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

function normalizeParcelGeometry(geometry: any) {
  if (!geometry) return geometry;

  if (
    geometry.type === 'Feature' &&
    geometry.geometry &&
    ['Polygon', 'MultiPolygon'].includes(geometry.geometry.type)
  ) {
    return geometry;
  }

  if (['Polygon', 'MultiPolygon'].includes(geometry.type)) {
    return {
      type: 'Feature',
      properties: {},
      geometry,
    };
  }

  if (
    geometry.geometry &&
    ['Polygon', 'MultiPolygon'].includes(geometry.geometry.type)
  ) {
    return {
      type: 'Feature',
      properties: geometry.properties ?? {},
      geometry: geometry.geometry,
    };
  }

  return geometry;
}

function normalizeDates(value: unknown) {
  return [
    ...new Set<string>(
      (Array.isArray(value) ? value : []).filter(
        (date: unknown) =>
          typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date),
      ),
    ),
  ].sort().reverse();
}

async function requestAnalysis(
  geometry: unknown,
  options: Record<string, unknown>,
) {
  if (!supabase) throw new Error('Uydu servisine bağlanılamadı.');

  const { data, error } = await supabase.functions.invoke(
    'satellite-field-analysis',
    {
      body: {
        geometry: normalizeParcelGeometry(geometry),
        maxCloudCoverage: 30,
        ...options,
      },
    },
  );

  if (error) throw new Error('Uydu verisi alınamadı. Tekrar dene.');
  if (!data?.success) {
    throw new Error(data?.message ?? 'Uydu ölçümü bulunamadı.');
  }

  return data;
}

async function requestSceneListFallback(geometry: unknown) {
  if (!supabase) throw new Error('Uydu servisine bağlanılamadı.');

  const { data, error } = await supabase.functions.invoke(
    'satellite-scene-list',
    {
      body: {
        geometry: normalizeParcelGeometry(geometry),
        daysBack: 180,
        maxCloudCoverage: 35,
      },
    },
  );

  if (error || !data?.success) {
    throw new Error(data?.message ?? 'Uydu arşivi alınamadı. Tekrar dene.');
  }

  return normalizeDates(data.dates);
}

export async function listSatelliteDates(
  geometry: unknown,
): Promise<string[]> {
  try {
    // Tek otorite: aynı Copernicus akışı hem güncel NDVI'yi hem arşiv
    // tarihlerini üretir. Böylece ayrı bir catalog fonksiyonuna bağımlı kalmayız.
    const data = await requestAnalysis(geometry, {
      listScenes: true,
      daysBack: 180,
      maxCloudCoverage: 35,
    });

    const dates = normalizeDates(data.dates);
    if (dates.length) return dates;
  } catch {
    // Eski/bağımsız scene-list deployment'ı geriye dönük yedek olarak kalır.
  }

  return requestSceneListFallback(geometry);
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
