import { supabase } from '../../../supabaseClient';
import type {
  SatelliteFusionErrorResponse,
  SatelliteFusionResponse,
} from '../types/satelliteFusion';

type SatelliteFusionOptions = {
  daysBack?: number;
  maxCloudCoverage?: number;
  forceRefresh?: boolean;
};

/**
 * Satellite fusion artık kendi memory cache'ini tutmaz.
 * Bütün read-only katman istekleri supabaseClient içindeki tek data bridge
 * üzerinden geçer; Home ve diğer ekranlar aynı snapshot'ı kullanır.
 */
export async function fetchFieldSatelliteFusion(
  geometry: unknown,
  options?: SatelliteFusionOptions,
): Promise<SatelliteFusionResponse> {
  if (!geometry) {
    throw new Error(
      'Sentinel fusion için parsel geometrisi bulunamadı.',
    );
  }

  if (!supabase) {
    throw new Error('Sentinel fusion için Supabase bağlantısı hazır değil.');
  }

  const { data, error } = await supabase.functions.invoke<
    SatelliteFusionResponse | SatelliteFusionErrorResponse
  >('field-satellite-fusion', {
    body: {
      geometry,
      daysBack: options?.daysBack ?? 90,
      maxCloudCoverage:
        options?.maxCloudCoverage ?? 35,
    },
    headers: options?.forceRefresh
      ? { 'x-tp-force-refresh': '1' }
      : undefined,
  });

  if (error) {
    throw new Error(
      `Sentinel fusion isteği başarısız: ${error.message}`,
    );
  }

  if (!data || data.success !== true) {
    const failed =
      data as SatelliteFusionErrorResponse | null;

    throw new Error(
      failed?.message ??
        failed?.error ??
        'Sentinel-1 + Sentinel-2 fusion verisi alınamadı.',
    );
  }

  return data;
}
