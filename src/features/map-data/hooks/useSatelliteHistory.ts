import { useEffect, useRef, useState } from 'react';
import type { SatelliteHealthResult } from '../../../lib/satelliteService';
import {
  fetchHistoricalSatellite,
  listSatelliteDates,
} from '../services/satelliteHistory';

const PREVIEW_LIMIT = 6;

export function useSatelliteHistory(
  fieldId: string | undefined,
  geometry: unknown,
) {
  const [open, setOpen] = useState(false);
  const [dates, setDates] = useState<string[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<{
    fieldId: string;
    data: SatelliteHealthResult;
  } | null>(null);
  const request = useRef(0);
  const cache = useRef(new Map<string, SatelliteHealthResult>());

  useEffect(() => {
    request.current++;
    setOpen(false);
    setSelection(null);
    setDates([]);
    setPreviews({});
    setError(null);
    setLoading(false);
    setPreviewLoading(false);
    cache.current.clear();
    return () => {
      request.current++;
    };
  }, [fieldId]);

  async function warmPreviews(
    previewDates: string[],
    requestId: number,
  ) {
    if (!geometry || !previewDates.length) return;

    setPreviewLoading(true);

    try {
      // Full historical result is cached. The same payload is reused if the
      // user taps the card, so preview warming does not duplicate that date's
      // later request. Sequential fetch also avoids hammering Copernicus.
      for (const date of previewDates.slice(0, PREVIEW_LIMIT)) {
        if (requestId !== request.current) return;
        if (cache.current.has(date)) {
          const cached = cache.current.get(date);
          if (cached?.ndviImage) {
            setPreviews((current) => ({
              ...current,
              [date]: cached.ndviImage,
            }));
          }
          continue;
        }

        try {
          const result = await fetchHistoricalSatellite(geometry, date);
          if (requestId !== request.current) return;
          cache.current.set(date, result);
          if (result.ndviImage) {
            setPreviews((current) => ({
              ...current,
              [date]: result.ndviImage,
            }));
          }
        } catch {
          // Tek bir sahne preview üretmezse bütün arşiv galerisi bozulmaz.
        }
      }
    } finally {
      if (requestId === request.current) setPreviewLoading(false);
    }
  }

  async function show() {
    setOpen(true);
    setError(null);

    if (!fieldId || !geometry) {
      setError('Önce parsel sınırları olan bir tarla ekle.');
      return;
    }

    if (dates.length) {
      const id = request.current;
      void warmPreviews(
        dates.filter((date) => !previews[date]),
        id,
      );
      return;
    }

    const id = ++request.current;
    setLoading(true);

    try {
      const result = await listSatelliteDates(geometry);
      if (id !== request.current) return;
      setDates(result);
      setLoading(false);
      void warmPreviews(result, id);
    } catch (caught) {
      if (id === request.current) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Tarihler alınamadı.',
        );
      }
    } finally {
      if (id === request.current) setLoading(false);
    }
  }

  async function select(date: string | null) {
    if (!date) {
      request.current++;
      setSelection(null);
      setLoading(false);
      setPreviewLoading(false);
      setOpen(false);
      return;
    }

    if (!fieldId || !geometry) return;
    const id = ++request.current;
    setError(null);
    setLoading(true);

    try {
      const result =
        cache.current.get(date) ??
        (await fetchHistoricalSatellite(geometry, date));
      if (id !== request.current) return;

      cache.current.set(date, result);
      if (result.ndviImage) {
        setPreviews((current) => ({
          ...current,
          [date]: result.ndviImage,
        }));
      }
      setSelection({ fieldId, data: result });
      setOpen(false);
    } catch (caught) {
      if (id === request.current) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Görüntü alınamadı.',
        );
      }
    } finally {
      if (id === request.current) setLoading(false);
    }
  }

  function close() {
    request.current++;
    setOpen(false);
    setLoading(false);
    setPreviewLoading(false);
  }

  return {
    open,
    dates,
    previews,
    loading,
    previewLoading,
    error,
    show,
    select,
    close,
    data:
      selection?.fieldId === fieldId
        ? selection?.data ?? null
        : null,
  };
}
