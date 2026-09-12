import { useMemo, useState } from 'react';
import { PUSULA_BODY_SRC } from '../../home/homeAssets';
import type { HomeDecisionEvent, HomeDecisionTarget } from '../../decision/types/homeDecision';

type Props = {
  fieldName: string;
  layerLabel: string;
  loading: boolean;
  headline?: string | null;
  summary?: string | null;
  result?: any;
  synthesis?: any;
  error?: string | null;
  decision?: HomeDecisionEvent | null;
  onOpenDecision?: (target: HomeDecisionTarget) => void;
  onOpenLayer?: (layer: string) => void;
  onRefresh?: () => void;
  onShowOnMap: () => void;
};

const CSS = String.raw`
.tp-home-map-pusula-shell {
  position: relative;
}

/*
 * Haritanın kendi alt gövdesini kullanıyoruz.
 * Ayrı kart yok; Pusula aynı yüzeyin içine yerleşiyor.
 */
.tp-home-map-pusula-shell .tp-field-stats {
  height: 88px !important;
  min-height: 88px !important;
  overflow: hidden !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

.tp-home-map-pusula-strip {
  position: absolute;
  z-index: 18;
  left: 1px;
  right: 1px;
  bottom: 1px;
  height: auto;
  min-height: 88px;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  padding: 9px 12px 8px;
  box-sizing: border-box;

  /* Harita kartından ayrı duran border/glow tamamen kaldırıldı. */
  border: 0;
  border-radius: 0 0 18px 18px;
  background:
    linear-gradient(
      180deg,
      rgba(3, 8, 5, .70) 0%,
      rgba(2, 7, 4, .91) 32%,
      rgba(2, 7, 4, .985) 100%
    );
  box-shadow: none;
  backdrop-filter: blur(7px);
  -webkit-backdrop-filter: blur(7px);
}

/* Haritanın bittiği yerde sert çizgi yerine görüntü alt alana eriyor. */
.tp-home-map-pusula-strip::before {
  content: '';
  position: absolute;
  z-index: -1;
  left: 0;
  right: 0;
  top: -20px;
  height: 22px;
  pointer-events: none;
  background:
    linear-gradient(
      180deg,
      rgba(2, 7, 4, 0) 0%,
      rgba(2, 7, 4, .26) 42%,
      rgba(2, 7, 4, .72) 100%
    );
}

.tp-home-map-pusula-logo {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;

  /* İkon ayrı buton gibi değil, haritanın etiketi gibi. */
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  opacity: .88;
}

.tp-home-map-pusula-logo img {
  display: block;
  width: 25px;
  height: 25px;
  object-fit: contain;
  filter: saturate(.82) brightness(.96);
}

.tp-home-map-pusula-copy {
  min-width: 0;
}

.tp-home-map-pusula-kicker {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(133, 183, 146, .92);
  font-size: 7.5px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: .085em;
  text-transform: uppercase;
}

.tp-home-map-pusula-kicker::after {
  content: '';
  width: 3px;
  height: 3px;
  flex: 0 0 3px;
  border-radius: 999px;
  background: rgba(133, 183, 146, .38);
}

.tp-home-map-pusula-kicker span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(166, 183, 171, .48);
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
}


.tp-home-map-pusula-signal {
  display: inline-flex;
  align-items: center;
  min-height: 15px;
  margin-left: 2px;
  padding: 0 5px;
  border-radius: 999px;
  border: 1px solid rgba(166, 183, 171, .12);
  background: rgba(166, 183, 171, .04);
  color: rgba(196, 209, 199, .68);
  font-size: 6.4px;
  line-height: 1;
  font-weight: 900;
  font-style: normal;
  letter-spacing: .055em;
  text-transform: uppercase;
}

.tp-home-map-pusula-signal.negative {
  border-color: rgba(239, 68, 68, .22);
  background: rgba(239, 68, 68, .07);
  color: rgba(252, 165, 165, .92);
}

.tp-home-map-pusula-signal.positive {
  border-color: #cbd2d9;
  background: #e8ebee;
  color: #303942;
}

.tp-home-map-pusula-signal.attention {
  border-color: rgba(245, 158, 11, .18);
  background: rgba(245, 158, 11, .055);
  color: rgba(253, 186, 116, .86);
}

.tp-home-map-pusula-signal.neutral {
  color: rgba(181, 197, 185, .62);
}

.tp-home-map-pusula-text {
  margin: 5px 0 0;
  max-width: 100%;
  overflow: visible;
  display: block;
  color: rgba(232, 239, 233, .93);
  font-size: 10.5px;
  line-height: 1.32;
  font-weight: 690;
}

.tp-home-map-pusula-strip.is-loading .tp-home-map-pusula-text,
.tp-home-map-pusula-strip.has-error .tp-home-map-pusula-text {
  color: rgba(183, 196, 187, .62);
  font-weight: 620;
}

.tp-home-map-pusula-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  white-space: nowrap;
}

.tp-home-map-pusula-actions button {
  min-height: 26px;
  padding: 0 6px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  font: inherit;
  font-size: 8px;
  font-weight: 800;
  cursor: pointer;
  transition:
    background .16s ease,
    color .16s ease;
}

/* Aynı renk ailesi: bağımsız cyan/emerald CTA görünümü yok. */
.tp-home-map-pusula-why {
  color: rgba(159, 190, 166, .72);
}

.tp-home-map-pusula-show {
  color: rgba(180, 207, 186, .86);
}

.tp-home-map-pusula-refresh {
  color: rgba(180, 207, 186, .86);
}

.tp-home-map-pusula-actions button:hover {
  color: rgba(221, 236, 225, .96);
  background: rgba(145, 176, 153, .055);
}

.tp-home-map-pusula-actions button:disabled {
  display: none;
}

.tp-home-map-pusula-actions .tp-home-map-pusula-refresh:disabled {
  display: inline-block;
  opacity: .55;
  cursor: wait;
}

/*
 * Neden? detayları ana harita kartını büyütmüyor.
 * Sheet de aynı obsidian-green yüzey ailesini kullanıyor.
 */
.tp-home-map-why-backdrop {
  position: fixed;
  inset: 0;
  z-index: 190;
  border: 0;
  background: rgba(0, 0, 0, .56);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.tp-home-map-why-sheet {
  position: fixed;
  z-index: 191;
  left: 50%;
  bottom: max(14px, env(safe-area-inset-bottom));
  width: min(92vw, 460px);
  transform: translateX(-50%);
  overflow: hidden;
  border: 1px solid rgba(105, 139, 114, .16);
  border-radius: 20px;
  background:
    radial-gradient(circle at 8% 0%, rgba(69, 111, 79, .08), transparent 30%),
    rgba(3, 12, 7, .99);
  box-shadow: 0 24px 70px rgba(0, 0, 0, .58);
}

.tp-home-map-why-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 14px 10px;
  border-bottom: 1px solid rgba(105, 139, 114, .10);
}

.tp-home-map-why-head div {
  min-width: 0;
}

.tp-home-map-why-head small {
  display: block;
  color: rgba(142, 187, 153, .82);
  font-size: 8px;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.tp-home-map-why-head strong {
  display: block;
  margin-top: 4px;
  color: rgba(233, 240, 234, .94);
  font-size: 13px;
}

.tp-home-map-why-close {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border: 1px solid rgba(255, 255, 255, .06);
  border-radius: 10px;
  background: rgba(255, 255, 255, .018);
  color: rgba(215, 228, 218, .80);
  font-size: 19px;
  cursor: pointer;
}

.tp-home-map-why-body {
  padding: 12px 14px 14px;
}

.tp-home-map-why-body ul {
  margin: 0;
  padding-left: 17px;
  color: rgba(217, 229, 220, .78);
  font-size: 10.5px;
  line-height: 1.5;
}

.tp-home-map-why-body li + li {
  margin-top: 5px;
}

.tp-home-map-why-action {
  margin: 10px 0 0;
  padding: 9px 10px;
  border-radius: 12px;
  border: 1px solid rgba(105, 139, 114, .11);
  background: rgba(105, 139, 114, .035);
  color: rgba(216, 230, 219, .78);
  font-size: 10px;
  line-height: 1.45;
}

.tp-home-map-why-action-link {
  width: 100%;
  margin-top: 10px;
  padding: 10px;
  border: 1px solid rgba(105, 190, 125, .26);
  border-radius: 10px;
  background: rgba(18, 61, 33, .35);
  color: #c7e9cf;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}


.tp-home-map-why-layers {
  margin-top: 12px;
  padding-top: 11px;
  border-top: 1px solid rgba(105, 139, 114, .10);
}

.tp-home-map-why-layers-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 7px;
}

.tp-home-map-why-layers-title strong {
  color: rgba(231, 239, 233, .90);
  font-size: 9px;
  font-weight: 900;
}

.tp-home-map-why-layers-title span {
  color: rgba(151, 169, 156, .48);
  font-size: 7px;
  font-weight: 700;
}

.tp-home-map-why-layer-list {
  display: grid;
  gap: 6px;
}

.tp-home-map-why-layer {
  width: 100%;
  min-height: 48px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 7px 8px;
  border: 1px solid rgba(105, 139, 114, .11);
  border-radius: 11px;
  background: rgba(255, 255, 255, .015);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.tp-home-map-why-layer:hover {
  border-color: rgba(124, 164, 134, .22);
  background: rgba(105, 139, 114, .045);
}

.tp-home-map-why-layer:disabled {
  cursor: default;
  opacity: .72;
}

.tp-home-map-why-layer-icon {
  width: 25px;
  height: 25px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  border: 1px solid rgba(105, 139, 114, .12);
  background: rgba(8, 24, 13, .70);
  color: rgba(142, 187, 153, .88);
  font-size: 11px;
}

.tp-home-map-why-layer-copy {
  min-width: 0;
}

.tp-home-map-why-layer-copy strong {
  display: block;
  overflow: hidden;
  color: rgba(232, 240, 234, .92);
  font-size: 8.5px;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tp-home-map-why-layer-copy span {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  color: rgba(181, 198, 185, .58);
  font-size: 7.2px;
  line-height: 1.28;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tp-home-map-why-layer-status {
  min-height: 17px;
  display: inline-flex;
  align-items: center;
  padding: 0 5px;
  border-radius: 999px;
  border: 1px solid rgba(166, 183, 171, .11);
  color: rgba(190, 205, 194, .68);
  font-size: 6px;
  font-weight: 900;
  letter-spacing: .045em;
  text-transform: uppercase;
}

.tp-home-map-why-layer-status.dikkat {
  border-color: rgba(239, 68, 68, .18);
  background: rgba(239, 68, 68, .055);
  color: rgba(252, 165, 165, .88);
}

.tp-home-map-why-layer-status.kontrol {
  border-color: rgba(245, 158, 11, .16);
  background: rgba(245, 158, 11, .045);
  color: rgba(253, 186, 116, .84);
}

.tp-home-map-why-layer-status.normal {
  border-color: #cbd2d9;
  background: #e8ebee;
  color: #303942;
}

@media (max-width: 560px) {
  .tp-home-map-pusula-shell .tp-field-stats {
    height: 94px !important;
    min-height: 94px !important;
  }

  .tp-home-map-pusula-strip {
    height: auto;
    min-height: 94px;
    grid-template-columns: 28px minmax(0, 1fr);
    gap: 8px;
    padding: 9px 10px 7px;
  }

  .tp-home-map-pusula-logo {
    width: 26px;
    height: 26px;
  }

  .tp-home-map-pusula-logo img {
    width: 23px;
    height: 23px;
  }

  .tp-home-map-pusula-copy {
    padding-bottom: 17px;
  }

  .tp-home-map-pusula-text {
    font-size: 10px;
  }

  .tp-home-map-pusula-actions {
    position: absolute;
    right: 7px;
    bottom: 4px;
  }

  .tp-home-map-pusula-actions button {
    min-height: 23px;
    padding: 0 5px;
    font-size: 7.8px;
  }
}
`

