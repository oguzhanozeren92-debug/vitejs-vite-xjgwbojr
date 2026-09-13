import { supabase } from '../../../supabaseClient';
import type { SatelliteHealthResult } from '../../../lib/satelliteService';

async function request(geometry: unknown, options: Record<string, unknown>) {
  if (!supabase) throw new Error('Uydu servisine bağlanılamadı.');
  const { data, error } = await supabase.functions.invoke('satellite-field-analysis', {
    body: { geometry, maxCloudCoverage: 30, ...options },
  });
  if (error) throw new Error('Uydu verisi alınamadı. Tekrar dene.');
  if (!data?.success) throw new Error(data?.message ?? 'Uydu ölçümü bulunamadı.');
  return data;
}

export async function listSatelliteDates(geometry: unknown): Promise<string[]> {
  const data = await request(geometry, { listScenes: true, daysBack: 180 });
  return [...new Set<string>((Array.isArray(data.dates) ? data.dates : [])
    .filter((date: unknown) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort().reverse();
}

export async function fetchHistoricalSatellite(geometry: unknown, date: string): Promise<SatelliteHealthResult> {
  const data = await request(geometry, { imageDate: date });
  if (data.latestImageDate !== date || !data.ndviImage || data.ndviAverage == null) {
    throw new Error('Bu güne ait geçerli NDVI görüntüsü bulunamadı. Başka bir tarih seç.');
  }
  return data;
}
