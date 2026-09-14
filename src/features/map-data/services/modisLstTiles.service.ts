export type ModisLstPlatform = 'terra' | 'aqua';

export type ModisLstTileSource = {
  id: string;
  platform: ModisLstPlatform;
  title: string;
  date: string;
  layerId: string;
  tileUrl: string;
  minZoom: number;
  maxZoom: number;
  tileSize: 256;
  format: 'png';
  opacity: number;
  attribution: string;
  measurement: 'Land Surface Temperature';
  period: 'Daily';
  numericValuesAvailableFromTiles: false;
  productionAuthority: false;
};

const GIBS_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';
const TILE_MATRIX_SET = 'GoogleMapsCompatible_Level7';
const ATTRIBUTION =
  'NASA Global Imagery Browse Services (GIBS), NASA EOSDIS';

const LAYERS: Record<ModisLstPlatform, { layerId: string; title: string }> = {
  terra: {
    layerId: 'MODIS_Terra_Land_Surface_Temp_Day',
    title: 'MODIS Terra Gündüz Yüzey Sıcaklığı',
  },
  aqua: {
    layerId: 'MODIS_Aqua_Land_Surface_Temp_Day',
    title: 'MODIS Aqua Gündüz Yüzey Sıcaklığı',
  },
};

function normalizeIsoDate(value: string) {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error('MODIS LST katmanı için YYYY-AA-GG biçiminde tarih gerekli.');
  }
  const timestamp = Date.parse(`${text}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) {
    throw new Error('MODIS LST katmanı için geçerli tarih gerekli.');
  }
  return text;
}

export function createModisLstTileSource(
  dateInput: string,
  platform: ModisLstPlatform = 'terra',
): ModisLstTileSource {
  const date = normalizeIsoDate(dateInput);
  const definition = LAYERS[platform];
  const tileUrl =
    `${GIBS_BASE}/${definition.layerId}/default/${date}/` +
    `${TILE_MATRIX_SET}/{z}/{y}/{x}.png`;

  return {
    id: `modis-lst-${platform}-${date}`,
    platform,
    title: definition.title,
    date,
    layerId: definition.layerId,
    tileUrl,
    minZoom: 1,
    maxZoom: 7,
    tileSize: 256,
    format: 'png',
    opacity: 0.75,
    attribution: ATTRIBUTION,
    measurement: 'Land Surface Temperature',
    period: 'Daily',
    numericValuesAvailableFromTiles: false,
    productionAuthority: false,
  };
}

export function createModisLstComparisonSources(dateInput: string) {
  const date = normalizeIsoDate(dateInput);
  return {
    terra: createModisLstTileSource(date, 'terra'),
    aqua: createModisLstTileSource(date, 'aqua'),
  } as const;
}
