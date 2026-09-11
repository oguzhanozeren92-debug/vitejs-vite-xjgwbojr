import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  dismissObservationPhotoPrompt,
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
.tp-ndvi-photo-backdrop{
  position:fixed;
  inset:0;
  z-index:2147483000;
  border:0;
  background:rgba(0,0,0,.60);
  backdrop-filter:blur(5px);
  -webkit-backdrop-filter:blur(5px);
}
.tp-ndvi-photo-sheet{
  position:fixed;
  z-index:2147483001;
  left:50%;
  top:50%;
  bottom:auto;
  width:min(92vw,470px);
  max-height:min(88dvh,720px);
  transform:translate(-50%,-50%);
  overflow:hidden;
  display:flex;
  flex-direction:column;
  border:1px solid rgba(239,68,68,.22);
  border-radius:22px;
  background:
    radial-gradient(circle at 12% 0%,rgba(239,68,68,.08),transparent 30%),
    rgba(3,12,7,.99);
  box-shadow:0 28px 80px rgba(0,0,0,.62);
}
.tp-ndvi-photo-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 14px 11px;border-bottom:1px solid rgba(255,255,255,.055)}
.tp-ndvi-photo-head small{display:block;color:#fca5a5;font-size:7px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}
.tp-ndvi-photo-head strong{display:block;margin-top:4px;color:#f3f7f4;font-size:13px}
.tp-ndvi-photo-head p{margin:5px 0 0;color:rgba(214,227,218,.62);font-size:9px;line-height:1.4}
.tp-ndvi-photo-close{width:32px;height:32px;border:1px solid rgba(255,255,255,.06);border-radius:10px;background:rgba(255,255,255,.02);color:#dce8de;font-size:19px;cursor:pointer}
.tp-ndvi-photo-body{padding:12px 14px 14px;overflow-y:auto;overscroll-behavior:contain}
.tp-ndvi-photo-guide{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:11px}
.tp-ndvi-photo-guide span{min-height:38px;display:grid;place-items:center;padding:5px;border:1px solid rgba(105,139,114,.10);border-radius:10px;background:rgba(255,255,255,.014);color:rgba(215,229,218,.68);font-size:7.5px;text-align:center}
.tp-ndvi-photo-pickers{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.tp-ndvi-photo-pickers button{min-height:42px;border-radius:12px;border:1px solid rgba(105,139,114,.16);background:rgba(105,139,114,.045);color:#e5f0e7;font-size:9px;font-weight:850;cursor:pointer}
.tp-ndvi-photo-files{margin-top:10px;display:grid;gap:5px}
.tp-ndvi-photo-file{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 8px;border-radius:10px;background:rgba(255,255,255,.018);color:rgba(218,230,220,.74);font-size:8px}
.tp-ndvi-photo-file button{border:0;background:transparent;color:#fca5a5;cursor:pointer}
.tp-ndvi-photo-error{margin:9px 0 0;color:#fca5a5;font-size:8px;line-height:1.4}
.tp-ndvi-photo-success{margin:9px 0 0;padding:8px 9px;border:1px solid rgba(34,197,94,.14);border-radius:10px;background:rgba(34,197,94,.04);color:#bbf7d0;font-size:8px;line-height:1.4}
.tp-ndvi-photo-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;margin-top:12px}
.tp-ndvi-photo-actions button{min-height:34px;padding:0 11px;border-radius:10px;font-size:8px;font-weight:850;cursor:pointer}
.tp-ndvi-photo-later{border:1px solid rgba(255,255,255,.06);background:transparent;color:rgba(211,225,214,.64)}
.tp-ndvi-photo-upload{border:1px solid rgba(239,68,68,.22);background:rgba(239,68,68,.09);color:#fecaca}
.tp-ndvi-photo-actions button:disabled{opacity:.38;cursor:default}
`;

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

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setError(null);
      setSuccess(null);
      setUploading(false);
    }
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
    </>,
    document.body,
  );
}
