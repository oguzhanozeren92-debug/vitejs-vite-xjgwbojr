export type IrrigationDecisionCode =
  | 'needs_data'
  | 'rainfed_monitoring'
  | 'wait'
  | 'irrigation_approaching'
  | 'irrigate_now';

export type IrrigationDecisionConfidence =
  | 'low'
  | 'medium'
  | 'high';

export type IrrigationDecisionDay = {
  date: string;

  estimatedCropWaterUseMm:
    number;

  precipitationMm:
    number;

  effectiveRainMm:
    number;

  estimatedDeficitMm:
    number;

  thresholdReached:
    boolean;
};


export type RainfedStressRiskLevel =
  | 'unknown'
  | 'normal'
  | 'elevated'
  | 'high';

export type RainfedStressAssessment = {
  /*
    Bu alan gerçek toprak nemi/su açığı değildir.
    Son 7 gün + 5 günlük tahminde ETc ile etkili yağış arasındaki
    iklim-temelli su baskısını gösteren erken uyarıdır.
  */
  riskLevel:
    RainfedStressRiskLevel;

  pressureRatio:
    number | null;

  past7DayPrecipitationMm:
    number | null;

  past7DayCropWaterUseMm:
    number | null;

  past7DayEffectiveRainMm:
    number | null;

  past7DayClimateDeficitMm:
    number | null;

  forecast5DayPrecipitationMm:
    number | null;

  forecast5DayCropWaterUseMm:
    number | null;

  forecast5DayEffectiveRainMm:
    number | null;

  forecast5DayClimateDeficitMm:
    number | null;

  combinedClimatePressureMm:
    number | null;

  validPastDayCount:
    number;

  validForecastDayCount:
    number;

  nextMeaningfulRain:
    | {
        date: string;
        precipitationMm: number;
      }
    | null;

  basis:
    'climate_water_balance_not_soil_moisture';
};

export type IrrigationDecisionResult = {
  fieldId: string;

  fieldName:
    | string
    | null;

  cropName:
    | string
    | null;

  decision:
    IrrigationDecisionCode;

  confidence:
    IrrigationDecisionConfidence;

  irrigationStatus:
    | 'irrigated'
    | 'rainfed'
    | 'partial'
    | 'unknown';

  /* Kc calculated for the current visit; never a measurement for past days. */
  currentKc: number | null;

  waterBalance: {
    /*
      Son tam sulamadan bugüne tahmini kök bölgesi açığı.
      Bu değer ancak güvenilir bir baseline varsa üretilir.
    */
    currentDeficitMm:
      number | null;

    stressThresholdMm:
      number | null;

    rootZoneStorageMm:
      number | null;

    currentDeficitRatio:
      number | null;

    projected5DayDeficitMm:
      number | null;

    daysToStressThreshold:
      number | null;

    lastIrrigationDate:
      string | null;

    lastIrrigationAppliedMm:
      number | null;

    baselineAssumption:
      | 'last_irrigation_refilled_root_zone'
      | null;
  };

  rainfedStress:
    | RainfedStressAssessment
    | null;

  recommendation: {
    /*
      Toprağa/kök bölgesine ulaşması gereken NET su.
      Sulama sistemi randımanı henüz uygulanmaz.
    */
    netWaterMm:
      number | null;

    totalNetWaterM3:
      number | null;

    irrigationEfficiencyApplied:
      false;

    grossWaterMm:
      null;

    totalGrossWaterM3:
      null;
  };

  forecast:
    IrrigationDecisionDay[];

  display: {
    headline:
      string;

    summary:
      string;

    action:
      string;

    waterLabel:
      string | null;
  };

  reasons:
    string[];

  missing:
    string[];

  warnings:
    string[];

  generatedAt:
    string;
};
