import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const REQUIRED = ['daily_weather', 'crop_parameters', 'soil_parameters', 'site_parameters', 'agromanagement'] as const;
const ARCHIVE_LAG_DAYS = 5;
const WEATHER_VALIDATION_DAYS = 7;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDateDaysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function resolveLocation(field: Record<string, unknown>) {
  const latitude = finite(field.parcel_centroid_lat ?? field.latitude);
  const longitude = finite(field.parcel_centroid_lng ?? field.longitude);
  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

async function authenticatedClients(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    throw new Error('PCSE pilot girdileri için sunucu kimlik bilgileri veya oturum eksik.');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error('PCSE pilot girdileri için geçerli kullanıcı oturumu gerekli.');
  return { user: data.user, serviceClient };
}

async function validateDailyWeather(location: { latitude: number; longitude: number } | null) {
  if (!location) {
    return { available: false, source: null, days: 0, detail: 'Tarla koordinatı eksik.' };
  }

  const end = isoDateDaysAgo(ARCHIVE_LAG_DAYS);
  const start = isoDateDaysAgo(ARCHIVE_LAG_DAYS + WEATHER_VALIDATION_DAYS - 1);
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('start_date', start);
  url.searchParams.set('end_date', end);
  url.searchParams.set('daily', 'temperature_2m_min,temperature_2m_max,precipitation_sum,et0_fao_evapotranspiration');
  url.searchParams.set('timezone', 'UTC');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TarlaPusula-PCSE-Pilot/1.0' },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.daily) {
      return { available: false, source: 'Open-Meteo Archive', days: 0, detail: `Weather HTTP ${response.status}` };
    }

    const d = payload.daily;
    const dates = Array.isArray(d.time) ? d.time : [];
    const tmin = Array.isArray(d.temperature_2m_min) ? d.temperature_2m_min : [];
    const tmax = Array.isArray(d.temperature_2m_max) ? d.temperature_2m_max : [];
    const rain = Array.isArray(d.precipitation_sum) ? d.precipitation_sum : [];
    const et0 = Array.isArray(d.et0_fao_evapotranspiration) ? d.et0_fao_evapotranspiration : [];
    const valid = dates.length === WEATHER_VALIDATION_DAYS && [tmin, tmax, rain, et0].every((a) => a.length === dates.length)
      && dates.every((_: string, i: number) => {
        const lo = Number(tmin[i]);
        const hi = Number(tmax[i]);
        const p = Number(rain[i]);
        const e = Number(et0[i]);
        return Number.isFinite(lo) && Number.isFinite(hi) && hi >= lo && Number.isFinite(p) && p >= 0 && Number.isFinite(e) && e >= 0;
      });

    return {
      available: valid,
      source: 'Open-Meteo Archive',
      days: valid ? dates.length : 0,
      start,
      end,
      detail: valid ? 'Gerçek günlük hava serisi server tarafında doğrulandı.' : 'Günlük hava serisi eksik veya geçersiz.',
    };
  } catch (error) {
    return {
      available: false,
      source: 'Open-Meteo Archive',
      days: 0,
      detail: error instanceof Error ? error.message : 'Weather validation failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const fieldId = String(body?.field_id ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    const { user, serviceClient } = await authenticatedClients(req);
    const { data: field, error: fieldError } = await serviceClient
      .from('fields')
      .select('id,user_id,crop,season,latitude,longitude,parcel_centroid_lat,parcel_centroid_lng')
      .eq('id', fieldId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya bu kullanıcıya ait değil.' }, 404);

    const [seasonResult, paramsResult, weather] = await Promise.all([
      serviceClient
        .from('field_seasons')
        .select('id,year,crop,planting_date,harvest_date,created_at')
        .eq('user_id', user.id)
        .eq('field_id', fieldId)
        .order('year', { ascending: false })
        .limit(1)
        .maybeSingle(),
      serviceClient
        .from('field_pcse_parameter_sets')
        .select('id,parameter_kind,parameters,source,source_reference,verified_at,updated_at')
        .eq('user_id', user.id)
        .eq('field_id', fieldId),
      validateDailyWeather(resolveLocation(field as Record<string, unknown>)),
    ]);

    if (seasonResult.error) throw seasonResult.error;
    if (paramsResult.error) throw paramsResult.error;

    const records = Array.isArray(paramsResult.data) ? paramsResult.data : [];
    const byKind = new Map(records.map((row: any) => [String(row.parameter_kind), row]));
    const availableInputs: string[] = [];
    if (weather.available) availableInputs.push('daily_weather');

    const adapters: Record<string, unknown> = {
      daily_weather: weather,
    };

    for (const kind of ['crop_parameters', 'soil_parameters', 'site_parameters', 'agromanagement']) {
      const row = byKind.get(kind) as any;
      const validObject = row?.parameters && typeof row.parameters === 'object' && !Array.isArray(row.parameters) && Object.keys(row.parameters).length > 0;
      if (validObject) availableInputs.push(kind);
      adapters[kind] = validObject
        ? {
            available: true,
            source: row.source,
            sourceReference: row.source_reference ?? null,
            verifiedAt: row.verified_at,
            parameters: row.parameters,
          }
        : {
            available: false,
            source: null,
            parameters: null,
            detail: `${kind} için doğrulanmış gerçek PCSE parametre kaydı yok.`,
          };
    }

    const missingInputs = REQUIRED.filter((key) => !availableInputs.includes(key));

    return json({
      ok: true,
      engine: 'pcse',
      mode: 'pilot-input-adapter',
      field_id: fieldId,
      rollout: 'pilot',
      production_authority: false,
      input_authority: 'server-derived',
      client_supplied_agricultural_values_accepted: false,
      ready: missingInputs.length === 0,
      available_inputs: availableInputs,
      missing_inputs: missingInputs,
      adapters,
      context: {
        crop_identity: seasonResult.data?.crop ?? field.crop ?? null,
        planting_date: seasonResult.data?.planting_date ?? null,
        harvest_date: seasonResult.data?.harvest_date ?? null,
        season_year: seasonResult.data?.year ?? field.season ?? null,
      },
      note: missingInputs.length === 0
        ? 'PCSE/WOFOST pilot girdileri doğrulanmış server-side kaynaklarla hazır.'
        : 'Eksik PCSE/WOFOST girdileri için sentetik değer üretilmedi; pilot bloklu kalır.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PCSE pilot input hazırlığı başarısız oldu.';
    console.error('[pcse-pilot-inputs]', message);
    const status = /oturum|kullanıcı/i.test(message) ? 401 : 500;
    return json({ ok: false, error: message, production_authority: false }, status);
  }
});
