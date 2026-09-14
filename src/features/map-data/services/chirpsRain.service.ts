import { supabase } from '../../../supabaseClient';

export type ChirpsRainDay = {
  date: string;
  value: number | null;
  unit: 'mm';
  quality: 'observed' | 'unavailable';
};

export type ChirpsRainResult = {
  ok: true;
  fieldId: string;
  productionAuthority: false;
  inputAuthority: 'server-derived';
  clientSuppliedGeometryAccepted: false;
  available: boolean;
  pending: boolean;
  source: string;
  provider: string;
  dataset: string;
  spatialScope: string;
  spatialResolutionDegrees: number | null;
  aggregation: string;
  period: {
    start: string;
    end: string;
    days: number;
  };
  daily: ChirpsRainDay[];
  stats: {
    totalMm: number;
    averageMm: number;
    validDayCount: number;
  } | null;
  providerJobId: string;
  generatedAt: string;
  missingInputs: string[];
  unavailableReason: string;
  note: string;
};

type LoadOptions = {
  days?: number;
  endDate?: string;
};

export async function loadChirpsRain(
  fieldIdInput: string,
  options: LoadOptions = {},
): Promise<ChirpsRainResult> {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) throw new Error('CHIRPS yağış verisi için tarla kimliği gerekli.');
  if (!supabase) throw new Error('CHIRPS yağış verisi için Supabase bağlantısı hazır değil.');

  const body: Record<string, unknown> = { field_id: fieldId };
  if (Number.isFinite(options.days)) {
    body.days = Math.max(1, Math.min(31, Math.round(Number(options.days))));
  }
  if (options.endDate) body.end_date = options.endDate;

  const { data, error } = await supabase.functions.invoke('field-chirps-rain', { body });
  if (error) throw new Error(error.message || 'CHIRPS yağış verisi alınamadı.');
  if (!data || data.ok === false) throw new Error(data?.error || 'CHIRPS yağış verisi hazırlanamadı.');

  if (data.production_authority !== false || data.input_authority !== 'server-derived') {
    throw new Error('CHIRPS sunucu otoritesi doğrulanamadı.');
  }
  if (data.client_supplied_geometry_accepted !== false) {
    throw new Error('CHIRPS geometri güvenlik sınırı doğrulanamadı.');
  }

  const daily: ChirpsRainDay[] = Array.isArray(data.daily)
    ? data.daily.map((row: any) => ({
        date: String(row?.date ?? ''),
        value: Number.isFinite(Number(row?.value)) ? Number(row.value) : null,
        unit: 'mm',
        quality: row?.quality === 'observed' ? 'observed' : 'unavailable',
      }))
    : [];

  const rawStats = data?.stats;
  const stats = rawStats && typeof rawStats === 'object'
    ? {
        totalMm: Number(rawStats.total_mm ?? 0),
        averageMm: Number(rawStats.average_mm ?? 0),
        validDayCount: Number(rawStats.valid_day_count ?? 0),
      }
    : null;

  return {
    ok: true,
    fieldId: String(data.field_id ?? fieldId),
    productionAuthority: false,
    inputAuthority: 'server-derived',
    clientSuppliedGeometryAccepted: false,
    available: Boolean(data.available),
    pending: Boolean(data.pending),
    source: String(data.source ?? 'UCSB CHIRPS via SERVIR ClimateSERV'),
    provider: String(data.provider ?? 'SERVIR ClimateSERV'),
    dataset: String(data.dataset ?? 'UCSB CHIRPS Rainfall'),
    spatialScope: String(data.spatial_scope ?? ''),
    spatialResolutionDegrees: Number.isFinite(Number(data.spatial_resolution_degrees))
      ? Number(data.spatial_resolution_degrees)
      : null,
    aggregation: String(data.aggregation ?? ''),
    period: {
      start: String(data?.period?.start ?? ''),
      end: String(data?.period?.end ?? ''),
      days: Number(data?.period?.days ?? 0),
    },
    daily,
    stats,
    providerJobId: String(data.provider_job_id ?? ''),
    generatedAt: String(data.generated_at ?? ''),
    missingInputs: Array.isArray(data.missing_inputs) ? data.missing_inputs.map(String) : [],
    unavailableReason: String(data.unavailable_reason ?? ''),
    note: String(data.note ?? ''),
  };
}
