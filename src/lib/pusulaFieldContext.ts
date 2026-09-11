import type { Field } from '../types';
import { fetchSoilGridsProfile } from '../services/soilGridsService';
import { fetchDemTerrainProfile } from '../services/demService';

export type PusulaEvidencePriority =
  | 'authoritative'
  | 'observed'
  | 'current_remote'
  | 'forecast'
  | 'reanalysis'
  | 'model_context';

export type PusulaSourceState =
  | 'ready'
  | 'partial'
  | 'unavailable'
  | 'not_requested';

export type PusulaEvidence = {
  source: string;
  priority: PusulaEvidencePriority;
  state: PusulaSourceState;
  observedAt?: string | null;
  confidence?: 'high' | 'medium' | 'low';
  notes?: string[];
};

export type PusulaFieldContext = {
  schemaVersion: 1;
  generatedAt: string;
  field: {
    id: string;
    name: string | null;
    crop: string | null;
    plantingDate: string | null;
    areaDa: number | null;
    village: string | null;
    district: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
  };

  userGroundTruth: {
    soilAnalysisAvailable: boolean;
    note:
      | 'Gerçek laboratuvar/saha verisi varsa model tahminlerinden önceliklidir.'
      | string;
  };

  weather: {
    locationLabel: string | null;
    current: unknown;
    forecast: unknown[];
    evidence: PusulaEvidence;
  };

  satellite: {
    ndviMean: number | null;
    healthScore: number | null;
    sceneDate: string | null;
    summary: string | null;
    evidence: PusulaEvidence;
  } | null;

  climate: {
    raw: unknown;
    evidence: PusulaEvidence;
  } | null;

  soilModel: {
    ph0To30: number | null;
    organicCarbonGKg0To30: number | null;
    clayPercent: number | null;
    sandPercent: number | null;
    siltPercent: number | null;
    warnings: string[];
    evidence: PusulaEvidence;
  } | null;

  terrain: {
    elevationM: number | null;
    minElevationM: number | null;
    maxElevationM: number | null;
    reliefM: number | null;
    averageSlopeDeg: number | null;
    maxSlopeDeg: number | null;
    dominantAspect: string | null;
    evidence: PusulaEvidence;
  } | null;

  radar: {
    status: 'map_available_metrics_pending';
    note: string;
    evidence: PusulaEvidence;
  };

  gamification: {
    points: number;
  };

  decisionPolicy: {
    sourcePriority: string[];
    neverBlindAverage: true;
    disagreementMeansUncertainty: true;
    farmerFacingRule: string;
  };

  sourceHealth: {
    ready: string[];
    partial: string[];
    unavailable: string[];
  };
};

type BuildArgs = {
  field: Field | Record<string, any>;
  locationLabel?: string | null;
  currentWeather?: unknown;
  forecast?: unknown[];
  satelliteData?: any;
  unifiedClimateContext?: unknown;
  gamificationPoints?: number;
  loadExtended?: boolean;
};

const CACHE_PREFIX = 'tp_pusula_extended_context_v1:';
const EXTENDED_CACHE_MS = 6 * 60 * 60 * 1000;

function finite(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function fieldCoordinates(field: any) {
  const latitude = finite(
    field?.parcelCentroidLat ??
      field?.latitude ??
      field?.lat,
  );
  const longitude = finite(
    field?.parcelCentroidLng ??
      field?.longitude ??
      field?.lng ??
      field?.lon,
  );

  if (latitude === null || longitude === null) return null;

  return { latitude, longitude };
}

function readExtendedCache(fieldId: string) {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(
      `${CACHE_PREFIX}${fieldId}`,
    );
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      soilModel?: PusulaFieldContext['soilModel'];
      terrain?: PusulaFieldContext['terrain'];
    };

    if (!parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > EXTENDED_CACHE_MS) return null;

    return parsed;
  } catch {
    return null;
  }
}

function writeExtendedCache(
  fieldId: string,
  value: {
    soilModel: PusulaFieldContext['soilModel'];
    terrain: PusulaFieldContext['terrain'];
  },
) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      `${CACHE_PREFIX}${fieldId}`,
      JSON.stringify({
        savedAt: Date.now(),
        ...value,
      }),
    );
  } catch {
    // Cache yalnızca optimizasyon.
  }
}

