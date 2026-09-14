import { useCallback, useEffect, useState } from 'react';
import type { IrrigationSchedulingPilotResult } from '../types/irrigationSchedulingPilot';

type PilotState = {
  fieldKey: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: IrrigationSchedulingPilotResult | null;
  error: string | null;
};

const INITIAL_STATE: PilotState = {
  fieldKey: '',
  status: 'idle',
  data: null,
  error: null,
};

/**
 * AquaCrop readiness + mevcut Irrigation Engine sonucunu tek pilot kontratta toplar.
 * Bu hook production sulama kararini degistirmez ve UI'ya sahte fallback veri vermez.
 */
export function useIrrigationSchedulingPilot(field: any | null | undefined) {
  const fieldKey = field?.id != null ? String(field.id) : '';
  const isDemo = Boolean(field?.demo);
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<PilotState>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;

    if (!fieldKey || isDemo) {
      setState(INITIAL_STATE);
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
  }, [fieldKey, isDemo]);

  const stateBelongsToField = state.fieldKey === fieldKey;

  return {
    result: stateBelongsToField ? state.data : null,
    status: stateBelongsToField ? state.status : fieldKey ? 'loading' : 'idle',
    loading: stateBelongsToField ? state.status === 'loading' : Boolean(fieldKey),
    error: stateBelongsToField ? state.error : null,
    refresh,
  };
}
