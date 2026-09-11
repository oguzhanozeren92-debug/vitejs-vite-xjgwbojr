import { useCallback, useEffect, useState } from 'react';

import {
  dismissObservationPhotoPrompt,
  findDueObservationFollowUps,
  touchExistingNdviObservationSignal,
} from '../services/fieldObservation.service';

import type {
  FieldObservationPoint,
} from '../types/fieldObservation';

type Input = {
  fieldId?: unknown;
  satelliteDate?: string | null;
  pusulaResult?: any;
};

function cleanDirection(value: unknown) {
  return String(value ?? '').trim();
}

function healthOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function useNdviObservationFollowUp({
  fieldId,
  satelliteDate,
  pusulaResult,
}: Input) {
  const resolvedFieldId = String(fieldId ?? '').trim();
  const [followUp, setFollowUp] = useState<FieldObservationPoint | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!resolvedFieldId) {
      setFollowUp(null);
      return;
    }

    setLoading(true);
    try {
      const due = await findDueObservationFollowUps(
        resolvedFieldId,
        satelliteDate,
      );
      setFollowUp(due[0] ?? null);
    } catch (error) {
      console.warn('NDVI takip hatırlatması okunamadı:', error);
      setFollowUp(null);
    } finally {
      setLoading(false);
    }
  }, [resolvedFieldId, satelliteDate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!resolvedFieldId) return;

    const layer =
      pusulaResult?.interpretedLayer ??
      pusulaResult?.activeLayer;

    if (layer !== 'vegetation') return;

    const findings =
      pusulaResult?.context?.ndvi?.spatial?.findings;

    if (!Array.isArray(findings)) return;

    const weak = findings
      .map((item: any) => ({
        direction: cleanDirection(item?.area ?? item?.direction),
        relativeHealth: healthOrNull(item?.ndvi?.relativeHealth),
      }))
      .filter(
        (item: any) =>
          item.direction &&
          item.relativeHealth !== null &&
          item.relativeHealth < 0.32,
      );

    if (!weak.length) return;

    void Promise.all(
      weak.map((item: any) =>
        touchExistingNdviObservationSignal({
          fieldId: resolvedFieldId,
          direction: item.direction,
          relativeHealth: item.relativeHealth,
          satelliteDate,
        }).catch(() => null),
      ),
    ).then(() => {
      void refresh();
    });
  }, [
    resolvedFieldId,
    satelliteDate,
    pusulaResult,
    refresh,
  ]);

  const dismiss = useCallback(async () => {
    if (!followUp) return;

    try {
      await dismissObservationPhotoPrompt(followUp.id, 7);
    } catch (error) {
      console.warn('NDVI takip hatırlatması ertelenemedi:', error);
    } finally {
      setFollowUp(null);
    }
  }, [followUp]);

  const consume = useCallback(() => {
    setFollowUp(null);
  }, []);

  return {
    followUp,
    loading,
    refresh,
    dismiss,
    consume,
  };
}
