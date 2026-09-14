import { supabase } from '../supabaseClient';

export type SoilGridsPropertyKey =
  | 'phh2o'
  | 'soc'
  | 'clay'
  | 'sand'
  | 'silt';

export type SoilGridsDepth =
  | '0-5cm'
  | '5-15cm'
  | '15-30cm'
  | '30-60cm'
  | '60-100cm'
  | '100-200cm';

export type SoilGridsLayerValue = {
  property: SoilGridsPropertyKey;
  depth: SoilGridsDepth;
  rawValue: number | null;
  value: number | null;
  unit: string;
  coverageId: string;
  sourceUrl?: string;
};

export type SoilGridsPropertyProfile = {
  key: SoilGridsPropertyKey;
  label: string;
  unit: string;
  layers: SoilGridsLayerValue[];
  topsoil0To30: number | null;
};

export type SoilGridsProfile = {
  success: true;
  source: 'SoilGrids';
  provider: 'ISRIC — World Soil Information';
  product: 'SoilGrids250m 2.0';
  dataType: 'model-estimate';
  license: 'CC BY 4.0';
  spatialResolutionMeters: 250;
  requestedLatitude: number;
  requestedLongitude: number;
  generatedAt: string;
  properties: {
    ph: SoilGridsPropertyProfile;
    organicCarbon: SoilGridsPropertyProfile;
    clay: SoilGridsPropertyProfile;
    sand: SoilGridsPropertyProfile;
    silt: SoilGridsPropertyProfile;
  };
  texture: {
    clayPercent: number | null;
    sandPercent: number | null;
    siltPercent: number | null;
  };
  warnings: string[];
};

type SoilGridsErrorResponse = {
  success?: false;
  error?: string;
  warnings?: string[];
  debug?: {
    successfulLayers?: number;
    requestedLayers?: number;
  };
};

/**
 * Eski sürümlerde SoilGrids ayrıca localStorage cache kullanıyordu.
 * Artık bütün read-only harita verileri supabaseClient içindeki tek persistent
 * data bridge üzerinden geçtiği için ikinci cache katmanı kaldırıldı.
 *
 * Fonksiyon geriye dönük çağrılar kırılmasın diye tutuluyor; eski key'leri
 * temizler ama güncel cache'i yönetmez.
 */
export function clearSoilGridsCache() {
  if (typeof window === 'undefined') return;

  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith('tp_soilgrids_')) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Eski cache temizliği kritik değil.
  }
}

export async function fetchSoilGridsProfile(
  latitude: number,
  longitude: number,
  options?: {
    forceRefresh?: boolean;
    signal?: AbortSignal;
  },
): Promise<SoilGridsProfile> {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('SoilGrids için geçerli bir enlem gerekli.');
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('SoilGrids için geçerli bir boylam gerekli.');
  }

  if (!supabase) {
    throw new Error('SoilGrids için Supabase bağlantısı hazır değil.');
  }

  const { data, error } = await supabase.functions.invoke<
    SoilGridsProfile | SoilGridsErrorResponse
  >('soilgrids', {
    body: {
      latitude,
      longitude,
    },
    headers: options?.forceRefresh
      ? { 'x-tp-force-refresh': '1' }
      : undefined,
  });

  if (options?.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (error) {
    throw new Error(
      `SoilGrids sunucu isteği başarısız: ${error.message}`,
    );
  }

  if (!data || data.success !== true) {
    const failed = data as SoilGridsErrorResponse | null;

    const warningText =
      failed?.warnings?.length
        ? ` ${failed.warnings.slice(0, 2).join(' | ')}`
        : '';

    const debugText =
      failed?.debug
        ? ` (${failed.debug.successfulLayers ?? 0}/${failed.debug.requestedLayers ?? 15} katman)`
        : '';

    throw new Error(
      `${failed?.error ?? 'SoilGrids verisi alınamadı.'}${debugText}${warningText}`,
    );
  }

  return data;
}

export function getSoilGridsWmsBaseUrl(property: SoilGridsPropertyKey) {
  return `https://maps.isric.org/mapserv/${property}`;
}

export function getSoilGridsWmsLayerName(
  property: SoilGridsPropertyKey,
  depth: SoilGridsDepth,
  prediction: 'mean' | 'Q0.05' | 'Q0.5' | 'Q0.95' = 'mean',
) {
  return `${property}_${depth}_${prediction}`;
}

export async function testSoilGridsAtCoordinates(
  latitude: number,
  longitude: number,
) {
  clearSoilGridsCache();

  const result = await fetchSoilGridsProfile(latitude, longitude, {
    forceRefresh: true,
  });

  console.log('✅ SOILGRIDS EDGE TEST SONUCU', result);

  return result;
}
