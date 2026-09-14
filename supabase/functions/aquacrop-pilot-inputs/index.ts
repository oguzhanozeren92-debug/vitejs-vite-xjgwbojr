import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const INITIAL_WATER_MAX_AGE_DAYS = 14;
const AQUACROP_UPSTREAM_COMMIT = '36cc20e44644ed1704398889312435c85e04a2f3';

const CROP_MODEL_MAP: Record<string, string> = {
  wheat: 'Wheat',
  bugday: 'Wheat',
  barley: 'Barley',
  arpa: 'Barley',
  maize: 'Maize',
  corn: 'Maize',
  misir: 'Maize',
  cotton: 'Cotton',
  pamuk: 'Cotton',
  potato: 'Potato',
  patates: 'Potato',
};

const PERENNIAL_CROP_KEYS = new Set([
  'badem', 'almond', 'ceviz', 'walnut', 'kiraz', 'cherry', 'elma', 'apple',
  'armut', 'pear', 'zeytin', 'olive', 'uzum', 'grape', 'antepfistigi', 'pistachio',
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeKey(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '');
}

function ageDays(iso: string | null | undefined) {
  if (!iso) return null;
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (Date.now() - timestamp) / 86400000);
}

function resolveLocation(field: Record<string, unknown>) {
  const latitude = finite(field.parcel_centroid_lat ?? field.latitude);
  const longitude = finite(field.parcel_centroid_lng ?? field.longitude);
  if (
    latitude === null || longitude === null ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) return null;
  return { latitude, longitude };
}

async function authenticatedClients(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    throw new Error('AquaCrop pilot girdileri için sunucu kimlik bilgileri veya oturum eksik.');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error('AquaCrop pilot girdileri için geçerli kullanıcı oturumu gerekli.');
  return { user: data.user, serviceClient, supabaseUrl, serviceRoleKey };
}

