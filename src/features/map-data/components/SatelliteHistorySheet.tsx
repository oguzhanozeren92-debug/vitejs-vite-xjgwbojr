import { useEffect, useRef } from 'react';
import { Check, Image as ImageIcon, X } from 'lucide-react';
import { getSatelliteHistoryPreview } from '../services/satelliteHistory';
import './SatelliteHistorySheet.css';

type Props = {
  open: boolean;
  dates: string[];
  loading: boolean;
  error: string | null;
  fieldName: string;
  selectedDate?: string | null;
  onSelect: (date: string | null) => void;
  onClose: () => void;
};

function formatDate(date: string) {
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export default function SatelliteHistorySheet(props: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const currentDate = props.dates[0] ?? null;

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;

    if (props.open) {
      if (!node.open) node.showModal();
    } else if (node.open) {
      node.close();
    }
  }, [props.open]);

  return (
    <dialog
      ref={dialog}
      className="tp-satellite-history"
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}
      aria-labelledby="tp-satellite-history-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div className="tp-satellite-history-handle" aria-hidden="true" />

      <header>
        <div>
          <small>{props.fieldName}</small>
          <h2 id="tp-satellite-history-title">Uydu Geçmişi</h2>
          <span className="tp-satellite-history-current">
            Güncel ölçüm: {currentDate ? formatDate(currentDate) : 'yükleniyor'}
          </span>
        </div>
        <button
          type="button"
          className="tp-satellite-history-close"
          onClick={props.onClose}
          aria-label="Kapat"
        >
          <X size={21} />
        </button>
      </header>

      <p className="tp-satellite-history-intro">
        Son 6 ayın uygun Sentinel-2 çekimleri. Önizlemeye dokun, o tarihin NDVI görüntüsü haritada açılsın.
      </p>

      {props.error ? (
        <p className="tp-satellite-history-error" role="alert">
          {props.error}
        </p>
      ) : null}

      {props.loading && !props.dates.length ? (
        <div className="tp-satellite-history-loading" role="status">
          <span />
          <strong>Uydu arşivi hazırlanıyor…</strong>
        </div>
      ) : null}

      {!props.loading && !props.error && !props.dates.length ? (
        <div className="tp-satellite-history-empty">
          <ImageIcon size={25} />
          <strong>Uygun çekim bulunamadı</strong>
          <p>Bulut filtresine uyan Sentinel-2 ölçümü bu dönemde bulunamadı.</p>
        </div>
      ) : null}

      {props.dates.length ? (
        <div className="tp-satellite-history-gallery" aria-label="Uydu görüntüsü tarihleri">
          {props.dates.map((date, index) => {
            const preview = getSatelliteHistoryPreview(date);
            const isCurrent = index === 0;
            const isSelected = props.selectedDate
              ? props.selectedDate === date
              : isCurrent;

            return (
              <button
                type="button"
                key={date}
                className={`tp-satellite-history-card ${isSelected ? 'selected' : ''}`}
                aria-pressed={isSelected}
                disabled={props.loading}
                onClick={() => props.onSelect(isCurrent ? null : date)}
              >
                <span className="tp-satellite-history-thumb">
                  {preview ? (
                    <img src={preview} alt={`${formatDate(date)} NDVI önizlemesi`} draggable={false} />
                  ) : (
                    <span className="tp-satellite-history-thumb-loading" aria-hidden="true">
                      <ImageIcon size={20} />
                    </span>
                  )}

                  {isCurrent ? (
                    <em>Güncel</em>
                  ) : null}

                  {isSelected ? (
                    <i aria-hidden="true"><Check size={13} /></i>
                  ) : null}
                </span>

                <span className="tp-satellite-history-card-copy">
                  <strong>{isCurrent ? 'Son ölçüm' : formatDate(date)}</strong>
                  <small>{isCurrent ? formatDate(date) : 'Sentinel-2 · NDVI'}</small>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </dialog>
  );
}
