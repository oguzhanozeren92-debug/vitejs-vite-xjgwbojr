import {
  CROP_ALIASES,
  PATHOGEN_GENERA,
  RISK_SCORES,
  type CropKey,
  type RiskLevel,
  type ThreatDefinition,
} from './catalog.ts';

export type HourlyRow = {
  time: string;
  temperature: number;
  humidity: number;
  precipitation: number;
  vpd: number | null;
  dewPoint: number | null;
  windSpeed: number | null;
};

export type DailyWeather = {
  date: string;
  tempAvg: number;
  tempMin: number;
  tempMax: number;
  rhMax: number;
  rain: number;
  vpdAvg: number | null;
  leafWetnessRhHours: number;
  leafWetnessCartHours: number | null;
  humidityStreak: number;
  hourlyTemperatures: number[];
};

export type DailyRisk = {
  date: string;
  score: number;
  level: RiskLevel;
  tempAvg: number;
  rhMax: number;
  rain3d: number;
  leafWetnessHours: number;
  humidityStreak: number;
  vpdAvg: number | null;
  phenologyFactor: number;
  cumulativeGdd: number | null;
};

export function finite(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

export function normalizeCrop(value: unknown): CropKey | null {
  const text = normalizeText(value);
  if (!text) return null;

  if (CROP_ALIASES[text]) {
    return CROP_ALIASES[text];
  }

  for (const [alias, crop] of Object.entries(CROP_ALIASES)) {
    if (text.includes(alias)) return crop;
  }

  return null;
}

export function classifyRisk(score: number): RiskLevel {
  if (score >= 88) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 30) return 'moderate';
  return 'low';
}

export function trapezoid(
  x: number,
  lo: number,
  hi: number,
  transitionFrac = 0.15,
) {
  const spread = hi > lo ? (hi - lo) * transitionFrac : 1;

  if (x < lo - spread) return 0;
  if (x < lo) {
    return spread > 0 ? (x - (lo - spread)) / spread : 1;
  }
  if (x <= hi) return 1;
  if (x < hi + spread) {
    return spread > 0 ? 1 - (x - hi) / spread : 0;
  }

  return 0;
}

export function phenologyMembership(
  x: number,
  lo: number,
  hi: number,
) {
  const margin = 0.12;
  const spread = hi > lo ? (hi - lo) * margin : margin;

  if (x < lo - spread) return 0;
  if (x < lo) {
    return spread > 0 ? (x - (lo - spread)) / spread : 1;
  }
  if (x <= hi) return 1;
  if (x < hi + spread) {
    return spread > 0 ? 1 - (x - hi) / spread : 0;
  }

  return 0;
}

export function isPathogen(scientificName: string) {
  const lower = scientificName.toLowerCase();
  return PATHOGEN_GENERA.some((genus) => lower.includes(genus));
}

export function leafWetnessRh(
  rhMax: number,
  rainTotal: number,
) {
  let base = 0;
  if (rhMax >= 95) base = 20;
  else if (rhMax >= 85) base = 14;
  else if (rhMax >= 75) base = 8;
  else if (rhMax >= 65) base = 4;

  let rain = 0;
  if (rainTotal >= 5) rain = 6;
  else if (rainTotal >= 1) rain = 4;
  else if (rainTotal >= 0.1) rain = 2;

  return Math.min(24, base + rain);
}

export function leafWetnessCartHour(
  airTemp: number,
  dewPoint: number,
  rh: number,
  windSpeedKmh: number,
) {
  const windMs = windSpeedKmh / 3.6;
  const dpd = airTemp - dewPoint;

  if (dpd < 3.7) return 1;

  if (rh >= 87.8) {
    if (windMs <= 2.5) return 1;
    if (dpd <= 5.3) return 1;
  }

  if (rh > 73 && windMs < 2.5 && dpd >= 0) {
    const threshold =
      2 * Math.sqrt(dpd) +
      0.2 * Math.sqrt(Math.max(0, windMs));

    if (dpd <= threshold) return 1;
  }

  return 0;
}

