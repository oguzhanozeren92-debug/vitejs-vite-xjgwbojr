const LAT = 38.9619998275862;
const LON = 38.7569432758621;
const ELEVATION_M = 855;
const START = '2026-09-01';
const END = '2026-09-07';

const compact = (value: string) => value.replaceAll('-', '');
const finite = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isFinite(number) && number > -900 ? number : null;
};
const round = (value: number | null, digits = 3) =>
  value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
const mean = (values: Array<number | null>) => {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};
const meanAbs = (values: Array<number | null>) => mean(values.map((value) => value == null ? null : Math.abs(value)));
const satVp = (tempC: number) => 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
const wind10to2 = (wind10: number) => wind10 * 4.87 / Math.log(67.8 * 10 - 5.42);

function dayOfYear(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

function fao56Et0(input: {
  date: string;
  tmax: number;
  tmin: number;
  dew: number;
  wind2: number;
  solar: number;
}) {
  const tmean = (input.tmax + input.tmin) / 2;
  const es = (satVp(input.tmax) + satVp(input.tmin)) / 2;
  const ea = satVp(input.dew);
  const delta = 4098 * satVp(tmean) / ((tmean + 237.3) ** 2);
  const pressure = 101.3 * (((293 - 0.0065 * ELEVATION_M) / 293) ** 5.26);
  const gamma = 0.000665 * pressure;
  const j = dayOfYear(input.date);
  const phi = LAT * Math.PI / 180;
  const dr = 1 + 0.033 * Math.cos(2 * Math.PI * j / 365);
  const solarDeclination = 0.409 * Math.sin(2 * Math.PI * j / 365 - 1.39);
  const sunsetHourAngle = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(solarDeclination))));
  const ra = 24 * 60 / Math.PI * 0.082 * dr * (
    sunsetHourAngle * Math.sin(phi) * Math.sin(solarDeclination) +
    Math.cos(phi) * Math.cos(solarDeclination) * Math.sin(sunsetHourAngle)
  );
  const rso = (0.75 + 2e-5 * ELEVATION_M) * ra;
  const rns = 0.77 * input.solar;
  const sigma = 4.903e-9;
  const tmaxK = input.tmax + 273.16;
  const tminK = input.tmin + 273.16;
  const cloud = rso > 0 ? Math.max(0.05, Math.min(1, input.solar / rso)) : 0.05;
  const rnl = sigma * ((tmaxK ** 4 + tminK ** 4) / 2) *
    (0.34 - 0.14 * Math.sqrt(Math.max(0, ea))) * (1.35 * cloud - 0.35);
  const rn = rns - rnl;
  const numerator = 0.408 * delta * rn + gamma * (900 / (tmean + 273)) * input.wind2 * (es - ea);
  const denominator = delta + gamma * (1 + 0.34 * input.wind2);
  return Math.max(0, numerator / denominator);
}

