import { supabase } from '../supabaseClient';
import { getFieldPhenologySnapshot } from '../features/phenology/services/fieldPhenologySnapshot.service';

export type UnifiedMapActiveLayer =
  | 'vegetation'
  | 'radar-vv'
  | 'radar-vh'
  | 'radar-water'
  | 'soil'
  | 'climate'
  | 'surface-temperature'
  | 'water-demand'
  | 'rain-history'
  | 'frost-risk'
  | 'biodiversity';

export type UnifiedMapAiResult = {
  status: 'normal' | 'dikkat' | 'kontrol';
  headline: string;
  summary: string;
  reasons: string[];
  action: string;
  confidence: 'dusuk' | 'orta' | 'yuksek';
  caution: string;
  importantArea?: {
    area: string;
    summary: string;
    evidence?: string[];
  } | null;
  model?: string;
  memorySaved?: boolean;
  memoryObservationId?: string | null;
  historyUsed?: number;
  memoryError?: string | null;
};

export type UnifiedMapAiInput = {
  fieldId: string;
  fieldName?: string;
  crop?: string;
  periodDays: number;
  activeLayer: UnifiedMapActiveLayer;
  activeLayerLabel: string;
  activeLayerContext?: unknown;
  context: {
    ndvi?: unknown;
    radar?: unknown;
    soil?: unknown;
    climate?: unknown;
    biodiversity?: unknown;
  };
};

export type FieldSynthesisLikelyCause = {
  title: string;
  probability: 'dusuk' | 'orta' | 'yuksek';
  reason: string;
};

export type FieldSynthesisEvidence = {
  layer: UnifiedMapActiveLayer | 'phenology';
  layerLabel: string;
  finding: string;
  status: 'normal' | 'dikkat' | 'kontrol';
};

export type FieldSynthesisLifecycle = {
  stage: string | null;
  stageLabel: string | null;
  confidence: 'low' | 'medium' | 'high' | null;
  dataStatus: string | null;
  cropCycle: string | null;
  bearing: boolean | null;
  plantingYear: number | null;
  ndviTrend: string | null;
  ndviQuality: string | null;
  climateShiftDays: number;
  climateAnomalyC: number | null;
};

export type FieldSynthesisResult = {
  status: 'normal' | 'dikkat' | 'kontrol';
  headline: string;
  summary: string;
  likelyCauses: FieldSynthesisLikelyCause[];
  evidence: FieldSynthesisEvidence[];
  importantArea: {
    area: string;
    summary: string;
    evidence?: string[];
  } | null;
  action: string;
  caution: string;
  confidence: 'dusuk' | 'orta' | 'yuksek';
  layersUsed: UnifiedMapActiveLayer[];
  missingLayers: UnifiedMapActiveLayer[];
  layerCount: number;
  generatedAt: string;
  model?: string;
  lifecycle?: FieldSynthesisLifecycle | null;
  memorySaved?: boolean;
  memoryObservationId?: string | null;
  memoryError?: string | null;
};

export type FieldSynthesisInput = {
  fieldId: string;
  fieldName?: string;
  crop?: string;
  weatherContext?: unknown;
  climateContext?: unknown;
  lifecycleContext?: {
    cropCycle?: string | null;
    season?: number | null;
    plantingYear?: number | null;
    plantingDate?: string | null;
    harvestDate?: string | null;
    bearing?: boolean | null;
  };
};

type LiveSourceAnalysis = {
  layer: UnifiedMapActiveLayer;
  label: string;
  result: UnifiedMapAiResult;
};

const MAP_DIRECTIONS = [
  'kuzeybatı',
  'kuzeydoğu',
  'güneybatı',
  'güneydoğu',
  'kuzey',
  'güney',
  'doğu',
  'batı',
  'merkez',
] as const;

function normalizeErrorMessage(value: unknown) {
  if (value instanceof Error && value.message) return value.message;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return 'Pusula harita yorumunu oluşturamadı.';
}

async function readFunctionError(error: any) {
  try {
    const context = error?.context;
    if (context instanceof Response) {
      const text = await context.clone().text();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          if (typeof parsed?.error === 'string' && parsed.error.trim()) {
            return parsed.error.trim();
          }
        } catch {
          return text.slice(0, 500);
        }
      }
    }
  } catch {
    // no-op
  }

  return error?.message || 'Pusula Edge Function çağrısı başarısız oldu.';
}

