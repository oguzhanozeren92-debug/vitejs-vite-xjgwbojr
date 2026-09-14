import { supabase } from '../../../supabaseClient';

export type FieldClimateLayerKey = 'lst' | 'et0' | 'rain' | 'frost';

export type FieldClimateLayerDay = {
  date: string;
  value: number | null;
  unit: string;
  quality: 'observed' | 'reanalysis' | 'derived' | 'unavailable';
  metadata?: Record<string, unknown>;
};

export type FieldClimateLayer = {
  available: boolean;
  metric: string;
  unit: string;
  source: string;
  provider: string;
  source_kind: string;
  days: FieldClimateLayerDay[];
  [key: string]: unknown;
};

export type FieldClimateLayersResult = {
  ok: true;
  fieldId: string;
  productionAuthority: false;
  inputAuthority: 'server-derived';
  clientSuppliedCoordinatesAccepted: false;
  spatialScope: 'field_centroid_point';
  locationSource: string;
  period: {
    start: string;
    end: string;
    days: number;
  };
  layers: Partial<Record<FieldClimateLayerKey, FieldClimateLayer>>;
  missingSourceAdapters: string[];
  generatedAt: string;
  note: string;
};

type LoadOptions = {
  days?: number;
  endDate?: string;
  layers?: FieldClimateLayerKey[];
};

export async function loadFieldClimateLayers(
  fieldIdInput: string,
  options: LoadOptions = {},
): Promise<FieldClimateLayersResult> {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) throw new Error('İklim katmanları için tarla kimliği gerekli.');
  if (!supabase) throw new Error('İklim katmanları için Supabase bağlantısı hazır değil.');

  const body: Record<string, unknown> = { field_id: fieldId };
  if (Number.isFinite(options.days)) body.days = Math.max(1, Math.min(31, Math.round(Number(options.days))));
  if (options.endDate) body.end_date = options.endDate;
  if (options.layers?.length) body.layers = options.layers;

  const { data, error } = await supabase.functions.invoke('field-climate-layers', { body });
  if (error) throw new Error(error.message || 'İklim katmanları alınamadı.');
  if (!data || data.ok === false) throw new Error(data?.error || 'İklim katmanları hazırlanamadı.');
  if (data.production_authority !== false || data.input_authority !== 'server-derived') {
    throw new Error('İklim katmanı sunucu otoritesi doğrulanamadı.');
  }
  if (data.client_supplied_coordinates_accepted !== false) {
    throw new Error('İklim katmanı koordinat güvenlik sınırı doğrulanamadı.');
  }

  const normalizedLayers: Partial<Record<FieldClimateLayerKey, FieldClimateLayer>> = {};
  for (const key of ['lst', 'et0', 'rain', 'frost'] as const) {
    const layer = data?.layers?.[key];
    if (!layer || typeof layer !== 'object') continue;
    normalizedLayers[key] = {
      ...layer,
      available: Boolean(layer.available),
      metric: String(layer.metric ?? ''),
      unit: String(layer.unit ?? ''),
      source: String(layer.source ?? ''),
      provider: String(layer.provider ?? ''),
      source_kind: String(layer.source_kind ?? ''),
      days: Array.isArray(layer.days)
        ? layer.days.map((day: any) => ({
            date: String(day?.date ?? ''),
            value: Number.isFinite(Number(day?.value)) ? Number(day.value) : null,
            unit: String(day?.unit ?? layer.unit ?? ''),
            quality: ['observed', 'reanalysis', 'derived', 'unavailable'].includes(String(day?.quality))
              ? day.quality
              : 'unavailable',
            ...(day?.metadata && typeof day.metadata === 'object' ? { metadata: day.metadata } : {}),
          }))
        : [],
    } as FieldClimateLayer;
  }

  return {
    ok: true,
    fieldId: String(data.field_id ?? fieldId),
    productionAuthority: false,
    inputAuthority: 'server-derived',
    clientSuppliedCoordinatesAccepted: false,
    spatialScope: 'field_centroid_point',
    locationSource: String(data.location_source ?? ''),
    period: {
      start: String(data?.period?.start ?? ''),
      end: String(data?.period?.end ?? ''),
      days: Number(data?.period?.days ?? 0),
    },
    layers: normalizedLayers,
    missingSourceAdapters: Array.isArray(data.missing_source_adapters)
      ? data.missing_source_adapters.map(String)
      : [],
    generatedAt: String(data.generated_at ?? ''),
    note: String(data.note ?? ''),
  };
}