export function centeredMovingAverage(
  values: number[],
  radius = 3,
) {
  return values.map((_, index) => {
    const start = Math.max(0, index - radius);
    const end = Math.min(values.length - 1, index + radius);
    const window = values.slice(start, end + 1);

    return (
      window.reduce((sum, value) => sum + value, 0) /
      Math.max(1, window.length)
    );
  });
}

export function aggregateDaily(
  rows: HourlyRow[],
): DailyWeather[] {
  const grouped = new Map<string, HourlyRow[]>();

  for (const row of rows) {
    const date = row.time.slice(0, 10);
    if (!date) continue;

    const current = grouped.get(date) ?? [];
    current.push(row);
    grouped.set(date, current);
  }

  let streak = 0;
  const out: DailyWeather[] = [];

  for (const date of [...grouped.keys()].sort()) {
    const dayRows = grouped.get(date) ?? [];
    const temps = dayRows.map((row) => row.temperature);
    const humidity = dayRows.map((row) => row.humidity);
    const rain = dayRows.reduce(
      (sum, row) => sum + row.precipitation,
      0,
    );

    const rhMax = humidity.length
      ? Math.max(...humidity)
      : 0;

    if (rhMax >= 80) streak += 1;
    else streak = 0;

    const vpdRows = dayRows
      .map((row) => row.vpd)
      .filter((value): value is number => value !== null);

    const cartAvailable = dayRows.every(
      (row) =>
        row.dewPoint !== null &&
        row.windSpeed !== null,
    );

    const cartHours = cartAvailable
      ? dayRows.reduce(
          (sum, row) =>
            sum +
            leafWetnessCartHour(
              row.temperature,
              row.dewPoint as number,
              row.humidity,
              row.windSpeed as number,
            ),
          0,
        )
      : null;

    out.push({
      date,
      tempAvg:
        temps.reduce((sum, value) => sum + value, 0) /
        Math.max(1, temps.length),
      tempMin: temps.length ? Math.min(...temps) : 0,
      tempMax: temps.length ? Math.max(...temps) : 0,
      rhMax,
      rain,
      vpdAvg: vpdRows.length
        ? vpdRows.reduce((sum, value) => sum + value, 0) /
          vpdRows.length
        : null,
      leafWetnessRhHours: leafWetnessRh(rhMax, rain),
      leafWetnessCartHours: cartHours,
      humidityStreak: streak,
      hourlyTemperatures: temps,
    });
  }

  return out;
}

export function trendFromTimeline(
  timeline: DailyRisk[],
  todayIndex: number,
): 'rising' | 'stable' | 'falling' {
  const today = timeline[todayIndex];
  if (!today) return 'stable';

  const future = timeline.slice(todayIndex + 1, todayIndex + 4);
  if (!future.length) return 'stable';

  const peakFuture = Math.max(...future.map((item) => item.score));
  const lastFuture = future[future.length - 1]?.score ?? today.score;

  if (peakFuture >= today.score + 12) return 'rising';
  if (lastFuture <= today.score - 12) return 'falling';
  return 'stable';
}

