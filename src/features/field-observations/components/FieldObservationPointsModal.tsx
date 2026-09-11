import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  listFieldObservationPoints,
  updateObservationPointStatus,
} from '../services/fieldObservation.service';

import type {
  FieldObservationPoint,
  FieldObservationPointOverview,
  FieldObservationPointStatus,
  NdviObservationTarget,
} from '../types/fieldObservation';

type Props = {
  open: boolean;
  fieldId: string | null | undefined;
  fieldName: string;
  onClose: () => void;
  onOpenOnMap: (target: NdviObservationTarget) => void;
  onOpenHistory: (target: NdviObservationTarget) => void;
  onStatusChanged?: (point: FieldObservationPoint) => void;
};

const CSS = String.raw`
.tp-field-tracking-portal{
  position:fixed!important;
  inset:0!important;
  z-index:2147483632!important;
  width:100vw!important;
  height:100dvh!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  padding:max(14px,env(safe-area-inset-top)) 14px max(14px,env(safe-area-inset-bottom))!important;
  box-sizing:border-box!important;
  isolation:isolate!important;
}
.tp-field-tracking-backdrop{
  position:absolute!important;inset:0!important;z-index:0!important;border:0!important;
  background:rgba(0,0,0,.66)!important;backdrop-filter:blur(5px)!important;-webkit-backdrop-filter:blur(5px)!important;
}
.tp-field-tracking-sheet{
  position:relative!important;z-index:1!important;width:min(94vw,620px)!important;max-height:min(88dvh,780px)!important;
  display:flex!important;flex-direction:column!important;overflow:hidden!important;
  border:1px solid rgba(34,197,94,.16)!important;border-radius:22px!important;
  background:radial-gradient(circle at 12% 0%,rgba(34,197,94,.075),transparent 28%),rgba(3,12,7,.99)!important;
  box-shadow:0 30px 90px rgba(0,0,0,.70)!important;
}
.tp-field-tracking-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px;border-bottom:1px solid rgba(255,255,255,.055)}
.tp-field-tracking-kicker{color:#86efac;font-size:7px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}
.tp-field-tracking-head h3{margin:4px 0 0;color:#f1f7f2;font-size:14px}
.tp-field-tracking-head p{margin:5px 0 0;color:rgba(210,224,213,.58);font-size:8.5px;line-height:1.4}
.tp-field-tracking-close{width:32px;height:32px;flex:0 0 32px;border:1px solid rgba(255,255,255,.06);border-radius:10px;background:rgba(255,255,255,.02);color:#dce8de;font-size:19px;cursor:pointer}
.tp-field-tracking-body{min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:12px 14px 14px}
.tp-field-tracking-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:11px}
.tp-field-tracking-tabs{display:flex;gap:6px;margin:0 0 10px;overflow-x:auto;scrollbar-width:none}
.tp-field-tracking-tabs::-webkit-scrollbar{display:none}
.tp-field-tracking-tab{min-height:29px;padding:0 9px;border:1px solid rgba(105,139,114,.10);border-radius:999px;background:rgba(255,255,255,.012);color:rgba(191,207,195,.58);font-size:6.8px;font-weight:850;white-space:nowrap;cursor:pointer}
.tp-field-tracking-tab.active{border-color:rgba(34,197,94,.20);background:rgba(34,197,94,.055);color:#bbf7d0}
.tp-field-tracking-card.paused{opacity:.78;border-color:rgba(245,158,11,.12)}
.tp-field-tracking-card.resolved{opacity:.68;border-color:rgba(148,163,184,.10)}
.tp-field-tracking-state.paused{border-color:rgba(245,158,11,.17);background:rgba(245,158,11,.04);color:#fde68a}
.tp-field-tracking-state.resolved{border-color:rgba(148,163,184,.14);background:rgba(148,163,184,.035);color:#cbd5e1}
.tp-field-tracking-stat{padding:8px;border:1px solid rgba(105,139,114,.10);border-radius:11px;background:rgba(255,255,255,.014)}
.tp-field-tracking-stat small{display:block;color:rgba(159,178,164,.48);font-size:6.3px;font-weight:850;text-transform:uppercase;letter-spacing:.04em}
.tp-field-tracking-stat strong{display:block;margin-top:4px;color:rgba(235,242,237,.91);font-size:10px}
.tp-field-tracking-list{display:grid;gap:8px}
.tp-field-tracking-card{display:grid;grid-template-columns:84px minmax(0,1fr);gap:10px;padding:9px;border:1px solid rgba(105,139,114,.10);border-radius:14px;background:rgba(255,255,255,.012)}
.tp-field-tracking-thumb{width:84px;height:82px;overflow:hidden;border-radius:10px;border:1px solid rgba(255,255,255,.055);background:rgba(255,255,255,.018)}
.tp-field-tracking-thumb img{width:100%;height:100%;display:block;object-fit:cover}
.tp-field-tracking-thumb-empty{width:100%;height:100%;display:grid;place-items:center;padding:8px;box-sizing:border-box;color:rgba(181,198,185,.40);font-size:7px;text-align:center}
.tp-field-tracking-copy{min-width:0}
.tp-field-tracking-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.tp-field-tracking-title{color:#eef5ef;font-size:10px;font-weight:900}
.tp-field-tracking-state{min-height:18px;display:inline-flex;align-items:center;padding:0 6px;border:1px solid rgba(105,139,114,.11);border-radius:999px;color:rgba(199,214,202,.66);font-size:6px;font-weight:850;white-space:nowrap}
.tp-field-tracking-state.due{border-color:rgba(239,68,68,.18);background:rgba(239,68,68,.045);color:#fecaca}
.tp-field-tracking-state.improving{border-color:rgba(34,197,94,.17);background:rgba(34,197,94,.04);color:#bbf7d0}
.tp-field-tracking-state.worsening{border-color:rgba(239,68,68,.18);background:rgba(239,68,68,.045);color:#fecaca}
.tp-field-tracking-state.stable{border-color:rgba(6,182,212,.15);background:rgba(6,182,212,.035);color:#a5f3fc}
.tp-field-tracking-meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.tp-field-tracking-chip{min-height:18px;display:inline-flex;align-items:center;padding:0 6px;border:1px solid rgba(105,139,114,.09);border-radius:999px;color:rgba(190,206,194,.58);font-size:6.4px;font-weight:800}
.tp-field-tracking-summary{margin:7px 0 0;color:rgba(204,218,208,.61);font-size:7.5px;line-height:1.38}
.tp-field-tracking-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:8px}
.tp-field-tracking-actions button{min-height:29px;padding:0 8px;border-radius:9px;font-size:7px;font-weight:850;cursor:pointer}
.tp-field-tracking-map{border:1px solid rgba(34,197,94,.15);background:rgba(34,197,94,.04);color:#bbf7d0}
.tp-field-tracking-history{border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.018);color:rgba(220,231,222,.72)}
.tp-field-tracking-pause{border:1px solid rgba(245,158,11,.14);background:rgba(245,158,11,.035);color:#fde68a}
.tp-field-tracking-resolve{border:1px solid rgba(148,163,184,.13);background:rgba(148,163,184,.03);color:#cbd5e1}
.tp-field-tracking-reactivate{border:1px solid rgba(34,197,94,.16);background:rgba(34,197,94,.045);color:#bbf7d0}
.tp-field-tracking-actions button:disabled{opacity:.45;cursor:default}
.tp-field-tracking-loading,.tp-field-tracking-empty,.tp-field-tracking-error{min-height:140px;display:grid;place-items:center;padding:20px;border:1px dashed rgba(105,139,114,.11);border-radius:12px;color:rgba(198,212,201,.58);font-size:8.5px;text-align:center}
.tp-field-tracking-error{color:#fca5a5}
@media(max-width:520px){.tp-field-tracking-stats{grid-template-columns:1fr 1fr}.tp-field-tracking-card{grid-template-columns:72px minmax(0,1fr)}.tp-field-tracking-thumb{width:72px;height:74px}}
`;

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function directionLabel(value: string | null | undefined) {
  const text = String(value ?? '').trim();
  if (!text) return 'Takip noktası';
  return text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1);
}

