export type PyFao56WeatherDay = {
  date: string;
  solarRadiationMjM2: number;
  tmaxC: number;
  tminC: number;
  rhmaxPct: number;
  rhminPct: number;
  windMS: number;
  rainMm: number;
};

export type PyFao56ShadowInput = {
  fieldId: string;
  station: {
    latitude: number;
    elevationM: number;
    windHeightM: number;
  };
  parameters: Record<string, number | string | boolean>;
  days: PyFao56WeatherDay[];
};

export type PyFao56ShadowDay = {
  date: string;
  referenceEtMm: number;
  cropEtMm: number;
  actualEtMm: number;
  rainMm: number;
  rootZoneDepletionMm: number;
  readilyAvailableWaterMm: number;
};

export type PyFao56ShadowResult = {
  ok: true;
  mode: 'shadow';
  engine: 'pyfao56';
  fieldId: string;
  productionAuthority: false;
  days: PyFao56ShadowDay[];
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
