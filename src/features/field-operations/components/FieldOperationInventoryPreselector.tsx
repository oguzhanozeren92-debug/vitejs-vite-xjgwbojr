import { useEffect, useState } from 'react';
import {
  listFieldOperationInventoryOptions,
  type FieldOperationInventoryOption,
} from '../services/fieldOperationInventory.service';

type Props = {
  open: boolean;
  fieldId: string;
  fieldName: string;
  operationType: 'Gübreleme' | 'İlaçlama';
  onContinue: (product: FieldOperationInventoryOption | null) => void;
  onCancel: () => void;
};

const CSS = String.raw`
.tp-operation-stock-portal{position:fixed;inset:0;z-index:2147483626;display:grid;place-items:center;padding:14px;box-sizing:border-box}
.tp-operation-stock-backdrop{position:absolute;inset:0;border:0;background:rgba(0,0,0,.66);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
.tp-operation-stock-sheet{position:relative;z-index:1;width:min(94vw,500px);max-height:min(84dvh,680px);display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(34,197,94,.18);border-radius:22px;background:linear-gradient(160deg,rgba(7,24,12,.99),rgba(2,9,5,.995));box-shadow:0 28px 90px rgba(0,0,0,.65);color:#eaf6ed}
.tp-operation-stock-head{padding:15px 16px 12px;border-bottom:1px solid rgba(255,255,255,.06)}
.tp-operation-stock-head small{display:block;color:#86efac;font-size:8px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.tp-operation-stock-head h3{margin:5px 0 0;font-size:17px}.tp-operation-stock-head p{margin:6px 0 0;color:rgba(211,229,216,.58);font-size:10px;line-height:1.45}
.tp-operation-stock-list{min-height:0;overflow:auto;display:grid;gap:7px;padding:12px 14px}
.tp-operation-stock-item{width:100%;display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;min-height:52px;padding:10px 11px;border:1px solid rgba(88,140,100,.18);border-radius:13px;background:rgba(255,255,255,.022);color:#e8f4eb;text-align:left;cursor:pointer}.tp-operation-stock-item:hover{border-color:rgba(34,197,94,.34);background:rgba(34,197,94,.06)}
.tp-operation-stock-item strong{display:block;font-size:11px}.tp-operation-stock-item small{display:block;margin-top:3px;color:rgba(198,218,204,.54);font-size:8px}.tp-operation-stock-amount{color:#a7f3d0;font-size:9px;font-weight:850;white-space:nowrap}.tp-operation-stock-linked{color:#67c47e!important}
.tp-operation-stock-empty,.tp-operation-stock-error{margin:12px 14px;padding:10px 11px;border-radius:12px;border:1px solid rgba(121,155,129,.16);background:rgba(255,255,255,.02);font-size:9px;line-height:1.5;color:rgba(214,230,218,.62)}.tp-operation-stock-error{border-color:rgba(239,68,68,.18);color:#fca5a5}
.tp-operation-stock-actions{display:flex;gap:7px;padding:11px 14px 14px;border-top:1px solid rgba(255,255,255,.05)}.tp-operation-stock-actions button{min-height:40px;padding:0 12px;border-radius:11px;font-size:9px;font-weight:850;cursor:pointer}.tp-operation-stock-external{flex:1;border:1px solid rgba(121,155,129,.18);background:rgba(255,255,255,.025);color:#d8e6db}.tp-operation-stock-cancel{border:1px solid rgba(121,155,129,.12);background:transparent;color:rgba(211,229,216,.56)}
`;

export default function FieldOperationInventoryPreselector({
  open,
  fieldId,
  fieldName,
  operationType,
  onContinue,
  onCancel,
}: Props) {
  const [items, setItems] = useState<FieldOperationInventoryOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !fieldId) return;
    let active = true;
    setLoading(true);
    setError('');

    void listFieldOperationInventoryOptions({ fieldId, operationType })
      .then((rows) => {
        if (!active) return;
        setItems(rows);
      })
      .catch((caught) => {
        if (!active) return;
        setItems([]);
        setError(caught instanceof Error ? caught.message : 'Depo ürünleri alınamadı.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, fieldId, operationType]);

  if (!open) return null;

  return (
    <div className="tp-operation-stock-portal" role="dialog" aria-modal="true" aria-label="Depo ürünü seç">
      <style>{CSS}</style>
      <button className="tp-operation-stock-backdrop" type="button" aria-label="Kapat" onClick={onCancel} />
      <section className="tp-operation-stock-sheet">
        <header className="tp-operation-stock-head">
          <small>{operationType} · TEK KAYIT</small>
          <h3>Depodan ürün kullanıyor musun?</h3>
          <p>
            {fieldName} için depodaki exact ürünü seçersen kullandığın miktar işlem kaydıyla birlikte stoktan otomatik düşer. Aynı bilgiyi Depo'ya tekrar girmezsin.
          </p>
        </header>

        {loading ? <div className="tp-operation-stock-empty">Depo kontrol ediliyor…</div> : null}
        {error ? <div className="tp-operation-stock-error">{error}</div> : null}

        {!loading && !error ? (
          <div className="tp-operation-stock-list">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="tp-operation-stock-item"
                onClick={() => onContinue(item)}
              >
                <span>
                  <strong>{item.productName}</strong>
                  <small className={item.linkedToField ? 'tp-operation-stock-linked' : ''}>
                    {item.linkedToField ? 'Bu tarlayla eşleşiyor' : 'Depoda kayıtlı ürün'}
                  </small>
                </span>
                <span className="tp-operation-stock-amount">
                  {new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(item.remainingAmount)} {item.unit}
                </span>
              </button>
            ))}
            {!items.length ? (
              <div className="tp-operation-stock-empty">
                Bu işlem türüne uygun, stoğu bulunan depo ürünü yok. İşlemi yine kaydedebilirsin; stok değişmez.
              </div>
            ) : null}
          </div>
        ) : null}

        <footer className="tp-operation-stock-actions">
          <button className="tp-operation-stock-external" type="button" onClick={() => onContinue(null)}>
            Depodan kullanmıyorum / harici ürün
          </button>
          <button className="tp-operation-stock-cancel" type="button" onClick={onCancel}>Vazgeç</button>
        </footer>
      </section>
    </div>
  );
}
