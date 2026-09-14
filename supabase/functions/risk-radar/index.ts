import {
  createClient,
} from 'https://esm.sh/@supabase/supabase-js@2';
import {
  PERENNIAL_CROPS,
  RISK_LABELS_TR,
  SUPPORTED_CROP_LABELS_TR,
  THREATS,
  type RiskLevel,
  type ThreatDefinition,
} from './catalog.ts';
import {
  aggregateDaily,
  classifyRisk,
  computeFuzzyTimeline,
  computePowderyMildewTimeline,
  finite,
  normalizeCrop,
  peakFromToday,
  reasonsFor,
  round,
  trendFromTimeline,
  type DailyRisk,
  type HourlyRow,
} from './risk-engine.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json; charset=utf-8',
};

const UPSTREAM = {
  repository: 'agstack/opensource-pestmodels',
  license: 'Apache-2.0',
  catalogSha: '4941ea4cec5678bcf853b19cfd7f35c40c6d6d9e',
  fuzzyEngineSha: '2144f013e5981e3a201b1529a95e51838093a518',
  powderyMildewSha: 'ef97dcfc66df2927b1278ff7ca5b0c754911b771',
  leafWetnessCartSha: '26e7d75118f41754aa1aba9bf4a061fe54718214',
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function dateMinusOne(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function firstOfYear(date: string) {
  return `${date.slice(0, 4)}-01-01`;
}

function daysBetween(start: string, end: string) {
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  return Math.floor((b - a) / 86_400_000);
}

function cleanIsoDate(value: unknown) {
  const text = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? text
    : null;
}

function fieldDisplayName(field: any) {
  return String(field?.name ?? '').trim() || 'Seçili tarla';
}

function getBearer(req: Request) {
  return (req.headers.get('Authorization') ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim();
}

async function getAuthenticatedContext(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey =
    Deno.env.get('SUPABASE_ANON_KEY') ??
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
    '';
  const serviceRoleKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';
  const token = getBearer(req);

  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceRoleKey
  ) {
    throw new Error(
      'Supabase Edge Function ayarları eksik.',
    );
  }

  if (!token) {
    throw new Error('Oturum bulunamadı.');
  }

  const userClient = createClient(
    supabaseUrl,
    anonKey,
    {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const {
    data: userData,
    error: userError,
  } = await userClient.auth.getUser(token);

  if (userError || !userData.user?.id) {
    throw new Error('Oturum doğrulanamadı.');
  }

  const admin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  return {
    admin,
    userId: userData.user.id,
  };
}

async function loadOwnedField(
  admin: any,
  userId: string,
  fieldId: string,
) {
  const { data, error } = await admin
    .from('fields')
    .select(
      [
        'id',
        'user_id',
        'name',
        'crop',
        'city',
        'district',
        'village',
        'season',
        'crop_cycle',
        'planting_year',
        'latitude',
        'longitude',
        'parcel_centroid_lat',
        'parcel_centroid_lng',
      ].join(','),
    )
    .eq('id', fieldId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Tarla kaydı okunamadı: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      'Tarla bulunamadı veya bu tarlaya erişim yok.',
    );
  }

  return data;
}

async function geocodeField(field: any) {
  /*
    Parsel adı, ada/parsel veya kullanıcı bilgisi dış servise gönderilmez.
    Sadece kayıtlı coğrafi yer etiketi koordinat yoksa fallback olarak kullanılır.
  */
  const query = [
    field?.village,
    field?.district,
    field?.city,
    'Türkiye',
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(', ');

  if (!query) return null;

  const url = new URL(
    'https://geocoding-api.open-meteo.com/v1/search',
  );
  url.searchParams.set('name', query);
  url.searchParams.set('count', '5');
  url.searchParams.set('language', 'tr');
  url.searchParams.set('format', 'json');

  const response = await fetch(url);
  if (!response.ok) return null;

  const payload = await response.json().catch(() => ({}));
  const results = Array.isArray(payload?.results)
    ? payload.results
    : [];

  const selected =
    results.find(
      (item: any) =>
        String(item?.country_code ?? '').toUpperCase() ===
        'TR',
    ) ?? results[0];

  const latitude = finite(selected?.latitude);
  const longitude = finite(selected?.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    latitude,
    longitude,
    source: 'geocoded-field-location',
    precision: field?.village
      ? 'village'
      : field?.district
        ? 'district'
        : 'city',
  };
}

async function resolveCoordinates(field: any) {
  const latitude = finite(
    field?.parcel_centroid_lat ?? field?.latitude,
  );
  const longitude = finite(
    field?.parcel_centroid_lng ?? field?.longitude,
  );

  if (latitude !== null && longitude !== null) {
    return {
      latitude,
      longitude,
      source:
        field?.parcel_centroid_lat != null
          ? 'parcel-centroid'
          : 'field-coordinate',
      precision: 'field',
    };
  }

  return await geocodeField(field);
}

async function fetchHourlyWeather(
  latitude: number,
  longitude: number,
) {
  const url = new URL(
    'https://api.open-meteo.com/v1/forecast',
  );

  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set(
    'hourly',
    [
      'temperature_2m',
      'relative_humidity_2m',
      'precipitation',
      'vapour_pressure_deficit',
      'dew_point_2m',
      'wind_speed_10m',
    ].join(','),
  );
  url.searchParams.set('past_days', '7');
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Hava verisi alınamadı (${response.status}): ${text.slice(0, 240)}`,
    );
  }

  const payload = JSON.parse(text);
  const hourly = payload?.hourly ?? {};
  const times = Array.isArray(hourly?.time)
    ? hourly.time
    : [];

  const rows: HourlyRow[] = [];

  for (let i = 0; i < times.length; i += 1) {
    const temperature = finite(hourly?.temperature_2m?.[i]);
    const humidity = finite(
      hourly?.relative_humidity_2m?.[i],
    );
    const precipitation = finite(
      hourly?.precipitation?.[i],
    );

    if (
      temperature === null ||
      humidity === null ||
      precipitation === null
    ) {
      continue;
    }

    rows.push({
      time: String(times[i]),
      temperature,
      humidity,
      precipitation,
      vpd: finite(
        hourly?.vapour_pressure_deficit?.[i],
      ),
      dewPoint: finite(hourly?.dew_point_2m?.[i]),
      windSpeed: finite(hourly?.wind_speed_10m?.[i]),
    });
  }

  if (!rows.length) {
    throw new Error(
      'Risk hesabı için saatlik hava verisi bulunamadı.',
    );
  }

  return {
    rows,
    timezone: String(payload?.timezone ?? ''),
    timezoneAbbreviation: String(
      payload?.timezone_abbreviation ?? '',
    ),
    elevation: finite(payload?.elevation),
    source: 'Open-Meteo Forecast API',
  };
}

async function fetchHistoricalGddSeed(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
  baseTemp: number,
) {
  if (
    !startDate ||
    !endDate ||
    startDate > endDate
  ) {
    return 0;
  }

  let effectiveStart = startDate;
  const span = daysBetween(startDate, endDate);

  if (span > 370) {
    const end = new Date(`${endDate}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() - 370);
    effectiveStart = end.toISOString().slice(0, 10);
  }

  const url = new URL(
    'https://archive-api.open-meteo.com/v1/archive',
  );
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('start_date', effectiveStart);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set('daily', 'temperature_2m_mean');
  url.searchParams.set('timezone', 'auto');

  try {
    const response = await fetch(url);
    if (!response.ok) return 0;

    const payload = await response.json().catch(() => ({}));
    const values = Array.isArray(
      payload?.daily?.temperature_2m_mean,
    )
      ? payload.daily.temperature_2m_mean
      : [];

    return values.reduce(
      (sum: number, value: unknown) => {
        const temp = finite(value);
        return temp === null
          ? sum
          : sum + Math.max(0, temp - baseTemp);
      },
      0,
    );
  } catch {
    /*
      GDD arşivi yardımcı fenoloji girdisidir. Arşiv geçici olarak
      yoksa motor 7+7 günlük hava penceresinden çalışmaya devam eder,
      fakat fenoloji faktörü daha temkinli olur.
    */
    return 0;
  }
}

function findTodayIndex(
  dates: string[],
  appDate: string,
) {
  let index = dates.findIndex(
    (date) => date === appDate,
  );

  if (index < 0) {
    index = dates.findIndex(
      (date) => date > appDate,
    );
  }

  if (index < 0) {
    index = Math.max(0, dates.length - 7);
  }

  return index;
}

function threatAction(score: number) {
  if (score >= 65) {
    return 'Tarlada belirti kontrolünü önceliklendir ve şüpheli alanı fotoğrafla doğrula. Risk skoru tek başına ilaçlama kararı değildir.';
  }

  if (score >= 30) {
    return 'Tarlayı rutin kontrolde bu tehdit açısından özellikle gözlemle. Belirti görürsen fotoğrafla kayıt oluştur.';
  }

  return 'Şu an için ek müdahale önermiyorum; rutin saha gözlemine devam et.';
}

async function buildThreatOutput(
  threat: ThreatDefinition,
  daily: ReturnType<typeof aggregateDaily>,
  todayIndex: number,
  location: {
    latitude: number;
    longitude: number;
  },
  seasonStartDate: string,
) {
  const firstDate = daily[0]?.date ?? '';
  const historyEnd = firstDate
    ? dateMinusOne(firstDate)
    : '';

  const seedGdd = await fetchHistoricalGddSeed(
    location.latitude,
    location.longitude,
    seasonStartDate,
    historyEnd,
    threat.bio.tBase,
  );

  let timeline: DailyRisk[];

  if (
    threat.specializedModel ===
    'grape_powdery_ucipm'
  ) {
    timeline = computePowderyMildewTimeline(
      threat,
      daily,
      seedGdd,
    );
  } else {
    timeline = computeFuzzyTimeline(
      threat,
      daily,
      seedGdd,
    );
  }

  const today = timeline[todayIndex] ?? timeline[0];
  const peak = peakFromToday(
    timeline,
    todayIndex,
  ) ?? today;

  const trend = trendFromTimeline(
    timeline,
    todayIndex,
  );

  const score = today?.score ?? 0;
  const level: RiskLevel = today?.level ?? 'low';

  return {
    scientificName: threat.scientificName,
    commonName: threat.commonName,
    displayName: threat.displayNameTr,
    threatType: threat.threatType,
    model:
      threat.specializedModel ===
      'grape_powdery_ucipm'
        ? 'UC IPM grape powdery mildew / AgStack port'
        : 'AgStack/OpenAgri Fuzzy Mamdani v2 port',
    score,
    level,
    levelLabel: RISK_LABELS_TR[level],
    peakScore7d: peak?.score ?? score,
    peakLevel7d: peak?.level ?? level,
    peakLevelLabel7d:
      RISK_LABELS_TR[peak?.level ?? level],
    peakDate: peak?.date ?? today?.date ?? null,
    trend,
    reasons: today
      ? reasonsFor(today, threat, trend)
      : [],
    metrics: today
      ? {
          temperatureAvgC: today.tempAvg,
          relativeHumidityMaxPercent: today.rhMax,
          precipitation3dMm: today.rain3d,
          leafWetnessHours: today.leafWetnessHours,
          humidityStreakDays: today.humidityStreak,
          vpdKpa: today.vpdAvg,
          cumulativeGdd: today.cumulativeGdd,
          phenologyFactor: today.phenologyFactor,
        }
      : null,
    timeline7d: timeline
      .slice(todayIndex, todayIndex + 7)
      .map((item) => ({
        date: item.date,
        score: item.score,
        level: item.level,
        levelLabel: RISK_LABELS_TR[item.level],
      })),
    action: threatAction(score),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: CORS_HEADERS,
    });
  }

  if (req.method !== 'POST') {
    return json(
      {
        ok: false,
        error: 'Yalnızca POST desteklenir.',
      },
      405,
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const fieldId = String(body?.fieldId ?? '').trim();

    if (!fieldId) {
      return json(
        {
          ok: false,
          error:
            'Risk Radarı için tarla kimliği gerekli.',
        },
        400,
      );
    }

    const { admin, userId } =
      await getAuthenticatedContext(req);

    const field = await loadOwnedField(
      admin,
      userId,
      fieldId,
    );

    const normalizedCrop = normalizeCrop(field?.crop);

    if (!normalizedCrop) {
      return json({
        ok: true,
        supported: false,
        field: {
          id: field.id,
          name: fieldDisplayName(field),
          crop: field?.crop ?? null,
        },
        reason:
          'Bu ürün için doğrulanmış Risk Radarı modeli henüz katalogda yok.',
        supportedCrops: SUPPORTED_CROP_LABELS_TR,
        threats: [],
        generatedAt: new Date().toISOString(),
      });
    }

    const threats = THREATS.filter(
      (item) => item.crop === normalizedCrop,
    );

    if (!threats.length) {
      return json({
        ok: true,
        supported: false,
        field: {
          id: field.id,
          name: fieldDisplayName(field),
          crop: field?.crop ?? null,
        },
        reason:
          'Bu ürün için Risk Radarı tehdidi bulunamadı.',
        supportedCrops: SUPPORTED_CROP_LABELS_TR,
        threats: [],
        generatedAt: new Date().toISOString(),
      });
    }

    const location = await resolveCoordinates(field);

    if (!location) {
      return json(
        {
          ok: false,
          error:
            'Tarla konumu bulunamadı. Risk hesabı için tarla koordinatı veya il/ilçe bilgisi gerekli.',
        },
        400,
      );
    }

    const weather = await fetchHourlyWeather(
      location.latitude,
      location.longitude,
    );

    const daily = aggregateDaily(weather.rows);

    if (daily.length < 3) {
      throw new Error(
        'Risk hesabı için yeterli günlük hava verisi oluşmadı.',
      );
    }

    const appDate =
      cleanIsoDate(body?.appDate) ??
      new Date().toISOString().slice(0, 10);

    const todayIndex = findTodayIndex(
      daily.map((item) => item.date),
      appDate,
    );

    const seasonStartDate =
      cleanIsoDate(body?.seasonStartDate) ??
      (PERENNIAL_CROPS.has(normalizedCrop)
        ? firstOfYear(
            daily[todayIndex]?.date ?? appDate,
          )
        : `${Number(
            field?.season ?? appDate.slice(0, 4),
          )}-01-01`);

    const outputs = await Promise.all(
      threats.map((threat) =>
        buildThreatOutput(
          threat,
          daily,
          todayIndex,
          location,
          seasonStartDate,
        ),
      ),
    );

    outputs.sort(
      (a, b) =>
        b.score - a.score ||
        b.peakScore7d - a.peakScore7d,
    );

    const topRisk = outputs[0] ?? null;
    const overallScore = topRisk?.score ?? 0;
    const overallLevel = classifyRisk(overallScore);

    return json({
      ok: true,
      supported: true,
      field: {
        id: field.id,
        name: fieldDisplayName(field),
        crop: field?.crop ?? null,
        normalizedCrop,
      },
      location: {
        latitude: round(location.latitude, 6),
        longitude: round(location.longitude, 6),
        source: location.source,
        precision: location.precision,
      },
      seasonStartDate,
      weather: {
        source: weather.source,
        timezone: weather.timezone,
        timezoneAbbreviation:
          weather.timezoneAbbreviation,
        elevationM: weather.elevation,
        pastDays: 7,
        forecastDays: 7,
      },
      overall: {
        score: overallScore,
        level: overallLevel,
        levelLabel: RISK_LABELS_TR[overallLevel],
        headline:
          overallLevel === 'critical'
            ? `${topRisk.displayName} riski kritik seviyede`
            : overallLevel === 'high'
              ? `${topRisk.displayName} riski yüksek`
              : overallLevel === 'moderate'
                ? `${topRisk.displayName} riski takip edilmeli`
                : 'Belirgin hastalık/zararlı risk sinyali yok',
        recommendation:
          overallScore >= 65
            ? 'Erken uyarı: saha kontrolü ve fotoğrafla doğrulama önerilir. Bu skor tek başına ilaçlama talimatı değildir.'
            : overallScore >= 30
              ? 'Rutin saha kontrolünde öne çıkan tehdidi özellikle gözlemle.'
              : 'Rutin kontrole devam et; yeni hava verisi geldikçe risk yeniden hesaplanır.',
      },
      threats: outputs,
      provenance: {
        engine: 'tarlapusula-risk-radar-v1.1',
        upstream: 'AgStack/OpenAgri Pest & Disease Models',
        upstreamRepository: UPSTREAM.repository,
        upstreamLicense: UPSTREAM.license,
        upstreamCatalogSha: UPSTREAM.catalogSha,
        fuzzyEngineSha: UPSTREAM.fuzzyEngineSha,
        powderyMildewSha: UPSTREAM.powderyMildewSha,
        leafWetnessCartSha: UPSTREAM.leafWetnessCartSha,
        weatherProvider: 'Open-Meteo',
        note:
          'Risk skoru erken uyarı amaçlıdır; kesin hastalık teşhisi veya pestisit uygulama talimatı değildir.',
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Pusula Risk Radarı hesabı oluşturulamadı.';

    console.error('[risk-radar]', message);

    /*
      Frontend Supabase invoke katmanında gerçek hata metnini okuyabilsin diye
      çalışma hatalarında HTTP 200 + ok:false dönüyoruz. Auth/validation erken
      dönüşleri ise uygun 4xx kodunu kullanıyor.
    */
    return json({
      ok: false,
      error: message,
    });
  }
});
