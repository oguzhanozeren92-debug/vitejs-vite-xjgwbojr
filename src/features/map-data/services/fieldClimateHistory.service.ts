import { supabase } from '../../../supabaseClient';
import type { FieldClimateLayerKey } from './fieldClimateLayers.service';

export type FieldClimateSnapshot = {
  layerKey: FieldClimateLayerKey;
  sourceKey: string;
  dataDate: string;
  value: number;
  unit: string;
  quality: string;
  sourceMetadata: Record<string, unknown>;
  updatedAt: string;
};

export type FieldClimateHistoryDate = {
  date: string;
  sources: string[];
};

type HistoryOptions = {
  sourceKey?: string;
  limit?: number;
};

function requireFieldId(value: string) {
  const fieldId = String(value ?? '').trim();
  if (!fieldId) throw new Error('İklim geçmişi için tarla kimliği gerekli.');
  return fieldId;
}

function normalizeLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 60;
  return Math.max(1, Math.min(366, Math.round(parsed)));
}

function normalizeRow(row: any): FieldClimateSnapshot | null {
  const value = Number(row?.value);
  const dataDate = String(row?.data_date ?? '').trim();
  const layerKey = String(row?.layer_key ?? '') as FieldClimateLayerKey;

  if (
    !['lst', 'et0', 'rain', 'frost'].includes(layerKey) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dataDate) ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  return {
    layerKey,
    sourceKey: String(row?.source_key ?? ''),
    dataDate,
    value,
    unit: String(row?.unit ?? ''),
    quality: String(row?.quality ?? ''),
    sourceMetadata:
      row?.source_metadata && typeof row.source_metadata === 'object'
        ? row.source_metadata
        : {},
    updatedAt: String(row?.updated_at ?? ''),
  };
}

export async function listFieldClimateHistoryDates(
  fieldIdInput: string,
  layerKey: FieldClimateLayerKey,
  options: HistoryOptions = {},
): Promise<FieldClimateHistoryDate[]> {
  const fieldId = requireFieldId(fieldIdInput);
  if (!supabase) throw new Error('İklim geçmişi için Supabase bağlantısı hazır değil.');

  let query = supabase
    .from('field_climate_layer_snapshots')
    .select('data_date,source_key')
    .eq('field_id', fieldId)
    .eq('layer_key', layerKey)
    .order('data_date', { ascending: false })
    .limit(normalizeLimit(options.limit));

  if (options.sourceKey) query = query.eq('source_key', options.sourceKey);

  const { data, error } = await query;
  if (error) throw error;

  const grouped = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const date = String((row as any)?.data_date ?? '');
    const source = String((row as any)?.source_key ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const sources = grouped.get(date) ?? new Set<string>();
    if (source) sources.add(source);
    grouped.set(date, sources);
  }

  return [...grouped.entries()]
    .map(([date, sources]) => ({ date, sources: [...sources].sort() }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function loadFieldClimateSnapshot(
  fieldIdInput: string,
  layerKey: FieldClimateLayerKey,
  dataDate: string,
  options: Pick<HistoryOptions, 'sourceKey'> = {},
): Promise<FieldClimateSnapshot[]> {
  const fieldId = requireFieldId(fieldIdInput);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataDate ?? ''))) {
    throw new Error('İklim geçmişi için YYYY-AA-GG biçiminde veri tarihi gerekli.');
  }
  if (!supabase) throw new Error('İklim geçmişi için Supabase bağlantısı hazır değil.');

  let query = supabase
    .from('field_climate_layer_snapshots')
    .select('layer_key,source_key,data_date,value,unit,quality,source_metadata,updated_at')
    .eq('field_id', fieldId)
    .eq('layer_key', layerKey)
    .eq('data_date', dataDate)
    .order('updated_at', { ascending: false });

  if (options.sourceKey) query = query.eq('source_key', options.sourceKey);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? [])
    .map(normalizeRow)
    .filter((row): row is FieldClimateSnapshot => row !== null);
}
