export type FieldRiskKey =
  | 'frost'
  | 'water_stress'
  | 'field_observation_decline'
  | 'heat_stress'
  | 'excess_rain_waterlogging';

export type FieldRiskLevel =
  | 'normal'
  | 'watch'
  | 'elevated'
  | 'high'
  | 'needs_data';

export type FieldRiskEvidence = {
  source: string;
  sourceLabel: string;
  observedAt: string | null;
  finding: string;
};

export type FieldRiskItem = {
  key: FieldRiskKey;
  label: string;
  level: FieldRiskLevel;
  assessed: boolean;
  headline: string;
  summary: string;
  action: string;
  evidence: FieldRiskEvidence[];
  missing: string[];
  productionAuthority: false;
};

export type FieldRiskEngineResult = {
  fieldId: string;
  generatedAt: string;
  productionAuthority: false;
  rankingMethod: 'ordinal_no_composite_score';
  highestRisk: FieldRiskItem | null;
  risks: FieldRiskItem[];
  unavailableRiskKeys: FieldRiskKey[];
  note: string;
};

export type FieldRiskWeatherDay = {
  date: string;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  precipitationMm: number | null;
};

export type FieldRiskWeatherResult = {
  fieldId: string;
  generatedAt: string;
  productionAuthority: false;
  inputAuthority: 'server-derived';
  clientSuppliedCoordinatesAccepted: false;
  locationSource: string;
  days: FieldRiskWeatherDay[];
};
