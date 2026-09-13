import { supabase } from '../../../supabaseClient';

export type SprayHour = {
  time: number;
  windKmh: number | null;
  gustKmh: number | null;
  rainChance: number | null;
  rainMm: number | null;
  temperatureC: number | null;
  humidity: number | null;
  isDay: boolean | null;
  sourceCount?: number;
};

export type HourlySprayForecast = {
  timezone: string;
  updatedAt: number;
  hours: SprayHour[];
  fusionMethod?: string;
  sources?: string[];
};

const MAX_SPRAY_FORECAST_AGE_MS = 2 * 60 * 60 * 1000;

export function isHourlySprayForecastFresh(
  data: HourlySprayForecast | null | undefined,
  now = Date.now(),
): boolean {
  return Boolean(
    data &&
      Number.isFinite(data.updatedAt) &&
      data.updatedAt <= now + 5 * 60 * 1000 &&
      now - data.updatedAt <= MAX_SPRAY_FORECAST_AGE_MS,
  );
}

export type HourlySprayState = {
  status: 'loading' | 'ready' | 'error';
  data?: HourlySprayForecast;
  message?: string;
};

export type SprayWindow = {
  from: number;
  to: number;
  maxWindKmh: number;
  maxRainChance: number;
};

export function sprayWindowStartsSoon(
  window: Pick<SprayWindow, 'from' | 'to'> | null | undefined,
  now: number,
): boolean {
  return Boolean(
    window &&
      window.from > now &&
      window.from - now <= 2 * 3600000 &&
      window.to > now,
  );
}

export type SprayHourPlan = {
  windows: SprayWindow[];
  message: string;
  nextRisk: string | null;
  nextRiskAt: number | null;
};

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIstanbulHour(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  // weather-compare Europe/Istanbul yerel ISO saatleri döndürür. Offset yoksa
  // +03:00 ekleyerek cihazın kendi saat diliminin sonucu değiştirmesini önle.
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw)
    ? raw
    : `${raw}:00+03:00`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * İlaçlama hava bağlamının tek giriş kapısı.
 *
 * Önceden bu servis Open-Meteo "best match" endpoint'ine ayrı bir sorgu
 * atıyordu. Artık günlük kartların kullandığı aynı weather-compare kaynağının
 * ECMWF + GFS + ICON birleşimindeki ihtiyatlı saatlik karar bağlamını okur.
 */
export async function fetchHourlySprayForecast(
  latitude: number,
  longitude: number,
): Promise<HourlySprayForecast> {
  if (!supabase) {
    throw new Error('Saatlik hava tahmini için Supabase bağlantısı hazır değil.');
  }

  const { data, error } = await supabase.functions.invoke('weather-compare', {
    body: { latitude, longitude },
  });

  if (error) {
    throw new Error(`Saatlik hava karşılaştırma servisi yanıt vermedi: ${error.message}`);
  }

  const sprayDecision = data?.sprayDecision;
  const rawHours = Array.isArray(sprayDecision?.hours) ? sprayDecision.hours : [];

  const hours: SprayHour[] = rawHours
    .map((row: any) => {
      const time = parseIstanbulHour(row?.time);
      if (time === null) return null;

      return {
        time,
        windKmh: finite(row?.windKmh),
        gustKmh: finite(row?.gustKmh),
        rainChance: finite(row?.rainChance),
        rainMm: finite(row?.rainMm),
        temperatureC: finite(row?.temperatureC),
        humidity: finite(row?.humidity),
        isDay:
          row?.isDay === true ? true : row?.isDay === false ? false : null,
        sourceCount: finite(row?.sourceCount) ?? undefined,
      } satisfies SprayHour;
    })
    .filter((hour: SprayHour | null): hour is SprayHour => Boolean(hour));

  if (!hours.length) {
    throw new Error('Bu tarla için çok kaynaklı saatlik tahmin bulunamadı.');
  }

  return {
    timezone: String(sprayDecision?.timezone || 'Europe/Istanbul'),
    updatedAt: Date.now(),
    hours,
    fusionMethod: String(
      sprayDecision?.method || 'conservative-multimodel-spray-v1',
    ),
    sources: Array.isArray(sprayDecision?.sources)
      ? sprayDecision.sources.map((item: unknown) => String(item)).filter(Boolean)
      : [],
  };
}

export function localForecastDay(time: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(time);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(time);
  }
}

export function formatForecastHour(time: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(time);
  } catch {
    return new Intl.DateTimeFormat('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(time);
  }
}

function immediateConcern(hour: SprayHour): string | null {
  if (hour.rainMm !== null && hour.rainMm >= 0.2) return 'yağış bekleniyor';
  if (hour.rainChance !== null && hour.rainChance >= 45) {
    return `yağış olasılığı %${Math.round(hour.rainChance)}`;
  }
  if (hour.windKmh !== null && hour.windKmh >= 20) {
    return `rüzgâr ${Math.round(hour.windKmh)} km/sa`;
  }
  if (hour.gustKmh !== null && hour.gustKmh >= 25) {
    return `ani rüzgâr ${Math.round(hour.gustKmh)} km/sa`;
  }
  return null;
}