function cleanText(value: unknown) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentence(value: unknown) {
  const text = cleanText(value);
  if (!text) return '';

  const match = text.match(/^.*?[.!?](?:\s|$)/);
  return cleanText(match?.[0] ?? text);
}

function completeSentence(value: unknown) {
  const sentence = firstSentence(value);
  if (!sentence) return '';

  // Pusula ana satırında karakter sayısına göre kesip "…" eklemiyoruz.
  // Kullanıcı ya tam cümleyi görür ya da CSS satır düzeni içinde sarılır.
  return sentence;
}

function trimCompact(value: unknown, max = 112) {
  const text = firstSentence(value);
  if (!text || text.length <= max) return text;

  const clipped = text.slice(0, max - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  const safe = lastSpace > max * .68 ? clipped.slice(0, lastSpace) : clipped;

  return `${safe.replace(/[.,;:!?]+$/, '')}…`;
}

function titleArea(value: unknown) {
  const text = cleanText(value);
  if (!text) return '';
  return text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1);
}


type PusulaSignalTone =
  | 'negative'
  | 'positive'
  | 'attention'
  | 'neutral';

type PusulaSignal = {
  tone: PusulaSignalTone;
  label: string;
  text?: string;
};

function numberOrNull(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sameArea(a: unknown, b: unknown) {
  return (
    cleanText(a).toLocaleLowerCase('tr-TR') ===
    cleanText(b).toLocaleLowerCase('tr-TR')
  );
}


function formatAreaList(areas: string[]) {
  const clean = Array.from(
    new Set(
      areas
        .map((area) => titleArea(area))
        .filter(Boolean),
    ),
  );

  if (!clean.length) return '';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) {
    return `${clean[0]} ve ${clean[1]}`;
  }

  return `${clean.slice(0, -1).join(', ')} ve ${clean[clean.length - 1]}`;
}

