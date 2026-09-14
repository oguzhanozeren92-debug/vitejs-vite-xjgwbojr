import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../supabaseClient';
import ClimateLayerPanel from './ClimateLayerPanel';
import type { ClimateHistoryMode } from '../hooks/useClimateLayerHistory';

type FieldContext = {
  id: string;
  name: string;
  geometry: unknown;
  latitude: number | null;
  longitude: number | null;
};

type DockGroup = 'water' | 'risk' | null;

function readJson(value: unknown) {
  if (typeof value !== 'string') return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function finiteOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function findFieldSelect(page: Element | null) {
  if (!page) return null;
  const selects = Array.from(page.querySelectorAll('select'));
  return selects[0] instanceof HTMLSelectElement ? selects[0] : null;
}

function findLayerChipRow(page: Element | null): { target: HTMLElement | null; group: DockGroup } {
  if (!page) return { target: null, group: null };
  const buttons = Array.from(page.querySelectorAll('button'));
  const waterButton = buttons.find((button) => button.textContent?.trim() === 'Yüzey Nemi');
  if (waterButton?.parentElement instanceof HTMLElement) {
    return { target: waterButton.parentElement, group: 'water' };
  }
  const riskButton = buttons.find((button) => button.textContent?.trim() === 'Hava Sıcaklığı');
  if (riskButton?.parentElement instanceof HTMLElement) {
    return { target: riskButton.parentElement, group: 'risk' };
  }
  return { target: null, group: null };
}

export default function UnifiedMapClimateHost() {
  const [page, setPage] = useState<Element | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [group, setGroup] = useState<DockGroup>(null);
  const [fieldId, setFieldId] = useState('');
  const [field, setField] = useState<FieldContext | null>(null);
  const [mode, setMode] = useState<ClimateHistoryMode>('et0');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let fieldSelect: HTMLSelectElement | null = null;
    let onFieldChange: (() => void) | null = null;

    const sync = () => {
      const nextPage = document.querySelector('.tp-unified-map-page');
      setPage(nextPage);
      const chip = findLayerChipRow(nextPage);
      setTarget(chip.target);
      setGroup(chip.group);

      const nextSelect = findFieldSelect(nextPage);
      if (fieldSelect !== nextSelect) {
        if (fieldSelect && onFieldChange) fieldSelect.removeEventListener('change', onFieldChange);
        fieldSelect = nextSelect;
        onFieldChange = () => setFieldId(fieldSelect?.value ?? '');
        if (fieldSelect) {
          fieldSelect.addEventListener('change', onFieldChange);
          setFieldId(fieldSelect.value);
        } else {
          setFieldId('');
        }
      }
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (fieldSelect && onFieldChange) fieldSelect.removeEventListener('change', onFieldChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadField() {
      setField(null);
      setError('');
      if (!fieldId || !supabase) return;

      const { data, error: queryError } = await supabase
        .from('fields')
        .select('*')
        .eq('id', fieldId)
        .maybeSingle();

      if (cancelled) return;
      if (queryError || !data) {
        setError(queryError?.message || 'Tarla bilgisi alınamadı.');
        return;
      }

      setField({
        id: String(data.id),
        name: String(data.name ?? data.field_name ?? 'Seçili tarla'),
        geometry: readJson(data.parcel_geometry ?? data.parcelGeometry ?? null),
        latitude: finiteOrNull(data.latitude ?? data.lat),
        longitude: finiteOrNull(data.longitude ?? data.lng ?? data.lon),
      });
    }

    void loadField();
    return () => {
      cancelled = true;
    };
  }, [fieldId]);

  useEffect(() => {
    if (!page) setOpen(false);
  }, [page]);

  const buttons = useMemo(() => {
    if (group === 'water') {
      return [
        { mode: 'et0' as const, label: 'ET₀' },
        { mode: 'chirps' as const, label: 'CHIRPS' },
      ];
    }
    if (group === 'risk') {
      return [
        { mode: 'modis_lst' as const, label: 'LST' },
        { mode: 'frost' as const, label: 'Don' },
      ];
    }
    return [];
  }, [group]);

  const chipPortal = target && buttons.length
    ? createPortal(
        <>
          {buttons.map((item) => (
            <button
              key={item.mode}
              type="button"
              onClick={() => {
                setMode(item.mode);
                setOpen(true);
              }}
              title={`${item.label} gerçek veri katmanını aç`}
              style={{
                minHeight: 31,
                flex: '0 0 auto',
                border: '1px solid rgba(6,182,212,.42)',
                borderRadius: 9,
                padding: '0 11px',
                background: 'rgba(4,46,55,.78)',
                color: '#cffafe',
                fontSize: 8.7,
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </button>
          ))}
        </>,
        target,
      )
    : null;

  const overlayPortal = open && page
    ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Su ve iklim katmanları"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'grid',
            alignItems: 'end',
            background: 'rgba(0,0,0,.48)',
            backdropFilter: 'blur(6px)',
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            style={{
              maxHeight: '88vh',
              overflowY: 'auto',
              borderRadius: '24px 24px 0 0',
              border: '1px solid rgba(34,197,94,.24)',
              background: '#020804',
              padding: '14px 14px 22px',
              boxShadow: '0 -20px 60px rgba(0,0,0,.35)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  minWidth: 38,
                  height: 38,
                  borderRadius: 12,
                  border: '1px solid #1e3a24',
                  background: '#061308',
                  color: '#eaf7ee',
                  cursor: 'pointer',
                }}
                aria-label="Kapat"
              >
                ×
              </button>
            </div>

            {error ? (
              <div style={{ padding: 16, color: '#ffc6bb' }}>{error}</div>
            ) : field ? (
              <ClimateLayerPanel
                key={`${field.id}:${mode}`}
                fieldId={field.id}
                fieldName={field.name}
                geometry={field.geometry}
                latitude={field.latitude}
                longitude={field.longitude}
                initialMode={mode}
                periodDays={7}
              />
            ) : (
              <div style={{ padding: 16, color: '#a8bcae' }}>Tarla verisi hazırlanıyor…</div>
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {chipPortal}
      {overlayPortal}
    </>
  );
}
