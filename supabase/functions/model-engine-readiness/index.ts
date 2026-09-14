import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPEN_METEO_ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';

const REQUIRED_INPUTS = {
  pcse: [
    'daily_weather',
    'crop_parameters',
    'soil_parameters',
    'site_parameters',
    'agromanagement',
  ],
  aquacrop: [
    'daily_weather',
    'crop_parameters',
    'soil_profile',
    'planting_date',
    'initial_water_content',
    'irrigation_management',
  ],
} as const;

const ROLLOUT = { pcse: 'pilot', aquacrop: 'pilot' } as const;

type Engine = keyof typeof REQUIRED_INPUTS;

type Evidence = {
  available: boolean;
  source: string | null;
  detail?: string | null;
};

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

function meaningfulObject(value: unknown) {
  return Boolean(value && typeof value === 'object' && Object.keys(value as Record<string, unknown>).length);
}

function collectCoordinates(value: unknown, sink: Array<[number, number]>) {
  if (!Array.isArray(value)) return;
  if (
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
  ) {
    const longitude = Number(value[0]);
    const latitude = Number(value[1]);
    if (
      longitude >= -180 && longitude <= 180 &&
      latitude >= -90 && latitude <= 90
    ) sink.push([longitude, latitude]);
    return;
  }
  for (const child of value) collectCoordinates(child, sink);
}

function resolveLocation(field: Record<string, unknown>) {
  const centroidLat = finite(field.parcel_centroid_lat);
  const centroidLng = finite(field.parcel_centroid_lng);
  if (
    centroidLat !== null && centroidLng !== null &&
    centroidLat >= -90 && centroidLat <= 90 &&
    centroidLng >= -180 && centroidLng <= 180
  ) {
    return { latitude: centroidLat, longitude: centroidLng, source: 'fields.parcel_centroid' };
  }

  const latitude = finite(field.latitude);
  const longitude = finite(field.longitude);
  if (
    latitude !== null && longitude !== null &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180
  ) {
    return { latitude, longitude, source: 'fields.coordinates' };
  }

  const geometry = (field.parcel_geometry as any)?.geometry ?? field.parcel_geometry;
  const points: Array<[number, number]> = [];
  collectCoordinates((geometry as any)?.coordinates, points);
  if (!points.length) return null;

  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [lng, lat] of points) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }

  return {
    latitude: (south + north) / 2,
    longitude: (west + east) / 2,
    source: 'fields.parcel_geometry',
  };
}

