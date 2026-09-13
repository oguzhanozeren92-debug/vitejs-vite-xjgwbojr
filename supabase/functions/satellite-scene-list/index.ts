const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ParcelGeometry = {
  type: 'Feature';
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: unknown;
  };
};

const TOKEN_URL =
  'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const CATALOG_URL = 'https://sh.dataspace.copernicus.eu/catalog/v1/search';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function collectCoordinates(
  value: unknown,
  result: [number, number][] = [],
) {
  if (!Array.isArray(value)) return result;

  if (
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    result.push([value[0], value[1]]);
    return result;
  }

  for (const child of value) collectCoordinates(child, result);
  return result;
}

function bboxFromGeometry(feature: ParcelGeometry) {
  const points = collectCoordinates(feature.geometry.coordinates);
  if (!points.length) return null;

  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  const bbox = [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];

  if (
    !bbox.every(Number.isFinite) ||
    bbox[0] >= bbox[2] ||
    bbox[1] >= bbox[3]
  ) {
    return null;
  }

  return bbox;
}

async function getToken() {
  const clientId = Deno.env.get('COPERNICUS_CLIENT_ID')?.trim();
  const clientSecret = Deno.env.get('COPERNICUS_CLIENT_SECRET')?.trim();

  if (!clientId || !clientSecret) {
    throw new Error('Copernicus kimlik bilgileri bulunamadı.');
  }

  const body = new URLSearchParams();
  body.set('grant_type', 'client_credentials');
  body.set('client_id', clientId);
  body.set('client_secret', clientSecret);

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error('Copernicus yetkilendirmesi başarısız.');
  }

  const payload = await response.json();
  if (!payload?.access_token) {
    throw new Error('Copernicus erişim anahtarı alınamadı.');
  }

  return String(payload.access_token);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ success: false, message: 'Sadece POST destekleniyor.' }, 405);
  }

  try {
    const body = await req.json();
    const geometry = body?.geometry as ParcelGeometry | undefined;

    if (
      !geometry ||
      geometry.type !== 'Feature' ||
      !geometry.geometry ||
      !['Polygon', 'MultiPolygon'].includes(geometry.geometry.type)
    ) {
      return json({ success: false, message: 'Geçerli parsel sınırı gerekli.' }, 400);
    }

    const bbox = bboxFromGeometry(geometry);
    if (!bbox) {
      return json({ success: false, message: 'Parsel koordinatları okunamadı.' }, 400);
    }

    const daysBack = Math.max(
      7,
      Math.min(180, Number(body?.daysBack ?? 180) || 180),
    );
    const maxCloudCoverage = Math.max(
      0,
      Math.min(100, Number(body?.maxCloudCoverage ?? 35) || 35),
    );

    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - daysBack);
    const datetime = `${start.toISOString().slice(0, 10)}T00:00:00Z/${end
      .toISOString()
      .slice(0, 10)}T23:59:59Z`;

    const token = await getToken();
    const response = await fetch(CATALOG_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        bbox,
        datetime,
        collections: ['sentinel-2-l2a'],
        limit: 100,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(
        'satellite-scene-list catalog error',
        response.status,
        detail,
      );
      throw new Error('Uydu arşivi şu anda okunamadı.');
    }

    const payload = await response.json();
    const features = Array.isArray(payload?.features) ? payload.features : [];
    const byDate = new Map<
      string,
      { date: string; cloudCoverage: number | null }
    >();

    for (const feature of features) {
      const raw = String(
        feature?.properties?.datetime ??
          feature?.properties?.start_datetime ??
          '',
      ).trim();
      const date = raw.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

      const cloudRaw = Number(feature?.properties?.['eo:cloud_cover']);
      const cloudCoverage = Number.isFinite(cloudRaw) ? cloudRaw : null;
      if (
        cloudCoverage !== null &&
        cloudCoverage > maxCloudCoverage
      ) {
        continue;
      }

      const previous = byDate.get(date);
      if (
        !previous ||
        previous.cloudCoverage === null ||
        (cloudCoverage !== null && cloudCoverage < previous.cloudCoverage)
      ) {
        byDate.set(date, { date, cloudCoverage });
      }
    }

    const scenes = [...byDate.values()].sort((a, b) =>
      b.date.localeCompare(a.date),
    );

    return json({
      success: true,
      source: 'Copernicus Data Space · Sentinel-2 L2A Catalog',
      bbox,
      period: datetime,
      scenes,
      dates: scenes.map((scene) => scene.date),
    });
  } catch (error) {
    console.error('satellite-scene-list', error);
    return json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Uydu arşivi alınamadı.',
      },
      200,
    );
  }
});
