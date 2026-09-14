const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ParcelGeometry = {
  type: 'Feature';
  properties?: Record<string, unknown>;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: unknown;
  };
};

const TOKEN_URL =
  'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const PROCESS_URL = 'https://sh.dataspace.copernicus.eu/process/v1';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

const buildDayTimeRange = (date: string) => ({
  from: `${date}T00:00:00Z`,
  to: `${date}T23:59:59Z`,
});

const makeBounds = (geometry: ParcelGeometry) => ({
  geometry: {
    type: geometry.geometry.type,
    coordinates: geometry.geometry.coordinates,
  },
  properties: {
    crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84',
  },
});

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
    const detail = await response.text();
    console.error('satellite-history-preview oauth', response.status, detail);
    throw new Error('Copernicus yetkilendirmesi başarısız.');
  }

  const payload = await response.json();
  if (!payload?.access_token) {
    throw new Error('Copernicus erişim anahtarı alınamadı.');
  }

  return String(payload.access_token);
}

const NDVI_PREVIEW_SCRIPT = `
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: { bands: 4 }
  };
}
function validPixel(scl) {
  return !(scl === 0 || scl === 1 || scl === 3 || scl === 8 || scl === 9 || scl === 10 || scl === 11);
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0 || !validPixel(sample.SCL)) return [0,0,0,0];
  let denom = sample.B08 + sample.B04;
  if (denom === 0) return [0,0,0,0];
  let ndvi = (sample.B08 - sample.B04) / denom;
  if (ndvi < 0.20) return [0.90,0.10,0.08,0.88];
  if (ndvi < 0.35) return [0.96,0.43,0.10,0.86];
  if (ndvi < 0.50) return [0.95,0.76,0.12,0.80];
  if (ndvi < 0.65) return [0.44,0.75,0.24,0.76];
  return [0.05,0.48,0.18,0.76];
}
`;

async function responseToBase64(response: Response) {
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

async function fetchPreview(input: {
  token: string;
  geometry: ParcelGeometry;
  date: string;
  maxCloudCoverage: number;
}) {
  const timeRange = buildDayTimeRange(input.date);
  const response = await fetch(PROCESS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.token}`,
      'Content-Type': 'application/json',
      Accept: 'image/png',
    },
    body: JSON.stringify({
      input: {
        bounds: makeBounds(input.geometry),
        data: [
          {
            type: 'sentinel-2-l2a',
            dataFilter: {
              timeRange,
              mosaickingOrder: 'mostRecent',
              maxCloudCoverage: input.maxCloudCoverage,
            },
          },
        ],
      },
      output: {
        width: 320,
        height: 320,
        responses: [
          {
            identifier: 'default',
            format: { type: 'image/png' },
          },
        ],
      },
      evalscript: NDVI_PREVIEW_SCRIPT,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('satellite-history-preview process', response.status, detail);
    throw new Error('Uydu önizlemesi üretilemedi.');
  }

  return responseToBase64(response);
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
    const imageDate = String(body?.imageDate ?? '').trim();

    if (
      !geometry ||
      geometry.type !== 'Feature' ||
      !geometry.geometry ||
      !['Polygon', 'MultiPolygon'].includes(geometry.geometry.type)
    ) {
      return json({ success: false, message: 'Geçerli parsel sınırı gerekli.' }, 400);
    }

    const parsedDate = new Date(`${imageDate}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(imageDate) ||
      !Number.isFinite(parsedDate.getTime()) ||
      dateOnly(parsedDate) !== imageDate ||
      imageDate > dateOnly(new Date())
    ) {
      return json({ success: false, message: 'Geçerli bir geçmiş ölçüm tarihi seç.' }, 400);
    }

    const maxCloudCoverage = clamp(
      Number(body?.maxCloudCoverage ?? 35) || 35,
      0,
      100,
    );

    const token = await getToken();
    const base64 = await fetchPreview({
      token,
      geometry,
      date: imageDate,
      maxCloudCoverage,
    });

    return json({
      success: true,
      previewOnly: true,
      source: 'Copernicus Data Space · Sentinel-2 L2A',
      latestImageDate: imageDate,
      ndviImage: `data:image/png;base64,${base64}`,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('satellite-history-preview', error);
    return json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Uydu önizlemesi alınamadı.',
    });
  }
});
