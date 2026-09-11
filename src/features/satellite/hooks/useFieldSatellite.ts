import { useState } from 'react';
import { analyzeFieldSatellite } from '../../../lib/satelliteService';
import type { Field, FieldSatelliteState } from '../../../types';

export function useFieldSatellite() {
  const [satelliteByField, setSatelliteByField] = useState<Record<string, FieldSatelliteState>>({});

  const loadFieldSatellite = async (field: Field, force = false) => {
    const key = String(field.id);
    const currentState = satelliteByField[key];

    if (currentState?.status === 'loading') return;
    if (!force && currentState?.status === 'ready') return;

    if (!field.parcelGeometry) {
      setSatelliteByField((current) => ({
        ...current,
        [key]: {
          status: 'error',
          message: 'Uydu analizi için önce gerçek ada/parsel sınırı bulunmalı.',
        },
      }));
      return;
    }

    setSatelliteByField((current) => ({
      ...current,
      [key]: {
        status: 'loading',
        data: current[key]?.data,
      },
    }));

    try {
      const data = await analyzeFieldSatellite(field.parcelGeometry);
      setSatelliteByField((current) => ({
        ...current,
        [key]: { status: 'ready', data },
      }));
    } catch (error) {
      setSatelliteByField((current) => ({
        ...current,
        [key]: {
          status: 'error',
          data: current[key]?.data,
          message: error instanceof Error ? error.message : 'Uydu analizi yüklenemedi.',
        },
      }));
    }
  };

  return { satelliteByField, loadFieldSatellite };
}
