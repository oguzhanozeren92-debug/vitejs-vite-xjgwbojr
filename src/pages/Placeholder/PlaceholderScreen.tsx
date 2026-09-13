import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  CloudSun,
  Map,
  Menu,
  Settings,
  Sparkles,
} from 'lucide-react';
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

type StoredNotification = {
  id: string;
  fieldId?: string;
  fieldName?: string;
  source?: string;
  severity?: 'info' | 'warning' | 'danger';
  title?: string;
  message?: string;
  target?: string;
  isRead?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const NOTIFICATION_STORAGE_KEY = 'tp_system_notifications_v1';
const MAP_ANIMATION_STORAGE_KEY = 'tp_settings_map_opening_animation_v1';

const PAGE_CSS = String.raw`
.tp-utility-page{min-height:100dvh;background:#f5f7f8;color:#18201d;padding-bottom:92px}
.tp-utility-top{position:sticky;z-index:35;top:0;display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:58px;padding:8px 12px;border-bottom:1px solid #e1e7e4;background:rgba(255,255,255,.94);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.tp-utility-top-left{display:flex;align-items:center;gap:8px;min-width:0}.tp-utility-icon-btn{width:40px;height:40px;display:grid;place-items:center;border:1px solid #dde5e0;border-radius:12px;background:#fff;color:#202a24;cursor:pointer}.tp-utility-top-title{min-width:0}.tp-utility-top-title small{display:block;color:#6e7c73;font-size:8px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.tp-utility-top-title strong{display:block;margin-top:2px;overflow:hidden;color:#172019;font-size:15px;font-weight:900;text-overflow:ellipsis;white-space:nowrap}.tp-utility-main{width:min(100%,760px);margin:0 auto;padding:18px 14px 28px;box-sizing:border-box}.tp-utility-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:16px}.tp-utility-hero h1{margin:0;color:#172019;font-size:27px;line-height:1.05;letter-spacing:-.04em}.tp-utility-hero p{margin:7px 0 0;max-width:560px;color:#69766e;font-size:11px;line-height:1.5}.tp-utility-badge{flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:0 9px;border:1px solid #dfe8e2;border-radius:999px;background:#fff;color:#587062;font-size:8px;font-weight:850}.tp-utility-section{margin-top:13px}.tp-utility-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.tp-utility-section-head strong{font-size:11px}.tp-utility-section-head button{display:inline-flex;align-items:center;gap:4px;border:0;background:transparent;color:#4e765d;font-size:9px;font-weight:850;cursor:pointer}.tp-notification-list{display:grid;gap:8px}.tp-notification-card{position:relative;width:100%;display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border:1px solid #e1e8e3;border-radius:15px;background:#fff;color:inherit;text-align:left;box-shadow:0 6px 20px rgba(26,43,33,.035);cursor:pointer}.tp-notification-card.unread{border-color:#cfe3d4;background:linear-gradient(180deg,#fff,#f8fcf9)}.tp-notification-card.danger{border-left:3px solid #ef4444}.tp-notification-card.warning{border-left:3px solid #f59e0b}.tp-notification-card.info{border-left:3px solid #22c55e}.tp-notification-icon{width:38px;height:38px;display:grid;place-items:center;border:1px solid #dce8df;border-radius:12px;background:#eff6f1;color:#426a50}.tp-notification-copy{min-width:0}.tp-notification-copy small{display:flex;align-items:center;gap:5px;color:#849089;font-size:7px;font-weight:800;text-transform:uppercase}.tp-notification-copy strong{display:block;margin-top:3px;color:#1d2721;font-size:12px;line-height:1.25}.tp-notification-copy p{margin:4px 0 0;color:#66736b;font-size:9.5px;line-height:1.42}.tp-notification-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.10)}.tp-notification-empty{display:grid;place-items:center;min-height:210px;padding:24px;border:1px dashed #d9e2dc;border-radius:18px;background:#fff;text-align:center}.tp-notification-empty svg{color:#7b9483}.tp-notification-empty strong{display:block;margin-top:10px;font-size:13px}.tp-notification-empty p{margin:5px 0 0;color:#758078;font-size:10px}.tp-settings-list{display:grid;gap:9px}.tp-settings-card{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px;border:1px solid #e1e8e3;border-radius:15px;background:#fff}.tp-settings-card-icon{width:38px;height:38px;display:grid;place-items:center;border:1px solid #dce8df;border-radius:12px;background:#eff6f1;color:#426a50}.tp-settings-copy{min-width:0}.tp-settings-copy strong{display:block;color:#1d2721;font-size:11.5px}.tp-settings-copy p{margin:4px 0 0;color:#6b776f;font-size:9px;line-height:1.42}.tp-switch{position:relative;width:44px;height:26px;padding:0;border:0;border-radius:999px;background:#d7ded9;cursor:pointer;transition:.18s ease}.tp-switch.on{background:#22c55e}.tp-switch::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.18);transition:.18s ease}.tp-switch.on::after{transform:translateX(18px)}.tp-settings-link{display:inline-flex;align-items:center;gap:4px;border:0;background:transparent;color:#4e765d;font-size:8.5px;font-weight:850;cursor:pointer}.tp-settings-note{margin-top:10px;padding:10px 11px;border-radius:13px;background:#edf4ef;color:#627068;font-size:8.5px;line-height:1.5}.tp-generic-cards{display:grid;gap:9px}.tp-generic-card{padding:14px;border:1px solid #e1e8e3;border-radius:15px;background:#fff}.tp-generic-card small{color:#6b8b73;font-size:7px;font-weight:900}.tp-generic-card h3{margin:6px 0 0;font-size:14px}.tp-generic-card p{margin:6px 0 0;color:#6b776f;font-size:9.5px;line-height:1.45}
@media(max-width:560px){.tp-utility-main{padding-top:15px}.tp-utility-hero h1{font-size:24px}.tp-utility-badge{display:none}.tp-notification-card{grid-template-columns:36px minmax(0,1fr) 14px}.tp-notification-icon,.tp-settings-card-icon{width:36px;height:36px}.tp-settings-card{grid-template-columns:36px minmax(0,1fr) auto}}
`;

function readNotifications(): StoredNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item) => {
      const id = String(item?.id ?? '');
      return !(item?.source === 'field' && id.includes(':missing-'));
    });
  } catch {
    return [];
  }
}

