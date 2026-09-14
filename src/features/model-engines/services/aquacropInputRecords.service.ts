import { supabase } from '../../../supabaseClient';

export type FieldWaterMeasurementInput = {
  fieldId: string;
  volumetricWaterContent: number;
  depthFromCm: number;
  depthToCm: number;
  source: 'sensor' | 'laboratory' | 'manual_verified';
  measuredAt?: string;
  notes?: string | null;
};

export type AquaCropManagementInput = {
  fieldId: string;
  mode: 'rainfed' | 'recorded_schedule' | 'manual_schedule' | 'soil_moisture_target';
  settings?: Record<string, unknown>;
  source?: 'user_verified' | 'recorded_operations';
};

async function currentUserId() {
  if (!supabase) throw new Error('AquaCrop girdileri için Supabase bağlantısı hazır değil.');
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('AquaCrop girdileri için oturum gerekli.');
  return data.user.id;
}

function notifyFieldInputChanged(fieldId: string, changedFields: string[]) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('tp:field-context-updated', {
      detail: { fieldId, changedFields },
    }),
  );
}

export async function recordFieldWaterMeasurement(input: FieldWaterMeasurementInput) {
  const fieldId = String(input.fieldId ?? '').trim();
  if (!fieldId) throw new Error('Toprak su ölçümü için tarla kimliği gerekli.');

  const water = Number(input.volumetricWaterContent);
  const from = Number(input.depthFromCm);
  const to = Number(input.depthToCm);
  if (!Number.isFinite(water) || water < 0 || water > 1) {
    throw new Error('Volumetrik toprak su içeriği 0 ile 1 arasında olmalı.');
  }
  if (!Number.isFinite(from) || from < 0 || !Number.isFinite(to) || to <= from || to > 300) {
    throw new Error('Toprak su ölçüm derinliği geçersiz.');
  }

  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('field_water_measurements')
    .insert({
      user_id: userId,
      field_id: fieldId,
      measured_at: input.measuredAt ?? new Date().toISOString(),
      volumetric_water_content: water,
      depth_from_cm: from,
      depth_to_cm: to,
      source: input.source,
      notes: input.notes ?? null,
    })
    .select('id,field_id,measured_at,volumetric_water_content,depth_from_cm,depth_to_cm,source')
    .single();

  if (error) throw error;
  notifyFieldInputChanged(fieldId, ['aquacrop_initial_water_content']);
  return data;
}

export async function saveAquaCropManagement(input: AquaCropManagementInput) {
  const fieldId = String(input.fieldId ?? '').trim();
  if (!fieldId) throw new Error('AquaCrop sulama yönetimi için tarla kimliği gerekli.');

  const userId = await currentUserId();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('field_aquacrop_management')
    .upsert(
      {
        user_id: userId,
        field_id: fieldId,
        mode: input.mode,
        settings: input.settings ?? {},
        source: input.source ?? 'user_verified',
        verified_at: now,
        updated_at: now,
      },
      { onConflict: 'user_id,field_id' },
    )
    .select('id,field_id,mode,settings,source,verified_at,updated_at')
    .single();

  if (error) throw error;
  notifyFieldInputChanged(fieldId, ['aquacrop_irrigation_management']);
  return data;
}