function uniqueText(items: string[], value: string) {
  if (value && !items.includes(value)) items.push(value);
}

function applyPhenologyToFieldSynthesis(
  synthesis: FieldSynthesisResult,
  snapshot: any,
): FieldSynthesisResult {
  if (!snapshot?.phenology) return synthesis;

  const phenology = snapshot.phenology;
  const context = snapshot.context ?? {};
  const ndvi = snapshot.ndvi ?? {};
  const climateShift = snapshot.climateShift ?? {};

  const lifecycle: FieldSynthesisLifecycle = {
    stage: phenology.stage ?? null,
    stageLabel: phenology.stageLabel ?? null,
    confidence: phenology.confidence ?? null,
    dataStatus: phenology.dataStatus ?? null,
    cropCycle: context.cropCycle ?? null,
    bearing: typeof context.bearing === 'boolean' ? context.bearing : null,
    plantingYear: Number.isFinite(Number(context.plantingYear))
      ? Number(context.plantingYear)
      : null,
    ndviTrend: ndvi.direction ?? null,
    ndviQuality: ndvi.quality ?? null,
    climateShiftDays: Number(climateShift.shiftDays ?? 0),
    climateAnomalyC: Number.isFinite(Number(climateShift.anomalyC))
      ? Number(climateShift.anomalyC)
      : null,
  };

  if (
    phenology.dataStatus !== 'usable' ||
    !phenology.stage ||
    phenology.stage === 'unknown'
  ) {
    return {
      ...synthesis,
      lifecycle,
    };
  }

  const evidence = Array.isArray(synthesis.evidence)
    ? [...synthesis.evidence]
    : [];

  evidence.unshift({
    layer: 'phenology',
    layerLabel: 'Fenoloji',
    finding: `${phenology.stageLabel}${
      climateShift.status === 'ready' && climateShift.shiftDays
        ? ` · ERA5 takvim düzeltmesi ${climateShift.shiftDays > 0 ? '+' : ''}${climateShift.shiftDays} gün`
        : ''
    }.`,
    status: 'normal',
  });

  let result: FieldSynthesisResult = {
    ...synthesis,
    evidence: evidence.slice(0, 8),
    lifecycle,
  };

  const crop = context.cropName ?? 'Ürün';
  const stage = String(phenology.stage);
  const stageLabel = String(phenology.stageLabel ?? 'Fenolojik dönem');

  if (
    context.cropCycle === 'perennial' &&
    context.bearing === false &&
    ['flowering', 'fruit_set', 'fruit_growth', 'maturation', 'harvest_window'].includes(stage)
  ) {
    const reasons = [
      `Üretim durumu: ${crop} henüz ürün vermiyor olarak kayıtlı.`,
      `Takvim evresi: ${stageLabel}.`,
    ];

    result = {
      ...result,
      headline: 'Ürün Vermeyen Ağaç · Genel Tarla Değerlendirmesi',
      summary:
        `${crop} henüz ürün vermiyor olarak kayıtlı. Takvimde “${stageLabel}” görünse de genel değerlendirmede meyve, olgunluk veya hasat önerileri bastırıldı. ` +
        result.summary,
      action: result.importantArea
        ? `${result.importantArea.area} bölümünde ağaç/taç gelişimi, sürgün durumu, su ve beslenme koşullarını komşu alanla karşılaştır; hasat veya olgunluk müdahalesi önerme.`
        : 'Ağaç/taç gelişimini, sürgün durumunu, su ve beslenme koşullarını takip et; hasat veya olgunluk müdahalesi önerme.',
      caution:
        `${result.caution} ${reasons.join(' ')}`,
    };
  } else if (stage === 'harvest_window') {
    result = {
      ...result,
      headline:
        result.status === 'normal'
          ? `Hasat Penceresi · ${result.headline}`
          : result.headline,
      summary:
        `${crop} için mevcut fenolojik dönem “${stageLabel}”. NDVI ve diğer katmanlardaki değişimler aktif büyüme dönemindeki eşiklerle tek başına yorumlanmamalı. ${result.summary}`,
      action:
        result.importantArea
          ? `${result.importantArea.area} bölümünde olgunluk, hasat durumu ve bitki görünümünü diğer alanlarla karşılaştır. ${result.action}`
          : `Olgunluk ve hasat durumunu sahada doğrula. ${result.action}`,
    };
  } else if (
    ['bud_break', 'flowering', 'fruit_set', 'fruit_growth'].includes(stage) &&
    ndvi.quality === 'usable' &&
    ndvi.direction === 'falling'
  ) {
    const causes = Array.isArray(result.likelyCauses)
      ? [...result.likelyCauses]
      : [];

    causes.unshift({
      title: `${stageLabel} döneminde NDVI düşüşü`,
      probability: 'orta',
      reason:
        'Aktif/hassas fenolojik dönemde 90 günlük NDVI trendi düşüyor. Bu durum tek başına teşhis değildir; su, beslenme ve bitki sağlığı sahada birlikte kontrol edilmelidir.',
    });

    result = {
      ...result,
      status: result.status === 'normal' ? 'dikkat' : result.status,
      likelyCauses: causes.slice(0, 4),
      action:
        result.importantArea
          ? `${result.importantArea.area} bölümünü ${stageLabel.toLocaleLowerCase('tr-TR')} döneminde öncelikli saha kontrolüne al; su, beslenme ve bitki sağlığını birlikte değerlendir.`
          : `${stageLabel} dönemindeki NDVI düşüşünü sahada doğrula; su, beslenme ve bitki sağlığını birlikte kontrol et.`,
    };
  }

  const cautionParts = [result.caution];
  if (lifecycle.climateShiftDays !== 0) {
    uniqueText(
      cautionParts,
      `Fenoloji takvimi ERA5-Land termal sapmasına göre ${lifecycle.climateShiftDays > 0 ? '+' : ''}${lifecycle.climateShiftDays} gün kaydırıldı.`,
    );
  }

  return {
    ...result,
    caution: cautionParts.filter(Boolean).join(' '),
  };
}