export function reasonsFor(
  day: DailyRisk,
  threat: ThreatDefinition,
  trend: 'rising' | 'stable' | 'falling',
) {
  const reasons: string[] = [];

  if (
    day.tempAvg >= threat.bio.tOptimalMin &&
    day.tempAvg <= threat.bio.tOptimalMax
  ) {
    reasons.push(
      `Ortalama sıcaklık ${round(day.tempAvg, 1)} °C ile tehdit için elverişli aralıkta.`,
    );
  }

  if (day.rhMax >= 80) {
    reasons.push(
      `Günlük en yüksek bağıl nem %${Math.round(day.rhMax)}; nemli koşullar riski destekliyor.`,
    );
  }

  if (day.rain3d >= 5) {
    reasons.push(
      `Son 3 günlük yağış toplamı yaklaşık ${round(day.rain3d, 1)} mm.`,
    );
  }

  if (
    day.leafWetnessHours >=
    threat.bio.minWetnessHoursHigh
  ) {
    reasons.push(
      `Tahmini yaprak ıslaklığı ${round(day.leafWetnessHours, 0)} saat ile risk eşiğini destekliyor.`,
    );
  }

  if (day.humidityStreak >= threat.bio.minStreak) {
    reasons.push(
      `%80+ nem koşulu ${day.humidityStreak} gündür ardışık sürüyor.`,
    );
  }

  if (day.phenologyFactor < 0.5) {
    reasons.push(
      'Fenolojik pencere bu tehdidin aktifliği açısından sınırlayıcı görünüyor.',
    );
  }

  if (trend === 'rising') {
    reasons.push(
      'Önümüzdeki 72 saatte risk skorunun yükselmesi bekleniyor.',
    );
  } else if (trend === 'falling') {
    reasons.push(
      'Önümüzdeki 72 saatte risk baskısının azalması bekleniyor.',
    );
  }

  return reasons.slice(0, 3);
}

export function computeFuzzyTimeline(
  threat: ThreatDefinition,
  daily: DailyWeather[],
  initialGdd = 0,
): DailyRisk[] {
  const smoothedTemps = isPathogen(threat.scientificName)
    ? centeredMovingAverage(daily.map((item) => item.tempAvg))
    : daily.map((item) => item.tempAvg);

  const smoothedRh = isPathogen(threat.scientificName)
    ? centeredMovingAverage(daily.map((item) => item.rhMax))
    : daily.map((item) => item.rhMax);

  let cumulativeGdd = initialGdd;

  const phenoLo =
    threat.bio.phenoFracLo != null
      ? threat.bio.phenoFracLo *
        (threat.bio.phenoFractionRefGdd5 ?? 2200)
      : 100;

  const phenoHi =
    threat.bio.phenoFracHi != null
      ? threat.bio.phenoFracHi *
        (threat.bio.phenoFractionRefGdd5 ?? 2200)
      : 2000;

  const timeline: DailyRisk[] = [];

  for (let i = 0; i < daily.length; i += 1) {
    const day = daily[i];
    const t = smoothedTemps[i] ?? day.tempAvg;
    const h = smoothedRh[i] ?? day.rhMax;
    const rain3d = daily
      .slice(Math.max(0, i - 2), i + 1)
      .reduce((sum, item) => sum + item.rain, 0);

    cumulativeGdd += Math.max(
      0,
      day.tempAvg - threat.bio.tBase,
    );

    const phenologyFactor = phenologyMembership(
      cumulativeGdd,
      phenoLo,
      phenoHi,
    );

    let rawScore = 0;

    if (
      t >= threat.bio.tLethalMin &&
      t <= threat.bio.tLethalMax
    ) {
      let weightedSum = 0;
      let weightTotal = 0;

      for (const rule of threat.rules) {
        const muTemp = trapezoid(t, rule.tempLo, rule.tempHi);
        const muHumidity = trapezoid(
          h,
          rule.humLo,
          rule.humHi,
        );

        const muRain =
          rule.rainMin <= 0 || rain3d >= rule.rainMin
            ? 1
            : trapezoid(
                rain3d,
                rule.rainMin * 0.5,
                rule.rainMin,
              );

        const mu = Math.min(
          muTemp,
          muHumidity,
          muRain,
        );

        if (mu > 0) {
          weightedSum +=
            mu * RISK_SCORES[rule.riskLevel];
          weightTotal += mu;
        }
      }

      rawScore =
        weightTotal > 0
          ? weightedSum / weightTotal
          : 0;

      if (day.humidityStreak < threat.bio.minStreak) {
        rawScore *= Math.max(
          0.3,
          day.humidityStreak /
            Math.max(1, threat.bio.minStreak),
        );
      }

      if (
        rawScore >= 88 &&
        day.leafWetnessRhHours <
          threat.bio.minWetnessHoursCritical
      ) {
        rawScore = Math.min(rawScore, 87);
      }

      if (
        rawScore >= 65 &&
        day.leafWetnessRhHours <
          threat.bio.minWetnessHoursHigh
      ) {
        rawScore = Math.min(rawScore, 64);
      }

      rawScore *= phenologyFactor;
    }

    const score = round(clamp(rawScore, 0, 100), 2);

    timeline.push({
      date: day.date,
      score,
      level: classifyRisk(score),
      tempAvg: round(day.tempAvg, 2),
      rhMax: round(day.rhMax, 2),
      rain3d: round(rain3d, 2),
      leafWetnessHours: round(day.leafWetnessRhHours, 2),
      humidityStreak: day.humidityStreak,
      vpdAvg:
        day.vpdAvg == null
          ? null
          : round(day.vpdAvg, 3),
      phenologyFactor: round(phenologyFactor, 4),
      cumulativeGdd: round(cumulativeGdd, 2),
    });
  }

  return timeline;
}

