import * as maplibregl from 'maplibre-gl';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './mapRuntime.css';
import { hasMapboxSatellite, mapboxAccessToken } from './mapStyle';

class ApplicationMapboxMap extends mapboxgl.Map {
  constructor(options: mapboxgl.MapOptions) {
    super({
      ...options,
      accessToken: mapboxAccessToken,
      // Keep provider credit available in embedded maps as well as fullscreen.
      attributionControl: options.attributionControl === false
        ? { compact: true }
        : options.attributionControl,
    });
  }
}

/*
 * STABLE IMAGE SWAP
 * ---------------------------------------------------------
 * Katman geçişinde eski render önce silinirse yeni PNG/raster decode edilene
 * kadar harita renksiz kalabiliyor. Buradaki kontrat:
 *
 * 1) Aynı image source yeniden geliyorsa remove/add yerine updateImage.
 * 2) Farklı image source'a geçiliyorsa eski source yeni source gerçekten
 *    yüklenene kadar ekranda kalır; sonra eski render temizlenir.
 * 3) Map component dispose edilince normal map.remove() her şeyi temizler.
 *
 * Bu görsel stabilizasyon veri kaynağı değildir. Yalnızca tek otoriter
 * snapshot'ın son tamamlanmış render'ını yeni render hazır olana kadar korur.
 */
const SOURCE_TO_LAYER: Record<string, string> = {
  // UnifiedMap
  'veg-image': 'veg-image-layer',
  'radar-image': 'radar-image-layer',
  'soil-wms-image': 'soil-wms-layer',
  'climate-overlay-image': 'climate-overlay-layer',

  // Ana harita
  'home-inline-image': 'home-inline-image-layer',
  'home-inline-climate': 'home-inline-climate-layer',
  'home-inline-agro': 'home-inline-agro-layer',
};

const STABLE_IMAGE_SOURCE_IDS = new Set(Object.keys(SOURCE_TO_LAYER));
const STABLE_IMAGE_LAYER_IDS = new Set(Object.values(SOURCE_TO_LAYER));
const HOME_IMAGE_SOURCE_IDS = new Set([
  'home-inline-image',
  'home-inline-climate',
  'home-inline-agro',
]);

const PATCH_FLAG = Symbol.for('tarlapusula.stable-image-source-patch.v2');
const PENDING_SOURCE_REMOVALS = Symbol.for('tarlapusula.pending-image-source-removals');
const PENDING_LAYER_REMOVALS = Symbol.for('tarlapusula.pending-image-layer-removals');

type StableMap = any;

function pendingSources(map: StableMap) {
  if (!map[PENDING_SOURCE_REMOVALS]) {
    map[PENDING_SOURCE_REMOVALS] = new Set<string>();
  }
  return map[PENDING_SOURCE_REMOVALS] as Set<string>;
}

function pendingLayers(map: StableMap) {
  if (!map[PENDING_LAYER_REMOVALS]) {
    map[PENDING_LAYER_REMOVALS] = new Set<string>();
  }
  return map[PENDING_LAYER_REMOVALS] as Set<string>;
}

