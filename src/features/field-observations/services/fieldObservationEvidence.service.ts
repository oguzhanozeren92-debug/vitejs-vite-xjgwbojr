import { listFieldObservationPoints } from './fieldObservation.service';
import { loadFieldObservationTrend } from './fieldObservationTrend.service';

export type FieldObservationEvidenceItem = {
  pointId: string;
  direction: string | null;
  status: string;
  lastDetectedAt: string;
  lastPhotoAt: string | null;
  latestComparisonStatus: 'improving' | 'stable' | 'worsening' | 'unknown';
  photoCount: number;
  comparisonCount: number;
  relativeHealthDelta: number | null;
  ndviDelta: number | null;
};

export type FieldObservationEvidence = {
  fieldId: string;
  source: 'persisted_field_observations';
  productionAuthority: false;
  points: FieldObservationEvidenceItem[];
  generatedAt: string;
};

export async function loadFieldObservationEvidence(
  fieldIdInput: string,
  maxPoints = 8,
): Promise<FieldObservationEvidence> {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) throw new Error('Gözlem kanıtı için tarla kimliği gerekli.');

  const overviews = await listFieldObservationPoints(fieldId);
  const active = overviews
    .filter((item) => item.point.status === 'active')
    .sort((a, b) => Date.parse(b.point.lastDetectedAt) - Date.parse(a.point.lastDetectedAt))
    .slice(0, Math.max(1, Math.min(20, Math.round(maxPoints))));

  const trends = await Promise.all(
    active.map(async (item) => {
      try {
        return await loadFieldObservationTrend(item.point.id);
      } catch {
        return null;
      }
    }),
  );

  return {
    fieldId,
    source: 'persisted_field_observations',
    productionAuthority: false,
    points: active.map((item, index) => {
      const trend = trends[index];
      return {
        pointId: item.point.id,
        direction: item.point.direction,
        status: item.point.status,
        lastDetectedAt: item.point.lastDetectedAt,
        lastPhotoAt: item.point.lastPhotoAt,
        latestComparisonStatus: trend?.latestComparisonStatus ?? 'unknown',
        photoCount: trend?.photoCount ?? item.photoCount,
        comparisonCount: trend?.comparisonCount ?? (item.latestComparison ? 1 : 0),
        relativeHealthDelta: trend?.relativeHealthDelta ?? null,
        ndviDelta: trend?.ndviDelta ?? null,
      };
    }),
    generatedAt: new Date().toISOString(),
  };
}