export function computePowderyMildewTimeline(
  threat: ThreatDefinition,
  daily: DailyWeather[],
  initialGdd = 0,
): DailyRisk[] {
  let conidialIndex = 0;
  let cumulativeGdd = initialGdd;
  const timeline: DailyRisk[] = [];

  for (const day of daily) {
    cumulativeGdd += Math.max(
      0,
      day.tempAvg - threat.bio.tBase,
    );

    const favorableHours = day.hourlyTemperatures.filter(
      (temperatureC) => {
        const f = temperatureC * 1.8 + 32;
        return f >= 70 && f <= 85;
      },
    ).length;

    if (favorableHours >= 6) {
      conidialIndex = Math.min(100, conidialIndex + 20);
    } else {
      conidialIndex = Math.max(0, conidialIndex - 10);
    }

    const hasExtremeHeat = day.hourlyTemperatures.some(
      (temperatureC) => temperatureC * 1.8 + 32 >= 95,
    );

    if (hasExtremeHeat) {
      conidialIndex = Math.max(0, conidialIndex - 10);
    }

    const phenoLo =
      (threat.bio.phenoFracLo ?? 0.1) *
      (threat.bio.phenoFractionRefGdd5 ?? 2200);

    const phenoHi =
      (threat.bio.phenoFracHi ?? 0.8) *
      (threat.bio.phenoFractionRefGdd5 ?? 2200);

    const phenologyFactor = phenologyMembership(
      cumulativeGdd,
      phenoLo,
      phenoHi,
    );

    const score = round(
      clamp(conidialIndex * phenologyFactor, 0, 100),
      1,
    );

    timeline.push({
      date: day.date,
      score,
      level:
        score >= 60
          ? 'high'
          : score >= 30
            ? 'moderate'
            : 'low',
      tempAvg: round(day.tempAvg, 2),
      rhMax: round(day.rhMax, 2),
      rain3d: round(day.rain, 2),
      leafWetnessHours: round(
        day.leafWetnessCartHours ??
          day.leafWetnessRhHours,
        2,
      ),
      humidityStreak: day.humidityStreak,
      vpdAvg:
        day.vpdAvg == null
          ? null
          : round(day.vpdAvg, 3),
      phenologyFactor: round(phenologyFactor, 4),
      cumulativeGdd: round(cumulativeGdd, 2),
    });
  }

  return timeline;
}

export function peakFromToday(
  timeline: DailyRisk[],
  todayIndex: number,
) {
  const future = timeline.slice(
    Math.max(0, todayIndex),
    todayIndex + 7,
  );

  return future.reduce<DailyRisk | null>(
    (best, item) =>
      !best || item.score > best.score
        ? item
        : best,
    null,
  );
}