function writeNotifications(items: StoredNotification[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(
      new CustomEvent('tp:notifications-updated', { detail: { notifications: items } }),
    );
  } catch {
    // localStorage kapalıysa ekran yine çalışmaya devam eder.
  }
}

function notificationDate(item: StoredNotification) {
  const raw = item.updatedAt || item.createdAt;
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function notificationIcon(item: StoredNotification) {
  if (item.source === 'weather') return <CloudSun size={18} strokeWidth={1.8} />;
  if (item.source === 'calendar') return <CalendarDays size={18} strokeWidth={1.8} />;
  if (item.source === 'pusula') return <Sparkles size={18} strokeWidth={1.8} />;
  if (item.source === 'satellite') return <Map size={18} strokeWidth={1.8} />;
  return <Bell size={18} strokeWidth={1.8} />;
}

function targetScreen(target: string | undefined): Screen {
  if (target === 'weather') return 'weatherHub';
  if (target === 'calendar') return 'calendar';
  if (target === 'ai') return 'aiAnalysis';
  if (target === 'soil') return 'soilAnalysisHub';
  return 'home';
}

function UtilityHeader({
  title,
  setSideMenuOpen,
  setScreen,
}: {
  title: string;
  setSideMenuOpen: Setter<boolean>;
  setScreen: Setter<Screen>;
}) {
  return (
    <header className="tp-utility-top">
      <div className="tp-utility-top-left">
        <button
          type="button"
          className="tp-utility-icon-btn"
          aria-label="Menüyü aç"
          onClick={() => setSideMenuOpen(true)}
        >
          <Menu size={20} strokeWidth={1.9} />
        </button>
        <div className="tp-utility-top-title">
          <small>TarlaPusula</small>
          <strong>{title}</strong>
        </div>
      </div>
      <button
        type="button"
        className="tp-utility-icon-btn"
        aria-label="Ana sayfaya dön"
        onClick={() => setScreen('home')}
      >
        ←
      </button>
    </header>
  );
}

function NotificationsPage({
  setScreen,
  setSideMenuOpen,
}: Pick<PlaceholderScreenProps, 'setScreen' | 'setSideMenuOpen'>) {
  const [items, setItems] = useState<StoredNotification[]>(() => readNotifications());
  const [onlyUnread, setOnlyUnread] = useState(false);

  useEffect(() => {
    const refresh = () => setItems(readNotifications());
    window.addEventListener('storage', refresh);
    window.addEventListener('tp:notifications-updated', refresh as EventListener);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('tp:notifications-updated', refresh as EventListener);
    };
  }, []);

  const visible = useMemo(
    () => (onlyUnread ? items.filter((item) => !item.isRead) : items),
    [items, onlyUnread],
  );
  const unreadCount = items.filter((item) => !item.isRead).length;

  const markRead = (id: string) => {
    const next = items.map((item) => (item.id === id ? { ...item, isRead: true } : item));
    setItems(next);
    writeNotifications(next);
  };

  const markAllRead = () => {
    const next = items.map((item) => ({ ...item, isRead: true }));
    setItems(next);
    writeNotifications(next);
  };

  return (
    <section className="tp-utility-page tp-placeholder-page">
      <UtilityHeader title="Bildirimler" setScreen={setScreen} setSideMenuOpen={setSideMenuOpen} />
      <main className="tp-utility-main">
        <div className="tp-utility-hero">
          <div>
            <h1>Bildirimler</h1>
            <p>Hava, uydu, takvim ve Pusula uyarılarını burada takip et. Yapılacak işler Görevlerim alanına taşınır.</p>
          </div>
          <span className="tp-utility-badge"><Bell size={14} /> {unreadCount} okunmamış</span>
        </div>

        <div className="tp-utility-section-head">
          <button type="button" onClick={() => setOnlyUnread((value) => !value)}>
            {onlyUnread ? 'Tümünü göster' : 'Yalnız okunmamış'}
          </button>
          {unreadCount > 0 ? (
            <button type="button" onClick={markAllRead}><CheckCheck size={13} /> Tümünü okundu yap</button>
          ) : null}
        </div>

        {visible.length ? (
          <div className="tp-notification-list">
            {visible.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`tp-notification-card ${item.severity ?? 'info'} ${item.isRead ? '' : 'unread'}`}
                onClick={() => {
                  markRead(item.id);
                  setScreen(targetScreen(item.target));
                }}
              >
                <span className="tp-notification-icon">{notificationIcon(item)}</span>
                <span className="tp-notification-copy">
                  <small>{item.fieldName || 'TarlaPusula'} · {notificationDate(item)}</small>
                  <strong>{item.title || 'Bildirim'}</strong>
                  {item.message ? <p>{item.message}</p> : null}
                </span>
                {item.isRead ? <ChevronRight size={14} /> : <span className="tp-notification-dot" />}
              </button>
            ))}
          </div>
        ) : (
          <div className="tp-notification-empty">
            <div>
              <Bell size={30} strokeWidth={1.5} />
              <strong>{onlyUnread ? 'Okunmamış bildirim yok' : 'Henüz bildirim yok'}</strong>
              <p>Yeni hava, uydu veya takvim olayı oluştuğunda burada görünecek.</p>
            </div>
          </div>
        )}
      </main>
    </section>
  );
}

