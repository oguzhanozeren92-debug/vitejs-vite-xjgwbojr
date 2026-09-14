import { calculateIrrigationDecision } from './irrigationDecision.service';
import { checkCropModelReadiness } from '../../model-engines/services/modelEngineShadow.service';
import type { IrrigationSchedulingPilotResult } from '../types/irrigationSchedulingPilot';

function normalizeFieldId(field: { id?: unknown } | null | undefined) {
  const fieldId = String(field?.id ?? '').trim();
  if (!fieldId) {
    throw new Error('Sulama zamanlama pilotu icin tarla kimligi gerekli.');
  }
  return fieldId;
}

function firstThresholdDate(
  forecast: Array<{ date: string; thresholdReached: boolean }>,
): string | null {
  const day = forecast.find((item) => item.thresholdReached);
  return day?.date ? String(day.date) : null;
}

/**
 * Real-data pilot coordinator.
 *
 * - Existing Irrigation Engine remains the production authority.
 * - AquaCrop is only a server-derived readiness/pilot signal here.
 * - No agricultural default, synthetic soil value or fake weather value is created.
 * - A pilot schedule is emitted only when AquaCrop's required real inputs are ready.
 */
export async function calculateIrrigationSchedulingPilot(
  field: { id?: unknown } | null | undefined,
): Promise<IrrigationSchedulingPilotResult> {
  const fieldId = normalizeFieldId(field);

  const [authoritativeDecision, aquaCrop] = await Promise.all([
    calculateIrrigationDecision({ id: fieldId }),
    checkCropModelReadiness('aquacrop', fieldId),
  ]);

  const blockedBy = new Set<string>();

  for (const item of authoritativeDecision.missing) {
    blockedBy.add(`irrigation:${item}`);
  }

  for (const item of aquaCrop.missingInputs) {
    blockedBy.add(`aquacrop:${item}`);
  }

  const rainfed = authoritativeDecision.irrigationStatus === 'rainfed';
  const decisionNeedsData = authoritativeDecision.decision === 'needs_data';

  let status: IrrigationSchedulingPilotResult['pilotSchedule']['status'];
  let basis: IrrigationSchedulingPilotResult['pilotSchedule']['basis'];
  let candidateDate: string | null = null;
  let candidateNetWaterMm: number | null = null;
  let candidateTotalNetWaterM3: number | null = null;

  if (rainfed) {
    status = 'rainfed_monitoring';
    basis = 'rainfed_monitoring';
  } else if (decisionNeedsData || !aquaCrop.ready) {
    status = 'needs_data';
    basis = 'blocked_missing_real_inputs';
  } else {
    status = 'pilot_ready';
    basis = 'existing_irrigation_engine';

    if (authoritativeDecision.decision === 'irrigate_now') {
      candidateDate = authoritativeDecision.generatedAt.slice(0, 10);
    } else if (authoritativeDecision.decision === 'irrigation_approaching') {
      candidateDate = firstThresholdDate(authoritativeDecision.forecast);
    }

    candidateNetWaterMm = authoritativeDecision.recommendation.netWaterMm;
    candidateTotalNetWaterM3 =
      authoritativeDecision.recommendation.totalNetWaterM3;
  }

  return {
    fieldId,
    generatedAt: new Date().toISOString(),
    productionAuthority: false,

    authoritativeDecision,

    aquaCrop: {
      rollout: 'pilot',
      ready: aquaCrop.ready,
      productionAuthority: false,
      availableInputs: aquaCrop.availableInputs,
      missingInputs: aquaCrop.missingInputs,
      evidence: aquaCrop.evidence,
      context: aquaCrop.context,
    },

    etContext: {
      source: 'tarlapusula-irrigation-engine',
      currentKc: authoritativeDecision.currentKc,
      currentDeficitMm: authoritativeDecision.waterBalance.currentDeficitMm,
      projected5DayDeficitMm:
        authoritativeDecision.waterBalance.projected5DayDeficitMm,
      stressThresholdMm: authoritativeDecision.waterBalance.stressThresholdMm,
      daysToStressThreshold:
        authoritativeDecision.waterBalance.daysToStressThreshold,
      forecastDayCount: authoritativeDecision.forecast.length,
    },

    pilotSchedule: {
      status,
      candidateDate,
      candidateNetWaterMm,
      candidateTotalNetWaterM3,
      basis,
      blockedBy: Array.from(blockedBy),
    },
  };
}