function screenedHour(hour: SprayHour, following: SprayHour[]): boolean {
  if (
    hour.isDay !== true ||
    hour.windKmh === null ||
    hour.gustKmh === null ||
    hour.rainChance === null ||
    hour.rainMm === null ||
    hour.temperatureC === null ||
    hour.humidity === null ||
    following.length < 2
  ) {
    return false;
  }

  // İhtiyatlı meteorolojik ön eleme: weather-compare rüzgâr/yağış için
  // modeller arasındaki daha riskli değeri taşır. Ürün etiketi ve parseldeki
  // gerçek ölçüm bu meteorolojik elemeden her zaman daha yüksek otoritedir.
  if (
    hour.windKmh < 5 ||
    hour.windKmh > 15 ||
    hour.gustKmh > 20 ||
    hour.rainChance >= 25 ||
    hour.rainMm >= 0.2 ||
    hour.temperatureC < 10 ||
    hour.temperatureC > 28 ||
    hour.humidity < 40
  ) {
    return false;
  }

  return following.every(
    (next, index) =>
      next.time === hour.time + (index + 1) * 3600000 &&
      next.rainChance !== null &&
      next.rainChance < 45 &&
      next.rainMm !== null &&
      next.rainMm < 0.2,
  );
}

function blockingCondition(hour: SprayHour): string | null {
  if (
    hour.windKmh === null ||
    hour.gustKmh === null ||
    hour.rainChance === null ||
    hour.rainMm === null ||
    hour.temperatureC === null ||
    hour.humidity === null
  ) {
    return 'Saatlik hava verisi eksik';
  }
  if (hour.windKmh < 5) return 'Rüzgâr çok hafif; ilaç sürüklenmesi riski olabilir';
  if (hour.windKmh > 15) return `Rüzgâr ${Math.round(hour.windKmh)} km/sa`;
  if (hour.gustKmh > 20) return `Ani rüzgâr ${Math.round(hour.gustKmh)} km/sa`;
  if (hour.rainChance >= 25) {
    return `Yağış olasılığı %${Math.round(hour.rainChance)}`;
  }
  if (hour.rainMm >= 0.2) return `Yağış ${hour.rainMm.toFixed(1)} mm`;
  if (hour.temperatureC < 10 || hour.temperatureC > 28) {
    return `Sıcaklık ${Math.round(hour.temperatureC)}°C`;
  }
  if (hour.humidity < 40) return `Nem %${Math.round(hour.humidity)}`;
  return null;
}

export function buildHourlySprayPlan(
  data: HourlySprayForecast | null | undefined,
  now = Date.now(),
): SprayHourPlan {
  if (!data?.hours.length) {
    return {
      windows: [],
      message: 'Saatlik tahmin henüz yok.',
      nextRisk: null,
      nextRiskAt: null,
    };
  }
  if (!isHourlySprayForecastFresh(data, now)) {
    return {
      windows: [],
      message: 'Saatlik hava tahmini eskidi. İlaçlama saati seçmeden önce tahmini yenile.',
      nextRisk: null,
      nextRiskAt: null,
    };
  }

  const today = localForecastDay(now, data.timezone);
  const all = data.hours;
  const upcoming = all.filter(
    (hour) => hour.time >= now && localForecastDay(hour.time, data.timezone) === today,
  );
  if (!upcoming.length) {
    return {
      windows: [],
      message: 'Bugün için kalan tahmin saati yok.',
      nextRisk: null,
      nextRiskAt: null,
    };
  }

  const nextRiskHour = upcoming.find((hour) => immediateConcern(hour));
  const nextRisk = nextRiskHour
    ? `${formatForecastHour(nextRiskHour.time, data.timezone)} civarı ${immediateConcern(nextRiskHour)}`
    : null;

  const acceptable = upcoming.filter((hour) => {
    const position = all.findIndex((entry) => entry.time === hour.time);
    return screenedHour(hour, all.slice(position + 1, position + 3));
  });

  const windows: SprayWindow[] = [];
  for (const hour of acceptable) {
    const previous = windows[windows.length - 1];
    if (previous && previous.to === hour.time) {
      previous.to = hour.time + 3600000;
      previous.maxWindKmh = Math.max(previous.maxWindKmh, hour.windKmh!);
      previous.maxRainChance = Math.max(previous.maxRainChance, hour.rainChance!);
    } else {
      windows.push({
        from: hour.time,
        to: hour.time + 3600000,
        maxWindKmh: hour.windKmh!,
        maxRainChance: hour.rainChance!,
      });
    }
  }

  const useful = windows.filter((window) => window.to - window.from >= 2 * 3600000);
  const daylight = upcoming.filter((hour) => hour.isDay === true);
  const blockedHour = daylight.find((hour) => blockingCondition(hour) !== null);
  const blocker = blockedHour ? blockingCondition(blockedHour) : null;

  return {
    windows: useful,
    message: useful.length
      ? 'Bugün ilaçlama havası için değerlendirilebilecek saatler:'
      : daylight.length < 2
        ? 'Bugün en az iki saatlik gündüz aralığı kalmadı; ilaçlama için saat önerilmiyor.'
        : blocker
          ? `Bugün ilaçlama için uygun saat görünmüyor. Örneğin ${formatForecastHour(blockedHour!.time, data.timezone)} civarı ${blocker[0].toLocaleLowerCase('tr-TR')}${blocker.slice(1)}.`
          : 'Bugün en az iki saatlik uygun hava aralığı görünmüyor.',
    nextRisk,
    nextRiskAt: nextRiskHour?.time ?? null,
  };
}