function healthText(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pointStatusLabel(status: FieldObservationPointStatus) {
  if (status === 'paused') return 'Duraklatıldı';
  if (status === 'resolved') return 'Takip tamamlandı';
  return 'Aktif';
}

function comparisonLabel(item: FieldObservationPointOverview) {
  const status = item.latestComparison?.status;
  if (status === 'improving') return 'Toparlanıyor';
  if (status === 'worsening') return 'Zayıflıyor';
  if (status === 'stable') return 'Stabil';
  return item.photoCount > 0 ? 'Takipte' : 'Fotoğraf bekliyor';
}

function isDue(item: FieldObservationPointOverview) {
  if (item.point.status !== 'active') return false;
  if (!item.point.lastPhotoAt || !item.point.nextPhotoDueAt) return false;
  const due = new Date(item.point.nextPhotoDueAt).getTime();
  return Number.isFinite(due) && due <= Date.now();
}

function targetFromItem(item: FieldObservationPointOverview, fieldName: string): NdviObservationTarget {
  return {
    point: item.point,
    fieldName,
    direction: item.point.direction,
    centroid: [item.point.centroidLng, item.point.centroidLat],
    relativeHealth: item.point.latestRelativeHealth,
    ndviValue: item.point.latestNdvi,
    satelliteDate: item.point.latestSatelliteDate,
  };
}

export default function FieldObservationPointsModal({
  open,
  fieldId,
  fieldName,
  onClose,
  onOpenOnMap,
  onOpenHistory,
  onStatusChanged,
}: Props) {
  const [items, setItems] = useState<FieldObservationPointOverview[]>([]);
  const [filter, setFilter] = useState<FieldObservationPointStatus>('active');
  const [busyPointId, setBusyPointId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setFilter('active');
  }, [open, fieldId]);

  useEffect(() => {
    if (!open || !fieldId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listFieldObservationPoints(String(fieldId))
      .then((result) => { if (!cancelled) setItems(result); })
      .catch((value) => { if (!cancelled) setError(value instanceof Error ? value.message : 'Takip noktaları yüklenemedi.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, fieldId]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const stats = useMemo(() => {
    let active = 0;
    let paused = 0;
    let resolved = 0;
    let due = 0;

    for (const item of items) {
      if (item.point.status === 'active') active += 1;
      if (item.point.status === 'paused') paused += 1;
      if (item.point.status === 'resolved') resolved += 1;
      if (isDue(item)) due += 1;
    }

    return { active, paused, resolved, due };
  }, [items]);

  const filteredItems = useMemo(
    () => items.filter((item) => item.point.status === filter),
    [items, filter],
  );

  const changeStatus = async (
    item: FieldObservationPointOverview,
    status: FieldObservationPointStatus,
  ) => {
    if (busyPointId) return;

    if (
      status === 'resolved' &&
      typeof window !== 'undefined' &&
      !window.confirm(
        `${directionLabel(item.point.direction)} bölgesindeki takibi tamamlamak istiyor musun? Geçmiş silinmeyecek.`,
      )
    ) {
      return;
    }

    setBusyPointId(item.point.id);
    setError(null);

    try {
      const point = await updateObservationPointStatus(item.point.id, status);
      setItems((current) =>
        current.map((entry) =>
          entry.point.id === point.id
            ? { ...entry, point }
            : entry,
        ),
      );
      onStatusChanged?.(point);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : 'Takip durumu güncellenemedi.',
      );
    } finally {
      setBusyPointId(null);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <style>{CSS}</style>
      <div className="tp-field-tracking-portal">
        <button type="button" className="tp-field-tracking-backdrop" aria-label="Takip noktalarını kapat" onClick={onClose} />
        <section className="tp-field-tracking-sheet" role="dialog" aria-modal="true" aria-label="Tarladaki NDVI takip noktaları">
          <header className="tp-field-tracking-head">
            <div>
              <div className="tp-field-tracking-kicker">🧭 PUSULA · NDVI TAKİP NOKTALARI</div>
              <h3>{fieldName} · Saha takipleri</h3>
              <p>Uydu sinyalinden seçilip fotoğrafla takip edilen zayıf alanların tamamı.</p>
            </div>
            <button type="button" className="tp-field-tracking-close" onClick={onClose} aria-label="Kapat">×</button>
          </header>

          <div className="tp-field-tracking-body">
            {!loading && !error && items.length > 0 ? (
              <>
                <div className="tp-field-tracking-stats">
                  <div className="tp-field-tracking-stat"><small>Aktif</small><strong>{stats.active}</strong></div>
                  <div className="tp-field-tracking-stat"><small>Fotoğraf zamanı</small><strong>{stats.due}</strong></div>
                  <div className="tp-field-tracking-stat"><small>Duraklatıldı</small><strong>{stats.paused}</strong></div>
                  <div className="tp-field-tracking-stat"><small>Tamamlandı</small><strong>{stats.resolved}</strong></div>
                </div>

                <div className="tp-field-tracking-tabs" role="tablist" aria-label="Takip durumu">
                  <button type="button" className={`tp-field-tracking-tab ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>Aktif · {stats.active}</button>
                  <button type="button" className={`tp-field-tracking-tab ${filter === 'paused' ? 'active' : ''}`} onClick={() => setFilter('paused')}>Duraklatıldı · {stats.paused}</button>
                  <button type="button" className={`tp-field-tracking-tab ${filter === 'resolved' ? 'active' : ''}`} onClick={() => setFilter('resolved')}>Tamamlandı · {stats.resolved}</button>
                </div>
              </>
            ) : null}

            {loading ? <div className="tp-field-tracking-loading">Takip noktaları hazırlanıyor…</div> : error ? <div className="tp-field-tracking-error">{error}</div> : items.length === 0 ? <div className="tp-field-tracking-empty">Bu tarlada henüz kalıcı NDVI takip noktası yok. Haritada zayıf bir alanı açıp fotoğraf eklediğinde burada görünür.</div> : filteredItems.length === 0 ? <div className="tp-field-tracking-empty">Bu durumda takip noktası yok.</div> : (
              <div className="tp-field-tracking-list">
                {filteredItems.map((item) => {
                  const due = isDue(item);
                  const lifecycleStatus = item.point.status;
                  const stateClass =
                    lifecycleStatus !== 'active'
                      ? lifecycleStatus
                      : due
                        ? 'due'
                        : (item.latestComparison?.status ?? '');
                  const busy = busyPointId === item.point.id;
                  return (
                    <article key={item.point.id} className={`tp-field-tracking-card ${lifecycleStatus}`}>
                      <div className="tp-field-tracking-thumb">
                        {item.latestPhoto?.signedUrl ? <img src={item.latestPhoto.signedUrl} alt={`${directionLabel(item.point.direction)} son takip fotoğrafı`} loading="lazy" /> : <div className="tp-field-tracking-thumb-empty">Henüz fotoğraf yok</div>}
                      </div>
                      <div className="tp-field-tracking-copy">
                        <div className="tp-field-tracking-top">
                          <div className="tp-field-tracking-title">{directionLabel(item.point.direction)}</div>
                          <span className={`tp-field-tracking-state ${stateClass}`}>
                            {lifecycleStatus !== 'active'
                              ? pointStatusLabel(lifecycleStatus)
                              : due
                                ? 'Yeni fotoğraf zamanı'
                                : comparisonLabel(item)}
                          </span>
                        </div>
                        <div className="tp-field-tracking-meta">
                          <span className="tp-field-tracking-chip">Son uydu {formatDate(item.point.latestSatelliteDate)}</span>
                          <span className="tp-field-tracking-chip">Sağlık {healthText(item.point.latestRelativeHealth)}</span>
                          <span className="tp-field-tracking-chip">{item.photoCount} fotoğraf</span>
                        </div>
                        {item.latestComparison?.summary ? <p className="tp-field-tracking-summary">{item.latestComparison.summary}</p> : item.point.lastPhotoAt ? <p className="tp-field-tracking-summary">Son fotoğraf {formatDate(item.point.lastPhotoAt)} tarihinde kaydedildi.</p> : <p className="tp-field-tracking-summary">Bu noktanın ilk saha fotoğrafı henüz eklenmedi.</p>}
                        <div className="tp-field-tracking-actions">
                          {item.photoCount > 0 ? <button type="button" className="tp-field-tracking-history" disabled={busy} onClick={() => onOpenHistory(targetFromItem(item, fieldName))}>◷ Geçmiş</button> : null}
                          <button type="button" className="tp-field-tracking-map" disabled={busy} onClick={() => onOpenOnMap(targetFromItem(item, fieldName))}>⌖ Haritada aç</button>

                          {lifecycleStatus === 'active' ? (
                            <>
                              <button type="button" className="tp-field-tracking-pause" disabled={busy} onClick={() => void changeStatus(item, 'paused')}>Ⅱ Duraklat</button>
                              <button type="button" className="tp-field-tracking-resolve" disabled={busy} onClick={() => void changeStatus(item, 'resolved')}>✓ Takibi tamamla</button>
                            </>
                          ) : (
                            <button type="button" className="tp-field-tracking-reactivate" disabled={busy} onClick={() => void changeStatus(item, 'active')}>↻ Yeniden başlat</button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </>,
    document.body,
  );
}