function weakVegetationAreas(result: any) {
  const findings =
    result?.context?.ndvi?.spatial?.findings;

  if (!Array.isArray(findings)) return [];

  return findings
    .map((finding: any) => ({
      area: cleanText(finding?.area),
      health: numberOrNull(
        finding?.ndvi?.relativeHealth,
      ),
    }))
    .filter(
      (item: any) =>
        item.area &&
        item.health != null &&
        item.health < 0.32,
    )
    .sort(
      (a: any, b: any) =>
        Number(a.health) - Number(b.health),
    )
    .slice(0, 3)
    .map((item: any) => item.area);
}


function resolvedSpatialImportantArea(result: any) {
  const layer =
    result?.interpretedLayer ??
    result?.activeLayer;

  const analysisArea =
    result?.analysis?.importantArea ?? null;

  if (analysisArea?.area) {
    return analysisArea;
  }

  const spatial =
    layer === 'vegetation'
      ? result?.context?.ndvi?.spatial
      : layer === 'radar-vv' ||
          layer === 'radar-vh' ||
          layer === 'radar-water'
        ? result?.context?.radar?.spatial
        : null;

  if (!spatial) return null;

  return (
    spatial?.importantAreaByLayer?.[layer] ??
    spatial?.importantArea ??
    null
  );
}