async function getSynthesisPhenologySnapshot(input: FieldSynthesisInput) {
  try {
    return await getFieldPhenologySnapshot(
      {
        id: input.fieldId,
        name: input.fieldName ?? null,
        crop: input.crop ?? null,
        cropCycle: input.lifecycleContext?.cropCycle ?? null,
        plantingYear: input.lifecycleContext?.plantingYear ?? null,
        bearing:
          typeof input.lifecycleContext?.bearing === 'boolean'
            ? input.lifecycleContext.bearing
            : null,
      },
      {
        forceRefresh: false,
      },
    );
  } catch (error) {
    console.warn(
      '[Pusula] genel sentez fenoloji bağlamı alınamadı:',
      error,
    );
    return null;
  }
}

async function interpretSingleLayer(
  input: UnifiedMapAiInput,
): Promise<UnifiedMapAiResult> {
  if (!supabase) {
    throw new Error('Pusula AI bağlantısı hazır değil.');
  }

  const { data, error } = await supabase.functions.invoke(
    'unified-map-ai',
    {
      body: {
        mode: 'single-layer',
        fieldId: input.fieldId,
        fieldName: input.fieldName,
        crop: input.crop,
        periodDays: input.periodDays,
        activeLayer: input.activeLayer,
        activeLayerLabel: input.activeLayerLabel,
        activeLayerContext: input.activeLayerContext,
        context: input.context,
      },
    },
  );

  if (error) {
    const message = await readFunctionError(error);
    console.error('[Pusula] unified-map-ai invoke hatası:', error);
    throw new Error(message);
  }

  if (!data) {
    throw new Error('Pusula boş yanıt döndürdü.');
  }

  if (data.ok === false) {
    throw new Error(
      data.error || 'Pusula harita yorumunu oluşturamadı.',
    );
  }

  if (!data.analysis) {
    throw new Error('Pusula yanıtında analiz bulunamadı.');
  }

  const analysis = data.analysis as UnifiedMapAiResult;

  return {
    ...analysis,
    importantArea: analysis.importantArea ?? null,
    model: analysis.model ?? 'pusula-spatial-engine-v2',
    memorySaved: Boolean(data.memorySaved),
    memoryObservationId: data.memoryObservationId ?? null,
    historyUsed: Number(data.historyUsed ?? 0),
    memoryError:
      typeof data.memoryError === 'string' ? data.memoryError : null,
  };
}

