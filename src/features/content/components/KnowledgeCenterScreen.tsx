import { useMemo, useState } from 'react';
import {
  BookOpen,
  Bug,
  ChevronRight,
  Image as ImageIcon,
  LibraryBig,
  Megaphone,
  RefreshCw,
  Search,
  ShieldAlert,
  Sprout,
  X,
} from 'lucide-react';
import { useKnowledgeContentFeed } from '../hooks/useKnowledgeContentFeed';
import type {
  KnowledgeContentRow,
  KnowledgeContentType,
} from '../services/knowledgeContent.service';
import './KnowledgeCenterScreen.css';

type KnowledgeFilter = 'all' | KnowledgeContentType;

const FILTERS: Array<{
  id: KnowledgeFilter;
  label: string;
  icon: typeof BookOpen;
}> = [
  { id: 'all', label: 'Tümü', icon: LibraryBig },
  { id: 'guide', label: 'Makaleler & Rehberler', icon: BookOpen },
  { id: 'plant', label: 'Bitkiler', icon: Sprout },
  { id: 'disease', label: 'Hastalıklar', icon: ShieldAlert },
  { id: 'pest', label: 'Zararlılar', icon: Bug },
  { id: 'announcement', label: 'Duyurular', icon: Megaphone },
  { id: 'image', label: 'Görseller', icon: ImageIcon },
];

const TYPE_LABELS: Record<KnowledgeContentType, string> = {
  guide: 'Bilimsel Makale / Rehber',
  plant: 'Bitki',
  disease: 'Hastalık',
  pest: 'Zararlı',
  announcement: 'Duyuru',
  image: 'Görsel İçerik',
};

