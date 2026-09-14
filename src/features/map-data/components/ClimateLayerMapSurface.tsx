import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { mapRuntime } from '../../../lib/mapRuntime';
import { createSatelliteRasterSource, vividSatellitePaint } from '../../../lib/mapStyle';
import type { ClimateHistoryMode } from '../hooks/useClimateLayerHistory';
import type { ModisLstTileSource } from '../services/modisLstTiles.service';

type Props = {
  mode: ClimateHistoryMode;
  fieldName: string;
  geometry: unknown;
  latitude?: number | null;
  longitude?: number | null;
  raster?: ModisLstTileSource | null;
  value?: number | null;
  unit?: string;
  dataDate?: string | null;
  sourceLabel: string;
};

type Bounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

function geometryObject(input: any) {
  if (!input) return null;
  if (input.type === 'Feature') return input.geometry ?? null;
  return input.geometry ?? input;
}

function geometryCoordinates(input: unknown) {
  const geometry = geometryObject(input);
  const points: number[][] = [];

  const walk = (value: any) => {
    if (!Array.isArray(value)) return;
    if (
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      const longitude = Number(value[0]);
      const latitude = Number(value[1]);
      if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
        points.push([longitude, latitude]);
      }
      return;
    }
    value.forEach(walk);
  };

  walk(geometry?.coordinates);
  return points;
}

function boundsForGeometry(input: unknown): Bounds | null {
  const points = geometryCoordinates(input);
  if (!points.length) return null;
  return {
    west: Math.min(...points.map((point) => point[0])),
    south: Math.min(...points.map((point) => point[1])),
    east: Math.max(...points.map((point) => point[0])),
    north: Math.max(...points.map((point) => point[1])),
  };
}

function fieldGeoJson(input: unknown) {
  const geometry = geometryObject(input);
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: geometry ?? { type: 'GeometryCollection', geometries: [] },
  };
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