function radarLayerFromContext(radar: any): UnifiedMapActiveLayer {
  const mode = String(radar?.mode ?? '').toLowerCase();
  if (mode === 'water') return 'radar-water';
  if (mode === 'vh') return 'radar-vh';
  return 'radar-vv';
}

function radarLabel(layer: UnifiedMapActiveLayer) {
  if (layer === 'radar-water') return 'Su Birikimi Riski';
  if (layer === 'radar-vh') return 'Bitki ve Zemin Farkı';
  return 'Nemli Alanlar';
}

function normalizeDirection(value: unknown) {
  const text = String(value ?? '').toLocaleLowerCase('tr-TR');
  return MAP_DIRECTIONS.find((direction) => text.includes(direction)) ?? null;
}

function radarVisionAnalysis(radar: any): LiveSourceAnalysis | null {
  const vision = radar?.visualInterpretation;
  if (!vision || typeof vision !== 'object') return null;

  const layer = radarLayerFromContext(radar);
  const observedAreas = Array.isArray(vision.observedAreas)
    ? vision.observedAreas.filter((item: unknown) => typeof item === 'string')
    : [];
  const direction = normalizeDirection(
    [vision.summary, ...observedAreas].join(' '),
  );

  return {
    layer,
    label: radarLabel(layer),
    result: {
      status:
        vision.status === 'kontrol' || vision.status === 'dikkat'
          ? vision.status
          : 'normal',
      headline: String(vision.headline ?? radarLabel(layer)),
      summary: String(
        vision.summary ?? 'Radar görüntüsü otomatik olarak yorumlandı.',
      ),
      reasons: observedAreas.slice(0, 3),
      action: String(
        vision.action ?? 'Radar görünümünü saha koşullarıyla karşılaştır.',
      ),
      confidence:
        vision.confidence === 'yuksek' || vision.confidence === 'orta'
          ? vision.confidence
          : 'dusuk',
      caution: String(
        vision.caution ??
          'Sentinel-1 radar sinyali nem, yüzey pürüzlülüğü ve bitki yapısından birlikte etkilenebilir.',
      ),
      importantArea: direction
        ? {
            area: direction,
            summary: `${direction} bölümünde radar yorumunda göreli fark öne çıkıyor.`,
            evidence: observedAreas.slice(0, 2),
          }
        : null,
      model: String(vision.model ?? 'sentinel1-vision'),
      memorySaved: Boolean(vision.memorySaved),
      memoryObservationId: vision.memoryObservationId ?? null,
      historyUsed: Number(vision.historyUsed ?? 0),
    },
  };
}

function biodiversityAnalysis(biodiversity: any): LiveSourceAnalysis | null {
  if (!biodiversity || typeof biodiversity !== 'object') return null;

  const total = Number(biodiversity.totalObservations ?? 0);
  const pestCandidates = Number(biodiversity.distinctPestCandidates ?? 0);
  const nearest = Number(biodiversity.nearestDistanceKm);
  const radius = Number(biodiversity.radiusKm ?? 25);
  const newest = String(biodiversity.newestObservationAt ?? '').slice(0, 10);

  const facts: string[] = [];
  if (Number.isFinite(total)) {
    facts.push(`${radius || 25} km çevrede ${Math.max(0, total)} konumlu GBIF kaydı`);
  }
  if (Number.isFinite(pestCandidates) && pestCandidates > 0) {
    facts.push(`${pestCandidates} farklı zararlı adayı`);
  }
  if (Number.isFinite(nearest) && nearest >= 0) {
    facts.push(`en yakın kayıt yaklaşık ${nearest.toFixed(1)} km`);
  }
  if (newest) facts.push(`en yeni kayıt ${newest}`);

  return {
    layer: 'biodiversity',
    label: 'Yakın Çevre Gözlemleri',
    result: {
      status: 'normal',
      headline: 'Yakın çevre gözlemleri bağlama eklendi',
      summary:
        facts.length > 0
          ? `${facts.join(', ')}. Bu kayıtlar tarlada zararlı bulunduğu anlamına gelmez.`
          : 'Yakın çevre GBIF kayıtları mevcut değerlendirmeye ek kanıt sağlamadı.',
      reasons: facts.slice(0, 3),
      action:
        pestCandidates > 0
          ? 'Saha kontrolünde bitki üzerindeki gerçek belirti ve zararlı varlığını doğrula; yalnız çevre kaydına göre işlem yapma.'
          : 'Yakın çevre kayıtlarını yalnız destekleyici bağlam olarak kullan.',
      confidence: total > 0 ? 'orta' : 'dusuk',
      caution:
        'GBIF gözlemleri yakın çevredeki açık kayıtları gösterir; seçili tarlada aynı türün veya zararlının bulunduğunu kanıtlamaz.',
      importantArea: null,
      model: 'gbif-context-evidence-v1',
    },
  };
}

