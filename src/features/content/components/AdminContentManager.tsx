import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  deleteAdminAgriNews,
  listAdminAgriNews,
  saveAdminAgriNews,
  setAgriNewsPublished,
  type AgriNewsDbCategory,
  type AgriNewsRow,
} from '../services/agriNews.service';
import {
  deleteAdminKnowledgeContent,
  listAdminKnowledgeContent,
  saveAdminKnowledgeContent,
  setKnowledgeContentActive,
  type KnowledgeContentRow,
  type KnowledgeContentType,
} from '../services/knowledgeContent.service';
import './AdminContentManager.css';

type ContentTab = 'agenda' | 'knowledge';

type NewsDraft = {
  id?: string;
  title: string;
  summary: string;
  category: AgriNewsDbCategory;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string;
  actionText: string;
  actionScreen: string;
  tags: string;
  regions: string;
  isPublished: boolean;
};

type KnowledgeDraft = {
  id?: string;
  title: string;
  description: string;
  category: string;
  contentType: KnowledgeContentType;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
};

const EMPTY_NEWS: NewsDraft = {
  title: '',
  summary: '',
  category: 'general',
  sourceName: 'TarlaPusula',
  sourceUrl: '',
  imageUrl: '',
  actionText: 'Detayı Gör',
  actionScreen: '',
  tags: '',
  regions: 'Türkiye Geneli',
  isPublished: true,
};

const EMPTY_KNOWLEDGE: KnowledgeDraft = {
  title: '',
  description: '',
  category: 'genel',
  contentType: 'guide',
  imageUrl: '',
  isActive: true,
  sortOrder: 0,
};

const CATEGORY_LABELS: Record<AgriNewsDbCategory, string> = {
  varieties: 'Yeni Çeşit',
  support: 'Destek & Mevzuat',
  disease: 'Hastalık / Zararlı Uyarısı',
  general: 'Tarımsal Gelişmeler',
};

const KNOWLEDGE_TYPE_LABELS: Record<KnowledgeContentType, string> = {
  guide: 'Bilimsel Makale / Rehber',
  plant: 'Bitki',
  disease: 'Hastalık',
  pest: 'Zararlı',
  announcement: 'Duyuru',
  image: 'Görsel İçerik',
};

