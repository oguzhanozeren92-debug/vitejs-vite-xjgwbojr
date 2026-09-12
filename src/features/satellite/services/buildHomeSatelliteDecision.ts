import type { HomeDecisionEvent } from '../../decision/types/homeDecision';

export type HomeSatelliteTrendSignal = {
  fieldId: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  quality: 'usable' | 'insufficient';
  direction: 'rising' | 'stable' | 'falling' | 'unknown';
  observationCount: number;
  spanDays: number | null;
  latestDate: string | null;
};

/** NDVI tek başına hastalık veya besin eksikliği teşhisi değildir. */
export function buildHomeSatelliteDecision(
  fieldId: string,
  trend: HomeSatelliteTrendSignal | null | undefined,
  activeGrowth: boolean,
  now: Date = new Date(),
): HomeDecisionEvent | null {
  const latestMs = trend?.latestDate ? Date.parse(trend.latestDate) : NaN;
  if (
    !fieldId || trend?.fieldId !== fieldId || trend.status !== 'ready' ||
    trend.quality !== 'usable' || trend.direction !== 'falling' ||
    trend.observationCount < 3 || trend.spanDays == null || trend.spanDays < 12 ||
    !activeGrowth || !Number.isFinite(latestMs) ||
    latestMs > now.getTime() + 86_400_000 || now.getTime() - latestMs > 30 * 86_400_000
  ) return null;

  return {
    id: `satellite:${fieldId}:ndvi-falling`,
    group: 'satellite-trend',
    source: 'satellite',
    priority: 78,
    severity: 'warning',
    target: 'map_vegetation',
    channels: ['today', 'notification'],
    label: 'UYDU TAKİBİ',
    title: 'NDVI Eğilimini Kontrol Et',
    detail: 'Bitki örtüsü sinyali azalıyor; haritadaki alanları sahada karşılaştır.',
    today: { tone: 'amber', visual: 'spraying', iconKey: 'leaf-green', iconClass: 'leaf' },
    notification: { iconKey: 'leaf', iconTone: 'green', dotTone: 'warning' },
  };
}
