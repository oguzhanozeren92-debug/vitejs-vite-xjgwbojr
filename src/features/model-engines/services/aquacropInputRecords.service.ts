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

export type FieldWaterProfileMeasurementInput = {
  fieldId: string;
  source: 'sensor' | 'laboratory' | 'manual_verified';
  measuredAt?: string;
  notes?: string | null;
  segments: Array<{
    volumetricWaterContent: number;
    depthFromCm: number;
    depthToCm: number;
  }>;
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

function normalizeWaterSegment(input: {
  volumetricWaterContent: number;
  depthFromCm: number;
  depthToCm: number;
}) {
  const water = Number(input.volumetricWaterContent);
  const from = Number(input.depthFromCm);
  const to = Number(input.depthToCm);

  if (!Number.isFinite(water) || water <= 0 || water >= 1) {
    throw new Error('Volumetrik toprak su içeriği 0 ile 1 arasında ve uç değerlerden farklı olmalı.');
  }
  if (!Number.isFinite(from) || from < 0 || !Number.isFinite(to) || to <= from || to > 300) {
    throw new Error('Toprak su ölçüm derinliği geçersiz.');
  }

  return { water, from, to };
}

export async function recordFieldWaterMeasurement(input: FieldWaterMeasurementInput) {
  const fieldId = String(input.fieldId ?? '').trim();
  if (!fieldId) throw new Error('Toprak su ölçümü için tarla kimliği gerekli.');

  const segment = normalizeWaterSegment(input);
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('field_water_measurements')
    .insert({
      user_id: userId,
      field_id: fieldId,
      measured_at: input.measuredAt ?? new Date().toISOString(),
      volumetric_water_content: segment.water,
      depth_from_cm: segment.from,
      depth_to_cm: segment.to,
      source: input.source,
      notes: input.notes ?? null,
    })
    .select('id,field_id,measured_at,volumetric_water_content,depth_from_cm,depth_to_cm,source')
    .single();

  if (error) throw error;
  notifyFieldInputChanged(fieldId, ['aquacrop_initial_water_content']);
  return data;
}

/**
 * Bir sensör/laboratuvar profilinin aynı ölçüm anındaki birden çok derinlik
 * segmentini tek seferde kaydeder. Pilot adapter yalnız gerçek ölçülen
 * segmentlerin 0-200 cm'yi kesintisiz kapsaması halinde initial_water_content
 * girdisini hazır sayar; bu servis boşlukları varsayımla doldurmaz.
 */
export async function recordFieldWaterProfileMeasurements(
  input: FieldWaterProfileMeasurementInput,
) {
  const fieldId = String(input.fieldId ?? '').trim();
  if (!fieldId) throw new Error('Toprak su profili için tarla kimliği gerekli.');
  if (!Array.isArray(input.segments) || input.segments.length === 0 || input.segments.length > 30) {
    throw new Error('Toprak su profili 1 ile 30 ölçüm segmenti içermeli.');
  }

  const normalized = input.segments
    .map(normalizeWaterSegment)
    .sort((a, b) => a.from - b.from || a.to - b.to);

  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index].from < normalized[index - 1].to) {
      throw new Error('Aynı profil içindeki toprak su ölçüm derinlikleri çakışmamalı.');
    }
  }

  const measuredAt = input.measuredAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(measuredAt))) {
    throw new Error('Toprak su profili için geçerli bir ölçüm tarihi gerekli.');
  }

  const userId = await currentUserId();
  const rows = normalized.map((segment) => ({
    user_id: userId,
    field_id: fieldId,
    measured_at: measuredAt,
    volumetric_water_content: segment.water,
    depth_from_cm: segment.from,
    depth_to_cm: segment.to,
    source: input.source,
    notes: input.notes ?? null,
  }));

  const { data, error } = await supabase
    .from('field_water_measurements')
    .insert(rows)
    .select('id,field_id,measured_at,volumetric_water_content,depth_from_cm,depth_to_cm,source');

  if (error) throw error;
  notifyFieldInputChanged(fieldId, ['aquacrop_initial_water_content']);
  return Array.isArray(data) ? data : [];
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
