import { useCallback, useEffect, useState } from 'react';
import type { IrrigationSchedulingPilotResult } from '../types/irrigationSchedulingPilot';
import type { AquaCropPilotRunResponse } from '../../model-engines/services/aquacropPilotRun.service';

type PilotState = {
  fieldKey: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: IrrigationSchedulingPilotResult | null;
  error: string | null;
};

type RunState = {
  fieldKey: string;
  status: 'idle' | 'running' | 'completed' | 'blocked' | 'error';
  data: AquaCropPilotRunResponse | null;
  error: string | null;
};

const INITIAL_STATE: PilotState = {
  fieldKey: '',
  status: 'idle',
  data: null,
  error: null,
};

const INITIAL_RUN_STATE: RunState = {
  fieldKey: '',
  status: 'idle',
  data: null,
  error: null,
};

/**
 * AquaCrop readiness + mevcut Irrigation Engine sonucunu tek pilot kontratta toplar.
 * Gercek AquaCrop calismasi otomatik tetiklenmez; runAquaCropPilot acikca cagrilmalidir.
 * Production sulama karari degismez ve sahte fallback veri uretilmez.
 */
export function useIrrigationSchedulingPilot(field: any | null | undefined) {
  const fieldKey = field?.id != null ? String(field.id) : '';
  const isDemo = Boolean(field?.demo);
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<PilotState>(INITIAL_STATE);
  const [runState, setRunState] = useState<RunState>(INITIAL_RUN_STATE);

  useEffect(() => {
    let cancelled = false;

    if (!fieldKey || isDemo) {
      setState(INITIAL_STATE);
      setRunState(INITIAL_RUN_STATE);
      return () => {
        cancelled = true;
      };
    }

    setState({
      fieldKey,
      status: 'loading',
      data: null,
      error: null,
    });

    void (async () => {
      try {
        const module = await import('../services/irrigationSchedulingPilot.service');
        const result = await module.calculateIrrigationSchedulingPilot({ id: fieldKey });

        if (cancelled) return;

        setState({
          fieldKey,
          status: 'ready',
          data: result,
          error: null,
        });
      } catch (error: unknown) {
        if (cancelled) return;

        setState({
          fieldKey,
          status: 'error',
          data: null,
          error:
            error instanceof Error
              ? error.message
              : 'Sulama zamanlama pilotu hazirlanamadi.',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fieldKey, isDemo, refreshKey]);

  useEffect(() => {
    if (!fieldKey || isDemo || typeof window === 'undefined') return;

    const handleContextUpdated = (event: Event) => {
      const detail = (event as CustomEvent)?.detail ?? {};
      const changedFieldId = String(detail?.fieldId ?? '');
      if (changedFieldId !== fieldKey) return;

      const changedFields = Array.isArray(detail?.changedFields)
        ? detail.changedFields.map((item: unknown) => String(item))
        : [];

      if (
        changedFields.length > 0 &&
        !changedFields.some((name) =>
          [
            'aquacrop_initial_water_content',
            'aquacrop_irrigation_management',
            'irrigation_status',
            'activities',
            'irrigation_history',
            'soil_analysis',
            'field_data_snapshot',
          ].includes(name),
        )
      ) {
        return;
      }

      setRefreshKey((value) => value + 1);
      setRunState(INITIAL_RUN_STATE);
    };

    window.addEventListener(
      'tp:field-context-updated',
      handleContextUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        'tp:field-context-updated',
        handleContextUpdated as EventListener,
      );
    };
  }, [fieldKey, isDemo]);

  const refresh = useCallback(() => {
    if (!fieldKey || isDemo) return;
    setRefreshKey((value) => value + 1);
    setRunState(INITIAL_RUN_STATE);
  }, [fieldKey, isDemo]);

  const runAquaCropPilot = useCallback(async () => {
    if (!fieldKey || isDemo) {
      throw new Error('AquaCrop pilotu icin gercek bir tarla gerekli.');
    }

    setRunState({ fieldKey, status: 'running', data: null, error: null });

    try {
      const module = await import('../../model-engines/services/aquacropPilotRun.service');
      const result = await module.runAquaCropPilot(fieldKey);
      setRunState({
        fieldKey,
        status: result.blocked ? 'blocked' : 'completed',
        data: result,
        error: null,
      });
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'AquaCrop pilotu calistirilamadi.';
      setRunState({ fieldKey, status: 'error', data: null, error: message });
      throw error;
    }
  }, [fieldKey, isDemo]);

  const stateBelongsToField = state.fieldKey === fieldKey;
  const runStateBelongsToField = runState.fieldKey === fieldKey;

  return {
    result: stateBelongsToField ? state.data : null,
    status: stateBelongsToField ? state.status : fieldKey ? 'loading' : 'idle',
    loading: stateBelongsToField ? state.status === 'loading' : Boolean(fieldKey),
    error: stateBelongsToField ? state.error : null,
    refresh,
    runAquaCropPilot,
    aquaCropRun: runStateBelongsToField ? runState.data : null,
    aquaCropRunStatus: runStateBelongsToField ? runState.status : 'idle',
    aquaCropRunLoading: runStateBelongsToField && runState.status === 'running',
    aquaCropRunError: runStateBelongsToField ? runState.error : null,
  };
}