function SettingsPage({
  setScreen,
  setSideMenuOpen,
}: Pick<PlaceholderScreenProps, 'setScreen' | 'setSideMenuOpen'>) {
  const [mapAnimation, setMapAnimation] = useState(() => {
    try {
      return window.localStorage.getItem(MAP_ANIMATION_STORAGE_KEY) !== 'off';
    } catch {
      return true;
    }
  });

  const notificationPermission =
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;

  const toggleMapAnimation = () => {
    const next = !mapAnimation;
    setMapAnimation(next);
    try {
      window.localStorage.setItem(MAP_ANIMATION_STORAGE_KEY, next ? 'on' : 'off');
    } catch {
      // Tercih kaydedilemese de ekran çalışmaya devam eder.
    }
  };

  return (
    <section className="tp-utility-page tp-placeholder-page">
      <UtilityHeader title="Ayarlar" setScreen={setScreen} setSideMenuOpen={setSideMenuOpen} />
      <main className="tp-utility-main">
        <div className="tp-utility-hero">
          <div>
            <h1>Ayarlar</h1>
            <p>Uygulama davranışını ve telefon bildirimlerini tek yerden yönet.</p>
          </div>
          <span className="tp-utility-badge"><Settings size={14} /> Uygulama</span>
        </div>

        <section className="tp-utility-section">
          <div className="tp-utility-section-head"><strong>Harita</strong></div>
          <div className="tp-settings-list">
            <div className="tp-settings-card">
              <span className="tp-settings-card-icon"><Map size={18} /></span>
              <div className="tp-settings-copy">
                <strong>Dünya → tarla geçişi</strong>
                <p>Harita açılırken ve uygun tarla geçişlerinde sinematik yaklaşmayı kullan.</p>
              </div>
              <button
                type="button"
                className={`tp-switch ${mapAnimation ? 'on' : ''}`}
                aria-label="Harita açılış animasyonunu değiştir"
                aria-pressed={mapAnimation}
                onClick={toggleMapAnimation}
              />
            </div>
          </div>
        </section>

        <section className="tp-utility-section">
          <div className="tp-utility-section-head"><strong>Bildirimler</strong></div>
          <div className="tp-settings-list">
            <div className="tp-settings-card">
              <span className="tp-settings-card-icon"><Bell size={18} /></span>
              <div className="tp-settings-copy">
                <strong>Telefon bildirimleri</strong>
                <p>
                  {notificationPermission === 'granted'
                    ? 'Tarayıcı izni açık. Takvim hatırlatmaları telefonuna gönderilebilir.'
                    : notificationPermission === 'denied'
                      ? 'Tarayıcı bildirimi engellenmiş. Cihaz/tarayıcı ayarından izin vermen gerekir.'
                      : notificationPermission === 'unsupported'
                        ? 'Bu tarayıcı web push bildirimini desteklemiyor.'
                        : 'Takvim ekranından telefon bildirimlerini açabilirsin.'}
                </p>
              </div>
              <button type="button" className="tp-settings-link" onClick={() => setScreen('calendar')}>
                Yönet <ChevronRight size={13} />
              </button>
            </div>

            <div className="tp-settings-card">
              <span className="tp-settings-card-icon"><CalendarDays size={18} /></span>
              <div className="tp-settings-copy">
                <strong>Takvim ve hatırlatmalar</strong>
                <p>Planlanan tarla işlerini, tamamlanan kayıtları ve bildirim saatlerini yönet.</p>
              </div>
              <button type="button" className="tp-settings-link" onClick={() => setScreen('calendar')}>
                Aç <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </section>

        <p className="tp-settings-note">
          Görev tamamlamaya bağlı Pusula puanları Ayarlar'dan değiştirilemez. Puan kuralları görev tamamlandığında sunucu tarafından doğrulanır.
        </p>
      </main>
    </section>
  );
}