function isoDay(offsetDays: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function fetchWeatherEvidence(latitude: number, longitude: number): Promise<Evidence> {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(5),
    longitude: longitude.toFixed(5),
    start_date: isoDay(-7),
    end_date: isoDay(-1),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,shortwave_radiation_sum',
    timezone: 'UTC',
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${OPEN_METEO_ARCHIVE}?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      return { available: false, source: null, detail: `Open-Meteo archive HTTP ${response.status}` };
    }

    const payload = await response.json();
    const dates = Array.isArray(payload?.daily?.time) ? payload.daily.time : [];
    const tmax = Array.isArray(payload?.daily?.temperature_2m_max) ? payload.daily.temperature_2m_max : [];
    const tmin = Array.isArray(payload?.daily?.temperature_2m_min) ? payload.daily.temperature_2m_min : [];
    const rain = Array.isArray(payload?.daily?.precipitation_sum) ? payload.daily.precipitation_sum : [];
    const solar = Array.isArray(payload?.daily?.shortwave_radiation_sum) ? payload.daily.shortwave_radiation_sum : [];

    let completeDays = 0;
    dates.forEach((_: unknown, index: number) => {
      if (
        finite(tmax[index]) !== null &&
        finite(tmin[index]) !== null &&
        finite(rain[index]) !== null &&
        finite(solar[index]) !== null
      ) completeDays += 1;
    });

    return completeDays >= 3
      ? {
          available: true,
          source: 'Open-Meteo archive server-side',
          detail: `${completeDays} complete daily weather rows`,
        }
      : {
          available: false,
          source: null,
          detail: `Only ${completeDays} complete daily weather rows`,
        };
  } catch (error) {
    return {
      available: false,
      source: null,
      detail: error instanceof Error ? error.message : 'Weather evidence unavailable',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function authenticatedClients(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    throw new Error('Supabase sunucu kimlik bilgileri veya kullanıcı oturumu eksik.');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error('Model readiness için geçerli kullanıcı oturumu gerekli.');
  return { user: data.user, serviceClient };
}

async function loadCanonicalContext(serviceClient: any, userId: string, fieldId: string, field: any) {
  const currentSeason = Number.isInteger(Number(field?.season)) ? Number(field.season) : null;

  let seasonQuery = serviceClient
    .from('field_seasons')
    .select('id,year,crop,planting_date,harvest_date,created_at')
    .eq('user_id', userId)
    .eq('field_id', fieldId)
    .order('year', { ascending: false })
    .limit(1);
  if (currentSeason !== null) seasonQuery = seasonQuery.eq('year', currentSeason);

  const [seasonResult, soilResult, irrigationResult] = await Promise.all([
    seasonQuery.maybeSingle(),
    serviceClient
      .from('soil_analyses')
      .select('id,status,extracted_values,ai_result,created_at,updated_at')
      .eq('user_id', userId)
      .eq('field_id', fieldId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    serviceClient
      .from('activities')
      .select('id,activity_date,quantity,unit,notes,created_at')
      .eq('user_id', userId)
      .eq('field_id', fieldId)
      .eq('activity_type', 'Sulama')
      .order('activity_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (seasonResult.error) throw seasonResult.error;
  if (soilResult.error) throw soilResult.error;
  if (irrigationResult.error) throw irrigationResult.error;

  return {
    season: seasonResult.data ?? null,
    soilAnalysis: soilResult.data ?? null,
    lastIrrigation: irrigationResult.data ?? null,
  };
}

function unavailable(detail: string): Evidence {
  return { available: false, source: null, detail };
}

async function deriveEvidence(
  engine: Engine,
  field: Record<string, unknown>,
  canonical: {
    season: any;
    soilAnalysis: any;
    lastIrrigation: any;
  },
) {
  const location = resolveLocation(field);
  const weather = location
    ? await fetchWeatherEvidence(location.latitude, location.longitude)
    : unavailable('Field location missing');

  const plantingDate: Evidence = canonical.season?.planting_date
    ? {
        available: true,
        source: 'field_seasons.planting_date',
        detail: String(canonical.season.planting_date),
      }
    : unavailable('No real planting date recorded for the active/latest season');

  const cropIdentity: Evidence = String(canonical.season?.crop ?? field.crop ?? '').trim()
    ? {
        available: true,
        source: canonical.season?.crop ? 'field_seasons.crop' : 'fields.crop',
        detail: String(canonical.season?.crop ?? field.crop),
      }
    : unavailable('Crop identity missing');

  const irrigationStatus: Evidence = String(field.irrigation_status ?? '').trim()
    ? {
        available: true,
        source: 'fields.irrigation_status',
        detail: String(field.irrigation_status),
      }
    : unavailable('Irrigation status missing');

  const soilAnalysis: Evidence = canonical.soilAnalysis &&
    (meaningfulObject(canonical.soilAnalysis.extracted_values) || meaningfulObject(canonical.soilAnalysis.ai_result))
    ? {
        available: true,
        source: 'soil_analyses',
        detail: `analysis ${canonical.soilAnalysis.id}`,
      }
    : unavailable('No parsed soil analysis is available');

  const lastIrrigation: Evidence = canonical.lastIrrigation?.activity_date
    ? {
        available: true,
        source: 'activities.Sulama',
        detail: `${canonical.lastIrrigation.activity_date}${
          canonical.lastIrrigation.quantity != null
            ? ` · ${canonical.lastIrrigation.quantity} ${canonical.lastIrrigation.unit ?? ''}`.trim()
            : ''
        }`,
      }
    : unavailable('No irrigation operation recorded');

  // Important: contextual evidence is NOT silently promoted to model parameters.
  // A crop name is not a calibrated crop parameter set; a soil report is not yet a
  // PCSE/AquaCrop soil adapter; an irrigation operation is not an AquaCrop strategy.
  const evidence: Record<string, Evidence> = {
    daily_weather: weather,
    crop_parameters: unavailable('Canonical crop identity exists only as context; calibrated model crop parameters are not stored yet'),
    soil_parameters: unavailable('Soil analysis exists only as context; PCSE soil-parameter adapter is not implemented yet'),
    site_parameters: unavailable('Field coordinates are context only; PCSE site parameters are not stored yet'),
    agromanagement: unavailable('Planting date/crop context exists, but a complete PCSE agromanagement object is not stored yet'),
    soil_profile: unavailable('Soil analysis exists only as context; AquaCrop soil-profile adapter is not implemented yet'),
    planting_date: plantingDate,
    initial_water_content: unavailable('No measured/validated initial soil-water state is stored yet'),
    irrigation_management: unavailable('Irrigation status/history is context only; AquaCrop irrigation-management parameters are not stored yet'),
  };

  const availableInputs = REQUIRED_INPUTS[engine].filter((key) => evidence[key]?.available);
  const missingInputs = REQUIRED_INPUTS[engine].filter((key) => !evidence[key]?.available);

  return {
    availableInputs,
    missingInputs,
    evidence,
    context: {
      field_location: location
        ? { available: true, source: location.source }
        : { available: false, source: null },
      crop_identity: cropIdentity,
      irrigation_status: irrigationStatus,
      planting_date: plantingDate,
      soil_analysis: soilAnalysis,
      last_irrigation: lastIrrigation,
      note: 'Context records are exposed for adapter work but are not promoted to model-ready parameters without an explicit validated adapter.',
    },
  };
}

async function persistSnapshot(
  serviceClient: any,
  values: Record<string, unknown>,
) {
  const { error } = await serviceClient
    .from('model_engine_readiness_snapshots')
    .upsert(values, { onConflict: 'user_id,field_id,engine' });

  if (error) {
    console.warn('[model-engine-readiness] snapshot persistence failed', error.message);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const body = await req.json();
    const engine = String(body?.engine ?? '').trim() as Engine;
    const fieldId = String(body?.field_id ?? body?.payload?.field_id ?? '').trim();

    if (engine !== 'pcse' && engine !== 'aquacrop') {
      return json({ ok: false, error: 'Yalnız pcse veya aquacrop readiness desteklenir.' }, 400);
    }
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    const { user, serviceClient } = await authenticatedClients(req);
    const { data: field, error: fieldError } = await serviceClient
      .from('fields')
      .select('*')
      .eq('id', fieldId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya bu kullanıcıya ait değil.' }, 404);

    const canonical = await loadCanonicalContext(serviceClient, user.id, fieldId, field);
    const derived = await deriveEvidence(engine, field as Record<string, unknown>, canonical);
    const checkedAt = new Date().toISOString();
    const ready = derived.missingInputs.length === 0;

    const snapshotPersisted = await persistSnapshot(serviceClient, {
      user_id: user.id,
      field_id: fieldId,
      engine,
      rollout: ROLLOUT[engine],
      ready,
      available_inputs: derived.availableInputs,
      missing_inputs: derived.missingInputs,
      evidence: derived.evidence,
      context: derived.context,
      input_authority: 'server-derived',
      checked_at: checkedAt,
    });

    return json({
      ok: true,
      engine,
      field_id: fieldId,
      ready,
      available_inputs: derived.availableInputs,
      missing_inputs: derived.missingInputs,
      evidence: derived.evidence,
      context: derived.context,
      rollout: ROLLOUT[engine],
      production_authority: false,
      input_authority: 'server-derived',
      client_supplied_available_inputs_ignored: true,
      checked_at: checkedAt,
      snapshot_persisted: snapshotPersisted,
      note: ready
        ? 'Gerçek sunucu verileri gerekli readiness sözleşmesini karşılıyor; pilot çalıştırma ayrıca kontrollü etkinleştirilmelidir.'
        : 'Eksik girdiler için sentetik değer üretilmedi. Gerçek tarla/model parametreleri ve doğrulanmış adapterlar tamamlanmadan motor çalıştırılmaz.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Model readiness isteği başarısız oldu.';
    console.error('[model-engine-readiness]', message);
    const status = /oturum|kullanıcı/i.test(message) ? 401 : 500;
    return json({ ok: false, error: message }, status);
  }
});
