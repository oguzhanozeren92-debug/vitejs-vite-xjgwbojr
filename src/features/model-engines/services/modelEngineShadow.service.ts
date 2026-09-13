import { supabase } from '../../../supabaseClient';
import type {
  ModelReadinessResult,
  PyFao56FieldShadowResult,
  PyFao56ShadowComparison,
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

function mapPyFao56Result(data: any, fallbackFieldId: string): PyFao56ShadowResult {
  if (data?.shadow_scope !== 'reference_et_and_single_kc') {
    throw new Error('Beklenmeyen pyfao56 shadow kapsamı döndü.');
  }

  return {
    ok: true,
    mode: 'shadow',
    shadowScope: 'reference_et_and_single_kc',
    engine: 'pyfao56',
    fieldId: String(data.field_id ?? fallbackFieldId),
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

function mapComparison(data: any): PyFao56ShadowComparison | null {
  if (!data || typeof data !== 'object') return null;

  return {
    basis: {
      note: String(data?.basis?.note ?? ''),
      tarlapusula: String(data?.basis?.tarlapusula ?? ''),
      pyfao56: String(data?.basis?.pyfao56 ?? ''),
    },
    comparedDayCount: Number(data?.compared_day_count ?? 0),
    days: Array.isArray(data?.days)
      ? data.days.map((day: any) => ({
          date: String(day.date),
          kc: Number(day.kc),
          tarlapusulaReferenceEtMm: Number(day.tarlapusula_reference_et_mm),
          pyfao56ReferenceEtMm: Number(day.pyfao56_reference_et_mm),
          referenceEtDeltaMm: Number(day.reference_et_delta_mm),
          referenceEtDeltaPct:
            day.reference_et_delta_pct === null || day.reference_et_delta_pct === undefined
              ? null
              : Number(day.reference_et_delta_pct),
          tarlapusulaCropEtMm: Number(day.tarlapusula_crop_et_mm),
          pyfao56CropEtMm: Number(day.pyfao56_crop_et_mm),
          cropEtDeltaMm: Number(day.crop_et_delta_mm),
          cropEtDeltaPct:
            day.crop_et_delta_pct === null || day.crop_et_delta_pct === undefined
              ? null
              : Number(day.crop_et_delta_pct),
          tarlapusulaPrecipitationMm:
            day.tarlapusula_precipitation_mm === null ||
            day.tarlapusula_precipitation_mm === undefined
              ? null
              : Number(day.tarlapusula_precipitation_mm),
          pyfao56InputRainMm:
            day.pyfao56_input_rain_mm === null || day.pyfao56_input_rain_mm === undefined
              ? null
              : Number(day.pyfao56_input_rain_mm),
        }))
      : [],
    summary: {
      meanAbsoluteReferenceEtDeltaMm:
        data?.summary?.mean_absolute_reference_et_delta_mm ?? null,
      meanAbsoluteReferenceEtDeltaPct:
        data?.summary?.mean_absolute_reference_et_delta_pct ?? null,
      meanAbsoluteCropEtDeltaMm:
        data?.summary?.mean_absolute_crop_et_delta_mm ?? null,
      meanAbsoluteCropEtDeltaPct:
        data?.summary?.mean_absolute_crop_et_delta_pct ?? null,
    },
  };
}

function mapFieldShadowResult(data: any, fieldId: string): PyFao56FieldShadowResult {
  if (!data || data.ok === false) {
    throw new Error(data?.error || 'pyfao56 tarla shadow sonucu alınamadı.');
  }
  if (data.shadow_scope !== 'reference_et_and_single_kc') {
    throw new Error('Beklenmeyen pyfao56 tarla shadow kapsamı döndü.');
  }

  return {
    ok: true,
    engine: 'pyfao56',
    mode: 'shadow',
    shadowScope: 'reference_et_and_single_kc',
    fieldId: String(data.field_id ?? fieldId),
    runId: String(data.run_id ?? ''),
    inputFingerprint: String(data.input_fingerprint ?? ''),
    ready: Boolean(data.ready),
    dayCount: Number(data.day_count ?? 0),
    dates: Array.isArray(data.dates) ? data.dates.map(String) : [],
    missingInputs: Array.isArray(data.missing_inputs)
      ? data.missing_inputs.map(String)
      : [],
    excludedDays: Array.isArray(data.excluded_days)
      ? data.excluded_days.map((item: any) => ({
          date: String(item?.date ?? ''),
          reason: String(item?.reason ?? ''),
        }))
      : [],
    sourceVersions:
      data.source_versions && typeof data.source_versions === 'object'
        ? data.source_versions
        : {},
    productionAuthority: false,
    fullWaterBalanceReady: false,
    blockedFullWaterBalanceInputs: Array.isArray(
      data.blocked_full_water_balance_inputs,
    )
      ? data.blocked_full_water_balance_inputs.map(String)
      : [],
    cached: Boolean(data.cached),
    output: data.output ? mapPyFao56Result(data.output, fieldId) : null,
    comparison: mapComparison(data.comparison),
  };
}

async function invokeFieldShadow(
  fieldId: string,
  operation: 'prepare-shadow-field' | 'shadow-run-field',
): Promise<PyFao56FieldShadowResult> {
  if (!fieldId.trim()) throw new Error('pyfao56 shadow için tarla kimliği gerekli.');

  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('model-engine-shadow', {
    body: {
      engine: 'pyfao56',
      operation,
      payload: { field_id: fieldId },
    },
  });

  if (error) {
    throw new Error(error.message || 'pyfao56 tarla shadow çağrısı başarısız oldu.');
  }

  return mapFieldShadowResult(data, fieldId);
}

/**
 * Server builds the input from the authenticated field, verified daily Kc,
 * NASA POWER weather, Open-Meteo ET0 baseline and the canonical DEM source.
 * No agricultural numeric input is accepted from the phone.
 */
export async function preparePyFao56FieldShadow(
  fieldId: string,
): Promise<PyFao56FieldShadowResult> {
  return invokeFieldShadow(fieldId, 'prepare-shadow-field');
}

/** Run only the ET0 + verified single-Kc shadow scope. It never becomes authority. */
export async function runPyFao56FieldShadow(
  fieldId: string,
): Promise<PyFao56FieldShadowResult> {
  return invokeFieldShadow(fieldId, 'shadow-run-field');
}

/** Low-level/manual contract kept for gateway development and validation only. */
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

  return mapPyFao56Result(data, input.fieldId);
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
