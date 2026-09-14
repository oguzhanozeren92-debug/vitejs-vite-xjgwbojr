import { useCallback, useEffect, useRef, useState } from 'react';
import { loadFieldObservationTrend } from '../services/fieldObservationTrend.service';
import type { FieldObservationTrendSummary } from '../types/fieldObservationTrend';

export type FieldObservationTrendState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export function useFieldObservationTrend(pointIdInput?: string | null) {
  const pointId = String(pointIdInput ?? '').trim();
  const requestRef = useRef(0);
  const [state, setState] = useState<FieldObservationTrendState>('idle');
  const [data, setData] = useState<FieldObservationTrendSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!pointId) {
      setData(null);
      setError(null);
      setState('empty');
      return null;
    }

    const requestId = ++requestRef.current;
    setState('loading');
    setError(null);

    try {
      const result = await loadFieldObservationTrend(pointId);
      if (requestId !== requestRef.current) return null;
      setData(result);
      setState(result.photoCount > 0 ? 'ready' : 'empty');
      return result;
    } catch (caught) {
      if (requestId !== requestRef.current) return null;
      setData(null);
      setState('error');
      setError(caught instanceof Error ? caught.message : 'Takip noktası geçmişi alınamadı.');
      return null;
    }
  }, [pointId]);

  useEffect(() => {
    requestRef.current += 1;
    setData(null);
    setError(null);
    setState(pointId ? 'idle' : 'empty');
  }, [pointId]);

  return {
    pointId,
    state,
    data,
    error,
    refresh,
  };
}
