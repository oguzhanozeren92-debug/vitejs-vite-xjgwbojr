import { useEffect, useState } from 'react';
import { fetchHomeSatelliteDate } from '../services/homeSatelliteDate.service';

export function useHomeSatelliteDate({
  fieldKey,
  parcelGeometry,
  satelliteDate,
}: {
  fieldKey: string;
  parcelGeometry?: unknown;
  satelliteDate?: unknown;
}) {
  const [resolvedFromService, setResolvedFromService] = useState('');

  useEffect(() => {
    let alive = true;
    setResolvedFromService('');

    if (!fieldKey || !parcelGeometry) {
      return () => {
        alive = false;
      };
    }

    void fetchHomeSatelliteDate(parcelGeometry)
      .then((value) => {
        if (alive && value) setResolvedFromService(value);
      })
      .catch((error) => {
        console.warn('Sentinel-2 görüntü tarihi alınamadı:', error);
      });

    return () => {
      alive = false;
    };
  }, [fieldKey, parcelGeometry]);

  return resolvedFromService || String(satelliteDate ?? '').trim();
}