function findSpatialFinding(result: any, area: unknown) {
  const layer = result?.activeLayer;

  const spatial =
    layer === 'vegetation'
      ? result?.context?.ndvi?.spatial
      : layer === 'radar-vv' ||
          layer === 'radar-vh' ||
          layer === 'radar-water'
        ? result?.context?.radar?.spatial
        : null;

  if (!spatial) return null;

  const direct = spatial?.importantAreaByLayer?.[layer];

  if (direct && (!area || sameArea(direct?.area, area))) {
    return direct;
  }

  if (Array.isArray(spatial?.findings)) {
    return (
      spatial.findings.find((item: any) =>
        sameArea(item?.area, area),
      ) ?? null
    );
  }

  return null;
}


type PusulaEvidenceLayer = {
  layer: string;
  label: string;
  finding: string;
  status: 'normal' | 'dikkat' | 'kontrol';
  icon: string;
  navigable: boolean;
};

const PUSULA_LAYER_META: Record<
  string,
  { label: string; icon: string; target: string | null }
> = {
  vegetation: {
    label: 'Sağlık · NDVI',
    icon: '◉',
    target: 'vegetation',
  },
  'radar-vv': {
    label: 'Nemli Alanlar · Radar',
    icon: '≈',
    target: 'radar-vv',
  },
  'radar-vh': {
    label: 'Yüzey & Bitki Farkı',
    icon: '≋',
    target: 'radar-vh',
  },
  'radar-water': {
    label: 'Su Birikimi Riski',
    icon: '◌',
    target: 'radar-water',
  },
  soil: {
    label: 'Toprak',
    icon: '⌁',
    target: 'soil',
  },
  climate: {
    label: 'İklim',
    icon: '☁',
    target: 'climate',
  },
  'surface-temperature': {
    label: 'Yüzey Sıcaklığı',
    icon: '°',
    target: 'surface-temperature',
  },
  evapotranspiration: {
    label: 'Su İhtiyacı · ET₀',
    icon: '↟',
    target: 'evapotranspiration',
  },
  'water-demand': {
    label: 'Su İhtiyacı · ET₀',
    icon: '↟',
    target: 'evapotranspiration',
  },
  'rainfall-history': {
    label: 'Yağış Geçmişi',
    icon: '⋮',
    target: 'rainfall-history',
  },
  'rain-history': {
    label: 'Yağış Geçmişi',
    icon: '⋮',
    target: 'rainfall-history',
  },
  phenology: {
    label: 'Ürün Dönemi',
    icon: '◒',
    target: null,
  },
};

