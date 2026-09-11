import { HOME_REFERENCE_ASSETS } from '../../home/homeAssets';

export type HomeTodayDecision = {
  id: string;
  visual: string;
  tone: string;
  target: any;
  iconClass: string;
  iconSrc: string;
  label: string;
  title: string;
  detail: string;
};

type Props = {
  decisions: HomeTodayDecision[];
  onOpenDecision: (target: any) => void;
};

export default function HomeTodayCard({ decisions, onOpenDecision }: Props) {
  return (
    <article className="tp-home-today-reference">
      <div
        className="tp-home-today-bg"
        aria-hidden="true"
        style={{ backgroundImage: `url(${HOME_REFERENCE_ASSETS.todayBg})` }}
      />
      <div className="tp-home-today-shade" aria-hidden="true" />

      <div className="tp-home-today-content">
        <div className="tp-home-today-title">
          <img
            className="tp-home-today-title-icon"
            src={HOME_REFERENCE_ASSETS.iconPusulaSprout}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <div>
            <small>BUGÜN</small>
            <h2>Ne Yapmalısın?</h2>
          </div>
        </div>

        <p className="tp-home-today-subtitle">
          Tarlan için en doğru zamanı birlikte seçelim.
        </p>

        <div className="tp-home-today-actions">
          {decisions.map((decision) => (
            <button
              type="button"
              key={decision.id}
              className={`tp-home-today-action ${decision.visual} ${decision.tone}`}
              onClick={() => onOpenDecision(decision.target)}
            >
              <img
                className={`tp-home-today-action-icon ${decision.iconClass}`}
                src={decision.iconSrc}
                alt=""
                aria-hidden="true"
                draggable={false}
              />
              <span className="tp-home-today-action-copy">
                <small>{decision.label}</small>
                <strong>{decision.title}</strong>
                <em>{decision.detail}</em>
              </span>
              <span className="tp-home-today-action-chevron" aria-hidden="true">
                ›
              </span>
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
