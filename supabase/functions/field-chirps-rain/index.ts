import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CLIMATESERV_API = 'https://climateserv.servirglobal.net/api';
const CHIRPS_DATATYPE = '0';
const DAILY_INTERVAL = '0';
const AVERAGE_OPERATION = '5';
const MAX_DAYS = 31;
const DEFAULT_DAYS = 7;
const POLL_ATTEMPTS = 12;
const POLL_DELAY_MS = 750;

type ClimateServGranule = {
  date?: unknown;
  value?: Record<string, unknown> | null;
};

type RainDay = {
  date: string;
  value: number | null;
  unit: 'mm';
  quality: 'observed' | 'unavailable';
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

function validDate(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return Number.isFinite(Date.parse(`${text}T00:00:00Z`)) ? text : null;
}

function climateServDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-');
  return `${month}/${day}/${year}`;
}

function normalizeGranuleDate(value: unknown): string | null {
  const text = String(value ?? '').trim();
  const parts = text.split('/');
  if (parts.length !== 3) return null;
  const [monthRaw, dayRaw, yearRaw] = parts;
  const month = String(Number(monthRaw)).padStart(2, '0');
  const day = String(Number(dayRaw)).padStart(2, '0');
  const year = String(Number(yearRaw)).padStart(4, '0');
  const iso = `${year}-${month}-${day}`;
  return validDate(iso);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function unwrapGeometry(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const object = value as Record<string, unknown>;
  if (object.type === 'Feature' && object.geometry && typeof object.geometry === 'object') {
    return object.geometry as Record<string, unknown>;
  }
  if (object.type === 'Polygon' || object.type === 'MultiPolygon') return object;
  return null;
}

function geometryLatitudeRange(geometry: Record<string, unknown>) {
  const latitudes: number[] = [];
  const walk = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (
      value.length >= 2 &&
      Number.isFinite(Number(value[0])) &&
      Number.isFinite(Number(value[1]))
    ) {
      latitudes.push(Number(value[1]));
      return;
    }
    for (const child of value) walk(child);
  };
  walk(geometry.coordinates);
  if (!latitudes.length) return null;
  return {
    min: Math.min(...latitudes),
    max: Math.max(...latitudes),
  };
}

async function authenticatedClients(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    throw new Error('CHIRPS için sunucu kimlik bilgileri veya oturum eksik.');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error('CHIRPS için geçerli kullanıcı oturumu gerekli.');
  return { user: data.user, serviceClient };
}

