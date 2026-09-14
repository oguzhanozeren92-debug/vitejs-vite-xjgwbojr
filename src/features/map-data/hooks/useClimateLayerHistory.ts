import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadChirpsRain,
  type ChirpsRainResult,
} from '../services/chirpsRain.service';
import {
  loadFieldClimateLayers,
  type FieldClimateLayer,
  type FieldClimateLayerKey,
  type FieldClimateLayersResult,
} from '../services/fieldClimateLayers.service';
import {
  listFieldClimateHistoryDates,
  type FieldClimateHistoryDate,
} from '../services/fieldClimateHistory.service';
import {
  createModisLstComparisonSources,
  type ModisLstTileSource,
} from '../services/modisLstTiles.service';

export type ClimateHistoryMode = 'et0' | 'chirps' | 'frost' | 'modis_lst';
export type ClimateHistoryState = 'idle' | 'loading' | 'ready' | 'pending' | 'empty' | 'error';

type LoadedClimateHistory =
  | {
      mode: 'et0' | 'frost';
      date: string;
      layer: FieldClimateLayer | null;
      response: FieldClimateLayersResult;
    }
  | {
      mode: 'chirps';
      date: string;
      response: ChirpsRainResult;
    }
  | {
      mode: 'modis_lst';
      date: string;
      terra: ModisLstTileSource;
      aqua: ModisLstTileSource;
    };

const SOURCE_BY_MODE: Partial<Record<ClimateHistoryMode, string>> = {
  et0: 'open_meteo_era5_land_et0',
  frost: 'open_meteo_era5_land_tmin',
  chirps: 'climateserv_chirps',
};

function todayMinusDays(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function normalizeDate(value: string | null | undefined) {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return Number.isFinite(Date.parse(`${text}T00:00:00Z`)) ? text : null;
}

function snapshotLayerForMode(mode: ClimateHistoryMode): FieldClimateLayerKey | null {
  if (mode === 'et0') return 'et0';
  if (mode === 'frost') return 'frost';
  if (mode === 'chirps') return 'rain';
  return null;
}

export function useClimateLayerHistory(
  fieldIdInput: string | undefined,
  mode: ClimateHistoryMode,
  periodDays = 7,
) {
  const fieldId = String(fieldIdInput ?? '').trim();
  const requestRef = useRef(0);
  const [selectedDate, setSelectedDateState] = useState<string | null>(null);
  const [historyDates, setHistoryDates] = useState<FieldClimateHistoryDate[]>([]);
  const [state, setState] = useState<ClimateHistoryState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LoadedClimateHistory | null>(null);

  const safeDays = useMemo(
    () => Math.max(1, Math.min(31, Math.round(Number(periodDays) || 7))),
    [periodDays],
  );

  const refreshHistoryDates = useCallback(async () => {
    const layerKey = snapshotLayerForMode(mode);
    if (!fieldId || !layerKey) {
      setHistoryDates([]);
      return [];
    }

    try {
      const dates = await listFieldClimateHistoryDates(fieldId, layerKey, {
        sourceKey: SOURCE_BY_MODE[mode],
        limit: 90,
      });
      setHistoryDates(dates);
      return dates;
    } catch {
      // History discovery must not hide an otherwise usable live layer.
      setHistoryDates([]);
      return [];
    }
  }, [fieldId, mode]);

  const load = useCallback(async (
    options: { date?: string | null; force?: boolean } = {},
  ): Promise<LoadedClimateHistory | null> => {
    if (!fieldId) {
      setData(null);
      setState('empty');
      setError('Katman geçmişi için tarla kimliği bulunamadı.');
      return null;
    }

    const requestId = ++requestRef.current;
    const requestedDate = normalizeDate(options.date ?? selectedDate);
    setState('loading');
    setError(null);

    try {
      let result: LoadedClimateHistory;

      if (mode === 'modis_lst') {
        // GIBS is a dated raster endpoint. A calendar date selects the real dated
        // Terra/Aqua tiles; it is not treated as proof that every pixel is cloud-free.
        const date = requestedDate ?? todayMinusDays(1);
        const sources = createModisLstComparisonSources(date);
        result = {
          mode,
          date,
          terra: sources.terra,
          aqua: sources.aqua,
        };
      } else if (mode === 'chirps') {
        const response = await loadChirpsRain(fieldId, {
          days: requestedDate ? 1 : safeDays,
          ...(requestedDate ? { endDate: requestedDate } : {}),
        });
        const date = requestedDate ?? response.period.end;
        result = { mode, date, response };
      } else {
        const layerKey: FieldClimateLayerKey = mode;
        const response = await loadFieldClimateLayers(fieldId, {
          days: requestedDate ? 1 : safeDays,
          ...(requestedDate ? { endDate: requestedDate } : {}),
          layers: [layerKey],
        });
        const date = requestedDate ?? response.period.end;
        result = {
          mode,
          date,
          layer: response.layers[layerKey] ?? null,
          response,
        };
      }

      if (requestId !== requestRef.current) return null;
      setData(result);
      setSelectedDateState(result.date || null);

      const isPending = result.mode === 'chirps' && result.response.pending;
      const isAvailable = result.mode === 'modis_lst'
        ? true
        : result.mode === 'chirps'
          ? result.response.available
          : Boolean(result.layer?.available);

      setState(isPending ? 'pending' : isAvailable ? 'ready' : 'empty');
      void refreshHistoryDates();
      return result;
    } catch (caught) {
      if (requestId !== requestRef.current) return null;
      setData(null);
      setState('error');
      setError(caught instanceof Error ? caught.message : 'Katman geçmişi alınamadı.');
      return null;
    }
  }, [fieldId, mode, safeDays, selectedDate, refreshHistoryDates]);

  const selectDate = useCallback((date: string | null) => {
    const normalized = date === null ? null : normalizeDate(date);
    if (date !== null && !normalized) {
      setError('Geçmiş için geçerli bir tarih seçilmedi.');
      return;
    }
    setSelectedDateState(normalized);
  }, []);

  useEffect(() => {
    requestRef.current += 1;
    setSelectedDateState(null);
    setHistoryDates([]);
    setData(null);
    setState(fieldId ? 'idle' : 'empty');
    setError(null);
    if (fieldId) void refreshHistoryDates();
  }, [fieldId, mode, refreshHistoryDates]);

  return {
    mode,
    selectedDate,
    historyDates,
    state,
    error,
    data,
    selectDate,
    load,
    refreshHistoryDates,
    clearDate: () => setSelectedDateState(null),
  };
}
