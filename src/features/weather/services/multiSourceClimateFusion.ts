export type FusionConfidence = 'high' | 'medium' | 'limited';
export type FusionAgreement = 'agree' | 'moderate' | 'diverge' | 'single-source';

export type FusedClimateMetric = {
  value: number | null;
  method: 'weighted-fusion' | 'primary-with-reference' | 'single-source' | 'no-data';
  confidence: FusionConfidence;
  agreement: FusionAgreement;
  sources: Array<{
    name: 'ERA5' | 'NASA POWER';
    value: number;
    weight: number;
    role: 'primary' | 'reference';
  }>;
  difference: number | null;
};

type FusionOptions = {
  primaryWeight: number;
  referenceWeight: number;
  moderateDifference: number;
  divergenceDifference: number;
  decimals?: number;
  relativeDivergenceRatio?: number;
};

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rounded(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function fuseEra5AndNasa(
  era5Raw: unknown,
  nasaRaw: unknown,
  options: FusionOptions,
): FusedClimateMetric {
  const era5 = finite(era5Raw);
  const nasa = finite(nasaRaw);
  const decimals = options.decimals ?? 2;

  if (era5 === null && nasa === null) {
    return {
      value: null,
      method: 'no-data',
      confidence: 'limited',
      agreement: 'single-source',
      sources: [],
      difference: null,
    };
  }

  if (era5 === null || nasa === null) {
    const sourceName = era5 !== null ? 'ERA5' : 'NASA POWER';
    const value = era5 ?? nasa!;
    return {
      value: rounded(value, decimals),
      method: 'single-source',
      confidence: 'limited',
      agreement: 'single-source',
      sources: [
        {
          name: sourceName,
          value,
          weight: 1,
          role: sourceName === 'ERA5' ? 'primary' : 'reference',
        },
      ],
      difference: null,
    };
  }

  const difference = Math.abs(era5 - nasa);
  const scale = Math.max(Math.abs(era5), Math.abs(nasa), 1);
  const relativeDifference = difference / scale;
  const relativeDiverges =
    options.relativeDivergenceRatio !== undefined &&
    relativeDifference >= options.relativeDivergenceRatio;
  const diverges = difference >= options.divergenceDifference || relativeDiverges;

  const sources: FusedClimateMetric['sources'] = [
    {
      name: 'ERA5',
      value: era5,
      weight: options.primaryWeight,
      role: 'primary',
    },
    {
      name: 'NASA POWER',
      value: nasa,
      weight: options.referenceWeight,
      role: 'reference',
    },
  ];

  if (diverges) {
    // Kaynaklar ciddi biçimde ayrışıyorsa yapay bir orta değer üretip belirsizliği
    // gizlemiyoruz. Bölgesel reanalysis olan ERA5 karar değeri olarak korunur;
    // NASA POWER farkı güven/kanıt katmanında tutulur.
    return {
      value: rounded(era5, decimals),
      method: 'primary-with-reference',
      confidence: 'limited',
      agreement: 'diverge',
      sources,
      difference: rounded(difference, decimals),
    };
  }

  const totalWeight = options.primaryWeight + options.referenceWeight;
  const fused =
    (era5 * options.primaryWeight + nasa * options.referenceWeight) /
    totalWeight;

  const moderate = difference >= options.moderateDifference;
  return {
    value: rounded(fused, decimals),
    method: 'weighted-fusion',
    confidence: moderate ? 'medium' : 'high',
    agreement: moderate ? 'moderate' : 'agree',
    sources,
    difference: rounded(difference, decimals),
  };
}

export function fuseHistoricalTemperature(
  era5: unknown,
  nasaPower: unknown,
): FusedClimateMetric {
  return fuseEra5AndNasa(era5, nasaPower, {
    primaryWeight: 0.7,
    referenceWeight: 0.3,
    moderateDifference: 2,
    divergenceDifference: 4,
    decimals: 2,
  });
}

export function fuseHistoricalPrecipitation(
  era5: unknown,
  nasaPower: unknown,
): FusedClimateMetric {
  return fuseEra5AndNasa(era5, nasaPower, {
    primaryWeight: 0.75,
    referenceWeight: 0.25,
    moderateDifference: 7.5,
    divergenceDifference: 15,
    relativeDivergenceRatio: 0.6,
    decimals: 2,
  });
}

export function combineFusionConfidence(
  ...metrics: FusedClimateMetric[]
): FusionConfidence {
  if (metrics.some((metric) => metric.confidence === 'limited')) return 'limited';
  if (metrics.some((metric) => metric.confidence === 'medium')) return 'medium';
  return 'high';
}