export default function ClimateLayerMapSurface({
  mode,
  fieldName,
  geometry,
  latitude,
  longitude,
  raster,
  value,
  unit = '',
  dataDate,
  sourceLabel,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const bounds = useMemo(() => boundsForGeometry(geometry), [geometry]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const centerLongitude = Number.isFinite(Number(longitude)) ? Number(longitude) : 35.2433;
    const centerLatitude = Number.isFinite(Number(latitude)) ? Number(latitude) : 38.9637;

    const map = new mapRuntime.Map({
      container,
      center: [centerLongitude, centerLatitude],
      zoom: bounds ? 16 : 7,
      minZoom: 1,
      maxZoom: 22,
      pitch: 48,
      bearing: -12,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      style: {
        version: 8,
        sources: {
          satellite: createSatelliteRasterSource(),
        },
        layers: [
          {
            id: 'climate-history-satellite',
            type: 'raster',
            source: 'satellite',
            paint: vividSatellitePaint,
          },
        ],
      },
    });

    mapRef.current = map;

    map.on('load', () => {
      map.addSource('climate-history-parcel', {
        type: 'geojson',
        data: fieldGeoJson(geometry),
      });
      map.addLayer({
        id: 'climate-history-parcel-shadow',
        type: 'line',
        source: 'climate-history-parcel',
        paint: {
          'line-color': '#07100b',
          'line-width': 6,
          'line-opacity': 0.84,
        },
      });
      map.addLayer({
        id: 'climate-history-parcel-line',
        type: 'line',
        source: 'climate-history-parcel',
        paint: {
          'line-color': '#70e39a',
          'line-width': 2.5,
          'line-opacity': 1,
        },
      });

      if (bounds) {
        map.fitBounds(
          [
            [bounds.west, bounds.south],
            [bounds.east, bounds.north],
          ],
          { padding: 18, maxZoom: 18.8, duration: 0, pitch: 48, bearing: -12 },
        );
      }
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const update = () => {
      const source = map.getSource('climate-history-parcel') as GeoJSONSource | undefined;
      source?.setData(fieldGeoJson(geometry));
      if (bounds) {
        map.fitBounds(
          [
            [bounds.west, bounds.south],
            [bounds.east, bounds.north],
          ],
          { padding: 18, maxZoom: 18.8, duration: 450, pitch: 48, bearing: -12 },
        );
      }
    };

    if (map.isStyleLoaded()) update();
    else map.once('load', update);
  }, [geometry, bounds?.west, bounds?.south, bounds?.east, bounds?.north]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateRaster = () => {
      if (map.getLayer('modis-lst-raster')) map.removeLayer('modis-lst-raster');
      if (map.getSource('modis-lst-source')) map.removeSource('modis-lst-source');
      if (mode !== 'modis_lst' || !raster?.tileUrl) return;

      map.addSource('modis-lst-source', {
        type: 'raster',
        tiles: [raster.tileUrl],
        tileSize: raster.tileSize,
        minzoom: raster.minZoom,
        maxzoom: raster.maxZoom,
        attribution: raster.attribution,
      });
      map.addLayer(
        {
          id: 'modis-lst-raster',
          type: 'raster',
          source: 'modis-lst-source',
          paint: {
            'raster-opacity': raster.opacity,
            'raster-resampling': 'linear',
            'raster-fade-duration': 0,
          },
        },
        map.getLayer('climate-history-parcel-shadow')
          ? 'climate-history-parcel-shadow'
          : undefined,
      );
    };

    if (map.isStyleLoaded()) updateRaster();
    else map.once('load', updateRaster);
  }, [mode, raster?.tileUrl, raster?.opacity, raster?.minZoom, raster?.maxZoom]);

  return (
    <div style={styles.shell}>
      <div ref={containerRef} style={styles.map} />
      <div style={styles.badge}>
        <span style={styles.badgeEyebrow}>{mode === 'modis_lst' ? 'MODIS LST' : 'TARLA DEĞERİ'}</span>
        <strong style={styles.badgeTitle}>{fieldName}</strong>
        <small style={styles.badgeMeta}>{formatDate(dataDate)} · {sourceLabel}</small>
      </div>
      {mode !== 'modis_lst' ? (
        <div style={styles.valueCard}>
          <span style={styles.valueLabel}>SEÇİLİ TARLA</span>
          <strong style={styles.value}>{value == null ? '—' : `${value.toFixed(2)} ${unit}`}</strong>
          <small style={styles.valueNote}>Bölgesel değeri tarla içi yapay ısı haritasına çevirmiyoruz.</small>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    position: 'relative',
    width: '100%',
    minHeight: 420,
    overflow: 'hidden',
    borderRadius: 22,
    border: '1px solid rgba(112,227,154,.22)',
    background: '#061308',
  },
  map: { position: 'absolute', inset: 0 },
  badge: {
    position: 'absolute',
    left: 14,
    top: 14,
    display: 'grid',
    gap: 2,
    padding: '10px 12px',
    borderRadius: 14,
    background: 'rgba(2,8,4,.82)',
    border: '1px solid rgba(112,227,154,.26)',
    color: '#eaf7ee',
    backdropFilter: 'blur(12px)',
    maxWidth: 'min(78%, 360px)',
  },
  badgeEyebrow: { fontSize: 10, letterSpacing: '.12em', opacity: 0.7 },
  badgeTitle: { fontSize: 14 },
  badgeMeta: { fontSize: 10, opacity: 0.72, overflow: 'hidden', textOverflow: 'ellipsis' },
  valueCard: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    display: 'grid',
    gap: 4,
    width: 'min(280px, calc(100% - 28px))',
    padding: '12px 14px',
    borderRadius: 16,
    background: 'rgba(2,8,4,.88)',
    border: '1px solid rgba(6,182,212,.32)',
    color: '#eaf7ee',
    backdropFilter: 'blur(12px)',
  },
  valueLabel: { fontSize: 10, letterSpacing: '.12em', color: '#8bd8e5' },
  value: { fontSize: 23 },
  valueNote: { fontSize: 10, lineHeight: 1.35, opacity: 0.68 },
};
