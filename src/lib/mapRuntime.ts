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
 * UnifiedMap'teki image katmanları aynı Map instance içinde alt-mod değişirken
 * eskiden removeSource/removeLayer -> addSource/addLayer yapıyordu. Yeni PNG
 * decode edilene kadar kısa süreli renksiz alan veya yarım render oluşabiliyor.
 *
 * Bu dört source/layer sadece kendi map component'i içinde yaşar. Section
 * değişince map tamamen dispose edildiği için farklı veri katmanlarının üst üste
 * kalması mümkün değildir. Aynı component içindeki yeni render ise mevcut
 * ImageSource.updateImage() ile yerinde güncellenir; son doğru görüntü yeni
 * görüntü hazır olana kadar korunur.
 */
const STABLE_IMAGE_SOURCE_IDS = new Set([
  'veg-image',
  'radar-image',
  'soil-wms-image',
  'climate-overlay-image',
]);

const STABLE_IMAGE_LAYER_IDS = new Set([
  'veg-image-layer',
  'radar-image-layer',
  'soil-wms-layer',
  'climate-overlay-layer',
]);

const PATCH_FLAG = Symbol.for('tarlapusula.stable-image-source-patch.v1');

function installStableImageSourcePatch(MapClass: any) {
  const proto = MapClass?.prototype as any;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalAddSource = proto.addSource;
  const originalRemoveSource = proto.removeSource;
  const originalAddLayer = proto.addLayer;
  const originalRemoveLayer = proto.removeLayer;

  proto.removeSource = function removeSourceStable(id: string) {
    if (STABLE_IMAGE_SOURCE_IDS.has(id) && this.getSource?.(id)) {
      // Aynı map içinde birazdan updateImage yapılacak; eski doğru görsel kalsın.
      return this;
    }
    return originalRemoveSource.call(this, id);
  };

  proto.removeLayer = function removeLayerStable(id: string) {
    if (STABLE_IMAGE_LAYER_IDS.has(id) && this.getLayer?.(id)) {
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
        current.updateImage({
          url: source.url,
          coordinates: source.coordinates,
        });
        return this;
      }
    }

    return originalAddSource.call(this, id, source);
  };

  proto.addLayer = function addLayerStable(layer: any, beforeId?: string) {
    if (STABLE_IMAGE_LAYER_IDS.has(String(layer?.id ?? '')) && this.getLayer?.(layer.id)) {
      const paint = layer?.paint ?? {};
      for (const [property, value] of Object.entries(paint)) {
        try {
          this.setPaintProperty?.(layer.id, property, value);
        } catch {
          // Eski render güvenli biçimde kalır.
        }
      }

      const layout = layer?.layout ?? {};
      for (const [property, value] of Object.entries(layout)) {
        try {
          this.setLayoutProperty?.(layer.id, property, value);
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
