import { onboardingStyles } from '../../styles/onboardingStyles';
import type { Screen } from '../../types';

type Setter<T> = (value: T) => void;

type PlaceholderInfo = {
  icon: string;
  title: string;
  subtitle: string;
  cards: string[];
};

type DesktopMenuItem = {
  screen: Screen;
  icon: string;
  label: string;
  badge?: string;
};

type PlaceholderScreenProps = {
  cmsRuntimeCss: string;
  placeholder: PlaceholderInfo;
  sideMenuOpen: boolean;
  screen: Screen;
  desktopMenuItems: DesktopMenuItem[];
  setScreen: Setter<Screen>;
  setSideMenuOpen: Setter<boolean>;
};

export default function PlaceholderScreen({
  cmsRuntimeCss,
  placeholder,
  sideMenuOpen,
  screen,
  desktopMenuItems,
  setScreen,
  setSideMenuOpen,
}: PlaceholderScreenProps) {
  return (
    <>
      <style>{cmsRuntimeCss + onboardingStyles}</style>

      <div className="tp-desktop-shell">
        {sideMenuOpen && (
          <>
            <button
              type="button"
              className="tp-side-backdrop"
              aria-label="Menüyü kapat"
              onClick={() => setSideMenuOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9997,
                border: 0,
                background: 'rgba(7,31,20,.38)',
              }}
            />

            <aside
              className="tp-desktop-sidebar tp-drawer-sidebar open"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                zIndex: 9998,
                width: 225,
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                padding: '16px 10px 14px',
                background:
                  'linear-gradient(180deg,#064b2f 0%,#075638 58%,#043f29 100%)',
                color: '#fff',
                boxShadow: '12px 0 34px rgba(5,57,35,.22)',
                overflow: 'hidden',
              }}
            >
              <div
                className="tp-side-brand"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '34px minmax(0,1fr) 26px',
                  alignItems: 'center',
                  gap: 8,
                  padding: '2px 4px 14px',
                  borderBottom: '1px solid rgba(255,255,255,.10)',
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    display: 'grid',
                    placeItems: 'center',
                    color: '#7be683',
                    fontSize: 22,
                  }}
                >
                  🌱
                </div>

                <div style={{ minWidth: 0 }}>
                  <strong
                    style={{
                      display: 'block',
                      color: '#fff',
                      fontSize: 17,
                      fontWeight: 900,
                      letterSpacing: '-.35px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    TarlaPusula
                  </strong>

                  <small
                    style={{
                      display: 'block',
                      marginTop: 1,
                      color: 'rgba(255,255,255,.67)',
                      fontSize: 8.5,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Tarla için akıllı rehber
                  </small>
                </div>

                <button
                  type="button"
                  onClick={() => setSideMenuOpen(false)}
                  aria-label="Menüyü kapat"
                  style={{
                    width: 26,
                    height: 26,
                    display: 'grid',
                    placeItems: 'center',
                    border: 0,
                    borderRadius: 7,
                    background: 'rgba(255,255,255,.07)',
                    color: '#fff',
                    fontSize: 17,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>

              <nav
                className="tp-side-nav"
                style={{
                  display: 'flex',
                  flex: 1,
                  flexDirection: 'column',
                  gap: 2,
                  overflowY: 'auto',
                  padding: '12px 0 8px',
                }}
              >
                {desktopMenuItems.map((item, index) => {
                  const active = screen === item.screen;

                  return (
                    <button
                      key={`${item.label}-${index}`}
                      onClick={() => {
                        setScreen(item.screen);
                        setSideMenuOpen(false);
                      }}
                      style={{
                        width: '100%',
                        minHeight: 38,
                        display: 'grid',
                        gridTemplateColumns: '27px minmax(0,1fr) auto',
                        alignItems: 'center',
                        gap: 8,
                        border: 0,
                        borderRadius: 9,
                        padding: '6px 9px',
                        background: active
                          ? 'linear-gradient(90deg,#21834b,#258d50)'
                          : 'transparent',
                        color: '#fff',
                        boxShadow: active
                          ? '0 7px 18px rgba(0,0,0,.14)'
                          : 'none',
                        fontFamily: 'inherit',
                        fontSize: 11.5,
                        fontWeight: 720,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          width: 27,
                          height: 27,
                          display: 'grid',
                          placeItems: 'center',
                          color: '#fff',
                          fontSize: 15,
                        }}
                      >
                        {item.icon}
                      </span>

                      <span
                        style={{
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.label}
                      </span>

                      {item.badge && (
                        <b
                          style={{
                            borderRadius: 999,
                            background:
                              item.badge === 'YENİ' ? '#7bdd6e' : '#ed5147',
                            color:
                              item.badge === 'YENİ' ? '#083e27' : '#fff',
                            padding: '3px 6px',
                            fontSize: 7.5,
                            fontWeight: 900,
                          }}
                        >
                          {item.badge}
                        </b>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '38px 1fr auto',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 5px',
                  borderTop: '1px solid rgba(255,255,255,.10)',
                  color: '#fff',
                }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '50%',
                    background: '#fff',
                    color: '#17653c',
                    fontWeight: 900,
                  }}
                >
                  Ü
                </span>

                <div>
                  <strong style={{ display: 'block', fontSize: 10.5 }}>
                    Üretici
                  </strong>
                  <small
                    style={{
                      display: 'block',
                      marginTop: 2,
                      color: 'rgba(255,255,255,.62)',
                      fontSize: 8.5,
                    }}
                  >
                    Ücretsiz Plan
                  </small>
                </div>

                <span>›</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  marginTop: 6,
                  padding: 11,
                  border: '1px solid rgba(255,255,255,.12)',
                  borderRadius: 13,
                  background: 'rgba(255,255,255,.055)',
                  color: '#fff',
                }}
              >
                <span
                  style={{
                    color: 'rgba(255,255,255,.74)',
                    fontSize: 8.5,
                  }}
                >
                  Tarla Kullanımınız
                </span>

                <strong
                  style={{ color: '#72e37b', fontSize: 19, lineHeight: 1 }}
                >
                  2 / 3
                </strong>

                <small
                  style={{
                    color: 'rgba(255,255,255,.62)',
                    fontSize: 8.3,
                  }}
                >
                  Ücretsiz tarla hakkınız kaldı
                </small>

                <div
                  style={{
                    height: 7,
                    overflow: 'hidden',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,.14)',
                  }}
                >
                  <i
                    style={{
                      display: 'block',
                      width: '66%',
                      height: '100%',
                      borderRadius: 999,
                      background: '#66d970',
                    }}
                  />
                </div>

                <button
                  type="button"
                  style={{
                    minHeight: 36,
                    marginTop: 3,
                    border: '1px solid rgba(255,255,255,.78)',
                    borderRadius: 8,
                    background: 'transparent',
                    color: '#fff',
                    fontFamily: 'inherit',
                    fontSize: 9.5,
                    fontWeight: 850,
                    cursor: 'pointer',
                  }}
                >
                  ＋ Tarla Ekle
                </button>
              </div>
            </aside>
          </>
        )}

        <section className="tp-placeholder-page">
          <header className="tp-placeholder-top">
            <div className="tp-placeholder-top-left">
              <button
                type="button"
                className="tp-menu-trigger"
                onClick={() => setSideMenuOpen(true)}
              >
                ☰
              </button>
              <button onClick={() => setScreen('home')}>← Ana Sayfa</button>
            </div>

            <div>
              <span>Konum</span>
              <strong>Samsun / Bafra</strong>
            </div>
          </header>

          <main className="tp-placeholder-main">
            <div className="tp-placeholder-heading">
              <div className="tp-placeholder-icon">{placeholder.icon}</div>
              <div>
                <h1>{placeholder.title}</h1>
                <p>{placeholder.subtitle}</p>
              </div>
              <span className="tp-coming-badge">HAZIRLANIYOR</span>
            </div>

            <div className="tp-placeholder-cards">
              {placeholder.cards.map((card, index) => (
                <article key={card}>
                  <span>{['01', '02', '03'][index]}</span>
                  <h3>{card}</h3>
                  <p>
                    Bu bölüm tasarıma eklendi. İşlevleri sonraki adımda
                    bağlanabilir.
                  </p>
                  <button>Yakında →</button>
                </article>
              ))}
            </div>

            <section className="tp-placeholder-preview">
              <div>
                <small>TARLAPUSULA</small>
                <h2>Bu sayfanın iskeleti hazır.</h2>
                <p>
                  Sol menü ve sayfa düzeni referans tasarımlardaki sade,
                  profesyonel tarım paneli diline göre oluşturuldu.
                </p>
              </div>

              <div className="tp-placeholder-visual">{placeholder.icon}</div>
            </section>
          </main>
        </section>
      </div>
    </>
  );
}
