import { supabase } from '../../../supabaseClient';

export type AquaCropPilotInputsResult = {
  ok: true;
  engine: 'aquacrop';
  mode: 'pilot-input-adapter';
  fieldId: string;
  productionAuthority: false;
  inputAuthority: 'server-derived';
  availableInputs: string[];
  missingInputs: string[];
  adapters: {
    cropParameters: Record<string, unknown>;
    soilProfile: Record<string, unknown>;
    initialWaterContent: Record<string, unknown>;
    irrigationManagement: Record<string, unknown>;
  };
  context: Record<string, unknown>;
  note: string;
};

export async function loadAquaCropPilotInputs(
  fieldIdInput: string,
): Promise<AquaCropPilotInputsResult> {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) throw new Error('AquaCrop pilot girdileri için tarla kimliği gerekli.');
  if (!supabase) throw new Error('AquaCrop pilot girdileri için Supabase bağlantısı hazır değil.');

  const { data, error } = await supabase.functions.invoke('aquacrop-pilot-inputs', {
    body: { field_id: fieldId },
  });

  if (error) {
    throw new Error(error.message || 'AquaCrop pilot girdileri alınamadı.');
  }
  if (!data || data.ok === false) {
    throw new Error(data?.error || 'AquaCrop pilot girdileri hazırlanamadı.');
  }
  if (data.input_authority !== 'server-derived') {
    throw new Error('AquaCrop pilot girdileri sunucu otoritesinden gelmedi.');
  }
  if (data.production_authority !== false) {
    throw new Error('AquaCrop pilot girdileri yanlışlıkla production otoritesi işaretlendi.');
  }

  return {
    ok: true,
    engine: 'aquacrop',
    mode: 'pilot-input-adapter',
    fieldId: String(data.field_id ?? fieldId),
    productionAuthority: false,
    inputAuthority: 'server-derived',
    availableInputs: Array.isArray(data.available_inputs)
      ? data.available_inputs.map(String)
      : [],
    missingInputs: Array.isArray(data.missing_inputs)
      ? data.missing_inputs.map(String)
      : [],
    adapters: {
      cropParameters:
        data?.adapters?.crop_parameters && typeof data.adapters.crop_parameters === 'object'
          ? data.adapters.crop_parameters
          : {},
      soilProfile:
        data?.adapters?.soil_profile && typeof data.adapters.soil_profile === 'object'
          ? data.adapters.soil_profile
          : {},
      initialWaterContent:
        data?.adapters?.initial_water_content && typeof data.adapters.initial_water_content === 'object'
          ? data.adapters.initial_water_content
          : {},
      irrigationManagement:
        data?.adapters?.irrigation_management && typeof data.adapters.irrigation_management === 'object'
          ? data.adapters.irrigation_management
          : {},
    },
    context:
      data?.context && typeof data.context === 'object'
        ? data.context
        : {},
    note: String(data.note ?? ''),
  };
}