function sourceEvidence(source: LiveSourceAnalysis): FieldSynthesisEvidence {
  return {
    layer: source.layer,
    layerLabel: source.label,
    finding: source.result.summary,
    status: source.result.status,
  };
}

function buildLiveFieldSynthesis(
  input: UnifiedMapAiInput,
  sources: LiveSourceAnalysis[],
): FieldSynthesisResult {
  const radarLayer = radarLayerFromContext(input.context.radar);
  const expectedLayers: UnifiedMapActiveLayer[] = [
    'vegetation',
    radarLayer,
    'soil',
    'climate',
    'biodiversity',
  ];
  const usedLayers = sources.map((source) => source.layer);
  const missingLayers = expectedLayers.filter(
    (layer) => !usedLayers.includes(layer),
  );

  const evidence = sources
    .slice()
    .sort((a, b) => {
      const weight = (status: UnifiedMapAiResult['status']) =>
        status === 'kontrol' ? 2 : status === 'dikkat' ? 1 : 0;
      return weight(b.result.status) - weight(a.result.status);
    })
    .map(sourceEvidence)
    .slice(0, 8);

  const attention = sources.filter(
    (source) =>
      source.result.status === 'dikkat' || source.result.status === 'kontrol',
  );
  const controlCount = sources.filter(
    (source) => source.result.status === 'kontrol',
  ).length;

  let status: FieldSynthesisResult['status'] = 'normal';
  if (controlCount > 0 || attention.length >= 3) status = 'kontrol';
  else if (attention.length > 0) status = 'dikkat';

  const directionScores = new Map<
    string,
    { count: number; labels: string[]; evidence: string[] }
  >();

  for (const source of sources) {
    const direction = normalizeDirection(source.result.importantArea?.area);
    if (!direction) continue;
    const current = directionScores.get(direction) ?? {
      count: 0,
      labels: [],
      evidence: [],
    };
    current.count += 1;
    current.labels.push(source.label);
    current.evidence.push(
      `${source.label}: ${source.result.importantArea?.summary ?? source.result.summary}`,
    );
    directionScores.set(direction, current);
  }

  const rankedDirections = [...directionScores.entries()].sort(
    (a, b) => b[1].count - a[1].count,
  );
  const strongest = rankedDirections[0] ?? null;
  const importantArea = strongest
    ? {
        area: strongest[0],
        summary:
          strongest[1].count >= 2
            ? `${strongest[1].count} farklı veri kaynağı ${strongest[0]} bölümünde ortaklaşan bir fark gösteriyor.`
            : `${strongest[1].labels[0]} verisinde ${strongest[0]} bölümü öne çıkıyor.`,
        evidence: strongest[1].evidence.slice(0, 3),
      }
    : null;

  const likelyCauses: FieldSynthesisLikelyCause[] = [];
  if (importantArea && strongest && strongest[1].count >= 2) {
    likelyCauses.push({
      title: 'Aynı bölgede birden fazla veri sinyali',
      probability: 'yuksek',
      reason: `${importantArea.area} bölümünü ${strongest[1].labels.join(' + ')} birlikte işaret ediyor. Kesin neden sahada doğrulanmalı.`,
    });
  }
  if (attention.length > 0 && likelyCauses.length === 0) {
    likelyCauses.push({
      title: 'Tek bir neden henüz öne çıkmıyor',
      probability: 'dusuk',
      reason:
        'Bazı canlı veri kaynaklarında dikkat işareti var ancak farklı katmanlar aynı neden veya aynı bölge üzerinde yeterince güçlü biçimde ortaklaşmıyor.',
    });
  }
  if (status === 'normal') {
    likelyCauses.push({
      title: 'Belirgin ortak stres sinyali yok',
      probability: 'orta',
      reason:
        'Bu yenilemede kullanılabilen canlı veri kaynakları birlikte değerlendirildiğinde güçlü ortak bir problem deseni oluşmadı.',
    });
  }

  let headline = 'Canlı harita verileri birlikte dengeli görünüyor';
  let summary = `${sources.length} güncel veri kaynağı birlikte değerlendirildi; güçlü ortak bir problem deseni görünmüyor.`;
  let action = 'Rutin saha kontrollerine devam et ve yeni veri tarihi geldiğinde değerlendirmeyi yenile.';

  if (status === 'dikkat') {
    headline = importantArea
      ? `${importantArea.area} bölümünü takip et`
      : 'Bazı canlı veriler saha kontrolü gerektiriyor';
    summary = importantArea
      ? `${importantArea.area} bölümünde en az bir güncel harita kaynağı dikkat çekiyor. Bu işaret kesin teşhis değildir; aynı bölgeyi sahada karşılaştırmak anlamlıdır.`
      : `${attention.length} güncel veri kaynağında dikkat işareti var ancak tek bir neden güçlü biçimde öne çıkmıyor.`;
    action = importantArea
      ? `${importantArea.area} bölümünü daha dengeli görünen bir bölümle karşılaştırarak saha kontrolü yap.`
      : 'Dikkat işareti veren katmanları sahada karşılaştır; sulama, bitki görünümü ve yüzey koşullarını birlikte kontrol et.';
  }

  if (status === 'kontrol') {
    headline = importantArea
      ? `${importantArea.area} bölümünü öncelikli kontrol et`
      : 'Canlı veriler saha kontrolünü önceliklendiriyor';
    summary = importantArea
      ? `${importantArea.area} bölümünde güncel veri kaynaklarının işaretleri bir araya geliyor. Bu durum kesin teşhis değildir ancak öncelikli saha kontrolünü destekler.`
      : 'Bir veya daha fazla güncel kaynak kontrol gerektiren işaret taşıyor. Kesin neden için saha doğrulaması gerekir.';
    action = importantArea
      ? `${importantArea.area} bölümünü öncelikli saha kontrolüne al; sulama, drenaj, bitki gelişimi ve yüzey koşullarını komşu bölümle karşılaştır.`
      : 'Kontrol işareti veren katmanların gösterdiği alanları sahada öncelikli incele.';
  }

  const nonLowConfidence = sources.filter(
    (source) => source.result.confidence !== 'dusuk',
  ).length;
  let confidence: FieldSynthesisResult['confidence'] = 'dusuk';
  if (
    sources.length >= 4 &&
    nonLowConfidence >= 3 &&
    (strongest?.[1].count ?? 0) >= 2
  ) {
    confidence = 'yuksek';
  } else if (sources.length >= 3 && nonLowConfidence >= 2) {
    confidence = 'orta';
  }

  const cautionParts = [
    'Bu canlı değerlendirme uydu, radar, model ve açık çevre kayıtlarını birlikte yorumlar; kesin hastalık, sulama veya toprak teşhisi değildir.',
  ];
  if (missingLayers.length) {
    cautionParts.push(
      `Bu yenilemede ${missingLayers.length} kaynak kullanılamadı; yorum yalnız hazır kaynaklara dayanıyor.`,
    );
  }
  if (usedLayers.includes('biodiversity')) {
    cautionParts.push(
      'Yakın çevre GBIF kaydı seçili tarlada zararlı bulunduğunu kanıtlamaz.',
    );
  }

  return {
    status,
    headline,
    summary,
    likelyCauses: likelyCauses.slice(0, 4),
    evidence,
    importantArea,
    action,
    caution: cautionParts.join(' '),
    confidence,
    layersUsed: usedLayers,
    missingLayers,
    layerCount: usedLayers.length,
    generatedAt: new Date().toISOString(),
    model: 'pusula-live-map-synthesis-v1',
    memorySaved: false,
    memoryObservationId: null,
    memoryError: null,
  };
}

