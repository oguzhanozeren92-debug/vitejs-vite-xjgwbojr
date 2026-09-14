import type { IrrigationDecisionResult } from './irrigationDecision';

export type IrrigationSchedulingPilotStatus =
  | 'needs_data'
  | 'rainfed_monitoring'
  | 'pilot_ready';

export type IrrigationSchedulingPilotResult = {
  fieldId: string;
  generatedAt: string;

  /**
   * Pilot katmani production sulama otoritesi degildir.
   * Mevcut Irrigation Engine karari authoritativeDecision icinde aynen korunur.
   */
  productionAuthority: false;

  authoritativeDecision: IrrigationDecisionResult;

  aquaCrop: {
    rollout: 'pilot';
    ready: boolean;
    productionAuthority: false;
    availableInputs: string[];
    missingInputs: string[];
    evidence: Record<string, unknown>;
    context: Record<string, unknown>;
    inputAdapters: {
      soilProfileCandidate: Record<string, unknown>;
      initialWaterContent: Record<string, unknown>;
      irrigationManagement: Record<string, unknown>;
    };
  };

  etContext: {
    source: 'tarlapusula-irrigation-engine';
    currentKc: number | null;
    currentDeficitMm: number | null;
    projected5DayDeficitMm: number | null;
    stressThresholdMm: number | null;
    daysToStressThreshold: number | null;
    forecastDayCount: number;
  };

  pilotSchedule: {
    status: IrrigationSchedulingPilotStatus;
    candidateDate: string | null;
    candidateNetWaterMm: number | null;
    candidateTotalNetWaterM3: number | null;
    basis:
      | 'existing_irrigation_engine'
      | 'rainfed_monitoring'
      | 'blocked_missing_real_inputs';
    blockedBy: string[];
  };
};
