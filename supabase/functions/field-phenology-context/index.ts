import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

function cleanDate(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);
  }

  try {
    const authorization = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!authorization || !supabaseUrl || !anonKey) {
      return json({ ok: false, error: 'Sunucu kimlik bilgileri veya oturum eksik.' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const fieldId = String(body?.field_id ?? '').trim();
    const currentDate = cleanDate(body?.current_date);

    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    if (
      'latitude' in body || 'longitude' in body || 'geometry' in body ||
      'crop' in body || 'crop_key' in body || 'planting_date' in body
    ) {
      return json({
        ok: false,
        error: 'Fenoloji bağlamında istemci koordinatı, ürün veya ekim tarihi kabul edilmez.',
      }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return json({ ok: false, error: 'Geçerli kullanıcı oturumu gerekli.' }, 401);
    }

    const { data: field, error: fieldError } = await userClient
      .from('fields')
      .select('id,user_id,name,crop,season,crop_cycle,planting_year,bearing,latitude,longitude,parcel_centroid_lat,parcel_centroid_lng')
      .eq('id', fieldId)
      .maybeSingle();

    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya kullanıcıya ait değil.' }, 404);

    const { data: seasons, error: seasonError } = await userClient
      .from('field_seasons')
      .select('id,year,crop,planting_date,harvest_date,created_at')
      .eq('field_id', fieldId)
      .order('year', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(3);

    if (seasonError) throw seasonError;

    const requestedYear = currentDate
      ? Number(currentDate.slice(0, 4))
      : new Date().getUTCFullYear();
    const seasonRows = Array.isArray(seasons) ? seasons : [];
    const activeSeason = seasonRows.find((row: any) => Number(row?.year) === requestedYear)
      ?? seasonRows.find((row: any) => !row?.harvest_date)
      ?? seasonRows[0]
      ?? null;

    const location = resolveLocation(field as Record<string, unknown>);
    const crop = String(activeSeason?.crop ?? field.crop ?? '').trim() || null;
    const plantingDate = cleanDate(activeSeason?.planting_date);
    const harvestDate = cleanDate(activeSeason?.harvest_date);

    const missingInputs: string[] = [];
    if (!location) missingInputs.push('field_location');
    if (!crop) missingInputs.push('crop');
    if (String(field.crop_cycle ?? '') === 'annual' && !plantingDate) {
      missingInputs.push('planting_date');
    }

    let climateShift: any = null;
    if (location) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/phenology-climate-shift`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: authorization,
            apikey: anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            latitude: location.latitude,
            longitude: location.longitude,
            cropKey: crop,
            currentDate,
          }),
        });
        climateShift = await response.json().catch(() => null);
        if (!response.ok || climateShift?.success === false) {
          climateShift = {
            success: false,
            status: 'unavailable',
            message: climateShift?.message ?? `phenology-climate-shift HTTP ${response.status}`,
          };
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    const stageStatus = harvestDate ? 'season_closed' : 'needs_data';
    const stageReason = harvestDate
      ? 'Bu sezon için gerçek hasat tarihi kayıtlı; aktif gelişim evresi üretilmez.'
      : 'Çeşit ve ürün-spesifik doğrulanmış gelişim modeli canlı karara bağlanmadığı için evre tahmini yapılmaz.';

    return json({
      ok: true,
      field_id: fieldId,
      production_authority: false,
      input_authority: 'server-derived',
      client_supplied_coordinates_accepted: false,
      field: {
        crop,
        crop_cycle: field.crop_cycle ?? null,
        season_year: activeSeason?.year ?? field.season ?? null,
        planting_date: plantingDate,
        harvest_date: harvestDate,
        planting_year: field.planting_year ?? null,
        bearing: field.bearing ?? null,
      },
      location_source: location?.source ?? null,
      thermal_calendar: climateShift,
      phenology_stage: {
        status: stageStatus,
        stage: null,
        bbch: null,
        confidence: 'low',
        reason: stageReason,
      },
      missing_inputs: missingInputs,
      evidence: [
        ...(activeSeason ? [{
          source: 'field_seasons',
          observed_at: activeSeason.created_at ?? null,
          finding: `Sezon ${activeSeason.year}; ekim ${plantingDate ?? 'kayıtlı değil'}; hasat ${harvestDate ?? 'kayıtlı değil'}.`,
        }] : []),
        ...(climateShift?.status === 'ready' ? [{
          source: 'ERA5-Land via Open-Meteo Historical API',
          observed_at: climateShift?.period?.to ?? null,
          finding: `Termal takvim kayması ${Number(climateShift.shiftDays ?? 0)} gün; sıcaklık anomalisi ${Number(climateShift.anomalyC ?? 0)} °C.`,
        }] : []),
      ],
      caution: 'Termal takvim kayması bir iklim sinyalidir; doğrulanmış ürün/çeşit fenoloji modeli veya saha gözlemi olmadan BBCH/gelişim evresi üretilmez.',
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[field-phenology-context]', error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : 'Fenoloji bağlamı hazırlanamadı.',
    }, 500);
  }
});
