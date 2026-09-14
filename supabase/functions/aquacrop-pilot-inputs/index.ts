import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const INITIAL_WATER_MAX_AGE_DAYS = 14;

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeTexture(value: any) {
  const sand = finite(value?.sandPercent ?? value?.sand ?? value?.sand_percent);
  const clay = finite(value?.clayPercent ?? value?.clay ?? value?.clay_percent);
  const silt = finite(value?.siltPercent ?? value?.silt ?? value?.silt_percent);
  if (sand === null || clay === null || silt === null) return null;
  if (sand < 0 || clay < 0 || silt < 0) return null;
  const total = sand + clay + silt;
  if (total <= 0 || total < 90 || total > 110) return null;
  return {
    sandPercent: Number(((sand / total) * 100).toFixed(2)),
    clayPercent: Number(((clay / total) * 100).toFixed(2)),
    siltPercent: Number(((silt / total) * 100).toFixed(2)),
  };
}

function calculateSaxtonRawls(texture: { sandPercent: number; clayPercent: number; siltPercent: number }) {
  const S = clamp(texture.sandPercent / 100, 0, 1);
  const C = clamp(texture.clayPercent / 100, 0, 1);
  const OM = 0;
  const theta1500t = -0.024 * S + 0.487 * C + 0.006 * OM + 0.005 * S * OM - 0.013 * C * OM + 0.068 * S * C + 0.031;
  const pwp = theta1500t + (0.14 * theta1500t - 0.02);
  const theta33t = -0.251 * S + 0.195 * C + 0.011 * OM + 0.006 * S * OM - 0.027 * C * OM + 0.452 * S * C + 0.299;
  const fc = theta33t + (1.283 * theta33t * theta33t - 0.374 * theta33t - 0.015);
  const safePwp = clamp(pwp, 0.02, 0.60);
  const safeFc = clamp(fc, safePwp + 0.01, 0.70);
  return {
    fieldCapacityVol: Number(safeFc.toFixed(4)),
    permanentWiltingPointVol: Number(safePwp.toFixed(4)),
    plantAvailableWaterFraction: Number((safeFc - safePwp).toFixed(4)),
    method: 'Saxton-Rawls-2006-texture-only',
    organicMatterAssumptionUsed: true,
  };
}

function ageDays(iso: string | null | undefined) {
  if (!iso) return null;
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (Date.now() - timestamp) / 86400000);
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
  return { user: data.user, serviceClient };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const body = await req.json();
    const fieldId = String(body?.field_id ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    const { user, serviceClient } = await authenticatedClients(req);
    const { data: field, error: fieldError } = await serviceClient
      .from('fields')
      .select('id,user_id,irrigation_status,area_decare')
      .eq('id', fieldId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya bu kullanıcıya ait değil.' }, 404);

    const [soilSnapshotResult, labResult, waterResult, managementResult] = await Promise.all([
      serviceClient
        .from('field_data_snapshots')
        .select('soil,captured_at')
        .eq('user_id', user.id)
        .eq('field_id', fieldId)
        .not('soil', 'is', null)
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      serviceClient
        .from('soil_analyses')
        .select('id,extracted_values,created_at')
        .eq('user_id', user.id)
        .eq('field_id', fieldId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
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
    ]);

    for (const result of [soilSnapshotResult, labResult, waterResult, managementResult]) {
      if (result.error) throw result.error;
    }

    const labTexture = normalizeTexture(labResult.data?.extracted_values?.texture ?? labResult.data?.extracted_values);
    const snapshotTexture = normalizeTexture(soilSnapshotResult.data?.soil?.texture);
    const texture = labTexture ?? snapshotTexture;
    const textureSource = labTexture
      ? 'soil_analyses.extracted_values'
      : snapshotTexture
        ? 'field_data_snapshots.soil.texture'
        : null;

    const soilCandidate = texture
      ? {
          available: true,
          modelReady: false,
          source: textureSource,
          texture,
          hydraulicEstimate: calculateSaxtonRawls(texture),
          detail: 'Gerçek/lokasyon-tabanlı tekstür bulundu. AquaCrop tam katman profili için saturation/Ksat/penetrability doğrulaması hâlâ gerekli.',
        }
      : {
          available: false,
          modelReady: false,
          source: null,
          texture: null,
          hydraulicEstimate: null,
          detail: 'AquaCrop toprak profili için kullanılabilir gerçek tekstür bulunamadı.',
        };

    const water = waterResult.data;
    const waterAgeDays = ageDays(water?.measured_at);
    const waterValid = Boolean(
      water &&
      finite(water.volumetric_water_content) !== null &&
      waterAgeDays !== null &&
      waterAgeDays <= INITIAL_WATER_MAX_AGE_DAYS,
    );
    const initialWater = waterValid
      ? {
          available: true,
          source: 'field_water_measurements',
          measuredAt: String(water.measured_at),
          ageDays: Number(waterAgeDays!.toFixed(2)),
          volumetricWaterContent: Number(water.volumetric_water_content),
          depthFromCm: Number(water.depth_from_cm),
          depthToCm: Number(water.depth_to_cm),
          measurementSource: String(water.source),
        }
      : {
          available: false,
          source: water ? 'field_water_measurements' : null,
          measuredAt: water?.measured_at ? String(water.measured_at) : null,
          ageDays: waterAgeDays === null ? null : Number(waterAgeDays.toFixed(2)),
          detail: water
            ? `Toprak su ölçümü ${INITIAL_WATER_MAX_AGE_DAYS} günlük pilot tazelik sınırının dışında.`
            : 'Doğrulanmış toprak su ölçümü yok.',
        };

    const irrigationStatus = String(field.irrigation_status ?? '').trim().toLowerCase();
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
    if (initialWater.available) availableInputs.push('initial_water_content');
    if (irrigationManagement.available) availableInputs.push('irrigation_management');
    // Soil candidate is intentionally NOT promoted yet; full AquaCrop layer adapter is incomplete.
    const missingInputs = ['soil_profile', 'initial_water_content', 'irrigation_management']
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
        soil_profile_candidate: soilCandidate,
        initial_water_content: initialWater,
        irrigation_management: irrigationManagement,
      },
      note: soilCandidate.available
        ? 'Toprak tekstürü ve hidrolik aday türetimi hazır; tam AquaCrop katman profili doğrulanana kadar soil_profile ready sayılmaz.'
        : 'Sentetik değer üretilmedi; eksik gerçek girdiler bloklanmaya devam ediyor.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AquaCrop pilot input hazırlığı başarısız oldu.';
    console.error('[aquacrop-pilot-inputs]', message);
    const status = /oturum|kullanıcı/i.test(message) ? 401 : 500;
    return json({ ok: false, error: message }, status);
  }
});