function normalizeEvidenceStatus(
  value: unknown,
): 'normal' | 'dikkat' | 'kontrol' {
  const status = cleanText(value).toLocaleLowerCase('tr-TR');

  if (status === 'dikkat') return 'dikkat';
  if (status === 'kontrol') return 'kontrol';
  return 'normal';
}

function buildEvidenceLayers(
  result: any,
  synthesis: any,
  currentLayerLabel: string,
): PusulaEvidenceLayer[] {
  const currentLayer = cleanText(
    result?.interpretedLayer ?? result?.activeLayer,
  );

  const sourceEvidence = Array.isArray(synthesis?.evidence)
    ? synthesis.evidence
    : [];

  const rows: PusulaEvidenceLayer[] = sourceEvidence
    .map((item: any) => {
      const layer = cleanText(item?.layer);
      const meta = PUSULA_LAYER_META[layer];

      if (!layer || !meta) return null;

      return {
        layer,
        label: cleanText(item?.layerLabel) || meta.label,
        finding:
          completeSentence(item?.finding) ||
          'Bu katman Pusula değerlendirmesine katkı verdi.',
        status: normalizeEvidenceStatus(item?.status),
        icon: meta.icon,
        navigable: Boolean(meta.target),
      };
    })
    .filter(Boolean) as PusulaEvidenceLayer[];

  // Sentez henüz hazır değilse bile açık katman kaybolmasın.
  if (currentLayer && !rows.some((row) => row.layer === currentLayer)) {
    const meta = PUSULA_LAYER_META[currentLayer];
    const analysis = result?.analysis ?? null;

    if (meta) {
      rows.unshift({
        layer: currentLayer,
        label: currentLayerLabel || meta.label,
        finding:
          completeSentence(analysis?.summary) ||
          completeSentence(analysis?.headline) ||
          'Açık harita katmanı bu yoruma doğrudan katkı verdi.',
        status: normalizeEvidenceStatus(analysis?.status),
        icon: meta.icon,
        navigable: Boolean(meta.target),
      });
    }
  }

  const unique = new Map<string, PusulaEvidenceLayer>();
  for (const row of rows) {
    const target = PUSULA_LAYER_META[row.layer]?.target ?? row.layer;
    if (!unique.has(target ?? row.layer)) {
      unique.set(target ?? row.layer, row);
    }
  }

  return Array.from(unique.values()).slice(0, 4);
}

