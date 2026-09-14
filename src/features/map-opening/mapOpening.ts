import type { Map } from 'maplibre-gl';

const MAP_ANIMATION_STORAGE_KEY = 'tp_settings_map_opening_animation_v1';

function reducedMotionPreferred() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function mapAnimationEnabled() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(MAP_ANIMATION_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

/**
 * Ana harita her yeni oluşturulduğunda sinematik dünya -> tarla geçişi oynar.
 * Kullanıcı Ayarlar'dan bu davranışı kapatabilir; işletim sisteminin azaltılmış
 * hareket tercihi de her zaman önceliklidir.
 */
export function shouldPlayMapOpening(): boolean {
  return mapAnimationEnabled() && !reducedMotionPreferred();
}

export function openMapAtField(
  map: Map,
  center: [number, number],
  bbox: number[] | null | undefined,
  animate: boolean,
  zoom = 16,
): void {
  const camera = bbox
    ? map.cameraForBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
        {
          padding: { top: 22, right: 22, bottom: 38, left: 22 },
          maxZoom: 18.35,
        },
      )
    : { center, zoom };

  if (!camera) return;

  const target = {
    ...camera,
    pitch: 0,
    bearing: 0,
  };

  if (animate && mapAnimationEnabled() && !reducedMotionPreferred()) {
    map.flyTo({
      ...target,
      duration: 2600,
      curve: 1.22,
      speed: 0.92,
      essential: false,
    });
    return;
  }

  map.jumpTo(target);
}
