import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPEN_METEO_FORECAST = 'https://api.open-meteo.com/v1/forecast';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveLocation(field: Record<string, unknown>) {
  const latitude = finite(field.parcel_centroid_lat ?? field.latitude);
  const longitude = finite(field.parcel_centroid_lng ?? field.longitude);
  if (
    latitude === null || longitude === null ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) return null;

  return {
    latitude,
    longitude,
    source: field.parcel_centroid_lat != null && field.parcel_centroid_lng != null
      ? 'parcel_centroid'
      : 'field_coordinates',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const authorization = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ ok: false, error: 'Sunucu kimlik bilgileri veya oturum eksik.' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const fieldId = String(body?.field_id ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    if ('latitude' in body || 'longitude' in body || 'geometry' in body) {
      return json({
        ok: false,
        error: 'Risk hava verisinde istemci koordinatı/geometrisi kabul edilmez.',
      }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return json({ ok: false, error: 'Geçerli kullanıcı oturumu gerekli.' }, 401);
    }

    const { data: field, error: fieldError } = await serviceClient
      .from('fields')
      .select('id,user_id,latitude,longitude,parcel_centroid_lat,parcel_centroid_lng')
      .eq('id', fieldId)
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya kullanıcıya ait değil.' }, 404);

    const location = resolveLocation(field as Record<string, unknown>);
    if (!location) {
      return json({
        ok: true,
        field_id: fieldId,
        production_authority: false,
        input_authority: 'server-derived',
        client_supplied_coordinates_accepted: false,
        location_source: '',
        days: [],
        missing_inputs: ['field_location'],
        generated_at: new Date().toISOString(),
      });
    }

    const url = new URL(OPEN_METEO_FORECAST);
    url.searchParams.set('latitude', String(location.latitude));
    url.searchParams.set('longitude', String(location.longitude));
    url.searchParams.set('daily', 'temperature_2m_min,temperature_2m_max,precipitation_sum');
    url.searchParams.set('timezone', 'UTC');
    url.searchParams.set('forecast_days', '5');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    let payload: any;
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'TarlaPusula-FieldRisk/1.0' },
      });
      payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.daily) {
        throw new Error(`Open-Meteo HTTP ${response.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }

    const dates = Array.isArray(payload?.daily?.time) ? payload.daily.time : [];
    const mins = Array.isArray(payload?.daily?.temperature_2m_min) ? payload.daily.temperature_2m_min : [];
    const maxs = Array.isArray(payload?.daily?.temperature_2m_max) ? payload.daily.temperature_2m_max : [];
    const rain = Array.isArray(payload?.daily?.precipitation_sum) ? payload.daily.precipitation_sum : [];

    const days = dates.map((date: unknown, index: number) => ({
      date: String(date ?? ''),
      temperature_min_c: finite(mins[index]),
      temperature_max_c: finite(maxs[index]),
      precipitation_mm: finite(rain[index]),
    }));

    return json({
      ok: true,
      field_id: fieldId,
      production_authority: false,
      input_authority: 'server-derived',
      client_supplied_coordinates_accepted: false,
      location_source: location.source,
      provider: 'Open-Meteo Forecast API',
      days,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[field-risk-weather]', error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : 'Risk hava verisi hazırlanamadı.',
    }, 500);
  }
});