async function loadSoilProfile(
  supabaseUrl: string,
  serviceRoleKey: string,
  location: { latitude: number; longitude: number } | null,
) {
  if (!location) {
    return {
      available: false,
      modelReady: false,
      source: null,
      profileDepthCm: 0,
      layers: [],
      detail: 'AquaCrop toprak profili için tarla koordinatı eksik.',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 65_000);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/aquacrop-soil-profile`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(location),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.ok === false) {
      return {
        available: false,
        modelReady: false,
        source: null,
        profileDepthCm: 0,
        layers: [],
        detail: payload?.error ?? `AquaCrop soil profile HTTP ${response.status}`,
      };
    }
    if (payload.input_authority !== 'server-derived' || payload.production_authority !== false) {
      throw new Error('AquaCrop soil profile trust boundary doğrulanamadı.');
    }
    return {
      available: Array.isArray(payload.layers) && payload.layers.length > 0,
      modelReady: Boolean(payload.model_ready),
      source: payload.source ?? null,
      profileDepthCm: Number(payload.profile_depth_cm ?? 0),
      layers: Array.isArray(payload.layers) ? payload.layers : [],
      assumptions: Array.isArray(payload.assumptions) ? payload.assumptions : [],
      warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
      generatedAt: String(payload.generated_at ?? ''),
      detail: payload.model_ready
        ? '0–200 cm SoilGrids katmanları AquaCrop uyumlu hidrolik profile dönüştürüldü.'
        : 'Toprak profili kısmi; 0–200 cm doğrulanmış pilot profil tamamlanmadı.',
    };
  } catch (error) {
    return {
      available: false,
      modelReady: false,
      source: null,
      profileDepthCm: 0,
      layers: [],
      detail: error instanceof Error ? error.message : 'AquaCrop soil profile adapter unavailable',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function resolveCropAdapter(field: any, season: any) {
  const rawCrop = String(season?.crop ?? field?.crop ?? '').trim();
  const cropKey = normalizeKey(rawCrop);
  const cropCycle = normalizeKey(field?.crop_cycle);
  const perennial = cropCycle.includes('perennial') || cropCycle.includes('cokyillik') || PERENNIAL_CROP_KEYS.has(cropKey);

  if (!rawCrop) {
    return {
      available: false,
      source: null,
      fieldCrop: null,
      modelCropKey: null,
      detail: 'Tarla için ürün kimliği eksik.',
    };
  }
  if (perennial) {
    return {
      available: false,
      source: 'fields.crop/field_seasons.crop',
      fieldCrop: rawCrop,
      modelCropKey: null,
      detail: 'Bu ürün çok yıllık; mevcut AquaCrop pilot kapsamına güvenli biçimde eşlenmedi.',
    };
  }

  const modelCropKey = CROP_MODEL_MAP[cropKey] ?? null;
  if (!modelCropKey) {
    return {
      available: false,
      source: 'fields.crop/field_seasons.crop',
      fieldCrop: rawCrop,
      modelCropKey: null,
      detail: 'Bu ürün için doğrulanmış AquaCrop built-in eşlemesi henüz tanımlı değil.',
    };
  }

  return {
    available: true,
    source: `aquacrop.entities.crops.crop_params@${AQUACROP_UPSTREAM_COMMIT}`,
    fieldCrop: rawCrop,
    modelCropKey,
    parameterAuthority: 'upstream-built-in',
    numericOverrides: false,
    detail: `${rawCrop} ürünü AquaCrop built-in ${modelCropKey} parametre setine doğrulanmış alias ile eşlendi.`,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const body = await req.json();
    const fieldId = String(body?.field_id ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    const { user, serviceClient, supabaseUrl, serviceRoleKey } = await authenticatedClients(req);
    const { data: field, error: fieldError } = await serviceClient
      .from('fields')
      .select('id,user_id,irrigation_status,area_decare,crop,crop_cycle,season,latitude,longitude,parcel_centroid_lat,parcel_centroid_lng')
      .eq('id', fieldId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya bu kullanıcıya ait değil.' }, 404);

    let seasonQuery = serviceClient
      .from('field_seasons')
      .select('id,year,crop,planting_date,harvest_date,created_at')
      .eq('user_id', user.id)
      .eq('field_id', fieldId)
      .order('year', { ascending: false })
      .limit(1);
    if (Number.isInteger(Number(field.season))) seasonQuery = seasonQuery.eq('year', Number(field.season));

    const [seasonResult, waterResult, managementResult, soilProfile] = await Promise.all([
      seasonQuery.maybeSingle(),
      serviceClient
        .from('field_water_measurements')
        .select('id,measured_at,volumetric_water_content,depth_from_cm,depth_to_cm,source')
        .eq('user_id', user.id)
        .eq('field_id', fieldId)
        .order('measured_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      serviceClient
        .from('field_aquacrop_management')
        .select('id,mode,settings,source,verified_at,updated_at')
        .eq('user_id', user.id)
        .eq('field_id', fieldId)
        .maybeSingle(),
      loadSoilProfile(supabaseUrl, serviceRoleKey, resolveLocation(field as Record<string, unknown>)),
    ]);

    for (const result of [seasonResult, waterResult, managementResult]) {
      if (result.error) throw result.error;
    }

    const cropParameters = resolveCropAdapter(field, seasonResult.data);

    const water = waterResult.data;
    const waterAgeDays = ageDays(water?.measured_at);
    const waterValue = finite(water?.volumetric_water_content);
    const waterDepthFrom = finite(water?.depth_from_cm);
    const waterDepthTo = finite(water?.depth_to_cm);
    const waterValid = Boolean(
      water && waterValue !== null && waterValue > 0 && waterValue < 1 &&
      waterDepthFrom !== null && waterDepthTo !== null && waterDepthTo > waterDepthFrom &&
      waterAgeDays !== null && waterAgeDays <= INITIAL_WATER_MAX_AGE_DAYS,
    );
    const initialWater = waterValid
      ? {
          available: true,
          source: 'field_water_measurements',
          measuredAt: String(water.measured_at),
          ageDays: Number(waterAgeDays!.toFixed(2)),
          volumetricWaterContent: waterValue,
          depthFromCm: waterDepthFrom,
          depthToCm: waterDepthTo,
          measurementSource: String(water.source),
        }
      : {
          available: false,
          source: water ? 'field_water_measurements' : null,
          measuredAt: water?.measured_at ? String(water.measured_at) : null,
          ageDays: waterAgeDays === null ? null : Number(waterAgeDays.toFixed(2)),
          detail: water
            ? `Toprak su ölçümü geçersiz veya ${INITIAL_WATER_MAX_AGE_DAYS} günlük pilot tazelik sınırının dışında.`
            : 'Doğrulanmış toprak su ölçümü yok.',
        };

    const irrigationStatus = normalizeKey(field.irrigation_status);
    const isRainfed = ['rainfed', 'susuz', 'dryland'].includes(irrigationStatus);
    const management = managementResult.data;
    const irrigationManagement = isRainfed
      ? {
          available: true,
          source: 'fields.irrigation_status',
          mode: 'rainfed',
          settings: {},
          verifiedAt: null,
          detail: 'Tarla susuz/rainfed kayıtlı; AquaCrop için sulamasız yönetim açıkça tanımlı.',
        }
      : management
        ? {
            available: true,
            source: 'field_aquacrop_management',
            mode: String(management.mode),
            settings: management.settings ?? {},
            verifiedAt: String(management.verified_at),
            managementSource: String(management.source),
          }
        : {
            available: false,
            source: null,
            mode: null,
            settings: null,
            verifiedAt: null,
            detail: 'Sulu/kısmi sulamalı tarla için doğrulanmış AquaCrop sulama yönetimi kaydı yok.',
          };

    const availableInputs: string[] = [];
    if (cropParameters.available) availableInputs.push('crop_parameters');
    if (soilProfile.modelReady) availableInputs.push('soil_profile');
    if (initialWater.available) availableInputs.push('initial_water_content');
    if (irrigationManagement.available) availableInputs.push('irrigation_management');

    const missingInputs = ['crop_parameters', 'soil_profile', 'initial_water_content', 'irrigation_management']
      .filter((key) => !availableInputs.includes(key));

    return json({
      ok: true,
      engine: 'aquacrop',
      mode: 'pilot-input-adapter',
      field_id: fieldId,
      production_authority: false,
      input_authority: 'server-derived',
      client_supplied_agricultural_values_accepted: false,
      available_inputs: availableInputs,
      missing_inputs: missingInputs,
      adapters: {
        crop_parameters: cropParameters,
        soil_profile: soilProfile,
        initial_water_content: initialWater,
        irrigation_management: irrigationManagement,
      },
      context: {
        planting_date: seasonResult.data?.planting_date ?? null,
        crop_identity: seasonResult.data?.crop ?? field.crop ?? null,
      },
      note: missingInputs.length === 0
        ? 'AquaCrop pilot için ürün, 0–200 cm toprak profili, başlangıç suyu ve sulama yönetimi gerçek/server-derived kaynaklarla hazır.'
        : 'Eksik AquaCrop girdileri için sentetik tarımsal değer üretilmedi; pilot bloklu kalır.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AquaCrop pilot input hazırlığı başarısız oldu.';
    console.error('[aquacrop-pilot-inputs]', message);
    const status = /oturum|kullanıcı/i.test(message) ? 401 : 500;
    return json({ ok: false, error: message }, status);
  }
});
