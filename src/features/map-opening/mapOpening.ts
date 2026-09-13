import type { Map } from 'maplibre-gl';

const SESSION_KEY = 'tarlapusula:map-opening:v1';
let played = false;

export function shouldPlayMapOpening(): boolean {
  if (played || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    return sessionStorage.getItem(SESSION_KEY) !== 'played';
  } catch {
    return true;
  }
}

/** Called only once the map has loaded, so StrictMode remounts do not consume it. */
export function openMapAtField(
  map: Map,
  center: [number, number],
  bbox: number[] | null | undefined,
  animate: boolean,
  zoom = 16,
): void {
  const camera = bbox
    ? map.cameraForBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], {
        padding: { top: 18, right: 18, bottom: 30, left: 18 },
        maxZoom: 18.35,
      })
    : { center, zoom };
  if (!camera) return;
  played = true;
  try { sessionStorage.setItem(SESSION_KEY, 'played'); } catch { /* Private browsing. */ }
  const target = { ...camera, pitch: 0, bearing: 0 };
  if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    map.flyTo({ ...target, duration: 2400, curve: 1.15, essential: false });
  } else {
    map.jumpTo(target);
  }
}