async function submitChirpsRequest(
  geometry: Record<string, unknown>,
  startDate: string,
  endDate: string,
) {
  const body = new URLSearchParams({
    datatype: CHIRPS_DATATYPE,
    begintime: climateServDate(startDate),
    endtime: climateServDate(endDate),
    intervaltype: DAILY_INTERVAL,
    operationtype: AVERAGE_OPERATION,
    dateType_Category: 'default',
    isZip_CurrentDataType: 'false',
    geometry: JSON.stringify(geometry),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${CLIMATESERV_API}/submitDataRequest/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'TarlaPusula-CHIRPS/1.0',
      },
      body,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    const jobId = Array.isArray(payload) ? String(payload[0] ?? '') : '';
    if (!response.ok || !/^[0-9a-f-]{36}$/i.test(jobId)) {
      throw new Error(`ClimateSERV CHIRPS isteği başlatılamadı. HTTP ${response.status}`);
    }
    return jobId;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForChirps(jobId: string) {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const response = await fetch(
      `${CLIMATESERV_API}/getDataRequestProgress/?id=${encodeURIComponent(jobId)}`,
      { headers: { 'User-Agent': 'TarlaPusula-CHIRPS/1.0' } },
    );
    const payload = await response.json().catch(() => null);
    const progress = Array.isArray(payload) ? finite(payload[0]) : null;
    if (progress !== null && progress >= 100) return true;
    if (progress !== null && progress < 0) throw new Error('ClimateSERV CHIRPS işi hata verdi.');
    await sleep(POLL_DELAY_MS);
  }
  return false;
}

async function fetchChirpsResult(jobId: string): Promise<RainDay[]> {
  const response = await fetch(
    `${CLIMATESERV_API}/getDataFromRequest/?id=${encodeURIComponent(jobId)}`,
    { headers: { 'User-Agent': 'TarlaPusula-CHIRPS/1.0' } },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(payload?.data)) {
    throw new Error(`ClimateSERV CHIRPS sonucu alınamadı. HTTP ${response.status}`);
  }

  return (payload.data as ClimateServGranule[])
    .map((granule): RainDay | null => {
      const date = normalizeGranuleDate(granule.date);
      if (!date) return null;
      const valueObject = granule.value ?? {};
      const value = finite(valueObject.avg ?? valueObject.average);
      return {
        date,
        value,
        unit: 'mm',
        quality: value === null ? 'unavailable' : 'observed',
      };
    })
    .filter((row): row is RainDay => row !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function persistRows(
  serviceClient: any,
  userId: string,
  fieldId: string,
  rows: RainDay[],
) {
  const validRows = rows
    .filter((row) => row.value !== null)
    .map((row) => ({
      user_id: userId,
      field_id: fieldId,
      layer_key: 'rain',
      source_key: 'climateserv_chirps',
      data_date: row.date,
      value: row.value,
      unit: row.unit,
      quality: row.quality,
      source_metadata: {
        provider: 'UCSB CHIRPS via SERVIR ClimateSERV',
        datatype: 0,
        operation: 'field_polygon_average',
        spatial_resolution_degrees: 0.05,
        station_blended: true,
      },
      updated_at: new Date().toISOString(),
    }));
  if (!validRows.length) return;

  const { error } = await serviceClient
    .from('field_climate_layer_snapshots')
    .upsert(validRows, {
      onConflict: 'user_id,field_id,layer_key,source_key,data_date',
    });
  if (error) throw error;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Yalnız POST desteklenir.' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const fieldId = String(body?.field_id ?? '').trim();
    if (!fieldId) return json({ ok: false, error: 'field_id gerekli.' }, 400);

    const days = Math.min(MAX_DAYS, Math.max(1, Math.round(finite(body?.days) ?? DEFAULT_DAYS)));
    const requestedEnd = validDate(body?.end_date);
    const latestAllowedDate = dateDaysAgo(2);
    const endDate = requestedEnd && requestedEnd < latestAllowedDate ? requestedEnd : latestAllowedDate;
    const startDate = dateMinusDays(endDate, days - 1);

    const { user, serviceClient } = await authenticatedClients(req);
    const { data: field, error: fieldError } = await serviceClient
      .from('fields')
      .select('id,user_id,parcel_geometry')
      .eq('id', fieldId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (fieldError) throw fieldError;
    if (!field) return json({ ok: false, error: 'Tarla bulunamadı veya bu kullanıcıya ait değil.' }, 404);

    const geometry = unwrapGeometry(field.parcel_geometry);
    if (!geometry) {
      return json({
        ok: true,
        field_id: fieldId,
        production_authority: false,
        input_authority: 'server-derived',
        client_supplied_geometry_accepted: false,
        available: false,
        period: { start: startDate, end: endDate, days },
        missing_inputs: ['parcel_geometry'],
        source: 'UCSB CHIRPS via SERVIR ClimateSERV',
      });
    }

    const latRange = geometryLatitudeRange(geometry);
    if (!latRange || latRange.min < -50 || latRange.max > 50) {
      return json({
        ok: true,
        field_id: fieldId,
        production_authority: false,
        input_authority: 'server-derived',
        client_supplied_geometry_accepted: false,
        available: false,
        period: { start: startDate, end: endDate, days },
        source: 'UCSB CHIRPS via SERVIR ClimateSERV',
        source_scope: '50S-50N',
        unavailable_reason: 'field_outside_chirps_latitude_scope',
      });
    }

    const jobId = await submitChirpsRequest(geometry, startDate, endDate);
    const completed = await waitForChirps(jobId);
    if (!completed) {
      return json({
        ok: true,
        field_id: fieldId,
        production_authority: false,
        input_authority: 'server-derived',
        client_supplied_geometry_accepted: false,
        available: false,
        pending: true,
        source: 'UCSB CHIRPS via SERVIR ClimateSERV',
        period: { start: startDate, end: endDate, days },
        provider_job_id: jobId,
        note: 'ClimateSERV işi Edge Function bekleme penceresinde tamamlanmadı; sahte veya başka kaynak verisi CHIRPS olarak döndürülmedi.',
      }, 202);
    }

    const rows = await fetchChirpsResult(jobId);
    await persistRows(serviceClient, user.id, fieldId, rows);

    const validValues = rows
      .map((row) => row.value)
      .filter((value): value is number => value !== null && Number.isFinite(value));

    return json({
      ok: true,
      field_id: fieldId,
      production_authority: false,
      input_authority: 'server-derived',
      client_supplied_geometry_accepted: false,
      available: validValues.length > 0,
      source: 'UCSB CHIRPS via SERVIR ClimateSERV',
      provider: 'SERVIR ClimateSERV',
      dataset: 'UCSB CHIRPS Rainfall',
      datatype: 0,
      spatial_scope: 'stored_field_polygon',
      spatial_resolution_degrees: 0.05,
      aggregation: 'field_polygon_average',
      period: { start: startDate, end: endDate, days },
      daily: rows,
      stats: validValues.length
        ? {
            total_mm: Number(validValues.reduce((sum, value) => sum + value, 0).toFixed(3)),
            average_mm: Number((validValues.reduce((sum, value) => sum + value, 0) / validValues.length).toFixed(3)),
            valid_day_count: validValues.length,
          }
        : null,
      provider_job_id: jobId,
      generated_at: new Date().toISOString(),
      note: 'CHIRPS yalnız gerçek ClimateSERV sonucundan üretilir; başka yağış kaynağı CHIRPS adıyla gösterilmez.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'CHIRPS yağış verisi hazırlanamadı.';
    console.error('[field-chirps-rain]', message);
    const status = /oturum|kullanıcı/i.test(message) ? 401 : 502;
    return json({ ok: false, error: message, production_authority: false }, status);
  }
});
