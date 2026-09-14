import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type WeatherRequest = {
  latitude?: number;
  longitude?: number;
};

type ForecastDay = {
  date: string;
  tempMax: number | null;
  tempMin: number | null;
  condition: string;
  precipitationProbability: number | null;
  precipitation: number | null;
  humidity: number | null;
  windSpeed: number | null;
};

type HourlyWeather = {
  time: string;
  windKmh: number | null;
  gustKmh: number | null;
  rainChance: number | null;
  rainMm: number | null;
  temperatureC: number | null;
  humidity: number | null;
  isDay: boolean | null;
};

type ProviderResult = {
  name: string;
  forecast: ForecastDay[];
  hourly: HourlyWeather[];
};

type FusionMeta = {
  method: string;
  sourceCount: number;
  agreement: number | null;
  confidence: 'high' | 'medium' | 'limited';
  sources: string[];
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const weatherCodeToText = (code: number | null) => {
  if (code === null || code === undefined) return 'Bilinmiyor';
  if (code === 0) return 'Güneşli';
  if (code === 1 || code === 2) return 'Parçalı Bulutlu';
  if (code === 3) return 'Kapalı';
  if (code === 45 || code === 48) return 'Sisli';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Çisenti';
  if ([61, 63, 65, 66, 67].includes(code)) return 'Yağmurlu';
  if ([71, 73, 75, 77].includes(code)) return 'Karlı';
  if ([80, 81, 82].includes(code)) return 'Sağanak Yağışlı';
  if ([85, 86].includes(code)) return 'Kar Sağanaklı';
  if ([95, 96, 99].includes(code)) return 'Gök Gürültülü';
  return 'Değişken';
};

const safeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const numbers = (values: unknown[]) =>
  values
    .map((value) => safeNumber(value))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

const median = (values: unknown[]): number | null => {
  const list = numbers(values);
  if (!list.length) return null;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 === 0
    ? (list[middle - 1] + list[middle]) / 2
    : list[middle];
};

const maximum = (values: unknown[]): number | null => {
  const list = numbers(values);
  return list.length ? list[list.length - 1] : null;
};

const minimum = (values: unknown[]): number | null => {
  const list = numbers(values);
  return list.length ? list[0] : null;
};

const average = (values: unknown[]): number | null => {
  const list = numbers(values);
  if (!list.length) return null;
  return list.reduce((sum, value) => sum + value, 0) / list.length;
};

const numericAgreement = (
  values: unknown[],
  tolerance: number,
): number | null => {
  const list = numbers(values);
  if (list.length < 2) return list.length === 1 ? 0.5 : null;
  const range = list[list.length - 1] - list[0];
  return Math.max(0, Math.min(1, 1 - range / Math.max(tolerance, 0.001)));
};

const round = (value: number | null, digits = 1) =>
  value === null ? null : Number(value.toFixed(digits));

const majorityCondition = (days: ForecastDay[]) => {
  const counts = new Map<string, number>();
  days.forEach((day) => {
    const key = day.condition || 'Bilinmiyor';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length && ranked[0][1] > days.length / 2) return ranked[0][0];

  // Eşitlikte kullanıcıyı gereksiz iyimser göstermemek için meteorolojik
  // olarak daha etkili koşulu seç. Bu sıralama yalnız görünür durum etiketi;
  // ilaçlama kararı aşağıdaki saatlik ihtiyatlı fusion ile verilir.
  const conditions = days.map((day) => day.condition);
  if (conditions.some((item) => item.includes('Gök'))) return 'Gök Gürültülü';
  if (conditions.some((item) => item.includes('Kar'))) return 'Karlı';
  if (conditions.some((item) => item.includes('Yağ') || item.includes('Sağanak'))) return 'Yağmurlu';
  if (conditions.some((item) => item.includes('Çisenti'))) return 'Çisenti';
  if (conditions.some((item) => item.includes('Sis'))) return 'Sisli';
  if (conditions.some((item) => item.includes('Bulut'))) return 'Parçalı Bulutlu';
  return conditions[0] || 'Değişken';
};

const confidenceFrom = (sourceCount: number, agreement: number | null): FusionMeta['confidence'] => {
  if (sourceCount >= 3 && (agreement ?? 0) >= 0.7) return 'high';
  if (sourceCount >= 2 && (agreement ?? 0) >= 0.4) return 'medium';
  return 'limited';
};

const getDailyHumidity = (hourly: any, date: string) => {
  if (!Array.isArray(hourly?.time) || !Array.isArray(hourly?.relative_humidity_2m)) {
    return null;
  }

  const values: unknown[] = [];
  hourly.time.forEach((time: string, index: number) => {
    if (String(time).startsWith(date)) values.push(hourly.relative_humidity_2m[index]);
  });

  const result = average(values);
  return result === null ? null : Math.round(result);
};

const normalizeOpenMeteo = (data: any): { forecast: ForecastDay[]; hourly: HourlyWeather[] } => {
  const daily = data?.daily;
  const hourly = data?.hourly;

  const forecast: ForecastDay[] = daily && Array.isArray(daily.time)
    ? daily.time.slice(0, 5).map((date: string, index: number): ForecastDay => ({
        date,
        tempMax: safeNumber(daily.temperature_2m_max?.[index]),
        tempMin: safeNumber(daily.temperature_2m_min?.[index]),
        condition: weatherCodeToText(safeNumber(daily.weather_code?.[index])),
        precipitationProbability: safeNumber(daily.precipitation_probability_max?.[index]),
        precipitation: safeNumber(daily.precipitation_sum?.[index]),
        humidity: getDailyHumidity(hourly, date),
        windSpeed: safeNumber(daily.wind_speed_10m_max?.[index]),
      }))
    : [];

  const hours: HourlyWeather[] = Array.isArray(hourly?.time)
    ? hourly.time.slice(0, 48).map((time: string, index: number): HourlyWeather => ({
        time: String(time),
        windKmh: safeNumber(hourly.wind_speed_10m?.[index]),
        gustKmh: safeNumber(hourly.wind_gusts_10m?.[index]),
        rainChance: safeNumber(hourly.precipitation_probability?.[index]),
        rainMm: safeNumber(hourly.precipitation?.[index]),
        temperatureC: safeNumber(hourly.temperature_2m?.[index]),
        humidity: safeNumber(hourly.relative_humidity_2m?.[index]),
        isDay: hourly.is_day?.[index] === 1 ? true : hourly.is_day?.[index] === 0 ? false : null,
      }))
    : [];

  return { forecast, hourly: hours };
};

const buildUrl = (endpoint: string, latitude: number, longitude: number) => {
  const url = new URL(endpoint);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('timezone', 'Europe/Istanbul');
  url.searchParams.set('forecast_days', '5');
  url.searchParams.set(
    'daily',
    [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'wind_speed_10m_max',
    ].join(','),
  );
  url.searchParams.set(
    'hourly',
    [
      'relative_humidity_2m',
      'wind_speed_10m',
      'wind_gusts_10m',
      'precipitation_probability',
      'precipitation',
      'temperature_2m',
      'is_day',
    ].join(','),
  );
  url.searchParams.set('wind_speed_unit', 'kmh');
  return url.toString();
};

const fetchProvider = async (
  name: string,
  endpoint: string,
  latitude: number,
  longitude: number,
): Promise<ProviderResult | null> => {
  try {
    const response = await fetch(buildUrl(endpoint, latitude, longitude), {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.error(`${name} weather error`, response.status, await response.text());
      return null;
    }

    const normalized = normalizeOpenMeteo(await response.json());
    if (!normalized.forecast.length) return null;
    return { name, forecast: normalized.forecast, hourly: normalized.hourly };
  } catch (error) {
    console.error(`${name} weather exception`, error);
    return null;
  }
};

const calculateConsensus = (providers: ProviderResult[]) => {
  const forecast: ForecastDay[] = [];
  const perDayFusion: Array<FusionMeta & { date: string }> = [];

  for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
    const days = providers.map((provider) => provider.forecast[dayIndex]).filter(Boolean);
    if (!days.length) continue;

    const tempAgreement = numericAgreement(days.map((day) => day.tempMax), 8);
    const windAgreement = numericAgreement(days.map((day) => day.windSpeed), 20);
    const rainAgreement = numericAgreement(days.map((day) => day.precipitationProbability), 70);
    const agreementValues = [tempAgreement, windAgreement, rainAgreement]
      .filter((value): value is number => value !== null);
    const agreement = agreementValues.length
      ? average(agreementValues)
      : null;

    forecast.push({
      date: days[0].date,
      tempMax: round(median(days.map((day) => day.tempMax))),
      tempMin: round(median(days.map((day) => day.tempMin))),
      condition: majorityCondition(days),
      precipitationProbability: round(median(days.map((day) => day.precipitationProbability)), 0),
      precipitation: round(median(days.map((day) => day.precipitation))),
      humidity: round(median(days.map((day) => day.humidity)), 0),
      windSpeed: round(median(days.map((day) => day.windSpeed))),
    });

    perDayFusion.push({
      date: days[0].date,
      method: 'robust-median-majority-v1',
      sourceCount: days.length,
      agreement: agreement === null ? null : round(agreement, 2),
      confidence: confidenceFrom(days.length, agreement),
      sources: providers.filter((provider) => provider.forecast[dayIndex]).map((provider) => provider.name),
    });
  }

  return { forecast, perDayFusion };
};

const calculateSprayDecisionHours = (providers: ProviderResult[]) => {
  const byTime = new Map<string, HourlyWeather[]>();

  providers.forEach((provider) => {
    provider.hourly.forEach((hour) => {
      if (!hour.time) return;
      const list = byTime.get(hour.time) ?? [];
      list.push(hour);
      byTime.set(hour.time, list);
    });
  });

  const hours = [...byTime.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 48)
    .map(([time, rows]) => {
      // İlaçlamada kör ortalama yapmıyoruz. Risk yaratabilecek rüzgâr/yağış
      // için güvenilir modeller içindeki daha ihtiyatlı değeri, sıcaklık için
      // robust medyanı, düşük nem riski için minimumu kullanıyoruz.
      const windKmh = maximum(rows.map((row) => row.windKmh));
      const gustKmh = maximum(rows.map((row) => row.gustKmh));
      const rainChance = maximum(rows.map((row) => row.rainChance));
      const rainMm = maximum(rows.map((row) => row.rainMm));
      const temperatureC = median(rows.map((row) => row.temperatureC));
      const humidity = minimum(rows.map((row) => row.humidity));
      const isDayVotes = rows.map((row) => row.isDay).filter((value): value is boolean => value !== null);
      const isDay = isDayVotes.length
        ? isDayVotes.filter(Boolean).length >= Math.ceil(isDayVotes.length / 2)
        : null;

      return {
        time,
        windKmh: round(windKmh),
        gustKmh: round(gustKmh),
        rainChance: round(rainChance, 0),
        rainMm: round(rainMm),
        temperatureC: round(temperatureC),
        humidity: round(humidity, 0),
        isDay,
        sourceCount: rows.length,
      };
    });

  return {
    timezone: 'Europe/Istanbul',
    method: 'conservative-multimodel-spray-v1',
    sources: providers.map((provider) => provider.name),
    hours,
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed', message: 'Sadece POST destekleniyor.' }, 405);
  }

  try {
    const body = (await req.json()) as WeatherRequest;
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return jsonResponse(
        { error: 'invalid_coordinates', message: 'Geçerli latitude ve longitude gerekli.' },
        400,
      );
    }

    const [ecmwf, gfs, icon] = await Promise.all([
      fetchProvider('ECMWF', 'https://api.open-meteo.com/v1/ecmwf', latitude, longitude),
      fetchProvider('GFS', 'https://api.open-meteo.com/v1/gfs', latitude, longitude),
      fetchProvider('DWD ICON', 'https://api.open-meteo.com/v1/dwd-icon', latitude, longitude),
    ]);

    const providers = [ecmwf, gfs, icon].filter(
      (provider): provider is ProviderResult => provider !== null,
    );

    if (!providers.length) {
      return jsonResponse({
        error: 'weather_unavailable',
        message: 'Hava kaynaklarının hiçbirinden veri alınamadı.',
        providers: [],
        forecast: [],
      });
    }

    const { forecast, perDayFusion } = calculateConsensus(providers);
    const sprayDecision = calculateSprayDecisionHours(providers);
    const overallAgreement = average(perDayFusion.map((item) => item.agreement));

    return jsonResponse({
      success: true,
      latitude,
      longitude,
      sourceCount: providers.length,
      providers: providers.map((provider) => ({
        name: provider.name,
        forecast: provider.forecast,
      })),
      forecast,
      fusion: {
        method: 'robust-median-majority-v1',
        sourceCount: providers.length,
        sources: providers.map((provider) => provider.name),
        agreement: overallAgreement === null ? null : round(overallAgreement, 2),
        confidence: confidenceFrom(providers.length, overallAgreement),
        perDay: perDayFusion,
      },
      sprayDecision,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('weather-compare error:', error);
    return jsonResponse({
      error: 'internal_error',
      message: 'Hava tahminleri karşılaştırılırken teknik hata oluştu.',
      providers: [],
      forecast: [],
    });
  }
});
