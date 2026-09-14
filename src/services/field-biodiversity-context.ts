import { supabase } from '../supabaseClient';
import { canonicalBiodiversityOptions } from '../features/data-bridge/dataAuthority';

export type GbifPestObservation = {
  gbifId: string;
  scientificName: string;
  commonLabelTr: string;
  observedAt: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  coordinateUncertaintyM: number | null;
  basisOfRecord: string | null;
  datasetTitle: string | null;
};

export type FieldBiodiversityContextResponse = {
  success: true;
  generatedAt: string;
  source: 'GBIF Occurrence API';
  radiusKm: number;
  lookbackYears: number;
  cropName: string | null;
  candidateCount: number;
  queriedPests: Array<{ scientificName: string; commonLabelTr: string }>;
  observations: GbifPestObservation[];
  summary: {
    totalObservations: number;
    distinctPestCandidates: number;
    nearestDistanceKm: number | null;
    newestObservationAt: string | null;
  };
  warnings: string[];
};

type FailedResponse = {
  success?: false;
  error?: string;
  detail?: string;
};

export async function fetchFieldBiodiversityContext(
  latitude: number,
  longitude: number,
  options?: {
    radiusKm?: number;
    lookbackYears?: number;
    scientificNames?: string[];
    cropName?: string;
    forceRefresh?: boolean;
  },
): Promise<FieldBiodiversityContextResponse> {
  if (!supabase) {
    throw new Error('GBIF saha bağlamı için Supabase bağlantısı hazır değil.');
  }

  const canonical = canonicalBiodiversityOptions(options);

  const { data, error } = await supabase.functions.invoke<
    FieldBiodiversityContextResponse | FailedResponse
  >('field-biodiversity-context', {
    body: {
      latitude,
      longitude,
      radiusKm: canonical.radiusKm,
      lookbackYears: canonical.lookbackYears,
      scientificNames: canonical.scientificNames,
      cropName: canonical.cropName,
    },
    headers: options?.forceRefresh
      ? { 'x-tp-force-refresh': '1' }
      : undefined,
  });

  if (error) {
    throw new Error(`GBIF saha bağlamı alınamadı: ${error.message}`);
  }

  if (!data || data.success !== true) {
    const failed = data as FailedResponse | null;
    throw new Error(
      [failed?.error ?? 'GBIF saha bağlamı alınamadı.', failed?.detail]
        .filter(Boolean)
        .join(' — '),
    );
  }

  return data;
}
