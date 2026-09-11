import { supabase } from '../supabaseClient';

export type Sentinel1RadarMode =
  | 'composite'
  | 'vv'
  | 'vh'
  | 'water';

export type Sentinel1RadarResponse = {
  success: true;
  source: 'Copernicus Sentinel-1 GRD';
  provider: 'Copernicus Data Space Ecosystem / Sentinel Hub';
  mode: Sentinel1RadarMode;
  timeRange: {
    from: string;
    to: string;
    days: number;
  };
  processing: {
    acquisitionMode: string;
    polarization: string;
    resolution: string;
    orthorectified: boolean;
    backCoeff: string;
    demInstance: string;
  };
  bbox: [number, number, number, number];
  imageDataUrl: string;
  generatedAt: string;
  disclaimer: string;
};

type Sentinel1ErrorResponse = {
  success?: false;
  error?: string;
  detail?: string;
};

export async function fetchSentinel1Radar(
  latitude: number,
  longitude: number,
  options?: {
    mode?: Sentinel1RadarMode;
    days?: number;
    radiusKm?: number;
  },
): Promise<Sentinel1RadarResponse> {
  const { data, error } = await supabase.functions.invoke<
    Sentinel1RadarResponse | Sentinel1ErrorResponse
  >('sentinel1-radar', {
    body: {
      latitude,
      longitude,
      mode: options?.mode ?? 'composite',
      days: options?.days ?? 30,
      radiusKm: options?.radiusKm ?? 2,
    },
  });

  if (error) {
    throw new Error(
      `Sentinel-1 sunucu isteği başarısız: ${error.message}`,
    );
  }

  if (!data || data.success !== true) {
    const failed = data as Sentinel1ErrorResponse | null;

    throw new Error(
      [failed?.error ?? 'Sentinel-1 verisi alınamadı.', failed?.detail]
        .filter(Boolean)
        .join(' — '),
    );
  }

  return data;
}
