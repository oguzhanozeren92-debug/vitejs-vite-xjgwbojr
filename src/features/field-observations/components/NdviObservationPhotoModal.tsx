import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  dismissObservationPhotoPrompt,
  getObservationPhotoLocationReference,
  uploadObservationPhotos,
} from '../services/fieldObservation.service';

import type {
  FieldObservationPhotoSource,
  NdviObservationTarget,
  ObservationUploadResult,
} from '../types/fieldObservation';

type Props = {
  open: boolean;
  target: NdviObservationTarget | null;
  onClose: () => void;
  onUploaded?: (result: ObservationUploadResult) => void;
};

const CSS = String.raw`
.tp-ndvi-photo-portal {
  position: fixed !important;
  inset: 0 !important;
  z-index: 2147483640 !important;
  width: 100vw !important;
  height: 100dvh !important;
  min-height: 100dvh !important;
  overflow: hidden !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding:
    max(14px, env(safe-area-inset-top))
    14px
    max(14px, env(safe-area-inset-bottom)) !important;
  box-sizing: border-box !important;
  isolation: isolate !important;
}

.tp-ndvi-photo-backdrop {
  position: absolute !important;
  inset: 0 !important;
  z-index: 0 !important;
  width: 100% !important;
  height: 100% !important;
  border: 0 !important;
  background: rgba(0,0,0,.62) !important;
  backdrop-filter: blur(5px) !important;
  -webkit-backdrop-filter: blur(5px) !important;
}

.tp-ndvi-photo-sheet {
  position: relative !important;
  inset: auto !important;
  left: auto !important;
  right: auto !important;
  top: auto !important;
  bottom: auto !important;
  z-index: 1 !important;
  width: min(92vw, 470px) !important;
  max-width: 470px !important;
  max-height: min(86dvh, 720px) !important;
  margin: 0 !important;
  transform: none !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  box-sizing: border-box !important;
  border: 1px solid rgba(239,68,68,.22) !important;
  border-radius: 22px !important;
  background:
    radial-gradient(circle at 12% 0%,rgba(239,68,68,.08),transparent 30%),
    rgba(3,12,7,.99) !important;
  box-shadow: 0 28px 80px rgba(0,0,0,.68) !important;
}

.tp-ndvi-photo-head {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 14px 11px;
  border-bottom: 1px solid rgba(255,255,255,.055);
}

.tp-ndvi-photo-head small {
  display: block;
  color: #fca5a5;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: .09em;
  text-transform: uppercase;
}

.tp-ndvi-photo-head strong {
  display: block;
  margin-top: 4px;
  color: #f3f7f4;
  font-size: 13px;
}

.tp-ndvi-photo-head p {
  margin: 5px 0 0;
  color: rgba(214,227,218,.62);
  font-size: 9px;
  line-height: 1.4;
}

.tp-ndvi-photo-close {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 10px;
  background: rgba(255,255,255,.02);
  color: #dce8de;
  font-size: 19px;
  cursor: pointer;
}

.tp-ndvi-photo-body {
  min-height: 0;
  padding: 12px 14px 14px;
  overflow-y: auto !important;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.tp-ndvi-photo-guide {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 6px;
  margin-bottom: 11px;
}

.tp-ndvi-photo-guide span {
  min-height: 38px;
  display: grid;
  place-items: center;
  padding: 5px;
  border: 1px solid rgba(105,139,114,.10);
  border-radius: 10px;
  background: rgba(255,255,255,.014);
  color: rgba(215,229,218,.68);
  font-size: 7.5px;
  text-align: center;
}


.tp-ndvi-photo-location{
  margin:0 0 10px;
  padding:9px 10px;
  border:1px solid rgba(6,182,212,.12);
  border-radius:12px;
  background:rgba(6,182,212,.025);
}

.tp-ndvi-photo-location-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
}

.tp-ndvi-photo-location-head strong{
  color:rgba(226,238,229,.86);
  font-size:8px;
  font-weight:900;
}

.tp-ndvi-photo-location-head button{
  min-height:27px;
  padding:0 8px;
  border:1px solid rgba(6,182,212,.16);
  border-radius:999px;
  background:rgba(6,182,212,.045);
  color:#a5f3fc;
  font-size:6.8px;
  font-weight:850;
  cursor:pointer;
}

.tp-ndvi-photo-location-head button:disabled{
  opacity:.45;
  cursor:default;
}

.tp-ndvi-photo-location p{
  margin:6px 0 0;
  color:rgba(196,213,201,.58);
  font-size:7.2px;
  line-height:1.42;
}

.tp-ndvi-photo-location-status{
  margin-top:7px;
  padding:6px 7px;
  border:1px solid rgba(105,139,114,.10);
  border-radius:9px;
  background:rgba(255,255,255,.012);
  color:rgba(210,224,213,.65);
  font-size:7.2px;
  line-height:1.4;
}

.tp-ndvi-photo-location-status.good{
  border-color:rgba(34,197,94,.16);
  background:rgba(34,197,94,.04);
  color:#bbf7d0;
}

.tp-ndvi-photo-location-status.warn{
  border-color:rgba(245,158,11,.16);
  background:rgba(245,158,11,.04);
  color:#fde68a;
}

.tp-ndvi-photo-location-status.far{
  border-color:rgba(239,68,68,.17);
  background:rgba(239,68,68,.04);
  color:#fecaca;
}

.tp-ndvi-photo-location-status.muted{
  color:rgba(196,213,201,.52);
}

.tp-ndvi-photo-pickers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

.tp-ndvi-photo-pickers button {
  min-height: 42px;
  border-radius: 12px;
  border: 1px solid rgba(105,139,114,.16);
  background: rgba(105,139,114,.045);
  color: #e5f0e7;
  font-size: 9px;
  font-weight: 850;
  cursor: pointer;
}

.tp-ndvi-photo-files {
  margin-top: 10px;
  display: grid;
  gap: 5px;
}

.tp-ndvi-photo-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 10px;
  background: rgba(255,255,255,.018);
  color: rgba(218,230,220,.74);
  font-size: 8px;
}

.tp-ndvi-photo-file button {
  border: 0;
  background: transparent;
  color: #fca5a5;
  cursor: pointer;
}

.tp-ndvi-photo-error {
  margin: 9px 0 0;
  color: #fca5a5;
  font-size: 8px;
  line-height: 1.4;
}

.tp-ndvi-photo-success {
  margin: 9px 0 0;
  padding: 8px 9px;
  border: 1px solid rgba(34,197,94,.14);
  border-radius: 10px;
  background: rgba(34,197,94,.04);
  color: #bbf7d0;
  font-size: 8px;
  line-height: 1.4;
}

.tp-ndvi-photo-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
  margin-top: 12px;
}

.tp-ndvi-photo-actions button {
  min-height: 34px;
  padding: 0 11px;
  border-radius: 10px;
  font-size: 8px;
  font-weight: 850;
  cursor: pointer;
}

.tp-ndvi-photo-later {
  border: 1px solid rgba(255,255,255,.06);
  background: transparent;
  color: rgba(211,225,214,.64);
}

.tp-ndvi-photo-upload {
  border: 1px solid rgba(239,68,68,.22);
  background: rgba(239,68,68,.09);
  color: #fecaca;
}

.tp-ndvi-photo-actions button:disabled {
  opacity: .38;
  cursor: default;
}

@media (max-height: 620px) {
  .tp-ndvi-photo-portal {
    align-items: flex-start !important;
    padding-top: 10px !important;
    padding-bottom: 10px !important;
  }

  .tp-ndvi-photo-sheet {
    max-height: calc(100dvh - 20px) !important;
  }
}
`

