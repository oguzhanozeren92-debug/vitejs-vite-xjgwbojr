import { useEffect, useRef } from 'react';
import { X, Check, History } from 'lucide-react';
import './SatelliteHistorySheet.css';

type Props = {
  open: boolean; dates: string[]; loading: boolean; error: string | null;
  fieldName: string; selectedDate?: string | null;
  onSelect: (date: string | null) => void;
  onClose: () => void;
};

export default function SatelliteHistorySheet(props: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (props.open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [props.open]);
  return (
    <dialog ref={dialog} className="tp-satellite-history" onCancel={props.onClose}
      aria-labelledby="tp-satellite-history-title" onClick={e => { if (e.target === e.currentTarget) props.onClose(); }}>
      <header>
        <div><small>{props.fieldName}</small><h2 id="tp-satellite-history-title">Ölçüm tarihi seç</h2></div>
        <button type="button" onClick={props.onClose} aria-label="Kapat"><X size={22} /></button>
      </header>
      <p>Son 6 ayın uygun Sentinel-2 çekimleri. Bir tarihe dokun, o günün NDVI verisi haritada açılsın.</p>
      {props.error && <p role="alert">{props.error}</p>}
      {props.loading && <p role="status">Uydu verisi alınıyor…</p>}
      <button type="button" className="tp-satellite-history-date" disabled={props.loading}
        onClick={() => props.onSelect(null)}><span>Son ölçüme dön</span>{!props.selectedDate && <Check size={20} />}</button>
      <div className="tp-satellite-history-dates">
        {!props.loading && !props.error && !props.dates.length && <p>Bu dönemde uygun uydu çekimi bulunamadı.</p>}
        {props.dates.map(date => <button type="button" key={date} disabled={props.loading}
          className="tp-satellite-history-date" aria-pressed={props.selectedDate === date}
          onClick={() => props.onSelect(date)}>
          <History size={19} /><span>{date.split('-').reverse().join('.')}</span>
          {props.selectedDate === date && <Check size={20} />}
        </button>)}
      </div>
    </dialog>
  );
}
