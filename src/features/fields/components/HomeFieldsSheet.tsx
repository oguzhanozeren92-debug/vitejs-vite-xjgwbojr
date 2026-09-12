import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getEntitlementSnapshot } from '../../../entitlements/useEntitlementStore';
import './HomeFieldsSheet.css';

type FieldOption = { id: string | number; name?: string | null; crop?: string | null; demo?: boolean };

type HomeFieldsSheetProps = {
  open: boolean;
  fields: FieldOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  onDetail: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onAdd: () => void;
  onClose: () => void;
};

export default function HomeFieldsSheet({
  open, fields, selectedId, onSelect, onDetail, onDelete, onAdd, onClose,
}: HomeFieldsSheetProps) {
  const [fieldToDelete, setFieldToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const pendingField = fields.find((field) => String(field.id) === fieldToDelete);

  const closeDeleteConfirmation = () => {
    if (deleting) return;
    setFieldToDelete(null);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!pendingField || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await onDelete(String(pendingField.id));
      setFieldToDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Tarla silinemedi. Tekrar dene.');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (fieldToDelete) {
          if (!deleting) {
            setFieldToDelete(null);
            setDeleteError('');
          }
        } else onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, fieldToDelete, deleting]);

  if (!open) return null;

  return createPortal(
    <div
      className="tp-fields-sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) {
          if (fieldToDelete) closeDeleteConfirmation();
          else onClose();
        }
      }}
    >
      <section className="tp-fields-sheet" role="dialog" aria-modal="true" aria-labelledby={fieldToDelete ? 'tp-fields-delete-title' : 'tp-fields-sheet-title'}>
        {fieldToDelete ? (
          <div className="tp-fields-delete-confirmation">
            <span className="tp-fields-delete-kicker">TARLA SİLME</span>
            <h2 id="tp-fields-delete-title">Emin misin?</h2>
            <p><strong>{pendingField?.name || 'Bu tarla'}</strong> ve ona bağlı kayıtlar kalıcı olarak silinecek. Bu işlem geri alınamaz.</p>
            {!getEntitlementSnapshot().isPremium && (
              <p className="tp-fields-delete-warning">Ücretsiz planda tarla değiştirme hakkı 7 günde bir yenilenir. İlk eklemeden sonraki 24 saatlik düzeltme süresi istisnadır.</p>
            )}
            {deleteError && <p className="tp-fields-delete-error" role="alert">{deleteError}</p>}
            <div className="tp-fields-delete-actions">
              <button type="button" onClick={closeDeleteConfirmation} disabled={deleting}>Vazgeç</button>
              <button type="button" className="danger" onClick={() => void confirmDelete()} disabled={deleting || !pendingField}>
                {deleting ? 'Siliniyor…' : 'Evet, Tarlayı Sil'}
              </button>
            </div>
          </div>
        ) : (
          <>
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
                {!field.demo && <button
                  type="button"
                  className="tp-fields-sheet-delete"
                  onClick={() => {
                    setDeleteError('');
                    setFieldToDelete(id);
                  }}
                  aria-label={`${field.name || 'Adsız Tarla'} tarlasını sil`}
                >Sil</button>}
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
          </>
        )}
      </section>
    </div>,
    document.body,
  );
}
