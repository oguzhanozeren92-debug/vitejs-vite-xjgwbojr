import type {
  FieldObservationEvidence,
  FieldObservationEvidenceItem,
} from './fieldObservationEvidence.service';

type SynthesisStatus = 'normal' | 'dikkat' | 'kontrol';
type CauseProbability = 'dusuk' | 'orta' | 'yuksek';

type ObservationSynthesis = {
  status: SynthesisStatus;
  summary: string;
  likelyCauses: Array<{
    title: string;
    probability: CauseProbability;
    reason: string;
  }>;
  evidence: Array<{
    layer: unknown;
    layerLabel: string;
    finding: string;
    status: SynthesisStatus;
  }>;
  action: string;
  caution: string;
};

function directionLabel(value: string | null) {
  const text = String(value ?? '').trim();
  if (!text) return 'Takip noktası';
  return text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1);
}

function hasLatestStreak(
  item: FieldObservationEvidenceItem,
  status: 'worsening' | 'improving',
) {
  return item.recentComparisonStatuses.length >= 3
    && item.recentComparisonStatuses.slice(0, 3).every((value) => value === status);
}

function severity(item: FieldObservationEvidenceItem) {
  if (hasLatestStreak(item, 'worsening')) return 4;
  if (item.latestComparisonStatus === 'worsening') return 3;
  if (item.worseningCount > 0) return 2;
  if (hasLatestStreak(item, 'improving')) return 1;
  return 0;
}

function appendUnique(base: string, value: string) {
  if (!value || base.includes(value)) return base;
  return `${base}${base.trim() ? ' ' : ''}${value}`;
}

export function applyFieldObservationEvidenceToSynthesis<T extends ObservationSynthesis>(
  synthesis: T,
  observation: FieldObservationEvidence | null | undefined,
): T {
  if (!observation?.points?.length) return synthesis;

  const relevant = [...observation.points]
    .filter((item) => item.comparisonCount > 0)
    .sort((a, b) => severity(b) - severity(a))
    .slice(0, 2);

  if (!relevant.length) return synthesis;

  const evidence = [...synthesis.evidence];
  const causes = [...synthesis.likelyCauses];
  let status = synthesis.status;
  let action = synthesis.action;
  let caution = synthesis.caution;
  let summary = synthesis.summary;

  for (const item of relevant) {
    const label = directionLabel(item.direction);

    if (hasLatestStreak(item, 'worsening')) {
      evidence.unshift({
        layer: 'vegetation',
        layerLabel: 'Saha gözlem geçmişi',
        finding: `${label} son 3 karşılaştırmada zayıflıyor.`,
        status: 'dikkat',
      });
      causes.unshift({
        title: 'Tekrarlayan saha gözlem zayıflaması',
        probability: 'orta',
        reason:
          'Kayıtlı fotoğraf/uydu karşılaştırmalarının son üçünde durum zayıflıyor. Bu bulgu tek başına hastalık, beslenme veya sulama nedeni teşhis etmez.',
      });
      if (status === 'normal') status = 'dikkat';
      summary = `${label} için kayıtlı takip geçmişinde ardışık zayıflama var. ${summary}`;
      action = `Aynı takip noktasını sahada yeniden kontrol et; fotoğraf, su/beslenme durumu ve zararlı/hastalık belirtilerini doğrula. ${action}`;
      caution = appendUnique(
        caution,
        'Saha gözlem geçmişi tek başına hastalık veya sulama teşhisi değildir.',
      );
      continue;
    }

    if (item.latestComparisonStatus === 'worsening' || item.worseningCount > 0) {
      evidence.unshift({
        layer: 'vegetation',
        layerLabel: 'Saha gözlem geçmişi',
        finding: item.latestComparisonStatus === 'worsening'
          ? `${label} son karşılaştırmada zayıflıyor; kayıtlı geçmişte ${item.worseningCount} kötüleşme karşılaştırması var.`
          : `${label} için kayıtlı geçmişte ${item.worseningCount} kötüleşme karşılaştırması var.`,
        status: item.latestComparisonStatus === 'worsening' ? 'dikkat' : 'normal',
      });
      if (item.latestComparisonStatus === 'worsening' && status === 'normal') {
        status = 'dikkat';
      }
      caution = appendUnique(
        caution,
        'Saha gözlem geçmişi tek başına hastalık veya sulama teşhisi değildir.',
      );
      continue;
    }

    if (hasLatestStreak(item, 'improving')) {
      evidence.unshift({
        layer: 'vegetation',
        layerLabel: 'Saha gözlem geçmişi',
        finding: `${label} son 3 karşılaştırmada toparlanıyor.`,
        status: 'normal',
      });
    }
  }

  return {
    ...synthesis,
    status,
    summary,
    evidence: evidence.slice(0, 10),
    likelyCauses: causes.slice(0, 5),
    action,
    caution,
  };
}
