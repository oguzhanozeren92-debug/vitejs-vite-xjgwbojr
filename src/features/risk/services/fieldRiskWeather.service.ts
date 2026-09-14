import { supabase } from '../../../supabaseClient';
import type { FieldRiskWeatherResult } from '../types/fieldRisk';

export async function loadFieldRiskWeather(
  fieldIdInput: string,
): Promise<FieldRiskWeatherResult> {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) throw new Error('Risk hava verisi için tarla kimliği gerekli.');
  if (!supabase) throw new Error('Risk hava verisi için Supabase bağlantısı hazır değil.');

  const { data, error } = await supabase.functions.invoke('field-risk-weather', {
    body: { field_id: fieldId },
  });

  if (error) throw new Error(error.message || 'Risk hava verisi alınamadı.');
  if (!data || data.ok === false) {
    throw new Error(data?.error || 'Risk hava verisi hazırlanamadı.');
  }

  if (
    data.production_authority !== false ||
    data.input_authority !== 'server-derived' ||
    data.client_supplied_coordinates_accepted !== false
  ) {
    throw new Error('Risk hava verisi güvenlik sınırı doğrulanamadı.');
  }

  return {
    fieldId: String(data.field_id ?? fieldId),
    generatedAt: String(data.generated_at ?? ''),
    productionAuthority: false,
    inputAuthority: 'server-derived',
    clientSuppliedCoordinatesAccepted: false,
    locationSource: String(data.location_source ?? ''),
    days: Array.isArray(data.days)
      ? data.days.map((day: any) => ({
          date: String(day?.date ?? ''),
          temperatureMinC: Number.isFinite(Number(day?.temperature_min_c))
            ? Number(day.temperature_min_c)
            : null,
          temperatureMaxC: Number.isFinite(Number(day?.temperature_max_c))
            ? Number(day.temperature_max_c)
            : null,
          precipitationMm: Number.isFinite(Number(day?.precipitation_mm))
            ? Number(day.precipitation_mm)
            : null,
        }))
      : [],
  };
}
