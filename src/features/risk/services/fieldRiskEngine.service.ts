import { calculateIrrigationDecision } from '../../irrigation/services/irrigationDecision.service';
import { loadFieldObservationEvidence } from '../../field-observations/services/fieldObservationEvidence.service';
import { loadFieldRiskWeather } from './fieldRiskWeather.service';
import type {
  FieldRiskEngineResult,
  FieldRiskEvidence,
  FieldRiskItem,
  FieldRiskLevel,
} from '../types/fieldRisk';

const LEVEL_ORDER: Record<FieldRiskLevel, number> = {
  high: 4,
  elevated: 3,
  watch: 2,
  normal: 1,
  needs_data: 0,
};

function evidence(
  source: string,
  sourceLabel: string,
  observedAt: string | null,
  finding: string,
): FieldRiskEvidence {
  return { source, sourceLabel, observedAt, finding };
}

function risk(
  item: Omit<FieldRiskItem, 'productionAuthority'>,
): FieldRiskItem {
  return { ...item, productionAuthority: false };
}

function frostRisk(
  weather: Awaited<ReturnType<typeof loadFieldRiskWeather>> | null,
): FieldRiskItem {
  const usable = weather?.days.filter((day) => day.temperatureMinC !== null) ?? [];
  if (!usable.length) {
    return risk({
      key: 'frost',
      label: 'Don Riski',
      level: 'needs_data',
      assessed: false,
      headline: 'Don riski değerlendirilemedi',
      summary: 'Önümüzdeki günler için kullanılabilir minimum sıcaklık tahmini yok.',
      action: 'Tarla konumu ve hava tahmini verisini kontrol et.',
      evidence: [],
      missing: ['forecast_min_temperature'],
    });
  }

  const coldest = usable.reduce((best, day) =>
    Number(day.temperatureMinC) < Number(best.temperatureMinC) ? day : best,
  );
  const min = Number(coldest.temperatureMinC);
  const level: FieldRiskLevel = min <= -2 ? 'high' : min <= 0 ? 'elevated' : 'normal';

  return risk({
    key: 'frost',
    label: 'Don Riski',
    level,
    assessed: true,
    headline:
      level === 'high'
        ? 'Kuvvetli don riski var'
        : level === 'elevated'
          ? 'Don riski yükseldi'
          : 'Belirgin don riski görünmüyor',
    summary: `5 günlük tahminde en düşük sıcaklık ${min.toFixed(1)} °C (${coldest.date}).`,
    action:
      level === 'normal'
        ? 'Tahmini izlemeye devam et.'
        : 'Hassas ürün ve gelişim dönemlerinde don önlemlerini saha koşullarına göre değerlendir.',
    evidence: [
      evidence(
        'open_meteo_forecast',
        'Open-Meteo minimum sıcaklık tahmini',
        coldest.date,
        `Minimum sıcaklık ${min.toFixed(1)} °C. TarlaPusula don sınıflaması: ≤ -2 °C yüksek, -2–0 °C yükselmiş risk.`,
      ),
    ],
    missing: [],
  });
}

function waterStressRisk(
  irrigation: Awaited<ReturnType<typeof calculateIrrigationDecision>> | null,
): FieldRiskItem {
  if (!irrigation) {
    return risk({
      key: 'water_stress',
      label: 'Su Stresi',
      level: 'needs_data',
      assessed: false,
      headline: 'Su stresi değerlendirilemedi',
      summary: 'Sulama motorunun güvenilir tarla sonucu alınamadı.',
      action: 'Sulama durumu, ürün ve su dengesi verilerini kontrol et.',
      evidence: [],
      missing: ['irrigation_decision'],
    });
  }

  if (irrigation.irrigationStatus === 'rainfed') {
    const rainfed = irrigation.rainfedStress;
    if (!rainfed || rainfed.riskLevel === 'unknown') {
      return risk({
        key: 'water_stress',
        label: 'Su Stresi',
        level: 'needs_data',
        assessed: false,
        headline: 'Susuz tarla için su stresi değerlendirilemedi',
        summary: 'İklim-temelli su baskısını değerlendirecek yeterli gerçek veri yok.',
        action: 'Yağış ve ET verilerinin tamamlanmasını bekle; saha bitki stresini kontrol et.',
        evidence: [],
        missing: ['rainfed_stress_context'],
      });
    }

    const level: FieldRiskLevel =
      rainfed.riskLevel === 'high'
        ? 'high'
        : rainfed.riskLevel === 'elevated'
          ? 'elevated'
          : 'normal';

    return risk({
      key: 'water_stress',
      label: 'Su Stresi',
      level,
      assessed: true,
      headline:
        level === 'high'
          ? 'Susuz tarlada su stresi riski yüksek'
          : level === 'elevated'
            ? 'Susuz tarlada su stresi riski yükseliyor'
            : 'Susuz tarlada belirgin su stresi sinyali yok',
      summary: irrigation.display.summary,
      action: irrigation.display.action,
      evidence: [
        evidence(
          'irrigation_engine_rainfed_stress',
          'TarlaPusula Sulama Motoru · susuz tarla stresi',
          irrigation.generatedAt,
          `Risk seviyesi: ${rainfed.riskLevel}; birleşik iklim baskısı: ${rainfed.combinedClimatePressureMm ?? '—'} mm.`,
        ),
      ],
      missing: [],
    });
  }

  if (irrigation.decision === 'needs_data') {
    return risk({
      key: 'water_stress',
      label: 'Su Stresi',
      level: 'needs_data',
      assessed: false,
      headline: 'Su stresi için veri gerekli',
      summary: irrigation.display.summary,
      action: irrigation.display.action,
      evidence: [],
      missing: irrigation.missing,
    });
  }

  const level: FieldRiskLevel =
    irrigation.decision === 'irrigate_now'
      ? 'high'
      : irrigation.decision === 'irrigation_approaching'
        ? 'elevated'
        : 'normal';

  return risk({
    key: 'water_stress',
    label: 'Su Stresi',
    level,
    assessed: true,
    headline: irrigation.display.headline,
    summary: irrigation.display.summary,
    action: irrigation.display.action,
    evidence: [
      evidence(
        'irrigation_engine',
        'TarlaPusula Sulama Motoru',
        irrigation.generatedAt,
        `Karar: ${irrigation.decision}; mevcut açık: ${irrigation.waterBalance.currentDeficitMm ?? '—'} mm; stres eşiği: ${irrigation.waterBalance.stressThresholdMm ?? '—'} mm.`,
      ),
    ],
    missing: [],
  });
}