function evidenceTarget(layer: string) {
  return PUSULA_LAYER_META[layer]?.target ?? null;
}

function resolvePusulaSignal(
  result: any,
  importantArea: any,
): PusulaSignal | null {
  const layer = result?.activeLayer;
  const area = titleArea(importantArea?.area);
  const finding = findSpatialFinding(
    result,
    importantArea?.area,
  );

  if (layer === 'vegetation') {
    const health = numberOrNull(
      finding?.ndvi?.relativeHealth,
    );

    const weakAreas =
      weakVegetationAreas(result);

    if (health != null) {
      if (health < 0.32) {
        const areaList =
          formatAreaList(weakAreas);

        return {
          tone: 'negative',
          label: 'Dikkat',
          text: areaList
            ? `${areaList} bölümlerinde bitki gelişimi çevresine göre daha zayıf görünüyor.`
            : area
              ? `${area} bölümünde bitki gelişimi çevresine göre daha zayıf görünüyor.`
              : 'Bitki gelişimi çevresine göre daha zayıf görünüyor.',
        };
      }

      if (health > 0.68) {
        return {
          tone: 'positive',
          label: 'Olumlu',
          text: area
            ? `${area} bölümünde bitki gelişimi çevresine göre daha güçlü görünüyor.`
            : 'Bitki gelişimi çevresine göre daha güçlü görünüyor.',
        };
      }

      return {
        tone: 'neutral',
        label: 'Normal',
        text: area
          ? `${area} bölümünde çevresine göre belirgin bir bitki gelişim farkı görünmüyor.`
          : 'Belirgin bir bitki gelişim farkı görünmüyor.',
      };
    }
  }

  if (layer === 'radar-water') {
    const water = numberOrNull(
      finding?.radarWater?.blueRatio,
    );

    if (water != null && water >= 0.68) {
      return {
        tone: 'negative',
        label: 'Dikkat',
        text: area
          ? `${area} bölümünde su birikimi sinyali çevresine göre daha yüksek görünüyor.`
          : 'Su birikimi sinyali çevresine göre daha yüksek görünüyor.',
      };
    }
  }

  if (layer === 'radar-vv') {
    const backscatter = numberOrNull(
      finding?.radarVv?.relativeBackscatter,
    );

    if (backscatter != null) {
      const direction =
        backscatter > 0.5 ? 'daha yüksek' : 'daha düşük';

      return {
        tone: 'attention',
        label: 'Kontrol',
        text: area
          ? `${area} bölümünde radar nem sinyali çevresine göre ${direction}.`
          : `Radar nem sinyali çevresine göre ${direction}.`,
      };
    }
  }

  if (layer === 'radar-vh') {
    const texture = numberOrNull(
      finding?.radarVh?.textureScore,
    );

    if (texture != null && texture >= 0.7) {
      return {
        tone: 'attention',
        label: 'Kontrol',
        text: area
          ? `${area} bölümünde yüzey ve bitki yapısı çevresine göre belirgin farklılık gösteriyor.`
          : 'Yüzey ve bitki yapısında çevresine göre belirgin farklılık var.',
      };
    }
  }

  const status = cleanText(
    result?.analysis?.status,
  ).toLocaleLowerCase('tr-TR');

  if (status === 'dikkat') {
    return { tone: 'negative', label: 'Dikkat' };
  }

  if (status === 'kontrol') {
    return { tone: 'attention', label: 'Kontrol' };
  }

  if (status === 'normal') {
    return { tone: 'neutral', label: 'Normal' };
  }

  return null;
}

