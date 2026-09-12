import { useRef } from 'react';
import './HomeFieldDataStatus.css';

type DataStatus = 'ready' | 'loading' | 'missing' | 'error';

export type HomeFieldDataStatusItem = {
  label: string;
  status: DataStatus;
  detail: string;
};

export default function HomeFieldDataStatus({
  fieldName,
  items,
}: {
  fieldName?: string | null;
  items: HomeFieldDataStatusItem[];
}) {
  const readyCount = items.filter((item) => item.status === 'ready').length;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="tp-home-data-status"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        <span className="tp-home-data-status-heading">
          <small>Tarla verileri</small>
          <strong>{fieldName ? `${readyCount}/${items.length} kaynak hazır` : 'Tarla ekle'}</strong>
          <small>{fieldName ? `${fieldName} · Ayrıntıları gör` : 'Veri durumunu görmek için'}</small>
        </span>
        <span className="tp-home-data-status-chevron" aria-hidden="true">↗</span>
      </button>
      <dialog
        ref={dialogRef}
        className="tp-home-data-dialog"
        aria-labelledby="tp-home-data-dialog-title"
        onClose={() => triggerRef.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="tp-home-data-dialog-head">
          <div>
            <small>SEÇİLİ TARLA</small>
            <h2 id="tp-home-data-dialog-title">Tarla verileri</h2>
            <p>{fieldName ? `${fieldName} · ${readyCount}/${items.length} kaynak hazır` : 'Önce bir tarla ekle'}</p>
          </div>
          <button type="button" aria-label="Tarla verilerini kapat" onClick={() => dialogRef.current?.close()}>×</button>
        </div>
        <div className="tp-home-data-status-list">
          {fieldName ? items.map((item) => (
            <div className="tp-home-data-status-row" key={item.label}>
              <span className={`tp-home-data-status-dot is-${item.status}`} aria-hidden="true" />
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </div>
          )) : <p>Bu tarla için veri durumu, tarla eklendikten sonra gösterilir.</p>}
        </div>
      </dialog>
    </>
  );
}
