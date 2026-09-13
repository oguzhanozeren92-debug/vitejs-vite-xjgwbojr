import type { Map } from 'maplibre-gl';

function reducedMotionPreferred() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Ana harita her yeni oluşturulduğunda sinematik dünya -> tarla geçişi oynar.
 * Önceki sürüm sessionStorage ile aynı oturumda tekrarını engelliyordu; bu da
 * uygulamayı yeniden açınca veya tarla değiştirince animasyonun kaybolmasına
 * neden oluyordu.
 */
export function shouldPlayMapOpening(): boolean {
  return !reducedMotionPreferred();
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

  if (animate && !reducedMotionPreferred()) {
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
