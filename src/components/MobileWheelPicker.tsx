import { useEffect, useMemo, useRef, useState } from 'react';

export type MobilePickerOption = {
  value: string;
  label: string;
  subtitle?: string;
};

type MobileWheelPickerProps = {
  value: string;
  options: MobilePickerOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  title?: string;
  className?: string;
};

const MOBILE_QUERY = '(max-width: 760px), (pointer: coarse)';

export default function MobileWheelPicker({
  value,
  options,
  onChange,
  placeholder = 'Seç',
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Ara...',
  title = 'Seçim yap',
  className = '',
}: MobileWheelPickerProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const [search, setSearch] = useState('');
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (!open) {
      setDraftValue(value);
      setSearch('');
    }
  }, [value, open]);

  const selectedOption = options.find((item) => item.value === value);

  const filteredOptions = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('tr-TR');
    if (!normalized) return options;

    return options.filter((item) =>
      `${item.label} ${item.subtitle ?? ''}`
        .toLocaleLowerCase('tr-TR')
        .includes(normalized),
    );
  }, [options, search]);

  useEffect(() => {
    if (!open || !wheelRef.current) return;

    const timer = window.setTimeout(() => {
      const target = wheelRef.current?.querySelector<HTMLElement>(
        `[data-picker-value="${CSS.escape(draftValue)}"]`,
      );

      target?.scrollIntoView({
        behavior: 'instant' as ScrollBehavior,
        block: 'center',
      });
    }, 50);

    return () => window.clearTimeout(timer);
  }, [open, draftValue, filteredOptions.length]);

  const updateDraftFromScroll = () => {
    if (!wheelRef.current) return;

    if (scrollFrameRef.current !== null) {
      cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = requestAnimationFrame(() => {
      const container = wheelRef.current;
      if (!container) return;

      const center =
        container.getBoundingClientRect().top + container.clientHeight / 2;

      let closestValue = draftValue;
      let closestDistance = Number.POSITIVE_INFINITY;

      container
        .querySelectorAll<HTMLElement>('[data-picker-value]')
        .forEach((item) => {
          const rect = item.getBoundingClientRect();
          const itemCenter = rect.top + rect.height / 2;
          const distance = Math.abs(center - itemCenter);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestValue = item.dataset.pickerValue ?? closestValue;
          }
        });

      if (closestValue !== draftValue) {
        setDraftValue(closestValue);
      }
    });
  };

  const chooseAndCenter = (nextValue: string) => {
    setDraftValue(nextValue);

    requestAnimationFrame(() => {
      const target = wheelRef.current?.querySelector<HTMLElement>(
        `[data-picker-value="${CSS.escape(nextValue)}"]`,
      );

      target?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  };

  if (!isMobile) {
    return (
      <select
        className={className}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {!options.some((item) => item.value === '') && (
          <option value="">{placeholder}</option>
        )}
        {options.map((item) => (
          <option key={`${item.value}-${item.label}`} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`tp-mobile-picker-trigger ${className}`.trim()}
        disabled={disabled}
        onClick={() => {
          setDraftValue(value);
          setOpen(true);
        }}
      >
        <span className={selectedOption ? '' : 'placeholder'}>
          {selectedOption?.label ?? placeholder}
        </span>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="m8 10 4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          className="tp-picker-backdrop"
          role="presentation"
          onMouseDown={() => setOpen(false)}
        >
          <section
            className="tp-picker-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="tp-picker-handle" />

            <div className="tp-picker-header">
              <button type="button" onClick={() => setOpen(false)}>
                Vazgeç
              </button>
              <strong>{title}</strong>
              <button
                type="button"
                className="done"
                onClick={() => {
                  if (draftValue) onChange(draftValue);
                  setOpen(false);
                }}
              >
                Bitti
              </button>
            </div>

            {searchable && (
              <div className="tp-picker-search">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle
                    cx="10.5"
                    cy="10.5"
                    r="5.8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="m15 15 4 4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={searchPlaceholder}
                  autoFocus
                />
              </div>
            )}

            <div className="tp-picker-wheel-wrap">
              <div className="tp-picker-selection-window" />

              <div
                ref={wheelRef}
                className="tp-picker-wheel"
                onScroll={updateDraftFromScroll}
              >
                <div className="tp-picker-spacer" />

                {filteredOptions.length > 0 ? (
                  filteredOptions.map((item) => (
                    <button
                      type="button"
                      key={`${item.value}-${item.label}`}
                      data-picker-value={item.value}
                      className={draftValue === item.value ? 'selected' : ''}
                      onClick={() => chooseAndCenter(item.value)}
                    >
                      <strong>{item.label}</strong>
                      {item.subtitle && <small>{item.subtitle}</small>}
                    </button>
                  ))
                ) : (
                  <div className="tp-picker-empty">Sonuç bulunamadı</div>
                )}

                <div className="tp-picker-spacer" />
              </div>
            </div>
          </section>
        </div>
      )}

      <style>{`
        .tp-mobile-picker-trigger{
          width:100%;
          min-height:46px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          border:1px solid #dbe3da;
          border-radius:11px;
          padding:0 13px;
          background:#fff;
          color:#233229;
          font:inherit;
          font-size:11px;
          font-weight:750;
          text-align:left;
          cursor:pointer;
        }

        .tp-mobile-picker-trigger .placeholder{
          color:#889188;
          font-weight:650;
        }

        .tp-mobile-picker-trigger svg{
          width:17px;
          height:17px;
          flex:0 0 17px;
          color:#6d786f;
        }

        .tp-mobile-picker-trigger:disabled{
          opacity:.55;
          cursor:not-allowed;
        }

        .tp-picker-backdrop{
          position:fixed;
          inset:0;
          z-index:99999;
          display:flex;
          align-items:flex-end;
          background:rgba(18,27,21,.34);
          backdrop-filter:blur(2px);
          -webkit-backdrop-filter:blur(2px);
        }

        .tp-picker-sheet{
          width:100%;
          max-height:min(76vh,680px);
          overflow:hidden;
          border-radius:22px 22px 0 0;
          background:#f9faf8;
          box-shadow:0 -18px 50px rgba(20,40,27,.16);
          animation:tpPickerIn .22s ease-out;
        }

        @keyframes tpPickerIn{
          from{transform:translateY(100%)}
          to{transform:translateY(0)}
        }

        .tp-picker-handle{
          width:38px;
          height:5px;
          margin:8px auto 4px;
          border-radius:999px;
          background:#ccd2cc;
        }

        .tp-picker-header{
          height:48px;
          display:grid;
          grid-template-columns:72px 1fr 72px;
          align-items:center;
          border-bottom:1px solid #e7ebe6;
          padding:0 8px;
          background:rgba(255,255,255,.88);
        }

        .tp-picker-header strong{
          overflow:hidden;
          color:#243028;
          font-size:12px;
          font-weight:850;
          text-align:center;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .tp-picker-header button{
          border:0;
          background:transparent;
          color:#6e7a71;
          font:inherit;
          font-size:11px;
          font-weight:750;
          cursor:pointer;
        }

        .tp-picker-header button.done{
          color:#26703d;
          font-weight:900;
        }

        .tp-picker-search{
          display:flex;
          align-items:center;
          gap:8px;
          margin:10px 12px 2px;
          border:1px solid #e2e7e1;
          border-radius:11px;
          padding:0 11px;
          background:#fff;
        }

        .tp-picker-search svg{
          width:16px;
          height:16px;
          flex:0 0 16px;
          color:#7c877e;
        }

        .tp-picker-search input{
          width:100%;
          min-height:40px;
          border:0!important;
          outline:0!important;
          padding:0!important;
          background:transparent!important;
          box-shadow:none!important;
          font-size:12px!important;
        }

        .tp-picker-wheel-wrap{
          position:relative;
          height:258px;
          overflow:hidden;
          -webkit-mask-image:linear-gradient(
            to bottom,
            transparent 0%,
            #000 22%,
            #000 78%,
            transparent 100%
          );
          mask-image:linear-gradient(
            to bottom,
            transparent 0%,
            #000 22%,
            #000 78%,
            transparent 100%
          );
        }

        .tp-picker-selection-window{
          position:absolute;
          z-index:0;
          top:50%;
          left:12px;
          right:12px;
          height:48px;
          transform:translateY(-50%);
          border-top:1px solid rgba(42,100,57,.12);
          border-bottom:1px solid rgba(42,100,57,.12);
          border-radius:10px;
          background:rgba(226,240,225,.68);
          pointer-events:none;
        }

        .tp-picker-wheel{
          position:relative;
          z-index:1;
          height:100%;
          overflow-y:auto;
          overscroll-behavior:contain;
          scroll-snap-type:y mandatory;
          scrollbar-width:none;
          padding:0 12px;
        }

        .tp-picker-wheel::-webkit-scrollbar{
          display:none;
        }

        .tp-picker-spacer{
          height:105px;
          flex:0 0 105px;
        }

        .tp-picker-wheel button{
          width:100%;
          height:48px;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          scroll-snap-align:center;
          border:0;
          background:transparent;
          color:#69736b;
          font:inherit;
          cursor:pointer;
          transition:transform .12s ease,color .12s ease;
        }

        .tp-picker-wheel button strong{
          font-size:13px;
          font-weight:700;
        }

        .tp-picker-wheel button small{
          margin-top:2px;
          color:#90988f;
          font-size:9px;
          font-weight:600;
        }

        .tp-picker-wheel button.selected{
          color:#1f3426;
          transform:scale(1.04);
        }

        .tp-picker-wheel button.selected strong{
          font-weight:900;
        }

        .tp-picker-empty{
          height:48px;
          display:grid;
          place-items:center;
          color:#8b948d;
          font-size:11px;
          font-weight:700;
        }
      `}</style>
    </>
  );
}