async function loadExtendedContext(
  fieldId: string,
  latitude: number,
  longitude: number,
) {
  const cached = readExtendedCache(fieldId);

  if (cached?.soilModel || cached?.terrain) {
    return {
      soilModel: cached.soilModel ?? null,
      terrain: cached.terrain ?? null,
    };
  }

  const [soilResult, terrainResult] = await Promise.allSettled([
    fetchSoilGridsProfile(latitude, longitude),
    fetchDemTerrainProfile(latitude, longitude, {
      gridSize: 7,
      stepMeters: 90,
    }),
  ]);

  const soilModel: PusulaFieldContext['soilModel'] =
    soilResult.status === 'fulfilled'
      ? {
          ph0To30:
            soilResult.value.properties.ph.topsoil0To30,
          organicCarbonGKg0To30:
            soilResult.value.properties.organicCarbon.topsoil0To30,
          clayPercent:
            soilResult.value.texture.clayPercent,
          sandPercent:
            soilResult.value.texture.sandPercent,
          siltPercent:
            soilResult.value.texture.siltPercent,
          warnings: soilResult.value.warnings ?? [],
          evidence: {
            source: 'ISRIC SoilGrids250m 2.0',
            priority: 'model_context',
            state:
              soilResult.value.warnings?.length
                ? 'partial'
                : 'ready',
            confidence: 'low',
            notes: [
              '250 m model tahminidir.',
              'Laboratuvar sonucu varsa laboratuvar verisi önceliklidir.',
            ],
          },
        }
      : null;

  const terrain: PusulaFieldContext['terrain'] =
    terrainResult.status === 'fulfilled'
      ? {
          elevationM:
            terrainResult.value.stats.centerElevationM,
          minElevationM:
            terrainResult.value.stats.minElevationM,
          maxElevationM:
            terrainResult.value.stats.maxElevationM,
          reliefM:
            terrainResult.value.stats.reliefM,
          averageSlopeDeg:
            terrainResult.value.stats.averageSlopeDeg,
          maxSlopeDeg:
            terrainResult.value.stats.maxSlopeDeg,
          dominantAspect:
            terrainResult.value.stats.dominantAspect,
          evidence: {
            source: 'Copernicus DEM GLO-90',
            priority: 'model_context',
            state: 'ready',
            confidence: 'medium',
            notes: [
              'Yaklaşık 90 m sayısal yükseklik modeli.',
              'RTK/GNSS veya hassas tesviye ölçümü değildir.',
            ],
          },
        }
      : null;

  writeExtendedCache(fieldId, {
    soilModel,
    terrain,
  });

  return { soilModel, terrain };
}

