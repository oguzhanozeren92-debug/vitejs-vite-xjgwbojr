import { useEffect, useMemo, useState } from 'react';
import type { Field, Screen } from '../types';
import { useAgriNewsFeed } from '../features/content/hooks/useAgriNewsFeed';
import type { AgriNewsRow } from '../features/content/services/agriNews.service';
import './AgriNewsScreen.css';

export type NewsCategory =
  | 'all'
  | 'varieties'
  | 'support'
  | 'pest_warning'
  | 'developments';

export interface NewsItem {
  id: string;
  category: Exclude<NewsCategory, 'all'>;
  categoryLabel: string;
  badgeType: 'green' | 'yellow' | 'red' | 'blue';
  title: string;
  summary: string;
  date: string;
  sourceName: string;
  sourceUrl?: string;
  imageUrl?: string;
  actionText?: string;
  actionScreen?: string;
  tags?: string[];
  recommendedRegions?: string[];
}

type MenuItem = {
  screen: Screen | string;
  icon?: string;
  label: string;
  badge?: string;
};

export interface AgriNewsScreenProps {
  fields: Field[];
  selectedFieldId?: string;
  screen?: Screen | string;
  desktopMenuItems?: MenuItem[];
  sideMenuOpen?: boolean;
  setScreen?: (screen: Screen) => void;
  setSideMenuOpen?: (open: boolean) => void;
}

type IconName =
  | 'back'
  | 'menu'
  | 'home'
  | 'field'
  | 'ai'
  | 'calendar'
  | 'more'
  | 'all'
  | 'variety'
  | 'document'
  | 'warning'
  | 'tractor'
  | 'pin'
  | 'weather'
  | 'bell'
  | 'arrowLeft'
  | 'arrowRight'
  | 'arrowUpRight'
  | 'calculator'
  | 'checklist'
  | 'book'
  | 'info'
  | 'close';

const FILTERS: Array<{
  id: NewsCategory;
  label: string;
  icon: IconName;
}> = [
  { id: 'all', label: 'Tüm Haberler', icon: 'all' },
  { id: 'varieties', label: 'Yeni Çeşitler', icon: 'variety' },
  { id: 'support', label: 'Destek & Mevzuat', icon: 'document' },
  { id: 'pest_warning', label: 'Hastalık / Zararlı Uyarıları', icon: 'warning' },
  { id: 'developments', label: 'Tarımsal Gelişmeler', icon: 'tractor' },
];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'back':
      return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
    case 'menu':
      return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
    case 'home':
      return <svg {...common}><path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></svg>;
    case 'field':
      return <svg {...common}><path d="M4 20c4-7 8-11 16-16" /><path d="M4 15c4 0 7 1 10 5M9 8c3 0 5 1 7 3" /></svg>;
    case 'ai':
      return <svg {...common}><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" /><path d="m18.5 13 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" /></svg>;
    case 'calendar':
      return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>;
    case 'more':
      return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></svg>;
    case 'all':
      return <svg {...common}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>;
    case 'variety':
      return <svg {...common}><path d="M12 21V5M12 9c-3 0-5-2-5-5 3 0 5 2 5 5ZM12 13c3 0 5-2 5-5-3 0-5 2-5 5Z" /><path d="M12 17c-3 0-5-2-5-5 3 0 5 2 5 5Z" /></svg>;
    case 'document':
      return <svg {...common}><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v5h5M9 12h6M9 16h6" /></svg>;
    case 'warning':
      return <svg {...common}><path d="M12 4 3 20h18L12 4Z" /><path d="M12 9v5M12 17h.01" /></svg>;
    case 'tractor':
      return <svg {...common}><circle cx="7" cy="17" r="3" /><circle cx="17" cy="17" r="4" /><path d="M4 14V8h8l2 5M8 8V5h5l2 5M2 17h2M10 17h3" /></svg>;
    case 'pin':
      return <svg {...common}><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></svg>;
    case 'weather':
      return <svg {...common}><circle cx="8" cy="8" r="3" /><path d="M8 2V1M8 15v-1M2 8H1M15 8h-1" /><path d="M8 19h10a3 3 0 0 0 0-6 5 5 0 0 0-9.4 1.2A2.7 2.7 0 0 0 8 19Z" /></svg>;
    case 'bell':
      return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></svg>;
    case 'arrowLeft':
      return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
    case 'arrowRight':
      return <svg {...common}><path d="m9 6 6 6-6 6" /></svg>;
    case 'arrowUpRight':
      return <svg {...common}><path d="M7 17 17 7M9 7h8v8" /></svg>;
    case 'calculator':
      return <svg {...common}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2M8 19h2M14 19h2" /></svg>;
    case 'checklist':
      return <svg {...common}><path d="m4 7 2 2 3-4M11 7h9M4 14l2 2 3-4M11 14h9M11 20h9" /></svg>;
    case 'book':
      return <svg {...common}><path d="M4 5a3 3 0 0 1 3-2h5v17H7a3 3 0 0 0-3 2V5ZM20 5a3 3 0 0 0-3-2h-5v17h5a3 3 0 0 1 3 2V5Z" /></svg>;
    case 'info':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></svg>;
    case 'close':
      return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  }
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