function installStableImageSourcePatch(MapClass: any) {
  const proto = MapClass?.prototype as any;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalAddSource = proto.addSource;
  const originalRemoveSource = proto.removeSource;
  const originalAddLayer = proto.addLayer;
  const originalRemoveLayer = proto.removeLayer;

  const actuallyRemove = (map: StableMap, sourceId: string) => {
    const layerId = SOURCE_TO_LAYER[sourceId];

    try {
      if (layerId && map.getLayer?.(layerId)) {
        originalRemoveLayer.call(map, layerId);
      }
    } catch {
      // Map başka bir lifecycle sırasında temizlenmiş olabilir.
    }

    try {
      if (map.getSource?.(sourceId)) {
        originalRemoveSource.call(map, sourceId);
      }
    } catch {
      // no-op
    }

    pendingSources(map).delete(sourceId);
    if (layerId) pendingLayers(map).delete(layerId);
  };

  const flushOtherHomeSources = (map: StableMap, activeSourceId: string) => {
    if (!HOME_IMAGE_SOURCE_IDS.has(activeSourceId)) return;

    for (const sourceId of [...pendingSources(map)]) {
      if (
        sourceId !== activeSourceId &&
        HOME_IMAGE_SOURCE_IDS.has(sourceId)
      ) {
        actuallyRemove(map, sourceId);
      }
    }
  };

  const whenSourceReady = (map: StableMap, sourceId: string) => {
    const finish = () => {
      try {
        if (typeof map.isSourceLoaded === 'function' && !map.isSourceLoaded(sourceId)) {
          return false;
        }
      } catch {
        return false;
      }

      flushOtherHomeSources(map, sourceId);
      return true;
    };

    if (finish()) return;

    const handler = (event: any) => {
      if (event?.sourceId !== sourceId) return;
      if (!finish()) return;
      try {
        map.off?.('sourcedata', handler);
      } catch {
        // no-op
      }
    };

    try {
      map.on?.('sourcedata', handler);
    } catch {
      // Map event API unavailable olsa bile mevcut render korunur.
    }
  };

  proto.removeSource = function removeSourceStable(id: string) {
    if (STABLE_IMAGE_SOURCE_IDS.has(id) && this.getSource?.(id)) {
      pendingSources(this).add(id);
      return this;
    }
    return originalRemoveSource.call(this, id);
  };

  proto.removeLayer = function removeLayerStable(id: string) {
    if (STABLE_IMAGE_LAYER_IDS.has(id) && this.getLayer?.(id)) {
      pendingLayers(this).add(id);
      return this;
    }
    return originalRemoveLayer.call(this, id);
  };

  proto.addSource = function addSourceStable(id: string, source: any) {
    if (
      STABLE_IMAGE_SOURCE_IDS.has(id) &&
      source?.type === 'image'
    ) {
      const current = this.getSource?.(id) as any;

      if (current && typeof current.updateImage === 'function') {
        // Aynı source: mevcut doğru raster ekranda dururken yenisi decode edilir.
        pendingSources(this).delete(id);
        const layerId = SOURCE_TO_LAYER[id];
        if (layerId) pendingLayers(this).delete(layerId);

        current.updateImage({
          url: source.url,
          coordinates: source.coordinates,
        });

        whenSourceReady(this, id);
        return this;
      }
    }

    const result = originalAddSource.call(this, id, source);

    if (STABLE_IMAGE_SOURCE_IDS.has(id)) {
      pendingSources(this).delete(id);
      whenSourceReady(this, id);
    }

    return result;
  };

  proto.addLayer = function addLayerStable(layer: any, beforeId?: string) {
    const id = String(layer?.id ?? '');

    if (STABLE_IMAGE_LAYER_IDS.has(id) && this.getLayer?.(id)) {
      pendingLayers(this).delete(id);

      const paint = layer?.paint ?? {};
      for (const [property, value] of Object.entries(paint)) {
        try {
          this.setPaintProperty?.(id, property, value);
        } catch {
          // Eski render güvenli biçimde kalır.
        }
      }

      const layout = layer?.layout ?? {};
      for (const [property, value] of Object.entries(layout)) {
        try {
          this.setLayoutProperty?.(id, property, value);
        } catch {
          // no-op
        }
      }

      return this;
    }

    return originalAddLayer.call(this, layer, beforeId);
  };
}

installStableImageSourcePatch(maplibregl.Map);
installStableImageSourcePatch(ApplicationMapboxMap);

// The application uses the common GL API (raster, GeoJSON, markers and controls).
// Keep the existing MapLibre types at this boundary for the legacy drawing editor.
// Without the user's own public token the current map remains usable.
export const mapRuntime: typeof maplibregl = hasMapboxSatellite
  ? {
      ...maplibregl,
      Map: ApplicationMapboxMap,
      Marker: mapboxgl.Marker,
      Popup: mapboxgl.Popup,
      NavigationControl: mapboxgl.NavigationControl,
      ScaleControl: mapboxgl.ScaleControl,
      AttributionControl: mapboxgl.AttributionControl,
    } as unknown as typeof maplibregl
  : maplibregl;
