const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Variable =
  | 'soil_moisture_0_to_7cm'
  | 'soil_moisture_7_to_28cm'
  | 'soil_moisture_28_to_100cm'
  | 'soil_temperature_0_to_7cm'
  | 'soil_temperature_7_to_28cm'
  | 'temperature_2m'
  | 'precipitation';

type RequestBody = {
  latitude?: number;
  longitude?: number;
  variable?: Variable;
  days?: number;
  gridRadius?: number;
};

type Cell = {
  id: string;
  latitude: number;
  longitude: number;
  value: number | null;
  unit: string;
  model: string;
  resolutionDegrees: number;
};

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function variableLabel(variable: Variable) {
  switch (variable) {
    case 'soil_moisture_0_to_7cm': return 'Yüzey Nemi';
    case 'soil_moisture_7_to_28cm': return 'Kök Bölgesi Nemi';
    case 'soil_moisture_28_to_100cm': return 'Derin Toprak Nemi';
    case 'soil_temperature_0_to_7cm': return 'Yüzey Toprak Sıcaklığı';
    case 'soil_temperature_7_to_28cm': return 'Kök Bölgesi Sıcaklığı';
    case 'temperature_2m': return 'Hava Sıcaklığı';
    case 'precipitation': return 'Yağış';
  }
}

function hourlyVariableFor(variable: Variable) {
  switch (variable) {
    case 'soil_temperature_0_to_7cm':
      return 'soil_temperature_0cm';
    case 'soil_temperature_7_to_28cm':
      return 'soil_temperature_6cm';
    default:
      return variable;
  }
}

function unitFor(variable: Variable) {
  if (variable.startsWith('soil_moisture')) return 'm³/m³';
  if (variable.includes('temperature')) return '°C';
  return 'mm';
}

function modelFor(variable: Variable) {
  return variable === 'precipitation'
    ? { api: 'era5', label: 'ERA5', resolutionDegrees: 0.25 }
    : { api: 'era5_land', label: 'ERA5-Land', resolutionDegrees: 0.1 };
}

function aggregate(values: unknown[], variable: Variable) {
  const numbers = values
    .map(Number)
    .filter((value) => Number.isFinite(value));

  if (!numbers.length) return null;

  if (variable === 'precipitation') {
    return numbers.reduce((sum, value) => sum + value, 0);
  }

  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'method_not_allowed' }, 405);
  }

  try {
    const body = (await req.json()) as RequestBody;
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const variable = String(body.variable ?? '') as Variable;
    const allowed: Variable[] = [
      'soil_moisture_0_to_7cm',
      'soil_moisture_7_to_28cm',
      'soil_moisture_28_to_100cm',
      'soil_temperature_0_to_7cm',
      'soil_temperature_7_to_28cm',
      'temperature_2m',
      'precipitation',
    ];

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      return json({ success: false, error: 'invalid_latitude' }, 400);
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return json({ success: false, error: 'invalid_longitude' }, 400);
    }
    if (!allowed.includes(variable)) {
      return json({ success: false, error: 'invalid_variable' }, 400);
    }

    const days = clamp(Math.round(Number(body.days ?? 7)), 1, 45);
    const gridRadius = clamp(Math.round(Number(body.gridRadius ?? 2)), 0, 3);
    const model = modelFor(variable);
    const hourlyVariable = hourlyVariableFor(variable);
    const sampleStep = model.resolutionDegrees;
    const points: Array<{ latitude: number; longitude: number }> = [];

    for (let y = -gridRadius; y <= gridRadius; y += 1) {
      for (let x = -gridRadius; x <= gridRadius; x += 1) {
        points.push({
          latitude: latitude + y * sampleStep,
          longitude: longitude + x * sampleStep,
        });
      }
    }

    // ERA5/ERA5-Land daily reanalysis has a publication lag. Keeping a stable
    // 5-day offset prevents the same screen from jumping between incomplete days.
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - 5);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days + 1);

    const params = new URLSearchParams({
      latitude: points.map((point) => point.latitude.toFixed(5)).join(','),
      longitude: points.map((point) => point.longitude.toFixed(5)).join(','),
      start_date: isoDate(start),
      end_date: isoDate(end),
      hourly: hourlyVariable,
      timezone: 'UTC',
      models: model.api,
      cell_selection: 'land',
    });

    const response = await fetch(`${ARCHIVE_URL}?${params.toString()}`);
    if (!response.ok) {
      const detail = await response.text();
      console.error('era5-map Open-Meteo:', response.status, detail);
      return json({
        success: false,
        error: 'era5_source_error',
        status: response.status,
      }, 502);
    }

    const payload = await response.json();
    const entries = Array.isArray(payload) ? payload : [payload];

    const cells = entries
      .map((entry: any, index: number) => {
        const values = Array.isArray(entry?.hourly?.[hourlyVariable])
          ? entry.hourly[hourlyVariable]
          : [];
        const value = aggregate(values, variable);
        if (value === null) return null;

        const fallback = points[index];
        const cellLatitude = Number(entry?.latitude ?? fallback?.latitude);
        const cellLongitude = Number(entry?.longitude ?? fallback?.longitude);

        if (!Number.isFinite(cellLatitude) || !Number.isFinite(cellLongitude)) {
          return null;
        }

        return {
          id: `${variable}:${cellLatitude.toFixed(5)}:${cellLongitude.toFixed(5)}`,
          latitude: cellLatitude,
          longitude: cellLongitude,
          value: Number(value.toFixed(variable === 'precipitation' ? 2 : 4)),
          unit: unitFor(variable),
          model: model.label,
          resolutionDegrees: model.resolutionDegrees,
        } satisfies Cell;
      })
      .filter(Boolean) as Cell[];

    if (!cells.length) {
      return json({ success: false, error: 'no_cells' }, 200);
    }

    const values = cells.map((cell) => Number(cell.value));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;

    return json({
      success: true,
      source: 'Open-Meteo Historical Weather API',
      provider: 'ECMWF via Open-Meteo',
      model: model.label,
      variable,
      variableLabel: variableLabel(variable),
      unit: unitFor(variable),
      period: {
        start: isoDate(start),
        end: isoDate(end),
      },
      cells,
      stats: {
        min,
        max,
        average,
        validCellCount: cells.length,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('era5-map:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'era5_map_failed',
    }, 500);
  }
});
