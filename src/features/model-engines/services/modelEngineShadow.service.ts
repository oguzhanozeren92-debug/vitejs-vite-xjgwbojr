import { supabase } from '../../../supabaseClient';
import type {
  ModelReadinessResult,
  PyFao56ShadowInput,
  PyFao56ShadowResult,
} from '../types';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Model motoru için Supabase bağlantısı hazır değil.');
  }
  return supabase;
}

function mapPyFao56Input(input: PyFao56ShadowInput) {
  return {
    field_id: input.fieldId,
    station: {
      latitude: input.station.latitude,
      elevation_m: input.station.elevationM,
      wind_height_m: input.station.windHeightM,
    },
    days: input.days.map((day) => ({
      date: day.date,
      solar_radiation_mj_m2: day.solarRadiationMjM2,
      tmax_c: day.tmaxC,
      tmin_c: day.tminC,
      dew_point_c: day.dewPointC,
      wind_m_s: day.windMS,
      rain_mm: day.rainMm,
      kc: day.kc,
    })),
  };
}

export async function runPyFao56Shadow(
  input: PyFao56ShadowInput,
): Promise<PyFao56ShadowResult> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('model-engine-shadow', {
    body: {
      engine: 'pyfao56',
      operation: 'shadow-run',
      payload: mapPyFao56Input(input),
    },
  });

  if (error) {
    throw new Error(error.message || 'pyfao56 shadow çağrısı başarısız oldu.');
  }
  if (!data || data.ok === false) {
    throw new Error(data?.error || 'pyfao56 shadow sonucu alınamadı.');
  }

  if (data.shadow_scope !== 'reference_et_and_single_kc') {
    throw new Error('Beklenmeyen pyfao56 shadow kapsamı döndü.');
  }

  return {
    ok: true,
    mode: 'shadow',
    shadowScope: 'reference_et_and_single_kc',
    engine: 'pyfao56',
    fieldId: String(data.field_id ?? input.fieldId),
    productionAuthority: false,
    fullWaterBalanceReady: false,
    blockedFullWaterBalanceInputs: Array.isArray(
      data.blocked_full_water_balance_inputs,
    )
      ? data.blocked_full_water_balance_inputs.map(String)
      : [],
    days: Array.isArray(data.days)
      ? data.days.map((day: any) => ({
          date: String(day.date),
          referenceEtMm: Number(day.reference_et_mm),
          kc: Number(day.kc),
          cropEtMm: Number(day.crop_et_mm),
          rainMm: Number(day.rain_mm),
        }))
      : [],
  };
}

export async function checkCropModelReadiness(
  engine: 'pcse' | 'aquacrop',
  fieldId: string,
  availableInputs: string[],
): Promise<ModelReadinessResult> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('model-engine-shadow', {
    body: {
      engine,
      operation: 'readiness',
      payload: {
        field_id: fieldId,
        available_inputs: availableInputs,
      },
    },
  });

  if (error) {
    throw new Error(error.message || `${engine} readiness çağrısı başarısız oldu.`);
  }
  if (!data || data.ok === false) {
    throw new Error(data?.error || `${engine} readiness sonucu alınamadı.`);
  }

  return {
    ok: true,
    engine,
    fieldId: String(data.field_id ?? fieldId),
    ready: Boolean(data.ready),
    missingInputs: Array.isArray(data.missing_inputs)
      ? data.missing_inputs.map(String)
      : [],
    rollout: data.rollout ?? 'off',
    productionAuthority: false,
    note: String(data.note ?? ''),
  };
}