function observationRisk(
  observation: Awaited<ReturnType<typeof loadFieldObservationEvidence>> | null,
): FieldRiskItem {
  const points = observation?.points ?? [];
  const comparable = points.filter((point) => point.comparisonCount > 0);

  if (!comparable.length) {
    return risk({
      key: 'field_observation_decline',
      label: 'Saha Gözlem Kötüleşmesi',
      level: 'needs_data',
      assessed: false,
      headline: 'Saha trendi için karşılaştırma gerekli',
      summary: 'Aynı takip noktasında karşılaştırılabilir gerçek gözlem geçmişi henüz yok.',
      action: 'Takip noktasına yeni fotoğraf ekleyerek zaman karşılaştırması oluştur.',
      evidence: [],
      missing: ['comparable_field_observation_history'],
    });
  }

  const streak = comparable.find(
    (point) =>
      point.recentComparisonStatuses.length >= 3 &&
      point.recentComparisonStatuses.slice(0, 3).every((status) => status === 'worsening'),
  );
  const latestWorsening = comparable.find((point) => point.latestComparisonStatus === 'worsening');

  if (streak) {
    return risk({
      key: 'field_observation_decline',
      label: 'Saha Gözlem Kötüleşmesi',
      level: 'elevated',
      assessed: true,
      headline: 'Bir takip noktası art arda zayıflıyor',
      summary: 'Kayıtlı gerçek gözlem geçmişinde aynı noktada son 3 karşılaştırma da kötüleşme yönünde.',
      action: 'Aynı noktayı sahada yeniden kontrol et; fotoğraf, su/beslenme durumu ve zararlı/hastalık belirtisini doğrula.',
      evidence: [
        evidence(
          'persisted_field_observations',
          'Saha gözlem geçmişi',
          streak.lastPhotoAt ?? streak.lastDetectedAt,
          'Son 3 karşılaştırma: worsening → worsening → worsening. Bu bulgu tek başına neden teşhisi değildir.',
        ),
      ],
      missing: [],
    });
  }

  if (latestWorsening) {
    return risk({
      key: 'field_observation_decline',
      label: 'Saha Gözlem Kötüleşmesi',
      level: 'watch',
      assessed: true,
      headline: 'Son saha karşılaştırmasında zayıflama var',
      summary: 'Bir takip noktasının en yeni gerçek karşılaştırması kötüleşme yönünde.',
      action: 'Aynı noktayı yeniden gözlemle ve zayıflamanın devam edip etmediğini doğrula.',
      evidence: [
        evidence(
          'persisted_field_observations',
          'Saha gözlem geçmişi',
          latestWorsening.lastPhotoAt ?? latestWorsening.lastDetectedAt,
          `Son karşılaştırma worsening; kayıtlı kötüleşme sayısı ${latestWorsening.worseningCount}.`,
        ),
      ],
      missing: [],
    });
  }

  return risk({
    key: 'field_observation_decline',
    label: 'Saha Gözlem Kötüleşmesi',
    level: 'normal',
    assessed: true,
    headline: 'Gözlem geçmişinde güncel kötüleşme sinyali yok',
    summary: 'Karşılaştırılabilir kayıtlar var ancak en yeni karşılaştırma kötüleşme yönünde değil.',
    action: 'Planlı takip aralığını sürdür.',
    evidence: [
      evidence(
        'persisted_field_observations',
        'Saha gözlem geçmişi',
        observation?.generatedAt ?? null,
        `${comparable.length} takip noktasında karşılaştırılabilir geçmiş değerlendirildi.`,
      ),
    ],
    missing: [],
  });
}

