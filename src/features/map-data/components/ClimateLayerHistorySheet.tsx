import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, X } from 'lucide-react';
import type { FieldClimateHistoryDate } from '../services/fieldClimateHistory.service';
import type { ClimateHistoryMode } from '../hooks/useClimateLayerHistory';
import { getClimateMapLayerDefinition } from '../climateLayerRegistry';

type Props = {
  open: boolean;
  mode: ClimateHistoryMode;
  fieldName: string;
  dates: FieldClimateHistoryDate[];
  selectedDate: string | null;
  loading?: boolean;
  error?: string | null;
  onSelect: (date: string | null) => void;
  onClose: () => void;
};

function formatDate(value: string) {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
}

export default function ClimateLayerHistorySheet({
  open,
  mode,
  fieldName,
  dates,
  selectedDate,
  loading = false,
  error = null,
  onSelect,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [manualDate, setManualDate] = useState('');
  const definition = useMemo(() => getClimateMapLayerDefinition(mode), [mode]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    setManualDate(selectedDate ?? '');
  }, [selectedDate, mode, open]);

  const allowCalendarDate = mode === 'modis_lst';

  return (
    <dialog
      ref={dialogRef}
      className="tp-satellite-history"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="tp-climate-history-title"
    >
      <div className="tp-satellite-history-handle" aria-hidden="true" />
      <header>
        <div>
          <small>{fieldName}</small>
          <h2 id="tp-climate-history-title">Geçmiş · {definition?.shortLabel ?? 'Katman'}</h2>
          <span className="tp-satellite-history-current">
            {definition?.sourceLabel ?? 'Veri kaynağı'}
          </span>
        </div>
        <button
          type="button"
          className="tp-satellite-history-close"
          onClick={onClose}
          aria-label="Kapat"
        >
          <X size={21} />
        </button>
      </header>

      <p className="tp-satellite-history-intro">
        {allowCalendarDate
          ? 'MODIS LST tarihli raster kaynağıdır. Tarih seçildiğinde NASA GIBS üzerindeki o güne ait gerçek tile istenir; bulut veya no-data alanları doldurulmaz.'
          : 'Yalnız daha önce gerçek kaynaktan alınmış ve tarihli olarak saklanmış değerler listelenir.'}
      </p>

      {error ? <p className="tp-satellite-history-error" role="alert">{error}</p> : null}

      {allowCalendarDate ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'end', marginBottom: 14 }}>
          <label style={{ display: 'grid', gap: 6, flex: 1 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Tarih</span>
            <input
              type="date"
              value={manualDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setManualDate(event.target.value)}
              style={{ minHeight: 42, borderRadius: 12, padding: '0 12px' }}
            />
          </label>
          <button
            type="button"
            disabled={!manualDate || loading}
            onClick={() => onSelect(manualDate || null)}
            style={{ minHeight: 42, borderRadius: 12, padding: '0 14px' }}
          >
            <CalendarDays size={16} /> Tarihi aç
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="tp-satellite-history-loading" role="status">
          <span />
          <strong>Geçmiş hazırlanıyor…</strong>
        </div>
      ) : null}

      {!loading && !dates.length && !allowCalendarDate ? (
        <div className="tp-satellite-history-empty">
          <CalendarDays size={24} />
          <strong>Henüz kayıtlı tarih yok</strong>
          <p>Katman gerçek kaynaktan yüklendikçe kullanılabilir tarihler burada oluşacak.</p>
        </div>
      ) : null}

      {dates.length ? (
        <div className="tp-satellite-history-gallery" aria-label="Katman veri tarihleri">
          {dates.map((item) => {
            const active = selectedDate === item.date;
            return (
              <button
                key={item.date}
                type="button"
                className={`tp-satellite-history-card ${active ? 'selected' : ''}`}
                aria-pressed={active}
                disabled={loading}
                onClick={() => onSelect(item.date)}
              >
                <span className="tp-satellite-history-thumb" style={{ display: 'grid', placeItems: 'center' }}>
                  <CalendarDays size={24} />
                  {active ? <i aria-hidden="true"><Check size={13} /></i> : null}
                </span>
                <span className="tp-satellite-history-card-copy">
                  <strong>{formatDate(item.date)}</strong>
                  <small>{item.sources.join(' · ') || definition?.shortLabel}</small>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {selectedDate ? (
        <button type="button" onClick={() => onSelect(null)} disabled={loading}>
          Güncel döneme dön
        </button>
      ) : null}
    </dialog>
  );
}