function formatDate(value?: string | null) {
  if (!value) return 'Tarih belirtilmedi';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarih belirtilmedi';
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function mapNewsRow(row: AgriNewsRow): NewsItem {
  const mapped = {
    varieties: {
      category: 'varieties' as const,
      categoryLabel: 'YENİ ÇEŞİT',
      badgeType: 'green' as const,
    },
    support: {
      category: 'support' as const,
      categoryLabel: 'DESTEK & MEVZUAT',
      badgeType: 'yellow' as const,
    },
    disease: {
      category: 'pest_warning' as const,
      categoryLabel: 'HASTALIK / ZARARLI UYARISI',
      badgeType: 'red' as const,
    },
    general: {
      category: 'developments' as const,
      categoryLabel: 'TARIMSAL GELİŞMELER',
      badgeType: 'blue' as const,
    },
  }[row.category];

  return {
    id: row.id,
    ...mapped,
    title: row.title,
    summary: row.summary?.trim() || 'Bu içerik için kısa özet girilmemiş.',
    date: formatDate(row.published_at || row.created_at),
    sourceName: row.source_name || 'TarlaPusula',
    sourceUrl: row.source_url?.trim() || undefined,
    imageUrl: row.image_url?.trim() || undefined,
    actionText: row.raw?.actionText?.trim() || 'Detayı Gör',
    actionScreen: row.raw?.actionScreen?.trim() || undefined,
    tags: row.raw?.tags ?? [],
    recommendedRegions: row.raw?.recommendedRegions ?? [],
  };
}

function actionIcon(item: NewsItem): IconName {
  if (item.category === 'support') return 'calculator';
  if (item.category === 'pest_warning') return 'checklist';
  if (item.category === 'developments') return 'book';
  return 'arrowRight';
}

function cardIcon(item: NewsItem): IconName {
  if (item.category === 'support') return 'document';
  if (item.category === 'pest_warning') return 'warning';
  if (item.category === 'developments') return 'tractor';
  return 'variety';
}

export default function AgriNewsScreen({
  fields,
  selectedFieldId = '',
  setScreen,
  setSideMenuOpen = () => undefined,
}: AgriNewsScreenProps) {
  const { items: rows, loading, error, refresh } = useAgriNewsFeed();
  const newsItems = useMemo(() => rows.map(mapNewsRow), [rows]);
  const realFields = useMemo(() => fields.filter((field) => !field.demo), [fields]);
  const selectedField = useMemo(
    () =>
      realFields.find((field) => String(field.id) === String(selectedFieldId)) ??
      realFields[0] ??
      null,
    [realFields, selectedFieldId],
  );

  const [selectedCategory, setSelectedCategory] = useState<NewsCategory>('all');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [detailItem, setDetailItem] = useState<NewsItem | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<Record<Exclude<NewsCategory, 'all'>, boolean>>(() => {
    try {
      const raw = window.localStorage.getItem('tp_agri_news_notification_prefs_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          varieties: Boolean(parsed.varieties),
          support: parsed.support === undefined ? true : Boolean(parsed.support),
          pest_warning: parsed.pest_warning === undefined ? true : Boolean(parsed.pest_warning),
          developments: Boolean(parsed.developments),
        };
      }
    } catch {
      // Cihaz depolaması kapalıysa varsayılanlar kullanılır.
    }

    return {
      varieties: false,
      support: true,
      pest_warning: true,
      developments: false,
    };
  });

  const featuredItems = useMemo(() => newsItems.slice(0, 3), [newsItems]);
  const featured = featuredItems[carouselIndex] ?? featuredItems[0] ?? null;

  useEffect(() => {
    if (carouselIndex >= featuredItems.length) setCarouselIndex(0);
  }, [carouselIndex, featuredItems.length]);

  useEffect(() => {
    if (featuredItems.length <= 1) return;
    const timer = window.setInterval(() => {
      setCarouselIndex((current) => (current + 1) % featuredItems.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [featuredItems.length]);

  const locationLabel =
    [selectedField?.city, selectedField?.district].filter(Boolean).join(' / ') ||
    'Türkiye Geneli';

  const cropNames = useMemo(
    () => realFields.map((field) => String(field.crop ?? '').trim()).filter(Boolean),
    [realFields],
  );

  const filteredNews = useMemo(() => {
    if (selectedCategory === 'all') return newsItems.slice(3, 9);
    return newsItems.filter((item) => item.category === selectedCategory).slice(0, 6);
  }, [newsItems, selectedCategory]);

  const personalItems = useMemo(() => {
    const cropTokens = cropNames.map(normalizeText).filter(Boolean);
    const locationTokens = [selectedField?.city, selectedField?.district]
      .map(normalizeText)
      .filter(Boolean);

    return newsItems
      .filter((item) => {
        const tagTokens = (item.tags ?? []).map(normalizeText);
        const regionTokens = (item.recommendedRegions ?? []).map(normalizeText);
        const cropMatch = cropTokens.some((crop) =>
          tagTokens.some((tag) => tag.includes(crop) || crop.includes(tag)),
        );
        const regionMatch = locationTokens.some((location) =>
          regionTokens.some((region) => region.includes(location) || location.includes(region)),
        );
        const nationwide = regionTokens.includes(normalizeText('Türkiye Geneli'));
        return cropMatch || regionMatch || nationwide;
      })
      .slice(0, 3);
  }, [cropNames, newsItems, selectedField?.city, selectedField?.district]);

  const navigate = (next: Screen) => {
    setScreen?.(next);
    setSideMenuOpen(false);
  };

  const handleAction = (item: NewsItem) => {
    if (item.actionScreen) {
      navigate(item.actionScreen as Screen);
      return;
    }
    setDetailItem(item);
  };

  const saveNotificationPrefs = () => {
    try {
      window.localStorage.setItem(
        'tp_agri_news_notification_prefs_v1',
        JSON.stringify(notificationPrefs),
      );
    } catch {
      // Tercihler bu oturumda state içinde kalır.
    }
    setNotificationOpen(false);
  };

  return (
    <div className="tp-agri-news-page">
      <div className="tp-agri-news-content">
        <header className="tp-agri-news-topbar">
          <button type="button" onClick={() => navigate('home')} aria-label="Ana sayfaya dön">
            <Icon name="back" size={18} />
          </button>
          <div>
            <strong>Tarım Gündemi</strong>
            <small>Ürünlerin ve bölgen için önemli gelişmeleri takip et</small>
          </div>
          <button
            type="button"
            className="tp-agri-news-mobile-menu"
            onClick={() => setSideMenuOpen(true)}
            aria-label="Menüyü aç"
          >
            <Icon name="menu" size={18} />
          </button>
        </header>

        <main className="tp-agri-news-main">
          <section className="tp-agri-news-heading">
            <div>
              <span>GÜNDEM · UYARILAR · MEVZUAT</span>
              <h1>
                Tarım Gündemi
                <em>Yayınlanmış içerikleri ve tarımsal gelişmeleri tek akışta takip et.</em>
              </h1>
            </div>

            <div className="tp-agri-news-widgets">
              <article>
                <Icon name="pin" size={16} />
                <div>
                  <small>KONUM</small>
                  <strong>{locationLabel}</strong>
                  <span>{selectedField ? `${selectedField.name} referans alınıyor` : 'Türkiye geneli akış'}</span>
                </div>
              </article>
              <article>
                <Icon name="weather" size={16} />
                <div>
                  <small>HAVA BAĞLANTISI</small>
                  <strong>Tarla hava modülü</strong>
                  <span>Yerel riskleri hava ekranından doğrula</span>
                </div>
              </article>
              <button type="button" onClick={() => setNotificationOpen(true)}>
                <Icon name="bell" size={16} />
                <div>
                  <small>BİLDİRİMLER</small>
                  <strong>Tercihleri Yönet</strong>
                  <span>Destek ve risk uyarılarını seç</span>
                </div>
              </button>
            </div>
          </section>

          <div className="tp-agri-news-filters">
            {FILTERS.map((filter) => (
              <button
                type="button"
                key={filter.id}
                className={selectedCategory === filter.id ? 'active' : ''}
                onClick={() => setSelectedCategory(filter.id)}
              >
                <Icon name={filter.icon} size={15} />
                {filter.label}
              </button>
            ))}
          </div>

          {loading ? (
            <section className="tp-agri-news-live-state">
              <strong>Tarım gündemi yükleniyor…</strong>
              <span>Yayınlanmış içerikler hazırlanıyor.</span>
            </section>
          ) : error ? (
            <section className="tp-agri-news-live-state is-error">
              <strong>Tarım gündemi alınamadı.</strong>
              <span>{error}</span>
              <button type="button" onClick={() => void refresh()}>Tekrar Dene</button>
            </section>
          ) : newsItems.length === 0 ? (
            <section className="tp-agri-news-live-state">
              <strong>Henüz yayınlanmış Tarım Gündemi içeriği yok.</strong>
              <span>Yönetim panelinden yayınlanan haberler burada görünecek.</span>
            </section>
          ) : (
            <>
              {featured && (
                <section className="tp-agri-news-featured">
                  <div className="tp-agri-news-feature-image">
                    {featured.imageUrl ? (
                      <img src={featured.imageUrl} alt="" />
                    ) : (
                      <div className="tp-agri-news-live-image-empty">
                        <Icon name={cardIcon(featured)} size={42} />
                      </div>
                    )}
                    <span className={`tp-agri-news-badge ${featured.badgeType}`}>
                      {featured.categoryLabel}
                    </span>
                    {featuredItems.length > 1 && (
                      <div className="tp-agri-news-feature-controls">
                        <button
                          type="button"
                          onClick={() =>
                            setCarouselIndex(
                              (current) =>
                                (current - 1 + featuredItems.length) % featuredItems.length,
                            )
                          }
                          aria-label="Önceki manşet"
                        >
                          <Icon name="arrowLeft" size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCarouselIndex((current) => (current + 1) % featuredItems.length)
                          }
                          aria-label="Sonraki manşet"
                        >
                          <Icon name="arrowRight" size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  <article className="tp-agri-news-feature-copy">
                    <span>{featured.date}</span>
                    <h2>{featured.title}</h2>
                    <p>{featured.summary}</p>
                    {featured.tags?.length ? (
                      <div className="tp-agri-news-tags">
                        {featured.tags.map((tag) => <span key={tag}>{tag}</span>)}
                      </div>
                    ) : null}
                    <div className="tp-agri-news-feature-actions">
                      <button type="button" className="primary" onClick={() => handleAction(featured)}>
                        <Icon name={actionIcon(featured)} size={15} />
                        {featured.actionText ?? 'Detayı Gör'}
                      </button>
                      {featured.sourceUrl && (
                        <button
                          type="button"
                          onClick={() => window.open(featured.sourceUrl, '_blank', 'noopener,noreferrer')}
                        >
                          <Icon name="arrowUpRight" size={14} />
                          Kaynağı Aç
                        </button>
                      )}
                    </div>
                    <small className="tp-agri-news-source">Kaynak: {featured.sourceName}</small>
                    {featuredItems.length > 1 && (
                      <div className="tp-agri-news-dots">
                        {featuredItems.map((item, index) => (
                          <button
                            type="button"
                            key={item.id}
                            className={index === carouselIndex ? 'active' : ''}
                            onClick={() => setCarouselIndex(index)}
                            aria-label={`Manşet ${index + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </article>

                  <aside className="tp-agri-news-region-card">
                    <div>
                      <span>İLGİLİ BÖLGELER</span>
                      <h3>Bölgesel Bağlam</h3>
                      <p>Yayıncı tarafından içerikle ilişkilendirilen bölgeler gösterilir.</p>
                    </div>
                    <div className="tp-agri-news-map">
                      <svg viewBox="0 0 300 160" role="img" aria-label="İllüstratif Türkiye bölge görünümü">
                        <path d="M20 82 42 58l36 3 22-22 36 10 27-19 33 15 39-6 25 24 20 13-11 24-41 8-20 22-39-4-34 16-27-12-37 4-16-22-28-5Z" fill="currentColor" opacity=".16" stroke="currentColor" strokeWidth="2" />
                      </svg>
                      <div>
                        {(featured.recommendedRegions ?? []).length ? (
                          featured.recommendedRegions?.map((region) => <span key={region}>{region}</span>)
                        ) : (
                          <span>Bölge bilgisi eklenmemiş</span>
                        )}
                      </div>
                    </div>
                  </aside>
                </section>
              )}

              {selectedCategory === 'all' && filteredNews.length === 0 && newsItems.length <= 3 ? (
                <section className="tp-agri-news-live-state compact">
                  <strong>Şimdilik başka yayın yok.</strong>
                  <span>Yeni içerikler yayınlandıkça burada sıralanacak.</span>
                </section>
              ) : (
                <section className="tp-agri-news-grid">
                  {filteredNews.map((item) => (
                    <article className="tp-agri-news-card" key={item.id}>
                      <div className="tp-agri-news-card-top">
                        <span className={`tp-agri-news-badge ${item.badgeType}`}>{item.categoryLabel}</span>
                        <time>{item.date}</time>
                      </div>
                      <div className="tp-agri-news-card-icon">
                        <Icon name={cardIcon(item)} size={22} />
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.summary}</p>
                      <button type="button" onClick={() => handleAction(item)}>
                        <Icon name={actionIcon(item)} size={15} />
                        {item.actionText ?? 'Detayı Gör'}
                      </button>
                      <small>
                        Kaynak: {item.sourceName}
                        {item.sourceUrl && <Icon name="arrowUpRight" size={11} />}
                      </small>
                    </article>
                  ))}
                </section>
              )}

              {personalItems.length > 0 && (
                <section className="tp-agri-news-personal">
                  <div className="tp-agri-news-section-head">
                    <div>
                      <span>SANA UYGUN İÇERİKLER <Icon name="info" size={12} /></span>
                      <h2>
                        {cropNames.length
                          ? `${cropNames.slice(0, 2).join(' · ')} ve bölge eşleşmeleri`
                          : `${locationLabel} için bölgesel eşleşmeler`}
                      </h2>
                    </div>
                    <button type="button" onClick={() => setSelectedCategory('all')}>
                      Tümünü Gör <Icon name="arrowRight" size={13} />
                    </button>
                  </div>
                  <div className="tp-agri-news-personal-list">
                    {personalItems.map((item) => (
                      <article key={`personal-${item.id}`}>
                        <div className={`tp-agri-news-personal-image ${item.badgeType}`}>
                          {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <Icon name={cardIcon(item)} size={23} />}
                        </div>
                        <div>
                          <span>{item.date}</span>
                          <strong>{item.title}</strong>
                          <small>{item.categoryLabel}</small>
                        </div>
                        <button type="button" onClick={() => handleAction(item)} aria-label={item.actionText ?? 'Detayı Gör'}>
                          <Icon name="arrowRight" size={14} />
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>

      <nav className="tp-agri-news-bottom-nav">
        <button type="button" onClick={() => navigate('home')}><Icon name="home" size={18} /><span>Ana Sayfa</span></button>
        <button type="button" onClick={() => navigate('home')}><Icon name="field" size={18} /><span>Tarlalarım</span></button>
        <button type="button" className="tp-agri-news-bottom-ai" onClick={() => navigate('aiAnalysis')}><b><Icon name="ai" size={19} /></b><span>AI Analiz</span></button>
        <button type="button" onClick={() => navigate('calendar')}><Icon name="calendar" size={18} /><span>Takvim</span></button>
        <button type="button" onClick={() => setSideMenuOpen(true)}><Icon name="more" size={18} /><span>Daha Fazla</span></button>
      </nav>

      {detailItem && (
        <div className="tp-agri-news-modal-layer">
          <button type="button" className="tp-agri-news-modal-backdrop" onClick={() => setDetailItem(null)} aria-label="Detay penceresini kapat" />
          <section className="tp-agri-news-modal" role="dialog" aria-modal="true" aria-label="Gündem detayı">
            <div className="tp-agri-news-modal-head">
              <div>
                <span className={`tp-agri-news-badge ${detailItem.badgeType}`}>{detailItem.categoryLabel}</span>
                <small>{detailItem.date}</small>
              </div>
              <button type="button" onClick={() => setDetailItem(null)} aria-label="Kapat"><Icon name="close" size={17} /></button>
            </div>
            {detailItem.imageUrl && <img className="tp-agri-news-modal-image" src={detailItem.imageUrl} alt="" />}
            <h2>{detailItem.title}</h2>
            <p>{detailItem.summary}</p>
            {detailItem.tags?.length ? (
              <div className="tp-agri-news-tags">{detailItem.tags.map((tag) => <span key={`modal-${tag}`}>{tag}</span>)}</div>
            ) : null}
            {detailItem.recommendedRegions?.length ? (
              <div className="tp-agri-news-modal-regions">
                <strong>İlgili bölgeler</strong>
                <div>{detailItem.recommendedRegions.map((region) => <span key={`region-${region}`}>{region}</span>)}</div>
              </div>
            ) : null}
            <div className="tp-agri-news-modal-source">
              <Icon name="info" size={15} />
              <span>Kaynak: {detailItem.sourceName}. Yayıncı tarafından eklenen kaynak ve içerik bilgisi gösteriliyor.</span>
            </div>
            <div className="tp-agri-news-modal-actions">
              <button type="button" onClick={() => setDetailItem(null)}>Kapat</button>
              {detailItem.sourceUrl && (
                <button type="button" onClick={() => window.open(detailItem.sourceUrl, '_blank', 'noopener,noreferrer')}>Kaynağı Aç</button>
              )}
              {detailItem.actionScreen && (
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    const target = detailItem.actionScreen as Screen;
                    setDetailItem(null);
                    navigate(target);
                  }}
                >
                  İlgili Modülü Aç
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {notificationOpen && (
        <div className="tp-agri-news-modal-layer">
          <button type="button" className="tp-agri-news-modal-backdrop" onClick={() => setNotificationOpen(false)} aria-label="Bildirim penceresini kapat" />
          <section className="tp-agri-news-modal compact" role="dialog" aria-modal="true" aria-label="Tarım gündemi bildirim tercihleri">
            <div className="tp-agri-news-modal-head">
              <div><small>BİLDİRİM TERCİHLERİ</small><h2>Hangi gelişmeleri takip edelim?</h2></div>
              <button type="button" onClick={() => setNotificationOpen(false)} aria-label="Kapat"><Icon name="close" size={17} /></button>
            </div>
            <div className="tp-agri-news-pref-list">
              {FILTERS.filter((filter) => filter.id !== 'all').map((filter) => {
                const key = filter.id as Exclude<NewsCategory, 'all'>;
                return (
                  <label key={`pref-${key}`} className={notificationPrefs[key] ? 'selected' : ''}>
                    <input
                      type="checkbox"
                      checked={notificationPrefs[key]}
                      onChange={() => setNotificationPrefs((current) => ({ ...current, [key]: !current[key] }))}
                    />
                    <span><Icon name={filter.icon} size={17} /></span>
                    <strong>{filter.label}</strong>
                  </label>
                );
              })}
            </div>
            <div className="tp-agri-news-modal-source">
              <Icon name="info" size={15} />
              <span>Bu tercih cihazda saklanır. Push bildirim altyapısı bağlandığında aynı seçimler kullanılabilir.</span>
            </div>
            <div className="tp-agri-news-modal-actions">
              <button type="button" onClick={() => setNotificationOpen(false)}>Vazgeç</button>
              <button type="button" className="primary" onClick={saveNotificationPrefs}>Tercihleri Kaydet</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
