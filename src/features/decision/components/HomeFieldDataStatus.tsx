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

  return (
    <details className="tp-home-data-status">
      <summary>
        <span className="tp-home-data-status-mark" aria-hidden="true">⌁</span>
        <span className="tp-home-data-status-heading">
          <strong>Tarla verileri</strong>
          <small>{fieldName ? `${fieldName} · ${readyCount}/${items.length} kaynak hazır` : 'Önce bir tarla ekle'}</small>
        </span>
        <span className="tp-home-data-status-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="tp-home-data-status-list">
        {fieldName ? items.map((item) => (
          <div className="tp-home-data-status-row" key={item.label}>
            <span className={`tp-home-data-status-dot is-${item.status}`} aria-hidden="true" />
            <strong>{item.label}</strong>
            <span>{item.detail}</span>
          </div>
        )) : <p>Bu tarla için veri durumu, tarla eklendikten sonra gösterilir.</p>}
      </div>
    </details>
  );
}
