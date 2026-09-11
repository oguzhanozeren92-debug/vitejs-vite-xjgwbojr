import type { RasterSourceSpecification } from 'maplibre-gl';

const MAPBOX_ACCESS_TOKEN = String(
  import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? '',
).trim();

const MAPBOX_ATTRIBUTION =
  '&copy; Mapbox &copy; OpenStreetMap';

const ESRI_FALLBACK_ATTRIBUTION =
  'Tiles &copy; Esri';

export const hasMapboxSatellite = MAPBOX_ACCESS_TOKEN.length > 0;

export function createSatelliteRasterSource(
  maxzoom = 22,
): RasterSourceSpecification {
  if (hasMapboxSatellite) {
    return {
      type: 'raster',
      tiles: [
        `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=${encodeURIComponent(
          MAPBOX_ACCESS_TOKEN,
        )}`,
      ],
      tileSize: 256,
      maxzoom,
      attribution: MAPBOX_ATTRIBUTION,
    };
  }

  return {
    type: 'raster',
    tiles: [
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ],
    tileSize: 256,
    maxzoom: Math.min(maxzoom, 19),
    attribution: ESRI_FALLBACK_ATTRIBUTION,
  };
}

export const vividSatellitePaint = {
  'raster-saturation': 0.16,
  'raster-contrast': 0.12,
  'raster-brightness-min': 0.015,
  'raster-brightness-max': 0.98,
} as const;