function synthesisToUnifiedResult(
  synthesis: FieldSynthesisResult,
): UnifiedMapAiResult {
  const reasons = synthesis.evidence
    .slice(0, 4)
    .map((item) => `${item.layerLabel}: ${item.finding}`);

  if (reasons.length < 4) {
    for (const cause of synthesis.likelyCauses) {
      const text = `${cause.title}: ${cause.reason}`;
      if (!reasons.includes(text)) reasons.push(text);
      if (reasons.length >= 4) break;
    }
  }

  return {
    status: synthesis.status,
    headline: synthesis.headline,
    summary: synthesis.summary,
    reasons,
    action: synthesis.action,
    confidence: synthesis.confidence,
    caution: synthesis.caution,
    importantArea: synthesis.importantArea,
    model: synthesis.model,
    memorySaved: false,
    memoryObservationId: null,
    historyUsed: 0,
    memoryError: null,
  };
}

async function interpretLiveUnifiedMap(
  input: UnifiedMapAiInput,
): Promise<UnifiedMapAiResult> {
  const jobs: Array<Promise<LiveSourceAnalysis>> = [];

  if (input.context.ndvi) {
    jobs.push(
      interpretSingleLayer({
        ...input,
        activeLayer: 'vegetation',
        activeLayerLabel: 'Bitki Sağlığı (NDVI)',
        context: { ndvi: input.context.ndvi },
      }).then((result) => ({
        layer: 'vegetation' as const,
        label: 'Bitki Sağlığı (NDVI)',
        result,
      })),
    );
  }

  if (input.context.soil) {
    jobs.push(
      interpretSingleLayer({
        ...input,
        activeLayer: 'soil',
        activeLayerLabel: 'Toprak',
        context: { soil: input.context.soil },
      }).then((result) => ({
        layer: 'soil' as const,
        label: 'Toprak',
        result,
      })),
    );
  }

  if (input.context.climate) {
    jobs.push(
      interpretSingleLayer({
        ...input,
        activeLayer: 'climate',
        activeLayerLabel: 'İklim',
        context: { climate: input.context.climate },
      }).then((result) => ({
        layer: 'climate' as const,
        label: 'İklim',
        result,
      })),
    );
  }

  const settled = await Promise.allSettled(jobs);
  const sources: LiveSourceAnalysis[] = settled
    .filter(
      (result): result is PromiseFulfilledResult<LiveSourceAnalysis> =>
        result.status === 'fulfilled',
    )
    .map((result) => result.value);

  const radar = radarVisionAnalysis(input.context.radar);
  if (radar) sources.push(radar);

  const biodiversity = biodiversityAnalysis(input.context.biodiversity);
  if (biodiversity) sources.push(biodiversity);

  if (!sources.length) {
    const firstError = settled.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    throw new Error(
      firstError
        ? normalizeErrorMessage(firstError.reason)
        : 'Pusula için yorumlanabilir güncel harita verisi bulunamadı.',
    );
  }

  let synthesis = buildLiveFieldSynthesis(input, sources);
  const phenologySnapshot = await getSynthesisPhenologySnapshot({
    fieldId: input.fieldId,
    fieldName: input.fieldName,
    crop: input.crop,
  });
  synthesis = applyPhenologyToFieldSynthesis(synthesis, phenologySnapshot);

  return synthesisToUnifiedResult(synthesis);
}

