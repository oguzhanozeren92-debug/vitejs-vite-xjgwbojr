import { supabase } from '../../../supabaseClient';
import type { SatelliteHealthResult } from '../../../lib/satelliteService';

const HISTORY_PREVIEW_CACHE = new Map<string, string>();

export function cacheSatelliteHistoryPreview(date: string, image: string) {
  if (!date || !image) return;
  HISTORY_PREVIEW_CACHE.set(date, image);
}

export function getSatelliteHistoryPreview(date: string) {
  return HISTORY_PREVIEW_CACHE.get(date) ?? null;
}

export function clearSatelliteHistoryPreviewCache() {
  HISTORY_PREVIEW_CACHE.clear();
}

async function requestAnalysis(
  geometry: unknown,
  options: Record<string, unknown>,
) {
  if (!supabase) throw new Error('Uydu servisine bağlanılamadı.');

  const { data, error } = await supabase.functions.invoke(
    'satellite-field-analysis',
    {
      body: { geometry, maxCloudCoverage: 30, ...options },
    },
  );

  if (error) throw new Error('Uydu verisi alınamadı. Tekrar dene.');
  if (!data?.success) {
    throw new Error(data?.message ?? 'Uydu ölçümü bulunamadı.');
  }

  return data;
}

export async function listSatelliteDates(
  geometry: unknown,
): Promise<string[]> {
  if (!supabase) throw new Error('Uydu servisine bağlanılamadı.');

  const { data, error } = await supabase.functions.invoke(
    'satellite-scene-list',
    {
      body: {
        geometry,
        daysBack: 180,
        maxCloudCoverage: 35,
      },
    },
  );

  if (error) {
    throw new Error('Uydu arşivi alınamadı. Tekrar dene.');
  }

  if (!data?.success) {
    throw new Error(data?.message ?? 'Uydu arşivi alınamadı.');
  }

  return [
    ...new Set<string>(
      (Array.isArray(data.dates) ? data.dates : []).filter(
        (date: unknown) =>
          typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date),
      ),
    ),
  ].sort().reverse();
}

export async function fetchHistoricalSatellite(
  geometry: unknown,
  date: string,
): Promise<SatelliteHealthResult> {
  const data = await requestAnalysis(geometry, { imageDate: date });

  if (
    data.latestImageDate !== date ||
    !data.ndviImage ||
    data.ndviAverage == null
  ) {
    throw new Error(
      'Bu güne ait geçerli NDVI görüntüsü bulunamadı. Başka bir tarih seç.',
    );
  }

  cacheSatelliteHistoryPreview(date, data.ndviImage);
  return data;
}
