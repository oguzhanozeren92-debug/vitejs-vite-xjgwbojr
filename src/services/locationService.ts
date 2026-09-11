import { supabase } from '../supabaseClient';
import type { LocationOption } from '../types';
import { sortTurkishLocationOptions } from '../utils/locationUtils';

const normalizeOptions = (data: Array<{ id: unknown; name: unknown }> | null) =>
  sortTurkishLocationOptions(
    (data ?? [])
      .map((item) => ({
        id: Number(item.id),
        name: String(item.name ?? '').trim(),
      }))
      .filter((item) => item.name),
  );

export async function fetchProvinceOptions(): Promise<LocationOption[]> {
  if (!supabase) throw new Error('Supabase bağlantısı hazır değil.');

  const { data, error } = await supabase
    .from('tr_provinces')
    .select('id, name');

  if (error) throw error;
  return normalizeOptions(data);
}

export async function fetchDistrictOptions(
  provinceId: number,
): Promise<LocationOption[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('tr_districts')
    .select('id, name')
    .eq('province_id', provinceId);

  if (error) throw error;
  return normalizeOptions(data);
}

export async function fetchVillageOptions(
  districtId: number,
): Promise<LocationOption[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('tr_villages')
    .select('id, name')
    .eq('district_id', districtId);

  if (error) throw error;
  return normalizeOptions(data);
}
