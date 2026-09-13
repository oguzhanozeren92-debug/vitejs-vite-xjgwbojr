export const FIELD_DATA_AUTHORITY = {
  vegetation: {
    functionName: 'satellite-field-analysis',
    provider: 'Copernicus Data Space',
    product: 'Sentinel-2 L2A',
    defaultDays: 45,
    maxCloudCoverage: 30,
  },
  radar: {
    functionName: 'sentinel1-radar',
    provider: 'Copernicus Data Space',
    product: 'Sentinel-1 GRD',
    defaultDays: 30,
    radiusKm: 2,
  },
  soil: {
    functionName: 'soilgrids',
    provider: 'ISRIC',
    product: 'SoilGrids250m 2.0',
  },
  weatherDecision: {
    functionName: 'weather-compare',
    providers: ['ECMWF', 'GFS', 'DWD ICON'],
    product: 'TarlaPusula MultiSource Weather',
    rule:
      'Kullanıcı üç modeli görebilir; Home/Pusula/ilaçlama tek canonical karar snapshotını kullanır.',
  },
  climateHistoryFusion: {
    providers: ['ERA5-Land / ERA5', 'NASA POWER'],
    product: 'TarlaPusula Historical Climate Fusion',
    rule:
      'Metric-specific fusion: ERA5 ana reanalysis, NASA POWER bağımsız referans. Ciddi ayrışmada yapay ortalama üretilmez.',
  },
  climateLand: {
    functionName: 'era5-map',
    provider: 'ECMWF via Open-Meteo',
    product: 'ERA5-Land',
    defaultDays: 7,
  },
  climatePrecipitation: {
    functionName: 'era5-map',
    provider: 'ECMWF via Open-Meteo',
    product: 'ERA5',
    defaultDays: 7,
  },
  biodiversity: {
    functionName: 'field-biodiversity-context',
    provider: 'GBIF',
    product: 'Occurrence API',
    radiusKm: 25,
    lookbackYears: 5,
  },
} as const;

/**
 * Bu dosya TarlaPusula'nın veri otoritesi sözleşmesidir.
 *
 * Aynı kullanıcı gerçeği tek canonical kayıt noktasında yaşar.
 * Dış dünyadan ise birden fazla güvenilir kaynak gelebilir; ekranlar provider
 * seçmez, service/fusion/repository katmanının ürettiği tek tutarlı sonucu
 * kullanır. Kaynak/provenance ve güven bilgisi içeride korunur.
 *
 * NOT: Kullanıcının açıkça farklı dönem seçmesi (örn. radar 7 gün / 30 gün)
 * farklı bir sorgudur. Sadece ekran değiştirmek yeni sorgu değildir.
 */
export function canonicalRadarOptions(input?: {
  mode?: 'composite' | 'vv' | 'vh' | 'water';
  days?: number;
  radiusKm?: number;
}) {
  return {
    mode: input?.mode ?? 'composite',
    days: input?.days ?? FIELD_DATA_AUTHORITY.radar.defaultDays,
    // Aynı radar görünümünün Home ve UnifiedMap'te farklı bbox üretmesini
    // engellemek için radius kullanıcı seçimi değildir; merkezi sabittir.
    radiusKm: FIELD_DATA_AUTHORITY.radar.radiusKm,
  } as const;
}

export function canonicalBiodiversityOptions(input?: {
  radiusKm?: number;
  lookbackYears?: number;
  scientificNames?: string[];
  cropName?: string;
}) {
  return {
    radiusKm: input?.radiusKm ?? FIELD_DATA_AUTHORITY.biodiversity.radiusKm,
    lookbackYears:
      input?.lookbackYears ?? FIELD_DATA_AUTHORITY.biodiversity.lookbackYears,
    scientificNames: input?.scientificNames?.slice(0, 8),
    cropName: input?.cropName?.trim() || undefined,
  };
}