function hasLiveMultiSourceContext(input: UnifiedMapAiInput) {
  const values = [
    input.context.ndvi,
    input.context.radar,
    input.context.soil,
    input.context.climate,
    input.context.biodiversity,
  ];
  return values.filter(Boolean).length >= 2;
}

export async function interpretUnifiedMap(
  input: UnifiedMapAiInput,
): Promise<UnifiedMapAiResult> {
  if (!supabase) {
    throw new Error('Pusula AI bağlantısı hazır değil.');
  }

  if (!input.fieldId) {
    throw new Error('Pusula AI için tarla seçilmedi.');
  }

  if (!input.activeLayer) {
    throw new Error('Pusula AI için harita katmanı seçilmedi.');
  }

  try {
    if (hasLiveMultiSourceContext(input)) {
      return await interpretLiveUnifiedMap(input);
    }
    return await interpretSingleLayer(input);
  } catch (error) {
    const message = normalizeErrorMessage(error);
    console.error('[Pusula] harita yorumu:', message);
    throw new Error(message);
  }
}

export async function synthesizeFieldObservations(
  input: FieldSynthesisInput,
): Promise<FieldSynthesisResult> {
  if (!supabase) {
    throw new Error('Pusula AI bağlantısı hazır değil.');
  }

  if (!input.fieldId) {
    throw new Error('Genel değerlendirme için tarla seçilmedi.');
  }

  try {
    const phenologySnapshot =
      await getSynthesisPhenologySnapshot(input);

    const lifecycleContext = {
      ...(input.lifecycleContext ?? {}),
      bearing:
        phenologySnapshot?.context?.bearing ??
        input.lifecycleContext?.bearing ??
        null,
      phenologyStage:
        phenologySnapshot?.phenology?.stage ?? null,
      phenologyStageLabel:
        phenologySnapshot?.phenology?.stageLabel ?? null,
      phenologyConfidence:
        phenologySnapshot?.phenology?.confidence ?? null,
      phenologyDataStatus:
        phenologySnapshot?.phenology?.dataStatus ?? null,
      ndviTrend:
        phenologySnapshot?.ndvi?.direction ?? null,
      ndviQuality:
        phenologySnapshot?.ndvi?.quality ?? null,
      climateShiftDays:
        phenologySnapshot?.climateShift?.shiftDays ?? 0,
      climateAnomalyC:
        phenologySnapshot?.climateShift?.anomalyC ?? null,
    };

    const { data, error } = await supabase.functions.invoke(
      'unified-map-ai',
      {
        body: {
          mode: 'field-synthesis',
          fieldId: input.fieldId,
          fieldName: input.fieldName,
          crop: input.crop,

          /*
            Backend v13 field-synthesis kontrolünden önce activeLayer
            doğruladığı için geriye dönük uyumluluk alanları.
          */
          activeLayer: 'vegetation',
          activeLayerLabel: 'Sağlık',

          weatherContext: input.weatherContext ?? null,
          climateContext: input.climateContext ?? null,
          lifecycleContext,
        },
      },
    );

    if (error) {
      const message = await readFunctionError(error);
      console.error('[Pusula] harmanlama invoke hatası:', error);
      throw new Error(message);
    }

    if (!data) {
      throw new Error('Pusula genel değerlendirme yanıtı boş geldi.');
    }

    if (data.ok === false) {
      throw new Error(
        data.error || 'Pusula genel değerlendirmeyi oluşturamadı.',
      );
    }

    if (!data.synthesis) {
      throw new Error(
        'Pusula yanıtında genel değerlendirme bulunamadı.',
      );
    }

    const rawSynthesis = data.synthesis as FieldSynthesisResult;

    const normalized: FieldSynthesisResult = {
      ...rawSynthesis,
      likelyCauses: Array.isArray(rawSynthesis.likelyCauses)
        ? rawSynthesis.likelyCauses
        : [],
      evidence: Array.isArray(rawSynthesis.evidence)
        ? rawSynthesis.evidence
        : [],
      layersUsed: Array.isArray(rawSynthesis.layersUsed)
        ? rawSynthesis.layersUsed
        : [],
      missingLayers: Array.isArray(rawSynthesis.missingLayers)
        ? rawSynthesis.missingLayers
        : [],
      importantArea: rawSynthesis.importantArea ?? null,
      layerCount: Number(
        rawSynthesis.layerCount ?? rawSynthesis.layersUsed?.length ?? 0,
      ),
      generatedAt:
        rawSynthesis.generatedAt || new Date().toISOString(),
      model: rawSynthesis.model || 'pusula-field-synthesis-v1',
      memorySaved: Boolean(data.memorySaved),
      memoryObservationId: data.memoryObservationId ?? null,
      memoryError:
        typeof data.memoryError === 'string' ? data.memoryError : null,
    };

    return applyPhenologyToFieldSynthesis(
      normalized,
      phenologySnapshot,
    );
  } catch (error) {
    const message = normalizeErrorMessage(error);
    console.error('[Pusula] genel değerlendirme:', message);
    throw new Error(message);
  }
}
