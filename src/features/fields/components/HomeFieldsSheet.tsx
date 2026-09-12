import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './HomeFieldsSheet.css';

type FieldOption = { id: string | number; name?: string | null; crop?: string | null };

type HomeFieldsSheetProps = {
  open: boolean;
  fields: FieldOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  onDetail: (id: string) => void;
  onAdd: () => void;
  onClose: () => void;
};

export default function HomeFieldsSheet({
  open, fields, selectedId, onSelect, onDetail, onAdd, onClose,
}: HomeFieldsSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="tp-fields-sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="tp-fields-sheet" role="dialog" aria-modal="true" aria-labelledby="tp-fields-sheet-title">
        <div className="tp-fields-sheet-head">
          <div>
            <small>TARLALARIN</small>
            <h2 id="tp-fields-sheet-title">Tarlalarım</h2>
          </div>
          <button type="button" className="tp-fields-sheet-close" aria-label="Tarlalarımı kapat" onClick={onClose}>×</button>
        </div>
        <div className="tp-fields-sheet-list">
          {fields.length ? fields.map((field) => {
            const id = String(field.id);
            const selected = id === selectedId;
            return (
              <div
                key={id}
                className={`tp-fields-sheet-field${selected ? ' is-selected' : ''}`}
              >
                <button
                  type="button"
                  className="tp-fields-sheet-field-select"
                  onClick={() => onSelect(id)}
                  aria-label={`${field.name || 'Adsız Tarla'} tarlasını seç`}
                >
                  <span className="tp-fields-sheet-field-icon" aria-hidden="true">✦</span>
                  <span className="tp-fields-sheet-field-copy">
                    <strong>{field.name || 'Adsız Tarla'}</strong>
                    <small>{field.crop || 'Ürün belirtilmedi'}</small>
                  </span>
                  {selected && <span className="tp-fields-sheet-field-status">Seçili</span>}
                </button>
                <button
                  type="button"
                  className="tp-fields-sheet-detail"
                  onClick={() => onDetail(id)}
                  aria-label={`${field.name || 'Adsız Tarla'} tarlasının detayını aç`}
                >Detay</button>
              </div>
            );
          }) : <p className="tp-fields-sheet-empty">Henüz kayıtlı tarlan yok.</p>}
        </div>
        <button type="button" className="tp-fields-sheet-add" onClick={onAdd}>+ Yeni tarla ekle</button>
      </section>
    </div>,
    document.body,
  );
}