function heatRisk(
  weather: Awaited<ReturnType<typeof loadFieldRiskWeather>> | null,
): FieldRiskItem {
  const maxValues = weather?.days
    .filter((day) => day.temperatureMaxC !== null)
    .map((day) => Number(day.temperatureMaxC)) ?? [];
  const maxTemperature = maxValues.length ? Math.max(...maxValues) : null;

  return risk({
    key: 'heat_stress',
    label: 'Isı Stresi',
    level: 'needs_data',
    assessed: false,
    headline: 'Isı stresi için ürün/eşevre eşiği gerekli',
    summary:
      maxTemperature === null
        ? 'Kullanılabilir maksimum sıcaklık tahmini yok; ayrıca ürün ve gelişim evresine özel güvenilir ısı stresi eşiği gerekli.'
        : `5 günlük tahminde maksimum sıcaklık ${maxTemperature.toFixed(1)} °C. Bu değer tek başına ürün ısı stresi ilan etmek için kullanılmıyor.`,
    action: 'Ürün ve gelişim evresine özel doğrulanmış ısı stresi eşikleri bağlandığında bu risk otomatik değerlendirilecek.',
    evidence:
      maxTemperature === null
        ? []
        : [
            evidence(
              'open_meteo_forecast',
              'Open-Meteo maksimum sıcaklık tahmini',
              weather?.generatedAt ?? null,
              `5 günlük maksimum sıcaklık: ${maxTemperature.toFixed(1)} °C.`,
            ),
          ],
    missing: [
      ...(maxTemperature === null ? ['forecast_max_temperature'] : []),
      'crop_stage_heat_stress_threshold',
    ],
  });
}

function excessRainRisk(
  weather: Awaited<ReturnType<typeof loadFieldRiskWeather>> | null,
): FieldRiskItem {
  const rainValues = weather?.days
    .filter((day) => day.precipitationMm !== null)
    .map((day) => Number(day.precipitationMm)) ?? [];
  const totalRain = rainValues.length
    ? rainValues.reduce((sum, value) => sum + Math.max(0, value), 0)
    : null;

  return risk({
    key: 'excess_rain_waterlogging',
    label: 'Aşırı Yağış / Su Birikimi',
    level: 'needs_data',
    assessed: false,
    headline: 'Su birikimi riski için saha/toprak kanıtı gerekli',
    summary:
      totalRain === null
        ? 'Kullanılabilir 5 günlük yağış tahmini yok.'
        : `5 günlük toplam yağış tahmini ${totalRain.toFixed(1)} mm. Yağış miktarı tek başına su birikimi ilan etmek için yeterli değil.`,
    action: 'Toprak infiltrasyonu/drenajı veya doğrulanmış Sentinel-1 su birikimi sinyali bağlandığında risk otomatik değerlendirilecek.',
    evidence:
      totalRain === null
        ? []
        : [
            evidence(
              'open_meteo_forecast',
              'Open-Meteo yağış tahmini',
              weather?.generatedAt ?? null,
              `5 günlük toplam yağış: ${totalRain.toFixed(1)} mm.`,
            ),
          ],
    missing: [
      ...(totalRain === null ? ['forecast_precipitation'] : []),
      'validated_drainage_or_radar_waterlogging_signal',
    ],
  });
}

/**
 * Field Risk Engine v1
 *
 * Risks are ranked ordinally; no fabricated 0-100 score is produced.
 * Existing production irrigation authority is consumed, never replaced.
 * Missing crop/soil-specific science stays `needs_data` instead of using generic defaults.
 */
export async function calculateFieldRiskEngine(
  field: { id?: unknown } | null | undefined,
): Promise<FieldRiskEngineResult> {
  const fieldId = String(field?.id ?? '').trim();
  if (!fieldId) throw new Error('Tarla risk motoru için tarla kimliği gerekli.');

  const [weatherResult, irrigationResult, observationResult] = await Promise.allSettled([
    loadFieldRiskWeather(fieldId),
    calculateIrrigationDecision({ id: fieldId }),
    loadFieldObservationEvidence(fieldId),
  ]);

  const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
  const irrigation = irrigationResult.status === 'fulfilled' ? irrigationResult.value : null;
  const observation = observationResult.status === 'fulfilled' ? observationResult.value : null;

  const risks = [
    frostRisk(weather),
    waterStressRisk(irrigation),
    observationRisk(observation),
    heatRisk(weather),
    excessRainRisk(weather),
  ].sort((a, b) => LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level]);

  const highestRisk = risks.find(
    (item) => item.assessed && ['high', 'elevated', 'watch'].includes(item.level),
  ) ?? null;

  return {
    fieldId,
    generatedAt: new Date().toISOString(),
    productionAuthority: false,
    rankingMethod: 'ordinal_no_composite_score',
    highestRisk,
    risks,
    unavailableRiskKeys: risks.filter((item) => !item.assessed).map((item) => item.key),
    note:
      'Risk motoru yalnız doğrulanmış mevcut sinyalleri sıralar. Eksik bilimsel eşikler için risk üretmez; üretim sulama karar otoritesi değişmez.',
  };
}