export default function PlaceholderScreen({
  cmsRuntimeCss,
  placeholder,
  screen,
  setScreen,
  setSideMenuOpen,
}: PlaceholderScreenProps) {
  if (screen === 'notificationsHub') {
    return (
      <>
        <style>{cmsRuntimeCss + onboardingStyles + PAGE_CSS}</style>
        <NotificationsPage setScreen={setScreen} setSideMenuOpen={setSideMenuOpen} />
      </>
    );
  }

  if (screen === 'settingsHub') {
    return (
      <>
        <style>{cmsRuntimeCss + onboardingStyles + PAGE_CSS}</style>
        <SettingsPage setScreen={setScreen} setSideMenuOpen={setSideMenuOpen} />
      </>
    );
  }

  return (
    <>
      <style>{cmsRuntimeCss + onboardingStyles + PAGE_CSS}</style>
      <section className="tp-utility-page tp-placeholder-page">
        <UtilityHeader title={placeholder.title} setScreen={setScreen} setSideMenuOpen={setSideMenuOpen} />
        <main className="tp-utility-main">
          <div className="tp-utility-hero">
            <div>
              <h1>{placeholder.title}</h1>
              <p>{placeholder.subtitle}</p>
            </div>
            <span className="tp-utility-badge">{placeholder.icon} Hazırlanıyor</span>
          </div>
          <div className="tp-generic-cards">
            {placeholder.cards.map((card, index) => (
              <article className="tp-generic-card" key={card}>
                <small>{String(index + 1).padStart(2, '0')}</small>
                <h3>{card}</h3>
                <p>Bu bölüm sonraki özellik paketinde gerçek veri ve işlemlerle bağlanacak.</p>
              </article>
            ))}
          </div>
        </main>
      </section>
    </>
  );
}
