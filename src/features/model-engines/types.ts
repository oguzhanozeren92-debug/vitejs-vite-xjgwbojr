export type PyFao56WeatherDay = {
  date: string;
  solarRadiationMjM2: number;
  tmaxC: number;
  tminC: number;
  dewPointC: number;
  windMS: number;
  rainMm: number;
  kc: number;
};

export type PyFao56ShadowInput = {
  fieldId: string;
  station: {
    latitude: number;
    elevationM: number;
    windHeightM: number;
  };
  days: PyFao56WeatherDay[];
};

export type PyFao56ShadowDay = {
  date: string;
  referenceEtMm: number;
  kc: number;
  cropEtMm: number;
  rainMm: number;
};

export type PyFao56ShadowResult = {
  ok: true;
  mode: 'shadow';
  shadowScope: 'reference_et_and_single_kc';
  engine: 'pyfao56';
  fieldId: string;
  productionAuthority: false;
  fullWaterBalanceReady: false;
  blockedFullWaterBalanceInputs: string[];
  days: PyFao56ShadowDay[];
};

export type PyFao56ShadowComparisonDay = {
  date: string;
  kc: number;
  tarlapusulaReferenceEtMm: number;
  pyfao56ReferenceEtMm: number;
  referenceEtDeltaMm: number;
  referenceEtDeltaPct: number | null;
  tarlapusulaCropEtMm: number;
  pyfao56CropEtMm: number;
  cropEtDeltaMm: number;
  cropEtDeltaPct: number | null;
  tarlapusulaPrecipitationMm: number | null;
  pyfao56InputRainMm: number | null;
};

export type PyFao56ShadowComparison = {
  basis: {
    note: string;
    tarlapusula: string;
    pyfao56: string;
  };
  comparedDayCount: number;
  days: PyFao56ShadowComparisonDay[];
  summary: {
    meanAbsoluteReferenceEtDeltaMm: number | null;
    meanAbsoluteReferenceEtDeltaPct: number | null;
    meanAbsoluteCropEtDeltaMm: number | null;
    meanAbsoluteCropEtDeltaPct: number | null;
  };
};

export type PyFao56FieldShadowResult = {
  ok: true;
  engine: 'pyfao56';
  mode: 'shadow';
  shadowScope: 'reference_et_and_single_kc';
  fieldId: string;
  runId: string;
  inputFingerprint: string;
  ready: boolean;
  dayCount: number;
  dates: string[];
  missingInputs: string[];
  excludedDays: Array<{ date: string; reason: string }>;
  sourceVersions: Record<string, unknown>;
  productionAuthority: false;
  fullWaterBalanceReady: false;
  blockedFullWaterBalanceInputs: string[];
  cached: boolean;
  output: PyFao56ShadowResult | null;
  comparison: PyFao56ShadowComparison | null;
};

export type ModelReadinessResult = {
  ok: true;
  engine: 'pcse' | 'aquacrop';
  fieldId: string;
  ready: boolean;
  missingInputs: string[];
  rollout: 'off' | 'shadow' | 'pilot' | 'production';
  productionAuthority: false;
  note: string;
};
