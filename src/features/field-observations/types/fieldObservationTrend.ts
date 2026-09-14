import type { FieldObservationComparisonStatus } from './fieldObservation';

export type FieldObservationTrendPoint = {
  photoId: string;
  capturedAt: string;
  satelliteDate: string | null;
  ndviValue: number | null;
  relativeHealth: number | null;
  notes: string | null;
};

export type FieldObservationTrendSummary = {
  pointId: string;
  fieldId: string;
  source: 'real_observation_history';
  productionAuthority: false;
  photoCount: number;
  comparisonCount: number;
  firstCapturedAt: string | null;
  lastCapturedAt: string | null;
  firstRelativeHealth: number | null;
  latestRelativeHealth: number | null;
  relativeHealthDelta: number | null;
  firstNdvi: number | null;
  latestNdvi: number | null;
  ndviDelta: number | null;
  latestComparisonStatus: FieldObservationComparisonStatus;
  recentComparisonStatuses: FieldObservationComparisonStatus[];
  improvingCount: number;
  stableCount: number;
  worseningCount: number;
  unknownCount: number;
  timeline: FieldObservationTrendPoint[];
};
