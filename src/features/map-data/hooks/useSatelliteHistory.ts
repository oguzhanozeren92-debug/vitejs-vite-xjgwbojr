import { useEffect, useRef, useState } from 'react';
import type { SatelliteHealthResult } from '../../../lib/satelliteService';
import { fetchHistoricalSatellite, listSatelliteDates } from '../services/satelliteHistory';

export function useSatelliteHistory(fieldId: string | undefined, geometry: unknown) {
  const [open, setOpen] = useState(false);
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ fieldId: string; data: SatelliteHealthResult } | null>(null);
  const request = useRef(0);
  const cache = useRef(new Map<string, SatelliteHealthResult>());

  useEffect(() => {
    request.current++;
    setOpen(false);
    setSelection(null);
    setDates([]);
    setError(null);
    setLoading(false);
    cache.current.clear();
    return () => { request.current++; };
  }, [fieldId]);

  async function show() {
    setOpen(true);
    setError(null);
    if (!fieldId || !geometry) {
      setError('Önce parsel sınırları olan bir tarla ekle.');
      return;
    }
    if (dates.length) return;
    const id = ++request.current;
    setLoading(true);
    try {
      const result = await listSatelliteDates(geometry);
      if (id === request.current) setDates(result);
    } catch (e) {
      if (id === request.current) setError(e instanceof Error ? e.message : 'Tarihler alınamadı.');
    } finally { if (id === request.current) setLoading(false); }
  }

  async function select(date: string | null) {
    if (!date) {
      request.current++;
      setSelection(null);
      setLoading(false);
      setOpen(false);
      return;
    }
    if (!fieldId || !geometry) return;
    const id = ++request.current;
    setError(null);
    setLoading(true);
    try {
      const result = cache.current.get(date) ?? await fetchHistoricalSatellite(geometry, date);
      if (id !== request.current) return;
      cache.current.set(date, result);
      setSelection({ fieldId, data: result });
      setOpen(false);
    } catch (e) {
      if (id === request.current) setError(e instanceof Error ? e.message : 'Görüntü alınamadı.');
    } finally { if (id === request.current) setLoading(false); }
  }

  function close() { request.current++; setOpen(false); setLoading(false); }
  return { open, dates, loading, error, show, select, close,
    data: selection?.fieldId === fieldId ? selection?.data ?? null : null };
}
