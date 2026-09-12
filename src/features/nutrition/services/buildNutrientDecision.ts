import type { SoilAnalysisRecord } from '../../../lib/soilAnalysisService';
import type { HomeDecisionEvent } from '../../decision/types/homeDecision';

export type HomeNutrientSignal = {
  fieldId: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  latestAnalysis: SoilAnalysisRecord | null;
};

/** Yalnızca kullanıcıya ait laboratuvar raporunun varlığı ve rapor durumu kullanılır. */
export function buildNutrientDecision(
  fieldId: string,
  crop: string | null | undefined,
  signal: HomeNutrientSignal | null | undefined,
  recentFertilization: boolean,
): HomeDecisionEvent | null {
  if (!fieldId || !crop?.trim() || signal?.fieldId !== fieldId || signal.status !== 'ready') return null;

  const analysis = signal.latestAnalysis;
  if (!analysis) {
    return {
      id: `nutrition:${fieldId}:missing-analysis`,
      group: 'nutrition', source: 'nutrition', priority: 39, severity: 'info',
      target: 'soil', channels: ['notification'], label: 'TOPRAK ANALİZİ',
      title: 'Toprak Analizini Ekle',
      detail: 'Gübreleme kararını bu tarlanın laboratuvar analiziyle destekle.',
      notification: { iconKey: 'document', iconTone: 'green', dotTone: 'info' },
    };
  }

  if (String(analysis.field_id) !== fieldId) return null;

  const reportCrop = String(analysis.crop ?? '').trim().toLocaleLowerCase('tr-TR');
  if (reportCrop && reportCrop !== crop.trim().toLocaleLowerCase('tr-TR')) {
    return {
      id: `nutrition:${fieldId}:${analysis.id}:crop-changed`,
      group: 'nutrition', source: 'nutrition', priority: 44, severity: 'info',
      target: 'soil', channels: ['notification'], label: 'TOPRAK ANALİZİ',
      title: 'Analiz Yorumunu Güncelle',
      detail: 'Son analiz önceki ürünün için yorumlanmış; yeni ürüne göre yeniden değerlendir.',
      notification: { iconKey: 'document', iconTone: 'green', dotTone: 'info' },
    };
  }

  if (!['check', 'alert'].includes(analysis.status ?? '')) {
    return null;
  }

  return {
    id: `nutrition:${fieldId}:${analysis.id}:report-review`,
    group: 'nutrition', source: 'nutrition', priority: analysis.status === 'alert' ? 76 : 62,
    severity: 'warning', target: 'soil', channels: ['today', 'notification'],
    label: 'TOPRAK ANALİZİ', title: 'Analiz Raporunu İncele',
    detail: recentFertilization
      ? 'Rapordaki uyarıyı son gübreleme kaydınla birlikte değerlendir.'
      : 'Raporda incelenmesi gereken bulgular var; uygulamadan önce kontrol et.',
    today: { tone: 'amber', visual: 'spraying', iconKey: 'document', iconClass: 'leaf' },
    notification: { iconKey: 'document', iconTone: 'gold', dotTone: 'warning' },
  };
}