function normalizeText(value: string) {
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
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function TypeIcon({ type, size = 21 }: { type: KnowledgeContentType; size?: number }) {
  const props = { size, strokeWidth: 1.8, 'aria-hidden': true } as const;

  if (type === 'plant') return <Sprout {...props} />;
  if (type === 'disease') return <ShieldAlert {...props} />;
  if (type === 'pest') return <Bug {...props} />;
  if (type === 'announcement') return <Megaphone {...props} />;
  if (type === 'image') return <ImageIcon {...props} />;
  return <BookOpen {...props} />;
}

function KnowledgeCard({
  item,
  onOpen,
}: {
  item: KnowledgeContentRow;
  onOpen: (item: KnowledgeContentRow) => void;
}) {
  const updatedLabel = formatDate(item.updated_at || item.created_at);

  return (
    <button
      type="button"
      className={`tp-knowledge-card type-${item.content_type}`}
      onClick={() => onOpen(item)}
    >
      <div className="tp-knowledge-card-media">
        {item.image_url ? (
          <img src={item.image_url} alt="" loading="lazy" />
        ) : (
          <div className="tp-knowledge-card-placeholder">
            <TypeIcon type={item.content_type} size={30} />
          </div>
        )}
        <span className="tp-knowledge-type-badge">
          <TypeIcon type={item.content_type} size={13} />
          {TYPE_LABELS[item.content_type]}
        </span>
      </div>

      <div className="tp-knowledge-card-copy">
        <div className="tp-knowledge-card-meta">
          <span>{item.category || 'Genel'}</span>
          {updatedLabel && <time>{updatedLabel}</time>}
        </div>
        <h3>{item.title}</h3>
        {item.description ? <p>{item.description}</p> : <p>İçeriği görüntülemek için dokun.</p>}
        <span className="tp-knowledge-card-action">
          Detayı Gör
          <ChevronRight size={15} strokeWidth={2} />
        </span>
      </div>
    </button>
  );
}

export default function KnowledgeCenterScreen() {
  const { items, loading, error, refresh } = useKnowledgeContentFeed();
  const [filter, setFilter] = useState<KnowledgeFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<KnowledgeContentRow | null>(null);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return items.filter((item) => {
      if (filter !== 'all' && item.content_type !== filter) return false;
      if (!normalizedQuery) return true;

      return normalizeText(
        [item.title, item.description, item.category, TYPE_LABELS[item.content_type]]
          .filter(Boolean)
          .join(' '),
      ).includes(normalizedQuery);
    });
  }, [items, filter, query]);

  const counts = useMemo(() => {
    const next: Partial<Record<KnowledgeFilter, number>> = { all: items.length };
    for (const item of items) {
      next[item.content_type] = (next[item.content_type] ?? 0) + 1;
    }
    return next;
  }, [items]);

  return (
    <div className="tp-knowledge-page">
      <header className="tp-knowledge-hero">
        <div className="tp-knowledge-hero-mark" aria-hidden="true">
          <LibraryBig size={28} strokeWidth={1.7} />
        </div>
        <div className="tp-knowledge-hero-copy">
          <span>BİLİMSEL BİLGİ · REHBER · SAHA KAYNAĞI</span>
          <h1>Bilgi Merkezi</h1>
          <p>
            Tarımsal makaleleri, bitki bilgilerini, hastalık ve zararlı rehberlerini tek yerde incele.
          </p>
        </div>
      </header>

      <section className="tp-knowledge-toolbar" aria-label="Bilgi Merkezi araçları">
        <label className="tp-knowledge-search">
          <Search size={17} strokeWidth={1.8} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Başlık, kategori veya konu ara..."
            aria-label="Bilgi Merkezi'nde ara"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Aramayı temizle">
              <X size={15} />
            </button>
          )}
        </label>

        <div className="tp-knowledge-filters" role="tablist" aria-label="İçerik türleri">
          {FILTERS.map((item) => {
            const Icon = item.icon;
            const active = item.id === filter;
            const count = counts[item.id] ?? 0;

            return (
              <button
                type="button"
                key={item.id}
                className={active ? 'active' : ''}
                onClick={() => setFilter(item.id)}
                role="tab"
                aria-selected={active}
              >
                <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
                <span>{item.label}</span>
                {count > 0 && <small>{count}</small>}
              </button>
            );
          })}
        </div>
      </section>

      <main className="tp-knowledge-main">
        {loading && (
          <div className="tp-knowledge-state">
            <span className="tp-knowledge-spinner" aria-hidden="true" />
            <strong>Bilgi Merkezi hazırlanıyor</strong>
            <p>Yayınlanmış içerikler yükleniyor.</p>
          </div>
        )}

        {!loading && error && (
          <div className="tp-knowledge-state error">
            <ShieldAlert size={27} strokeWidth={1.7} aria-hidden="true" />
            <strong>İçerikler alınamadı</strong>
            <p>{error}</p>
            <button type="button" onClick={() => void refresh()}>
              <RefreshCw size={15} />
              Tekrar Dene
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="tp-knowledge-state empty">
            <BookOpen size={29} strokeWidth={1.6} aria-hidden="true" />
            <strong>Henüz yayınlanmış içerik yok</strong>
            <p>Bilgi Merkezi içerikleri yönetim panelinden yayınlandığında burada görünecek.</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && filteredItems.length === 0 && (
          <div className="tp-knowledge-state empty">
            <Search size={27} strokeWidth={1.6} aria-hidden="true" />
            <strong>Eşleşen içerik bulunamadı</strong>
            <p>Aramayı veya seçili içerik türünü değiştir.</p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setFilter('all');
              }}
            >
              Filtreleri Temizle
            </button>
          </div>
        )}

        {!loading && !error && filteredItems.length > 0 && (
          <section className="tp-knowledge-results">
            <div className="tp-knowledge-results-head">
              <div>
                <span>YAYINLANMIŞ İÇERİKLER</span>
                <h2>
                  {filter === 'all'
                    ? 'Tüm Bilgi Merkezi'
                    : FILTERS.find((item) => item.id === filter)?.label}
                </h2>
              </div>
              <small>{filteredItems.length} içerik</small>
            </div>

            <div className="tp-knowledge-grid">
              {filteredItems.map((item) => (
                <KnowledgeCard key={item.id} item={item} onOpen={setSelectedItem} />
              ))}
            </div>
          </section>
        )}
      </main>

      {selectedItem && (
        <div className="tp-knowledge-modal-layer">
          <button
            type="button"
            className="tp-knowledge-modal-backdrop"
            onClick={() => setSelectedItem(null)}
            aria-label="İçerik detayını kapat"
          />

          <article
            className="tp-knowledge-modal"
            role="dialog"
            aria-modal="true"
            aria-label={selectedItem.title}
          >
            <div className="tp-knowledge-modal-head">
              <span className={`tp-knowledge-modal-icon type-${selectedItem.content_type}`}>
                <TypeIcon type={selectedItem.content_type} size={20} />
              </span>
              <div>
                <small>{TYPE_LABELS[selectedItem.content_type]}</small>
                <span>{selectedItem.category || 'Genel'}</span>
              </div>
              <button type="button" onClick={() => setSelectedItem(null)} aria-label="Kapat">
                <X size={18} />
              </button>
            </div>

            {selectedItem.image_url && (
              <img className="tp-knowledge-modal-image" src={selectedItem.image_url} alt="" />
            )}

            <div className="tp-knowledge-modal-body">
              <h2>{selectedItem.title}</h2>
              {formatDate(selectedItem.updated_at || selectedItem.created_at) && (
                <time>{formatDate(selectedItem.updated_at || selectedItem.created_at)}</time>
              )}
              {selectedItem.description ? (
                <p>{selectedItem.description}</p>
              ) : (
                <p>Bu içerik için henüz açıklama eklenmemiş.</p>
              )}
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