export async function buildPusulaFieldContext({
  field,
  locationLabel = null,
  currentWeather = null,
  forecast = [],
  satelliteData = null,
  unifiedClimateContext = null,
  gamificationPoints = 0,
  loadExtended = true,
}: BuildArgs): Promise<PusulaFieldContext> {
  const fieldId = String((field as any)?.id ?? '').trim();

  if (!fieldId) {
    throw new Error('PusulaFieldContext için tarla kimliği gerekli.');
  }

  const coords = fieldCoordinates(field);

  let soilModel: PusulaFieldContext['soilModel'] = null;
  let terrain: PusulaFieldContext['terrain'] = null;

  if (loadExtended && coords) {
    const extended = await loadExtendedContext(
      fieldId,
      coords.latitude,
      coords.longitude,
    );

    soilModel = extended.soilModel;
    terrain = extended.terrain;
  }

  const satellite = satelliteData
    ? {
        ndviMean:
          finite(
            satelliteData.ndviMean ??
              satelliteData.meanNdvi,
          ),
        healthScore:
          finite(satelliteData.healthScore),
        sceneDate:
          asString(
            satelliteData.sceneDate ??
              satelliteData.date,
          ),
        summary:
          asString(
            satelliteData.summary ??
              satelliteData.analysis,
          ),
        evidence: {
          source: 'Sentinel-2 / NDVI',
          priority: 'current_remote' as const,
          state: 'ready' as const,
          observedAt:
            asString(
              satelliteData.sceneDate ??
                satelliteData.date ??
                satelliteData.generatedAt,
            ),
          confidence: 'medium' as const,
          notes: [
            'Optik uydu verisidir; bulut ve görüntü tarihi yorumda dikkate alınır.',
          ],
        },
      }
    : null;

  const climate = unifiedClimateContext
    ? {
        raw: unifiedClimateContext,
        evidence: {
          source: 'NASA POWER + ERA5-Land/ERA5',
          priority: 'reanalysis' as const,
          state: 'ready' as const,
          confidence: 'medium' as const,
          notes: [
            'Kaynaklar ayrı tutulur; birbirine körlemesine ortalanmaz.',
            'Kaynaklar arası fark belirsizlik olarak yorumlanır.',
          ],
        },
      }
    : null;

  const ready: string[] = [];
  const partial: string[] = [];
  const unavailable: string[] = [];

  const register = (
    name: string,
    state: PusulaSourceState,
  ) => {
    if (state === 'ready') ready.push(name);
    else if (state === 'partial') partial.push(name);
    else if (state === 'unavailable') unavailable.push(name);
  };

  register('weather', forecast.length ? 'ready' : 'unavailable');
  register(
    'sentinel2_ndvi',
    satellite ? 'ready' : 'unavailable',
  );
  register(
    'climate_reference',
    climate ? 'ready' : 'unavailable',
  );
  register(
    'soilgrids',
    soilModel?.evidence.state ?? 'unavailable',
  );
  register(
    'dem',
    terrain?.evidence.state ?? 'unavailable',
  );
  register('sentinel1_radar_metrics', 'unavailable');

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),

    field: {
      id: fieldId,
      name: asString((field as any).name),
      crop: asString(
        (field as any).crop ??
          (field as any).product ??
          (field as any).cropName,
      ),
      plantingDate: asString(
        (field as any).plantingDate ??
          (field as any).planting_date,
      ),
      areaDa: finite(
        (field as any).areaDa ??
          (field as any).area,
      ),
      village: asString((field as any).village),
      district: asString((field as any).district),
      city: asString((field as any).city),
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    },

    userGroundTruth: {
      soilAnalysisAvailable: Boolean(
        (field as any).soilAnalysis ||
          (field as any).soil_analysis ||
          (field as any).soilAnalysisId ||
          (field as any).soil_analysis_id ||
          (field as any).soilTest ||
          (field as any).soil_test,
      ),
      note:
        'Gerçek laboratuvar/saha verisi varsa model tahminlerinden önceliklidir.',
    },

    weather: {
      locationLabel,
      current: currentWeather,
      forecast: Array.isArray(forecast)
        ? forecast.slice(0, 5)
        : [],
      evidence: {
        source: 'Kısa vadeli hava tahmini',
        priority: 'forecast',
        state: forecast.length ? 'ready' : 'unavailable',
        confidence: 'medium',
      },
    },

    satellite,
    climate,
    soilModel,
    terrain,

    radar: {
      status: 'map_available_metrics_pending',
      note:
        'Sentinel-1 radar haritası mevcut; Pusula AI için ham görüntü yerine sayısal radar özet metriği ayrıca bağlanacak.',
      evidence: {
        source: 'Copernicus Sentinel-1 GRD',
        priority: 'current_remote',
        state: 'not_requested',
        confidence: 'medium',
        notes: [
          'Radar geri saçılımı doğrudan toprak nem yüzdesi değildir.',
          'Nem, bitki örtüsü, yüzey pürüzlülüğü ve geometri birlikte etkilidir.',
        ],
      },
    },

    gamification: {
      points: Number(gamificationPoints || 0),
    },

    decisionPolicy: {
      sourcePriority: [
        'Kullanıcının gerçek saha/laboratuvar verisi',
        'Güncel uydu/radar gözlemleri',
        'Güncel kısa vadeli hava',
        'ERA5-Land/ERA5 reanalysis ve NASA POWER iklim bağlamı',
        'SoilGrids ve DEM model/sabit bağlam',
      ],
      neverBlindAverage: true,
      disagreementMeansUncertainty: true,
      farmerFacingRule:
        'Çiftçiye ham teknik değer yığını değil; kısa gözlem, neden, güven düzeyi ve uygulanabilir saha kontrolü sun.',
    },

    sourceHealth: {
      ready,
      partial,
      unavailable,
    },
  };
}