async function fetchJson(url: string) {
  const response = await fetch(url, { headers: { 'User-Agent': 'TarlaPusula-ET0-Diagnostics/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} · ${new URL(url).hostname}`);
  return response.json();
}

function nasaDay(parameter: any, date: string) {
  const key = compact(date);
  const values = {
    tmax: finite(parameter?.T2M_MAX?.[key]),
    tmin: finite(parameter?.T2M_MIN?.[key]),
    dew: finite(parameter?.T2MDEW?.[key]),
    wind2: finite(parameter?.WS2M?.[key]),
    solar: finite(parameter?.ALLSKY_SFC_SW_DWN?.[key]),
    rain: finite(parameter?.PRECTOTCORR?.[key]),
  };
  if ([values.tmax, values.tmin, values.dew, values.wind2, values.solar].some((value) => value == null)) return null;
  const met = values as { tmax: number; tmin: number; dew: number; wind2: number; solar: number; rain: number | null };
  return { ...met, et0: fao56Et0({ date, ...met }) };
}

function openDay(payload: any, date: string) {
  const dailyIndex = (payload?.daily?.time ?? []).indexOf(date);
  if (dailyIndex < 0) return null;
  const hourlyIndexes: number[] = [];
  (payload?.hourly?.time ?? []).forEach((time: unknown, index: number) => {
    if (String(time).startsWith(date)) hourlyIndexes.push(index);
  });
  const dew = hourlyIndexes.map((index) => finite(payload?.hourly?.dew_point_2m?.[index])).filter((value): value is number => value != null);
  const wind10 = hourlyIndexes.map((index) => finite(payload?.hourly?.wind_speed_10m?.[index])).filter((value): value is number => value != null);
  const radiation = hourlyIndexes.map((index) => finite(payload?.hourly?.shortwave_radiation?.[index])).filter((value): value is number => value != null);
  const published = finite(payload?.daily?.et0_fao_evapotranspiration?.[dailyIndex]);
  const tmax = finite(payload?.daily?.temperature_2m_max?.[dailyIndex]);
  const tmin = finite(payload?.daily?.temperature_2m_min?.[dailyIndex]);
  const rain = finite(payload?.daily?.precipitation_sum?.[dailyIndex]);
  if (published == null || tmax == null || tmin == null || dew.length !== 24 || wind10.length !== 24 || radiation.length !== 24) {
    return { published, incomplete: true };
  }
  const met = {
    tmax,
    tmin,
    dew: mean(dew)!,
    wind2: wind10to2(mean(wind10)!),
    solar: radiation.reduce((sum, value) => sum + value, 0) * 0.0036,
    rain,
  };
  return { ...met, published, reconstructed: fao56Et0({ date, ...met }), incomplete: false };
}

function dominantDriver(nasa: any, open: any, date: string) {
  if (!nasa || !open || open.incomplete) return null;
  const base = nasa.et0;
  const candidates = [
    ['wind', fao56Et0({ date, ...nasa, wind2: open.wind2 })],
    ['temperature', fao56Et0({ date, ...nasa, tmax: open.tmax, tmin: open.tmin })],
    ['humidity_dewpoint', fao56Et0({ date, ...nasa, dew: open.dew })],
    ['solar_radiation', fao56Et0({ date, ...nasa, solar: open.solar })],
  ].map(([name, value]) => ({ name, deltaMm: Number(value) - base }));
  candidates.sort((a, b) => Math.abs(b.deltaMm) - Math.abs(a.deltaMm));
  return candidates[0];
}

export default async function handler(_req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const nasaBase = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,T2MDEW,WS2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN&community=AG&longitude=${LON}&latitude=${LAT}&start=${compact(START)}&end=${compact(END)}&format=JSON&time-standard=`;
    const common = `latitude=${LAT}&longitude=${LON}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration&hourly=dew_point_2m,wind_speed_10m,shortwave_radiation&start_date=${START}&end_date=${END}&wind_speed_unit=ms`;
    const [nasaLstRaw, nasaUtcRaw, openUtcRaw, openIstanbulRaw] = await Promise.all([
      fetchJson(`${nasaBase}LST`),
      fetchJson(`${nasaBase}UTC`),
      fetchJson(`https://archive-api.open-meteo.com/v1/archive?${common}&timezone=UTC`),
      fetchJson(`https://archive-api.open-meteo.com/v1/archive?${common}&timezone=Europe%2FIstanbul`),
    ]);

    const dates: string[] = [];
    for (let date = new Date(`${START}T00:00:00Z`); date <= new Date(`${END}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1)) {
      dates.push(date.toISOString().slice(0, 10));
    }

    const nasaLstParameter = nasaLstRaw?.properties?.parameter ?? {};
    const nasaUtcParameter = nasaUtcRaw?.properties?.parameter ?? {};
    const rows = dates.map((date) => {
      const nasaLst = nasaDay(nasaLstParameter, date);
      const nasaUtc = nasaDay(nasaUtcParameter, date);
      const openUtc = openDay(openUtcRaw, date);
      const openIstanbul = openDay(openIstanbulRaw, date);
      const nasaTimeStandardDelta = nasaLst && nasaUtc ? nasaUtc.et0 - nasaLst.et0 : null;
      const sourceDelta = nasaUtc && openUtc?.published != null ? openUtc.published - nasaUtc.et0 : null;
      const sourceDeltaPct = sourceDelta != null && nasaUtc?.et0 ? sourceDelta / nasaUtc.et0 * 100 : null;
      const openDayBoundaryDelta = openUtc?.published != null && openIstanbul?.published != null ? openIstanbul.published - openUtc.published : null;
      const reconstructionGap = openUtc?.published != null && openUtc?.reconstructed != null ? openUtc.published - openUtc.reconstructed : null;
      return {
        date,
        nasaLstEt0Mm: round(nasaLst?.et0 ?? null),
        nasaUtcEt0Mm: round(nasaUtc?.et0 ?? null),
        openUtcPublishedEt0Mm: round(openUtc?.published ?? null),
        openUtcReconstructedEt0Mm: round(openUtc?.reconstructed ?? null),
        openIstanbulPublishedEt0Mm: round(openIstanbul?.published ?? null),
        nasaLstToUtcDeltaMm: round(nasaTimeStandardDelta),
        openMinusNasaUtcMm: round(sourceDelta),
        openMinusNasaUtcPct: round(sourceDeltaPct, 1),
        openIstanbulMinusUtcMm: round(openDayBoundaryDelta),
        openPublishedMinusReconstructedMm: round(reconstructionGap),
        dominantInputDriver: (() => {
          const driver = dominantDriver(nasaUtc, openUtc, date);
          return driver ? { name: driver.name, deltaMm: round(driver.deltaMm) } : null;
        })(),
      };
    });

    const comparable = rows.filter((row) => row.nasaLstEt0Mm != null && row.nasaUtcEt0Mm != null && row.openUtcPublishedEt0Mm != null);
    const driverCounts = new Map<string, number>();
    comparable.forEach((row) => {
      if (row.dominantInputDriver?.name) driverCounts.set(row.dominantInputDriver.name, (driverCounts.get(row.dominantInputDriver.name) ?? 0) + 1);
    });
    const topDriver = [...driverCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    res.status(200).json({
      scope: { field: 'ŞENO', crop: 'Badem', start: START, end: END, latitude: LAT, longitude: LON, elevationM: ELEVATION_M },
      note: 'Preview-only diagnostics. Production irrigation authority is unchanged.',
      summary: {
        comparableDays: comparable.length,
        nasaLstEt0MeanMm: round(mean(comparable.map((row) => row.nasaLstEt0Mm))),
        nasaUtcEt0MeanMm: round(mean(comparable.map((row) => row.nasaUtcEt0Mm))),
        openUtcPublishedEt0MeanMm: round(mean(comparable.map((row) => row.openUtcPublishedEt0Mm))),
        meanAbsNasaLstToUtcDeltaMm: round(meanAbs(comparable.map((row) => row.nasaLstToUtcDeltaMm))),
        meanAbsSourceDeltaMm: round(meanAbs(comparable.map((row) => row.openMinusNasaUtcMm))),
        meanSignedSourceDeltaPct: round(mean(comparable.map((row) => row.openMinusNasaUtcPct)), 1),
        openHigherThanNasaUtcDays: comparable.filter((row) => (row.openMinusNasaUtcMm ?? 0) > 0).length,
        meanAbsOpenIstanbulToUtcDeltaMm: round(meanAbs(comparable.map((row) => row.openIstanbulMinusUtcMm))),
        meanAbsOpenPublishedToReconstructedDeltaMm: round(meanAbs(comparable.map((row) => row.openPublishedMinusReconstructedMm))),
        dominantDriver: topDriver ? { name: topDriver[0], days: topDriver[1] } : null,
      },
      days: rows,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