function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value?: string | null) {
  if (!value) return 'Taslak';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarih yok';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export default function AdminContentManager() {
  const [tab, setTab] = useState<ContentTab>('agenda');
  const [news, setNews] = useState<AgriNewsRow[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeContentRow[]>([]);
  const [newsDraft, setNewsDraft] = useState<NewsDraft>(EMPTY_NEWS);
  const [knowledgeDraft, setKnowledgeDraft] =
    useState<KnowledgeDraft>(EMPTY_KNOWLEDGE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [nextNews, nextKnowledge] = await Promise.all([
        listAdminAgriNews(),
        listAdminKnowledgeContent(),
      ]);
      setNews(nextNews);
      setKnowledge(nextKnowledge);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'İçerik kayıtları yüklenemedi.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const publishedCount = useMemo(
    () => news.filter((item) => item.is_published).length,
    [news],
  );
  const activeKnowledgeCount = useMemo(
    () => knowledge.filter((item) => item.is_active).length,
    [knowledge],
  );

  const resetFeedback = () => {
    setMessage('');
    setError('');
  };

  const editNews = (item: AgriNewsRow) => {
    resetFeedback();
    setNewsDraft({
      id: item.id,
      title: item.title,
      summary: item.summary ?? '',
      category: item.category,
      sourceName: item.source_name || 'TarlaPusula',
      sourceUrl: item.source_url ?? '',
      imageUrl: item.image_url ?? '',
      actionText: item.raw?.actionText ?? 'Detayı Gör',
      actionScreen: item.raw?.actionScreen ?? '',
      tags: (item.raw?.tags ?? []).join(', '),
      regions: (item.raw?.recommendedRegions ?? []).join(', '),
      isPublished: item.is_published,
    });
    window.setTimeout(() => {
      document
        .querySelector('.tp-admin-content-editor')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 20);
  };

  const editKnowledge = (item: KnowledgeContentRow) => {
    resetFeedback();
    setKnowledgeDraft({
      id: item.id,
      title: item.title,
      description: item.description ?? '',
      category: item.category || 'genel',
      contentType: item.content_type,
      imageUrl: item.image_url ?? '',
      isActive: item.is_active,
      sortOrder: Number(item.sort_order ?? 0),
    });
    window.setTimeout(() => {
      document
        .querySelector('.tp-admin-content-editor')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 20);
  };

  const submitNews = async (event: FormEvent) => {
    event.preventDefault();
    resetFeedback();
    setSaving(true);
    try {
      await saveAdminAgriNews({
        id: newsDraft.id,
        title: newsDraft.title,
        summary: newsDraft.summary,
        category: newsDraft.category,
        sourceName: newsDraft.sourceName,
        sourceUrl: newsDraft.sourceUrl,
        imageUrl: newsDraft.imageUrl,
        isPublished: newsDraft.isPublished,
        actionText: newsDraft.actionText,
        actionScreen: newsDraft.actionScreen,
        tags: splitCsv(newsDraft.tags),
        recommendedRegions: splitCsv(newsDraft.regions),
      });
      setNewsDraft(EMPTY_NEWS);
      setMessage(newsDraft.id ? 'Haber güncellendi.' : 'Haber kaydedildi.');
      await load();
      window.dispatchEvent(new Event('tp-agri-news-updated'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Haber kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const submitKnowledge = async (event: FormEvent) => {
    event.preventDefault();
    resetFeedback();
    setSaving(true);
    try {
      await saveAdminKnowledgeContent({
        id: knowledgeDraft.id,
        title: knowledgeDraft.title,
        description: knowledgeDraft.description,
        category: knowledgeDraft.category,
        contentType: knowledgeDraft.contentType,
        imageUrl: knowledgeDraft.imageUrl,
        isActive: knowledgeDraft.isActive,
        sortOrder: knowledgeDraft.sortOrder,
      });
      setKnowledgeDraft(EMPTY_KNOWLEDGE);
      setMessage(
        knowledgeDraft.id ? 'Bilgi içeriği güncellendi.' : 'Bilgi içeriği kaydedildi.',
      );
      await load();
      window.dispatchEvent(new Event('tp-knowledge-content-updated'));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Bilgi içeriği kaydedilemedi.',
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleNews = async (item: AgriNewsRow) => {
    resetFeedback();
    setSaving(true);
    try {
      await setAgriNewsPublished(item.id, !item.is_published);
      setMessage(item.is_published ? 'Haber yayından kaldırıldı.' : 'Haber yayınlandı.');
      await load();
      window.dispatchEvent(new Event('tp-agri-news-updated'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Yayın durumu değiştirilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const removeNews = async (item: AgriNewsRow) => {
    if (!window.confirm(`“${item.title}” silinsin mi?`)) return;
    resetFeedback();
    setSaving(true);
    try {
      await deleteAdminAgriNews(item.id);
      if (newsDraft.id === item.id) setNewsDraft(EMPTY_NEWS);
      setMessage('Haber silindi.');
      await load();
      window.dispatchEvent(new Event('tp-agri-news-updated'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Haber silinemedi.');
    } finally {
      setSaving(false);
    }
  };

  const toggleKnowledge = async (item: KnowledgeContentRow) => {
    resetFeedback();
    setSaving(true);
    try {
      await setKnowledgeContentActive(item.id, !item.is_active);
      setMessage(item.is_active ? 'İçerik pasife alındı.' : 'İçerik yayına açıldı.');
      await load();
      window.dispatchEvent(new Event('tp-knowledge-content-updated'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'İçerik durumu değiştirilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const removeKnowledge = async (item: KnowledgeContentRow) => {
    if (!window.confirm(`“${item.title}” silinsin mi?`)) return;
    resetFeedback();
    setSaving(true);
    try {
      await deleteAdminKnowledgeContent(item.id);
      if (knowledgeDraft.id === item.id) setKnowledgeDraft(EMPTY_KNOWLEDGE);
      setMessage('Bilgi içeriği silindi.');
      await load();
      window.dispatchEvent(new Event('tp-knowledge-content-updated'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'İçerik silinemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="tp-admin-content-manager">
      <header className="tp-admin-content-head">
        <div>
          <span>İÇERİK MERKEZİ</span>
          <h2>Gündem ve Bilgi Merkezi</h2>
          <p>
            Kullanıcıya gösterilecek içerikleri buradan yayınla, düzenle veya
            yayından kaldır.
          </p>
        </div>
        <div className="tp-admin-content-counts">
          <strong>{publishedCount}<small>yayında haber</small></strong>
          <strong>{activeKnowledgeCount}<small>aktif bilgi</small></strong>
        </div>
      </header>

      <nav className="tp-admin-content-tabs" aria-label="İçerik türü">
        <button
          type="button"
          className={tab === 'agenda' ? 'active' : ''}
          onClick={() => setTab('agenda')}
        >
          Tarım Gündemi
        </button>
        <button
          type="button"
          className={tab === 'knowledge' ? 'active' : ''}
          onClick={() => setTab('knowledge')}
        >
          Bilgi Merkezi
        </button>
      </nav>

      {message && <div className="tp-admin-content-message success">{message}</div>}
      {error && <div className="tp-admin-content-message error">{error}</div>}

      {tab === 'agenda' ? (
        <div className="tp-admin-content-layout">
          <form className="tp-admin-content-editor" onSubmit={submitNews}>
            <div className="tp-admin-content-editor-title">
              <div>
                <strong>{newsDraft.id ? 'Haberi Düzenle' : 'Yeni Haber'}</strong>
                <small>Kaynak ve yayın durumunu açıkça belirt.</small>
              </div>
              {newsDraft.id && (
                <button type="button" onClick={() => setNewsDraft(EMPTY_NEWS)}>
                  Yeni kayıt
                </button>
              )}
            </div>

            <label>
              Başlık
              <input
                required
                maxLength={180}
                value={newsDraft.title}
                onChange={(event) =>
                  setNewsDraft((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label>
              Özet
              <textarea
                rows={5}
                value={newsDraft.summary}
                onChange={(event) =>
                  setNewsDraft((current) => ({ ...current, summary: event.target.value }))
                }
              />
            </label>
            <div className="tp-admin-content-grid two">
              <label>
                Kategori
                <select
                  value={newsDraft.category}
                  onChange={(event) =>
                    setNewsDraft((current) => ({
                      ...current,
                      category: event.target.value as AgriNewsDbCategory,
                    }))
                  }
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                Kaynak adı
                <input
                  value={newsDraft.sourceName}
                  onChange={(event) =>
                    setNewsDraft((current) => ({
                      ...current,
                      sourceName: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label>
              Kaynak bağlantısı
              <input
                type="url"
                placeholder="https://..."
                value={newsDraft.sourceUrl}
                onChange={(event) =>
                  setNewsDraft((current) => ({ ...current, sourceUrl: event.target.value }))
                }
              />
            </label>
            <label>
              Kapak görseli URL
              <input
                type="url"
                placeholder="https://..."
                value={newsDraft.imageUrl}
                onChange={(event) =>
                  setNewsDraft((current) => ({ ...current, imageUrl: event.target.value }))
                }
              />
            </label>
            <div className="tp-admin-content-grid two">
              <label>
                Aksiyon yazısı
                <input
                  value={newsDraft.actionText}
                  onChange={(event) =>
                    setNewsDraft((current) => ({ ...current, actionText: event.target.value }))
                  }
                />
              </label>
              <label>
                Uygulama hedefi
                <input
                  placeholder="Örn: supportHub"
                  value={newsDraft.actionScreen}
                  onChange={(event) =>
                    setNewsDraft((current) => ({ ...current, actionScreen: event.target.value }))
                  }
                />
              </label>
            </div>
            <label>
              Etiketler
              <input
                placeholder="Buğday, ÇKS, Sulama"
                value={newsDraft.tags}
                onChange={(event) =>
                  setNewsDraft((current) => ({ ...current, tags: event.target.value }))
                }
              />
              <small>Virgülle ayır.</small>
            </label>
            <label>
              Önerilen bölgeler
              <input
                placeholder="Türkiye Geneli, İç Anadolu"
                value={newsDraft.regions}
                onChange={(event) =>
                  setNewsDraft((current) => ({ ...current, regions: event.target.value }))
                }
              />
              <small>Virgülle ayır.</small>
            </label>
            <label className="tp-admin-content-check">
              <input
                type="checkbox"
                checked={newsDraft.isPublished}
                onChange={(event) =>
                  setNewsDraft((current) => ({
                    ...current,
                    isPublished: event.target.checked,
                  }))
                }
              />
              <span>
                Hemen yayınla
                <small>Kapalıysa taslak olarak kaydedilir.</small>
              </span>
            </label>
            <button className="tp-admin-content-save" disabled={saving} type="submit">
              {saving ? 'Kaydediliyor…' : newsDraft.id ? 'Değişiklikleri Kaydet' : 'Haberi Kaydet'}
            </button>
          </form>

          <div className="tp-admin-content-list">
            <div className="tp-admin-content-list-head">
              <strong>Haberler</strong>
              <span>{news.length} kayıt</span>
            </div>
            {loading ? (
              <div className="tp-admin-content-empty">Haberler yükleniyor…</div>
            ) : news.length === 0 ? (
              <div className="tp-admin-content-empty">
                <strong>Henüz haber yok.</strong>
                <span>İlk içeriği soldaki formdan ekleyebilirsin.</span>
              </div>
            ) : (
              news.map((item) => (
                <article key={item.id} className="tp-admin-content-row">
                  {item.image_url ? <img src={item.image_url} alt="" /> : <div className="tp-admin-content-image-empty">Görsel yok</div>}
                  <div className="tp-admin-content-row-copy">
                    <span className={`status ${item.is_published ? 'live' : 'draft'}`}>
                      {item.is_published ? 'YAYINDA' : 'TASLAK'}
                    </span>
                    <small>{CATEGORY_LABELS[item.category]} · {formatDate(item.published_at)}</small>
                    <strong>{item.title}</strong>
                    <p>{item.summary || 'Özet girilmemiş.'}</p>
                    <em>{item.source_name}</em>
                  </div>
                  <div className="tp-admin-content-row-actions">
                    <button type="button" onClick={() => editNews(item)}>Düzenle</button>
                    <button type="button" onClick={() => void toggleNews(item)} disabled={saving}>
                      {item.is_published ? 'Yayından Al' : 'Yayınla'}
                    </button>
                    <button className="danger" type="button" onClick={() => void removeNews(item)} disabled={saving}>Sil</button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="tp-admin-content-layout">
          <form className="tp-admin-content-editor" onSubmit={submitKnowledge}>
            <div className="tp-admin-content-editor-title">
              <div>
                <strong>{knowledgeDraft.id ? 'İçeriği Düzenle' : 'Yeni Bilgi İçeriği'}</strong>
                <small>Makale, rehber, hastalık veya zararlı içeriği ekle.</small>
              </div>
              {knowledgeDraft.id && (
                <button type="button" onClick={() => setKnowledgeDraft(EMPTY_KNOWLEDGE)}>
                  Yeni kayıt
                </button>
              )}
            </div>
            <label>
              Başlık
              <input
                required
                maxLength={180}
                value={knowledgeDraft.title}
                onChange={(event) =>
                  setKnowledgeDraft((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label>
              İçerik / Açıklama
              <textarea
                required
                rows={10}
                value={knowledgeDraft.description}
                onChange={(event) =>
                  setKnowledgeDraft((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>
            <div className="tp-admin-content-grid two">
              <label>
                İçerik türü
                <select
                  value={knowledgeDraft.contentType}
                  onChange={(event) =>
                    setKnowledgeDraft((current) => ({
                      ...current,
                      contentType: event.target.value as KnowledgeContentType,
                    }))
                  }
                >
                  {Object.entries(KNOWLEDGE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                Kategori
                <input
                  placeholder="Örn: Bitki Sağlığı"
                  value={knowledgeDraft.category}
                  onChange={(event) =>
                    setKnowledgeDraft((current) => ({ ...current, category: event.target.value }))
                  }
                />
              </label>
            </div>
            <label>
              Kapak görseli URL
              <input
                type="url"
                placeholder="https://..."
                value={knowledgeDraft.imageUrl}
                onChange={(event) =>
                  setKnowledgeDraft((current) => ({ ...current, imageUrl: event.target.value }))
                }
              />
            </label>
            <label>
              Sıralama
              <input
                type="number"
                value={knowledgeDraft.sortOrder}
                onChange={(event) =>
                  setKnowledgeDraft((current) => ({
                    ...current,
                    sortOrder: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="tp-admin-content-check">
              <input
                type="checkbox"
                checked={knowledgeDraft.isActive}
                onChange={(event) =>
                  setKnowledgeDraft((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
              />
              <span>
                Kullanıcıya göster
                <small>Kapalıysa içerik panelde kalır ama yayında görünmez.</small>
              </span>
            </label>
            <button className="tp-admin-content-save" disabled={saving} type="submit">
              {saving ? 'Kaydediliyor…' : knowledgeDraft.id ? 'Değişiklikleri Kaydet' : 'İçeriği Kaydet'}
            </button>
          </form>

          <div className="tp-admin-content-list">
            <div className="tp-admin-content-list-head">
              <strong>Bilgi Merkezi İçerikleri</strong>
              <span>{knowledge.length} kayıt</span>
            </div>
            {loading ? (
              <div className="tp-admin-content-empty">İçerikler yükleniyor…</div>
            ) : knowledge.length === 0 ? (
              <div className="tp-admin-content-empty">
                <strong>Henüz bilgi içeriği yok.</strong>
                <span>İlk makale veya rehberi soldan ekleyebilirsin.</span>
              </div>
            ) : (
              knowledge.map((item) => (
                <article key={item.id} className="tp-admin-content-row">
                  {item.image_url ? <img src={item.image_url} alt="" /> : <div className="tp-admin-content-image-empty">Görsel yok</div>}
                  <div className="tp-admin-content-row-copy">
                    <span className={`status ${item.is_active ? 'live' : 'draft'}`}>
                      {item.is_active ? 'AKTİF' : 'PASİF'}
                    </span>
                    <small>{KNOWLEDGE_TYPE_LABELS[item.content_type]} · sıra {item.sort_order}</small>
                    <strong>{item.title}</strong>
                    <p>{item.description || 'Açıklama girilmemiş.'}</p>
                    <em>{item.category}</em>
                  </div>
                  <div className="tp-admin-content-row-actions">
                    <button type="button" onClick={() => editKnowledge(item)}>Düzenle</button>
                    <button type="button" onClick={() => void toggleKnowledge(item)} disabled={saving}>
                      {item.is_active ? 'Pasife Al' : 'Yayınla'}
                    </button>
                    <button className="danger" type="button" onClick={() => void removeKnowledge(item)} disabled={saving}>Sil</button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}