export default function HomeMapPusulaStrip({
  fieldName,
  layerLabel,
  loading,
  headline,
  summary,
  result,
  synthesis,
  error,
  decision,
  onOpenDecision,
  onOpenLayer,
  onRefresh,
  onShowOnMap,
}: Props) {
  const [whyOpen, setWhyOpen] = useState(false);
  const analysis = result?.analysis ?? null;
  const importantArea =
    resolvedSpatialImportantArea(result);

  const signal = useMemo<PusulaSignal | null>(
    () => decision
      ? { tone: decision.severity === 'danger' ? 'negative' as const : 'attention' as const, label: decision.severity === 'danger' ? 'Dikkat' : 'Kontrol' }
      : resolvePusulaSignal(result, importantArea),
    [decision, result, importantArea],
  );

  const reasons = useMemo(
    () =>
      decision
        ? (decision.evidence ?? []).map(cleanText).filter(Boolean).slice(0, 3)
        : Array.isArray(analysis?.reasons)
        ? analysis.reasons
            .map((item: unknown) => cleanText(item))
            .filter(Boolean)
            .slice(0, 3)
        : [],
    [decision, analysis?.reasons],
  );


  const evidenceLayers = useMemo(
    () => decision ? [] : buildEvidenceLayers(result, synthesis, layerLabel),
    [decision, result, synthesis, layerLabel],
  );

  const compactText = useMemo(() => {
    if (decision) return `${decision.title}: ${completeSentence(decision.detail)}`;
    if (loading && !result) return `${layerLabel} verisi yorumlanıyor…`;
    if (error && !result) return 'Pusula bu katmanı şu an yorumlayamadı.';

    if (signal?.text) {
      return signal.text;
    }

    if (importantArea) {
      const area = titleArea(importantArea?.area);
      const areaSummary =
        completeSentence(importantArea?.summary) ||
        completeSentence(analysis?.headline);

      if (area && areaSummary) {
        return `${area}: ${areaSummary}`;
      }
    }

    return (
      completeSentence(analysis?.headline) ||
      completeSentence(headline) ||
      completeSentence(analysis?.summary) ||
      completeSentence(summary) ||
      `${fieldName} için harita verileri değerlendiriliyor.`
    );
  }, [
    decision,
    loading,
    error,
    result,
    signal?.text,
    importantArea,
    analysis?.headline,
    analysis?.summary,
    headline,
    summary,
    fieldName,
    layerLabel,
  ]);

  const action = decision ? '' : trimCompact(analysis?.action, 150);
  const canExplain = reasons.length > 0 || Boolean(action) || evidenceLayers.length > 0;

  /*
   * NDVI ve radar katmanlarında AI'nin area metni gelmese bile kendi
   * gerçek mekânsal raster/spatial verimiz var. Bu nedenle butonu
   * yalnızca analysis.importantArea'ya bağlamıyoruz.
   *
   * Toprak/iklim gibi model çözünürlüğü tarla ölçeğinde yerel bir alan
   * üretmiyorsa sahte hotspot göstermemek için buton kapalı kalır.
   */
  const interpretedLayer =
    result?.interpretedLayer ??
    result?.activeLayer;

  const hasSpatialRaster =
    interpretedLayer === 'vegetation'
      ? Boolean(
          result?.context?.ndvi?.spatial ||
            importantArea,
        )
      : interpretedLayer === 'radar-vv' ||
          interpretedLayer === 'radar-vh' ||
          interpretedLayer === 'radar-water'
        ? Boolean(
            result?.context?.radar?.spatial ||
              importantArea,
          )
        : Boolean(
            importantArea?.geometry ||
              importantArea?.bounds ||
              importantArea?.area,
          );

  const canShowOnMap =
    Boolean(result) &&
    hasSpatialRaster;

  return (
    <>
      <style>{CSS}</style>

      <section
        className={[
          'tp-home-map-pusula-strip',
          loading && !decision && !result ? 'is-loading' : '',
          error && !decision && !result ? 'has-error' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label="Pusula harita yorumu"
      >
        <span className="tp-home-map-pusula-logo" aria-hidden="true">
          <img src={PUSULA_BODY_SRC} alt="" draggable={false} />
        </span>

        <div className="tp-home-map-pusula-copy">
          <div className="tp-home-map-pusula-kicker">
            PUSULA
            <span>{decision ? `${fieldName} · ${decision.label}` : layerLabel}</span>
            {signal ? (
              <em
                className={`tp-home-map-pusula-signal ${signal.tone}`}
              >
                {signal.label}
              </em>
            ) : null}
          </div>

          <p className="tp-home-map-pusula-text">{compactText}</p>
          {error && result ? (
            <small className="tp-home-map-pusula-refresh-error" role="status">
              Yeni yorum alınamadı; önceki yorum gösteriliyor. Tekrar deneyebilirsin.
            </small>
          ) : null}
        </div>

        <div className="tp-home-map-pusula-actions">
          {onRefresh ? (
            <button
              type="button"
              className="tp-home-map-pusula-refresh"
              disabled={loading}
              aria-label={loading ? 'Pusula harita yorumu yenileniyor' : 'Pusula harita yorumunu yenile'}
              title="Haritayı yeniden yorumla"
              onClick={onRefresh}
            >
              {loading ? 'Yenileniyor…' : '↻ Yenile'}
            </button>
          ) : null}
          <button
            type="button"
            className="tp-home-map-pusula-why"
            disabled={!canExplain}
            onClick={() => setWhyOpen(true)}
          >
            Neden?
          </button>

          <button
            type="button"
            className="tp-home-map-pusula-show"
            disabled={decision ? !onOpenDecision : !canShowOnMap}
            onClick={() => decision && onOpenDecision ? onOpenDecision(decision.target) : onShowOnMap()}
          >
            {decision ? 'Detayı aç' : 'Haritada göster'}
          </button>
        </div>
      </section>

      {whyOpen && canExplain ? (
        <>
          <button
            type="button"
            className="tp-home-map-why-backdrop"
            aria-label="Pusula açıklamasını kapat"
            onClick={() => setWhyOpen(false)}
          />

          <section
            className="tp-home-map-why-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Pusula neden açıklaması"
          >
            <div className="tp-home-map-why-head">
              <div>
                <small>PUSULA</small>
                <strong>Neden bunu söylüyorum?</strong>
              </div>

              <button
                type="button"
                className="tp-home-map-why-close"
                onClick={() => setWhyOpen(false)}
                aria-label="Kapat"
              >
                ×
              </button>
            </div>

            <div className="tp-home-map-why-body">
              {reasons.length > 0 ? (
                <ul>
                  {reasons.map((reason: string, index: number) => (
                    <li key={`${index}:${reason}`}>{reason}</li>
                  ))}
                </ul>
              ) : null}

              {evidenceLayers.length > 0 ? (
                <div className="tp-home-map-why-layers">
                  <div className="tp-home-map-why-layers-title">
                    <strong>Bu karara katkı veren katmanlar</strong>
                    <span>Dokun → haritada aç</span>
                  </div>

                  <div className="tp-home-map-why-layer-list">
                    {evidenceLayers.map((item) => {
                      const target = evidenceTarget(item.layer);

                      return (
                        <button
                          type="button"
                          key={`${item.layer}:${item.label}`}
                          className="tp-home-map-why-layer"
                          disabled={!target || !onOpenLayer}
                          onClick={() => {
                            if (!target || !onOpenLayer) return;
                            setWhyOpen(false);
                            onOpenLayer(target);
                          }}
                        >
                          <span
                            className="tp-home-map-why-layer-icon"
                            aria-hidden="true"
                          >
                            {item.icon}
                          </span>

                          <span className="tp-home-map-why-layer-copy">
                            <strong>{item.label}</strong>
                            <span>{item.finding}</span>
                          </span>

                          <span
                            className={`tp-home-map-why-layer-status ${item.status}`}
                          >
                            {item.status}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {action ? (
                <p className="tp-home-map-why-action">{action}</p>
              ) : null}
              {decision && onOpenDecision ? (
                <button
                  type="button"
                  className="tp-home-map-why-action-link"
                  onClick={() => { setWhyOpen(false); onOpenDecision(decision.target); }}
                >
                  İlgili veriyi aç →
                </button>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