function formatDate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}


type CaptureLocation = {
  lat: number;
  lng: number;
  accuracyM: number;
  distanceM: number;
};

type LocationState =
  | 'idle'
  | 'checking'
  | 'ready'
  | 'denied'
  | 'unsupported'
  | 'error';

function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)));
}

function metersLabel(value: number) {
  if (!Number.isFinite(value)) return '';
  if (value < 1000) return `${Math.round(value)} m`;
  return `${(value / 1000).toLocaleString('tr-TR', {
    maximumFractionDigits: 1,
  })} km`;
}

export default function NdviObservationPhotoModal({
  open,
  target,
  onClose,
  onUploaded,
}: Props) {
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [source, setSource] = useState<FieldObservationPhotoSource>('upload');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [captureLocation, setCaptureLocation] =
    useState<CaptureLocation | null>(null);
  const [previousPhotoLocation, setPreviousPhotoLocation] = useState<{
    lat: number;
    lng: number;
    capturedAt: string | null;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setError(null);
      setSuccess(null);
      setUploading(false);
      setLocationState('idle');
      setCaptureLocation(null);
      setPreviousPhotoLocation(null);
    }
  }, [open, target?.point.id]);

  useEffect(() => {
    if (!open || !target?.point.id) return;

    let cancelled = false;

    void getObservationPhotoLocationReference(target.point.id)
      .then((value) => {
        if (!cancelled) setPreviousPhotoLocation(value);
      })
      .catch(() => {
        if (!cancelled) setPreviousPhotoLocation(null);
      });

    return () => {
      cancelled = true;
    };
  }, [open, target?.point.id]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const locationLabel = useMemo(() => {
    const direction = String(target?.direction ?? '').trim();
    return direction
      ? direction.charAt(0).toLocaleUpperCase('tr-TR') + direction.slice(1)
      : 'Takip noktası';
  }, [target?.direction]);

  const referenceLocation = useMemo(() => {
    if (previousPhotoLocation) {
      return {
        lat: previousPhotoLocation.lat,
        lng: previousPhotoLocation.lng,
        source: 'previous_photo' as const,
      };
    }

    const lat = Number(target?.point.centroidLat);
    const lng = Number(target?.point.centroidLng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return {
      lat,
      lng,
      source: 'tracking_point' as const,
    };
  }, [
    previousPhotoLocation,
    target?.point.centroidLat,
    target?.point.centroidLng,
  ]);

  const checkLocation = () => {
    if (!referenceLocation) {
      setLocationState('error');
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation
    ) {
      setLocationState('unsupported');
      return;
    }

    setLocationState('checking');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude);
        const lng = Number(position.coords.longitude);
        const accuracyM = Math.max(
          0,
          Number(position.coords.accuracy) || 0,
        );

        const distanceM = distanceMeters(
          lat,
          lng,
          referenceLocation.lat,
          referenceLocation.lng,
        );

        setCaptureLocation({
          lat,
          lng,
          accuracyM,
          distanceM,
        });
        setLocationState('ready');
      },
      (geoError) => {
        setCaptureLocation(null);
        setLocationState(
          geoError.code === geoError.PERMISSION_DENIED
            ? 'denied'
            : 'error',
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 15000,
      },
    );
  };

  if (!open || !target) return null;

  const appendFiles = (next: FileList | null, nextSource: FieldObservationPhotoSource) => {
    if (!next?.length) return;
    setSource(nextSource);
    setFiles((current) => [...current, ...Array.from(next)].slice(0, 3));
    setError(null);
  };

  const submit = async () => {
    if (!files.length || uploading) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await uploadObservationPhotos({
        point: target.point,
        files,
        source,
        ndviValue: target.ndviValue,
        relativeHealth: target.relativeHealth,
        satelliteDate: target.satelliteDate,
        capturedLat: captureLocation?.lat ?? null,
        capturedLng: captureLocation?.lng ?? null,
        locationAccuracyM: captureLocation?.accuracyM ?? null,
        distanceToPointM: captureLocation?.distanceM ?? null,
      });

      const comparison = result.comparison;
      setSuccess(
        comparison?.summary ||
          'Fotoğraf tarihli olarak kaydedildi. Pusula bu noktayı takip etmeye devam edecek.',
      );
      setFiles([]);
      onUploaded?.(result);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Fotoğraf kaydedilemedi.');
    } finally {
      setUploading(false);
    }
  };

  const later = async () => {
    try {
      await dismissObservationPhotoPrompt(target.point.id, 7);
    } catch {
      // Kapatma davranışı DB hatası yüzünden engellenmesin.
    }
    onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <style>{CSS}</style>

      <div className="tp-ndvi-photo-portal">
        <button
          type="button"
          className="tp-ndvi-photo-backdrop"
          aria-label="Fotoğraf penceresini kapat"
          onClick={onClose}
        />

        <section className="tp-ndvi-photo-sheet" role="dialog" aria-modal="true">
        <div className="tp-ndvi-photo-head">
          <div>
            <small>PUSULA TAKİP NOKTASI · {locationLabel}</small>
            <strong>Bu zayıf alanı fotoğrafla takip et</strong>
            <p>
              Fotoğraflar tarihli saklanır. Yeni uydu görüntüsü geldiğinde aynı noktadaki gelişimi önceki kayıtla karşılaştırabiliriz.
              {target.satelliteDate ? ` · Uydu: ${formatDate(target.satelliteDate)}` : ''}
            </p>
          </div>
          <button type="button" className="tp-ndvi-photo-close" onClick={onClose}>×</button>
        </div>

        <div className="tp-ndvi-photo-body">
          <div className="tp-ndvi-photo-guide">
            <span>🌿 Yaprak / sürgün yakın plan</span>
            <span>🌳 Bitkinin genel görünümü</span>
            <span>🌱 Sorunlu alan / toprak çevresi</span>
          </div>

          <div className="tp-ndvi-photo-location">
            <div className="tp-ndvi-photo-location-head">
              <strong>⌖ Aynı nokta kontrolü</strong>
              <button
                type="button"
                onClick={checkLocation}
                disabled={locationState === 'checking'}
              >
                {locationState === 'checking'
                  ? 'Konum alınıyor…'
                  : captureLocation
                    ? 'Tekrar kontrol et'
                    : 'Konumu kontrol et'}
              </button>
            </div>

            <p>
              {previousPhotoLocation
                ? `Referans: önceki fotoğrafın çekildiği konum${
                    previousPhotoLocation.capturedAt
                      ? ` · ${formatDate(previousPhotoLocation.capturedAt)}`
                      : ''
                  }.`
                : 'İlk kayıtta referans olarak Pusula takip alanının merkezi kullanılır.'}
              {' '}Konum izni vermezsen fotoğraf eklemeye yine devam edebilirsin.
            </p>

            {locationState === 'ready' && captureLocation ? (
              <div
                className={`tp-ndvi-photo-location-status ${
                  captureLocation.accuracyM > 80
                    ? 'warn'
                    : captureLocation.distanceM <=
                        Math.max(30, captureLocation.accuracyM)
                      ? 'good'
                      : captureLocation.distanceM <= 70
                        ? 'warn'
                        : 'far'
                }`}
              >
                {captureLocation.accuracyM > 80
                  ? `GPS doğruluğu düşük (±${Math.round(
                      captureLocation.accuracyM,
                    )} m). Ölçüm yaklaşık; fotoğrafı yine kaydedebilirsin.`
                  : captureLocation.distanceM <=
                      Math.max(30, captureLocation.accuracyM)
                    ? `Doğru noktaya yakınsın · yaklaşık ${metersLabel(
                        captureLocation.distanceM,
                      )}.`
                    : captureLocation.distanceM <= 70
                      ? `Takip noktasına yaklaşık ${metersLabel(
                          captureLocation.distanceM,
                        )} uzaktasın. Mümkünse biraz daha yaklaş.`
                      : `Takip noktasından yaklaşık ${metersLabel(
                          captureLocation.distanceM,
                        )} uzaktasın. Aynı yerden karşılaştırma için noktaya yaklaşman daha iyi olur.`}
              </div>
            ) : locationState === 'denied' ? (
              <div className="tp-ndvi-photo-location-status muted">
                Konum izni verilmedi. Fotoğraf kaydı engellenmeyecek.
              </div>
            ) : locationState === 'unsupported' ? (
              <div className="tp-ndvi-photo-location-status muted">
                Bu cihaz/tarayıcı konum kontrolünü desteklemiyor. Fotoğraf kaydı engellenmeyecek.
              </div>
            ) : locationState === 'error' ? (
              <div className="tp-ndvi-photo-location-status muted">
                Konum alınamadı. Fotoğraf kaydı engellenmeyecek.
              </div>
            ) : null}
          </div>

          <div className="tp-ndvi-photo-pickers">
            <button type="button" onClick={() => cameraRef.current?.click()}>
              📷 Fotoğraf çek
            </button>
            <button type="button" onClick={() => galleryRef.current?.click()}>
              ▣ Galeriden seç
            </button>
          </div>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            onChange={(event) => appendFiles(event.target.files, 'camera')}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => appendFiles(event.target.files, 'gallery')}
          />

          {files.length > 0 ? (
            <div className="tp-ndvi-photo-files">
              {files.map((file, index) => (
                <div className="tp-ndvi-photo-file" key={`${file.name}:${file.lastModified}:${index}`}>
                  <span>{index + 1}. {file.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    Kaldır
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {error ? <p className="tp-ndvi-photo-error">{error}</p> : null}
          {success ? <p className="tp-ndvi-photo-success">{success}</p> : null}

          <div className="tp-ndvi-photo-actions">
            <button type="button" className="tp-ndvi-photo-later" onClick={later}>
              Şimdi değil
            </button>
            <button
              type="button"
              className="tp-ndvi-photo-upload"
              disabled={!files.length || uploading}
              onClick={() => void submit()}
            >
              {uploading ? 'Kaydediliyor…' : `Kaydet${files.length ? ` (${files.length})` : ''}`}
            </button>
          </div>
        </div>
        </section>
      </div>
    </>,
    document.body,
  );
}
