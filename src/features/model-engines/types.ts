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
