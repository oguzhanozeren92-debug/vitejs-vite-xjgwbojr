import type { ClimateHistoryMode } from './hooks/useClimateLayerHistory';

export type ClimateMapLayerDefinition = {
  key: ClimateHistoryMode;
  label: string;
  shortLabel: string;
  group: 'water' | 'risk';
  sourceLabel: string;
  measurementLabel: string;
  unit: string;
  renderKind: 'dated-raster' | 'field-value';
  historySupported: true;
  note: string;
};

export const CLIMATE_MAP_LAYERS: readonly ClimateMapLayerDefinition[] = [
  {
    key: 'modis_lst',
    label: 'Yüzey Sıcaklığı (LST)',
    shortLabel: 'LST',
    group: 'risk',
    sourceLabel: 'NASA GIBS · MODIS Terra/Aqua',
    measurementLabel: 'Land Surface Temperature',
    unit: 'raster',
    renderKind: 'dated-raster',
    historySupported: true,
    note: 'Gerçek tarihli MODIS LST rasterıdır. Tile görüntüsü sayısal tarla ortalaması gibi yorumlanmaz.',
  },
  {
    key: 'et0',
    label: 'Referans Evapotranspirasyon',
    shortLabel: 'ET₀',
    group: 'water',
    sourceLabel: 'ERA5-Land / ECMWF via Open-Meteo',
    measurementLabel: 'FAO-56 reference evapotranspiration',
    unit: 'mm',
    renderKind: 'field-value',
    historySupported: true,
    note: 'Bu ET₀ referans evapotranspirasyondur; gerçek ürün ET veya sulama emri değildir.',
  },
  {
    key: 'chirps',
    label: 'CHIRPS Yağış',
    shortLabel: 'CHIRPS',
    group: 'water',
    sourceLabel: 'UCSB CHIRPS via SERVIR ClimateSERV',
    measurementLabel: 'field polygon precipitation average',
    unit: 'mm',
    renderKind: 'field-value',
    historySupported: true,
    note: 'Parsel geometrisi üzerindeki gerçek CHIRPS ortalamasıdır; başka yağış kaynağı CHIRPS adıyla gösterilmez.',
  },
  {
    key: 'frost',
    label: 'Don Riski',
    shortLabel: 'Don',
    group: 'risk',
    sourceLabel: 'ERA5-Land / ECMWF via Open-Meteo',
    measurementLabel: 'daily minimum 2m air temperature / frost risk',
    unit: '°C',
    renderKind: 'field-value',
    historySupported: true,
    note: 'Don riski günlük minimum 2 m hava sıcaklığından türetilir; tarla içi sensör ölçümü değildir.',
  },
] as const;

export function getClimateMapLayerDefinition(mode: ClimateHistoryMode) {
  return CLIMATE_MAP_LAYERS.find((layer) => layer.key === mode) ?? null;
}
