import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPEN_METEO_ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const NASA_POWER_DAILY = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const MAX_DAYS = 31;
const DEFAULT_DAYS = 7;
const ARCHIVE_LAG_DAYS = 5;
const ALLOWED_LAYERS = ['lst', 'et0', 'rain', 'frost'] as const;
type LayerKey = typeof ALLOWED_LAYERS[number];

type LayerDay = {
  date: string;
  value: number | null;
  unit: string;
  quality: 'observed' | 'reanalysis' | 'derived' | 'unavailable';
  metadata?: Record<string, unknown>;
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
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validDate(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return Number.isFinite(Date.parse(`${text}T00:00:00Z`)) ? text : null;
}

function formatPowerDate(date: string) {
  return date.replaceAll('-', '');
}

function readablePowerDate(date: string) {
  return date.length === 8
    ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
    : date;
}

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function dateMinusDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
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

async function authenticatedClients(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    throw new Error('İklim katmanları için sunucu kimlik bilgileri veya oturum eksik.');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error('İklim katmanları için geçerli kullanıcı oturumu gerekli.');
  return { user: data.user, serviceClient };
}

async function fetchEra5Land(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
) {
  const url = new URL(OPEN_METEO_ARCHIVE);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set(
    'daily',
    'temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration',
  );
  url.searchParams.set('timezone', 'UTC');
  url.searchParams.set('models', 'era5_land');
  url.searchParams.set('cell_selection', 'land');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TarlaPusula-ClimateLayers/1.0' },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.daily) {
      throw new Error(`ERA5-Land/Open-Meteo HTTP ${response.status}`);
    }
    return payload.daily;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchNasaSkinTemperature(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
): Promise<Map<string, number | null>> {
  const query = new URLSearchParams({
    parameters: 'TS',
    community: 'AG',
    longitude: String(longitude),
    latitude: String(latitude),
    start: formatPowerDate(startDate),
    end: formatPowerDate(endDate),
    format: 'JSON',
    'time-standard': 'UTC',
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`${NASA_POWER_DAILY}?${query.toString()}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TarlaPusula-ClimateLayers/1.0' },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.properties?.parameter?.TS) {
      throw new Error(`NASA POWER TS HTTP ${response.status}`);
    }

    const values = new Map<string, number | null>();
    for (const [rawDate, rawValue] of Object.entries(payload.properties.parameter.TS)) {
      const value = finite(rawValue);
      values.set(readablePowerDate(rawDate), value !== null && value > -900 ? value : null);
    }
    return values;
  } finally {
    clearTimeout(timeout);
  }
}

function layerDaysFromEra5(daily: any, key: 'et0' | 'rain' | 'frost'): LayerDay[] {
  const dates = Array.isArray(daily?.time) ? daily.time.map(String) : [];
  const sourceValues = key === 'et0'
    ? daily?.et0_fao_evapotranspiration
    : key === 'rain'
      ? daily?.precipitation_sum
      : daily?.temperature_2m_min;
  const values = Array.isArray(sourceValues) ? sourceValues : [];

  return dates.map((date: string, index: number) => {
    const value = finite(values[index]);
    if (key === 'frost') {
      return {
        date,
        value,
        unit: '°C',
        quality: value === null ? 'unavailable' : 'derived',
        metadata: value === null
          ? { frost_risk: null }
          : {
              frost_risk: value <= -2 ? 'high' : value <= 0 ? 'elevated' : 'low',
              threshold_c: 0,
            },
      };
    }
    return {
      date,
      value,
      unit: 'mm',
      quality: value === null ? 'unavailable' : key === 'et0' ? 'derived' : 'reanalysis',
    };
  });
}

async function persistLayerDays(
  serviceClient: any,
  userId: string,
  fieldId: string,
  layerKey: LayerKey,
  sourceKey: string,
  rows: LayerDay[],
  sourceMetadata: Record<string, unknown>,
) {
  const validRows = rows.filter((row) => row.value !== null).map((row) => ({
    user_id: userId,
    field_id: fieldId,
    layer_key: layerKey,
    source_key: sourceKey,
    data_date: row.date,
    value: row.value,
    unit: row.unit,
    quality: row.quality,
    source_metadata: {
      ...sourceMetadata,
      ...(row.metadata ?? {}),
    },
    updated_at: new Date().toISOString(),
  }));
  if (!validRows.length) return;

  const { error } = await serviceClient
    .from('field_climate_layer_snapshots')
    .upsert(validRows, {
      onConflict: 'user_id,field_id,layer_key,source_key,data_date',
    });
  if (error) console.error('[field-climate-layers] snapshot persistence:', error.message);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const fieldId = String(body?.field_id ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    const requestedLayers = Array.isArray(body?.layers)
      ? body.layers.map(String).filter((value: string): value is LayerKey => ALLOWED_LAYERS.includes(value as LayerKey))
      : [...ALLOWED_LAYERS];
    if (!requestedLayers.length) return json({ ok: false, error: 'Geçerli iklim katmanı seçilmedi.' }, 400);

    const days = Math.min(MAX_DAYS, Math.max(1, Math.round(finite(body?.days) ?? DEFAULT_DAYS)));
    const latestAllowedDate = dateDaysAgo(ARCHIVE_LAG_DAYS);
    const requestedEnd = validDate(body?.end_date);
    const endDate = requestedEnd && requestedEnd < latestAllowedDate ? requestedEnd : latestAllowedDate;
    const startDate = dateMinusDays(endDate, days - 1);

    const { user, serviceClient } = await authenticatedClients(req);
    const { data: field, error: fieldError } = await serviceClient
      .from('fields')
      .select('id,user_id,latitude,longitude,parcel_centroid_lat,parcel_centroid_lng')
      .eq('id', fieldId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya bu kullanıcıya ait değil.' }, 404);

    const location = resolveLocation(field as Record<string, unknown>);
    if (!location) {
      return json({
        ok: true,
        field_id: fieldId,
        production_authority: false,
        input_authority: 'server-derived',
        client_supplied_coordinates_accepted: false,
        period: { start: startDate, end: endDate },
        layers: {},
        missing_inputs: ['field_location'],
      });
    }

    const needEra = requestedLayers.some((key: LayerKey) => ['et0', 'rain', 'frost'].includes(key));
    const [eraResult, nasaResult] = await Promise.allSettled([
      needEra ? fetchEra5Land(location.latitude, location.longitude, startDate, endDate) : Promise.resolve(null),
      requestedLayers.includes('lst')
        ? fetchNasaSkinTemperature(location.latitude, location.longitude, startDate, endDate)
        : Promise.resolve(new Map<string, number | null>()),
    ]);

    const eraDaily = eraResult.status === 'fulfilled' ? eraResult.value : null;
    const nasaSkin = nasaResult.status === 'fulfilled' ? nasaResult.value : new Map<string, number | null>();
    const resultLayers: Record<string, unknown> = {};

    if (requestedLayers.includes('et0')) {
      const rows = eraDaily ? layerDaysFromEra5(eraDaily, 'et0') : [];
      resultLayers.et0 = {
        available: rows.some((row) => row.value !== null),
        metric: 'FAO-56 reference evapotranspiration (ET0)',
        unit: 'mm',
        source: 'Open-Meteo Historical Weather API',
        provider: 'ERA5-Land / ECMWF via Open-Meteo',
        source_kind: 'reanalysis-derived-et0',
        is_actual_crop_et: false,
        days: rows,
      };
      await persistLayerDays(serviceClient, user.id, fieldId, 'et0', 'open_meteo_era5_land_et0', rows, {
        provider: 'ERA5-Land / ECMWF via Open-Meteo',
        metric: 'FAO-56 ET0',
        actual_crop_et: false,
      });
    }

    if (requestedLayers.includes('rain')) {
      const rows = eraDaily ? layerDaysFromEra5(eraDaily, 'rain') : [];
      resultLayers.rain = {
        available: rows.some((row) => row.value !== null),
        metric: 'daily precipitation',
        unit: 'mm',
        source: 'Open-Meteo Historical Weather API',
        provider: 'ERA5-Land / ECMWF via Open-Meteo',
        source_kind: 'reanalysis-precipitation',
        days: rows,
        source_status: {
          primary: 'era5_land',
          chirps: 'adapter_not_connected',
          chirps_note: 'CHIRPS ayrı kaynak doğrulaması tamamlanana kadar ERA5-Land verisi CHIRPS olarak etiketlenmez.',
        },
      };
      await persistLayerDays(serviceClient, user.id, fieldId, 'rain', 'open_meteo_era5_land_precip', rows, {
        provider: 'ERA5-Land / ECMWF via Open-Meteo',
        chirps: false,
      });
    }

    if (requestedLayers.includes('frost')) {
      const rows = eraDaily ? layerDaysFromEra5(eraDaily, 'frost') : [];
      resultLayers.frost = {
        available: rows.some((row) => row.value !== null),
        metric: 'daily minimum 2m air temperature / frost risk',
        unit: '°C',
        source: 'Open-Meteo Historical Weather API',
        provider: 'ERA5-Land / ECMWF via Open-Meteo',
        source_kind: 'reanalysis-derived-frost-risk',
        days: rows,
      };
      await persistLayerDays(serviceClient, user.id, fieldId, 'frost', 'open_meteo_era5_land_tmin', rows, {
        provider: 'ERA5-Land / ECMWF via Open-Meteo',
        frost_threshold_c: 0,
      });
    }

    if (requestedLayers.includes('lst')) {
      const rows: LayerDay[] = [];
      for (let date = startDate; date <= endDate; date = dateMinusDays(date, -1)) {
        const value = nasaSkin.get(date) ?? null;
        rows.push({
          date,
          value,
          unit: '°C',
          quality: value === null ? 'unavailable' : 'reanalysis',
        });
      }
      resultLayers.lst = {
        available: rows.some((row) => row.value !== null),
        metric: 'Earth skin temperature (TS)',
        unit: '°C',
        source: 'NASA POWER',
        provider: 'NASA POWER / MERRA-2 family',
        source_kind: 'point-skin-temperature',
        days: rows,
        source_status: {
          current: 'nasa_power_ts_point',
          landsat_modis_raster: 'adapter_not_connected',
          note: 'Bu değer Landsat/MODIS raster LST değildir; NASA POWER TS açıkça ayrı kaynak olarak tutulur.',
        },
      };
      await persistLayerDays(serviceClient, user.id, fieldId, 'lst', 'nasa_power_ts', rows, {
        provider: 'NASA POWER',
        metric: 'Earth skin temperature TS',
        landsat_modis_raster: false,
      });
    }

    const missingSources: string[] = [];
    if (requestedLayers.includes('rain')) missingSources.push('chirps');
    if (requestedLayers.includes('lst')) missingSources.push('landsat_or_modis_lst_raster');

    return json({
      ok: true,
      field_id: fieldId,
      production_authority: false,
      input_authority: 'server-derived',
      client_supplied_coordinates_accepted: false,
      spatial_scope: 'field_centroid_point',
      location_source: location.source,
      period: { start: startDate, end: endDate, days },
      layers: resultLayers,
      missing_source_adapters: missingSources,
      generated_at: new Date().toISOString(),
      note: 'Yalnız gerçek kaynaklardan dönen değerler saklanır; eksik kaynaklar başka kaynak adıyla gösterilmez.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'İklim katmanları hazırlanamadı.';
    console.error('[field-climate-layers]', message);
    const status = /oturum|kullanıcı/i.test(message) ? 401 : 500;
    return json({ ok: false, error: message, production_authority: false }, status);
  }
});
