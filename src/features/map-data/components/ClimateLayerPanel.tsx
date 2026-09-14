import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import ClimateLayerHistorySheet from './ClimateLayerHistorySheet';
import ClimateLayerMapSurface from './ClimateLayerMapSurface';
import { CLIMATE_MAP_LAYERS, getClimateMapLayerDefinition } from '../climateLayerRegistry';
import {
  useClimateLayerHistory,
  type ClimateHistoryMode,
} from '../hooks/useClimateLayerHistory';

type Props = {
  fieldId: string;
  fieldName: string;
  geometry: unknown;
  latitude?: number | null;
  longitude?: number | null;
  initialMode?: ClimateHistoryMode;
  periodDays?: number;
};

function modeValue(data: ReturnType<typeof useClimateLayerHistory>['data']) {
  if (!data) return { value: null, unit: '', source: '', date: null as string | null };

  if (data.mode === 'modis_lst') {
    return {
      value: null,
      unit: '',
      source: data.terra.title,
      date: data.date,
    };
  }

  if (data.mode === 'chirps') {
    return {
      value: data.response.stats?.totalMm ?? null,
      unit: 'mm',
      source: data.response.source,
      date: data.date,
    };
  }

  const day = data.layer?.days?.find((item) => item.date === data.date)
    ?? data.layer?.days?.at(-1)
    ?? null;

  return {
    value: day?.value ?? null,
    unit: day?.unit ?? data.layer?.unit ?? '',
    source: data.layer?.source ?? '',
    date: data.date,
  };
}

export default function ClimateLayerPanel({
  fieldId,
  fieldName,
  geometry,
  latitude,
  longitude,
  initialMode = 'et0',
  periodDays = 7,
}: Props) {
  const [mode, setMode] = useState<ClimateHistoryMode>(initialMode);
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = useClimateLayerHistory(fieldId, mode, periodDays);
  const definition = useMemo(() => getClimateMapLayerDefinition(mode), [mode]);
  const display = useMemo(() => modeValue(history.data), [history.data]);

  useEffect(() => {
    void history.load({ force: false });
    // history.load changes when selectedDate changes. Initial/live loading should
    // follow field/mode/period only; explicit date selection is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId, mode, periodDays]);

  const selectHistoryDate = async (date: string | null) => {
    history.selectDate(date);
    setHistoryOpen(false);
    await history.load({ date, force: true });
  };

  const terraRaster = history.data?.mode === 'modis_lst'
    ? history.data.terra
    : null;

  return (
    <section style={styles.panel} aria-label="Su ve iklim katmanları">
      <div style={styles.header}>
        <div>
          <span style={styles.eyebrow}>SU & İKLİM</span>
          <h3 style={styles.title}>{definition?.label ?? 'İklim katmanı'}</h3>
          <p style={styles.copy}>{definition?.note}</p>
        </div>
        <button type="button" style={styles.historyButton} onClick={() => setHistoryOpen(true)}>
          ◷ Geçmiş
        </button>
      </div>

      <div style={styles.tabs}>
        {CLIMATE_MAP_LAYERS.map((layer) => {
          const active = layer.key === mode;
          return (
            <button
              type="button"
              key={layer.key}
              onClick={() => setMode(layer.key)}
              style={{
                ...styles.tab,
                ...(active ? styles.tabActive : {}),
              }}
            >
              {layer.shortLabel}
            </button>
          );
        })}
      </div>

      {history.state === 'loading' ? (
        <div style={styles.stateBox}>Katman gerçek kaynaktan hazırlanıyor…</div>
      ) : null}
      {history.state === 'pending' ? (
        <div style={styles.stateBox}>CHIRPS sağlayıcı işi devam ediyor. Hazır olduğunda kayıtlı tarih oluşacak.</div>
      ) : null}
      {history.state === 'error' ? (
        <div style={{ ...styles.stateBox, ...styles.error }}>{history.error}</div>
      ) : null}
      {history.state === 'empty' && !history.error ? (
        <div style={styles.stateBox}>Bu tarla ve dönem için gerçek kaynak verisi bulunamadı.</div>
      ) : null}

      {history.data ? (
        <ClimateLayerMapSurface
          mode={mode}
          fieldName={fieldName}
          geometry={geometry}
          latitude={latitude}
          longitude={longitude}
          raster={terraRaster}
          value={display.value}
          unit={display.unit}
          dataDate={display.date}
          sourceLabel={display.source || definition?.sourceLabel || ''}
        />
      ) : null}

      <ClimateLayerHistorySheet
        open={historyOpen}
        mode={mode}
        fieldName={fieldName}
        dates={history.historyDates}
        selectedDate={history.selectedDate}
        loading={history.state === 'loading'}
        error={history.error}
        onSelect={(date) => void selectHistoryDate(date)}
        onClose={() => setHistoryOpen(false)}
      />
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    display: 'grid',
    gap: 14,
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 14,
    alignItems: 'start',
  },
  eyebrow: {
    display: 'block',
    marginBottom: 5,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '.14em',
    color: '#67d99a',
  },
  title: { margin: 0, fontSize: 19, color: '#eaf7ee' },
  copy: { margin: '5px 0 0', maxWidth: 720, fontSize: 12, lineHeight: 1.45, color: '#94aa9b' },
  historyButton: {
    minHeight: 38,
    padding: '0 13px',
    flex: '0 0 auto',
    borderRadius: 12,
    border: '1px solid rgba(6,182,212,.28)',
    background: 'rgba(6,182,212,.08)',
    color: '#bdebf2',
    fontWeight: 800,
    cursor: 'pointer',
  },
  tabs: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  tab: {
    minHeight: 36,
    padding: '0 13px',
    borderRadius: 999,
    border: '1px solid #1e3a24',
    background: '#061308',
    color: '#9fb6a6',
    fontWeight: 800,
    cursor: 'pointer',
  },
  tabActive: {
    border: '1px solid rgba(34,197,94,.65)',
    background: 'rgba(34,197,94,.13)',
    color: '#dcffe8',
    boxShadow: '0 0 16px rgba(34,197,94,.08)',
  },
  stateBox: {
    minHeight: 54,
    display: 'grid',
    placeItems: 'center',
    padding: 12,
    borderRadius: 14,
    border: '1px solid #1e3a24',
    background: 'rgba(6,19,8,.72)',
    color: '#a8bcae',
    fontSize: 12,
    textAlign: 'center',
  },
  error: {
    color: '#ffc6bb',
    border: '1px solid rgba(239,68,68,.28)',
    background: 'rgba(239,68,68,.06)',
  },
};
