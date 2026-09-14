import { supabase } from '../../../supabaseClient';
import type { FieldObservationComparisonStatus } from '../types/fieldObservation';
import type {
  FieldObservationTrendPoint,
  FieldObservationTrendSummary,
} from '../types/fieldObservationTrend';

function finiteOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function textOrNull(value: unknown) {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function difference(first: number | null, latest: number | null) {
  if (first === null || latest === null) return null;
  return Number((latest - first).toFixed(3));
}

function comparisonStatus(value: unknown): FieldObservationComparisonStatus {
  return ['improving', 'stable', 'worsening', 'unknown'].includes(String(value))
    ? (value as FieldObservationComparisonStatus)
    : 'unknown';
}

export async function loadFieldObservationTrend(
  pointIdInput: string,
): Promise<FieldObservationTrendSummary> {
  const pointId = String(pointIdInput ?? '').trim();
  if (!pointId) throw new Error('Zaman karşılaştırması için takip noktası gerekli.');
  if (!supabase) throw new Error('Takip noktası bağlantısı hazır değil.');

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Takip noktası için oturum bulunamadı.');
  const userId = authData.user.id;

  const [pointResult, photoResult, comparisonResult] = await Promise.all([
    supabase
      .from('field_observation_points')
      .select('id,field_id')
      .eq('id', pointId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('field_observation_photos')
      .select('id,point_id,field_id,captured_at,satellite_date,ndvi_value,relative_health,notes')
      .eq('point_id', pointId)
      .eq('user_id', userId)
      .order('captured_at', { ascending: true }),
    supabase
      .from('field_observation_comparisons')
      .select('status,compared_at')
      .eq('point_id', pointId)
      .eq('user_id', userId)
      .order('compared_at', { ascending: true }),
  ]);

  if (pointResult.error) throw pointResult.error;
  if (!pointResult.data) throw new Error('Takip noktası bulunamadı.');
  if (photoResult.error) throw photoResult.error;
  if (comparisonResult.error) throw comparisonResult.error;

  const timeline: FieldObservationTrendPoint[] = (photoResult.data ?? []).map((row: any) => ({
    photoId: String(row.id),
    capturedAt: String(row.captured_at),
    satelliteDate: textOrNull(row.satellite_date),
    ndviValue: finiteOrNull(row.ndvi_value),
    relativeHealth: finiteOrNull(row.relative_health),
    notes: textOrNull(row.notes),
  }));

  const comparisons = comparisonResult.data ?? [];
  const counts = {
    improving: 0,
    stable: 0,
    worsening: 0,
    unknown: 0,
  };

  for (const row of comparisons) {
    counts[comparisonStatus(row.status)] += 1;
  }

  const first = timeline[0] ?? null;
  const latest = timeline.at(-1) ?? null;
  const latestComparison = comparisons.at(-1) ?? null;
  const recentComparisonStatuses = comparisons
    .slice(-5)
    .reverse()
    .map((row: any) => comparisonStatus(row.status));

  return {
    pointId,
    fieldId: String(pointResult.data.field_id),
    source: 'real_observation_history',
    productionAuthority: false,
    photoCount: timeline.length,
    comparisonCount: comparisons.length,
    firstCapturedAt: first?.capturedAt ?? null,
    lastCapturedAt: latest?.capturedAt ?? null,
    firstRelativeHealth: first?.relativeHealth ?? null,
    latestRelativeHealth: latest?.relativeHealth ?? null,
    relativeHealthDelta: difference(first?.relativeHealth ?? null, latest?.relativeHealth ?? null),
    firstNdvi: first?.ndviValue ?? null,
    latestNdvi: latest?.ndviValue ?? null,
    ndviDelta: difference(first?.ndviValue ?? null, latest?.ndviValue ?? null),
    latestComparisonStatus: comparisonStatus(latestComparison?.status),
    recentComparisonStatuses,
    improvingCount: counts.improving,
    stableCount: counts.stable,
    worseningCount: counts.worsening,
    unknownCount: counts.unknown,
    timeline,
  };
}
