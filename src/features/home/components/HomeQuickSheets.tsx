import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Bell, ClipboardList, X } from 'lucide-react';
import type { HomeTodayDecision } from '../../today/components/HomeTodayCard';
import type { HomeSystemNotification } from '../../notifications/hooks/useHomeNotifications';
import type { IrrigationDecisionResult } from '../../irrigation/types/irrigationDecision';
import { buildRainfedTodaySummary } from '../../irrigation/services/rainfedTodaySummary';
import './HomeQuickSheets.css';

type Props = {
  active: 'today' | 'notifications' | null;
  onClose: () => void;
  decisions: HomeTodayDecision[];
  notifications: HomeSystemNotification[];
  fieldName?: string;
  irrigationDecision?: IrrigationDecisionResult | null;
  onOpenDecision: (target: HomeTodayDecision['target']) => void;
  onOpenNotifications: () => void;
};

export default function HomeQuickSheets({
  active,
  onClose,
  decisions,
  notifications,
  fieldName,
  irrigationDecision,
  onOpenDecision,
  onOpenNotifications,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastActiveRef = useRef<'today' | 'notifications'>('today');
  const [selectedDecision, setSelectedDecision] = useState<HomeTodayDecision | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (active) lastActiveRef.current = active;
    if (active && !dialog?.open) dialog?.showModal();
    if (!active && dialog?.open) dialog.close();
    if (!active) setSelectedDecision(null);
  }, [active]);

  const close = () => {
    dialogRef.current?.close();
    onClose();
  };

  const rainfed = selectedDecision?.id.startsWith('irrigation:') && irrigationDecision
    ? buildRainfedTodaySummary(irrigationDecision)
    : null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="tp-home-quick-sheet"
      aria-label={active === 'notifications' ? 'Bildirimler' : 'Bugün ne yapmalısın?'}
      onClose={() => {
        onClose();
        document.querySelector<HTMLButtonElement>(
          lastActiveRef.current === 'notifications' ? '.tp-mf-quick-notifications' : '.tp-mf-quick-today',
        )?.focus();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="tp-home-quick-sheet-head">
        {selectedDecision && active === 'today' ? (
          <button type="button" className="tp-home-quick-back" onClick={() => setSelectedDecision(null)} aria-label="Bugünün listesine dön">
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
        ) : (
          <span className="tp-home-quick-sheet-icon" aria-hidden="true">
            {active === 'notifications' ? <Bell size={21} /> : <ClipboardList size={21} />}
          </span>
        )}
        <div>
          <small>{fieldName || 'Tarlan'}</small>
          <h2>{active === 'notifications' ? 'Bildirimler' : selectedDecision ? selectedDecision.title : 'Bugün Ne Yapmalısın?'}</h2>
        </div>
        <button type="button" className="tp-home-quick-close" aria-label="Pencereyi kapat" onClick={close}>
          <X size={21} aria-hidden="true" />
        </button>
      </div>

      {active === 'today' && !selectedDecision && (
        <div className="tp-home-quick-list">
          {decisions.length ? decisions.map((decision) => (
            <button key={decision.id} type="button" className="tp-home-quick-item" onClick={() => setSelectedDecision(decision)}>
              <img src={decision.iconSrc} alt="" aria-hidden="true" />
              <span>
                <small>{decision.label}</small>
                <strong>{decision.title}</strong>
                <span className="tp-home-quick-description">{decision.detail}</span>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          )) : <p className="tp-home-quick-empty">Bugün için yeni bir öneri yok. Tarlandaki gelişmeleri burada göreceksin.</p>}
        </div>
      )}

      {active === 'today' && selectedDecision && (
        <div className="tp-home-quick-detail">
          {rainfed ? (
            <>
              <p><strong>Genel durum:</strong> {rainfed.generalStatus}</p>
              <dl>{rainfed.rows.map(({ label, text }) => (
                <div key={label}><dt>{label}</dt><dd>{text}</dd></div>
              ))}</dl>
              <p><strong>Özet:</strong> {rainfed.conclusion}</p>
              <small>Bu yağış ve tahmini su ihtiyacı farkıdır; ölçülmüş toprak nemi ya da sulama miktarı değildir.</small>
            </>
          ) : <p>{selectedDecision.detail}</p>}
          <button type="button" className="tp-home-quick-link" onClick={() => {
            const target = selectedDecision.target;
            close();
            onOpenDecision(target);
          }}>Detayına git <span aria-hidden="true">→</span></button>
        </div>
      )}

      {active === 'notifications' && (
        <div className="tp-home-quick-list">
          {notifications.length ? notifications.map((item) => (
            <article className="tp-home-quick-notification" key={item.id}>
              <span className={`tp-home-quick-severity is-${item.severity}`} aria-hidden="true" />
              <div><strong>{item.title}</strong><p>{item.detail}</p></div>
            </article>
          )) : <p className="tp-home-quick-empty">Şu an yeni bir gelişme görünmüyor.</p>}
          <button type="button" className="tp-home-quick-link" onClick={() => {
            close();
            onOpenNotifications();
          }}>Bildirim merkezine git <span aria-hidden="true">→</span></button>
        </div>
      )}
    </dialog>,
    document.body,
  );
}
