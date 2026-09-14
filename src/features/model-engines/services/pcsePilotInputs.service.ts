import { supabase } from '../../../supabaseClient';

export type PcsePilotInputsResult = {
  ok: true;
  engine: 'pcse';
  mode: 'pilot-input-adapter';
  fieldId: string;
  ready: boolean;
  productionAuthority: false;
  inputAuthority: 'server-derived';
  availableInputs: string[];
  missingInputs: string[];
  adapters: Record<string, Record<string, unknown>>;
  context: Record<string, unknown>;
  note: string;
};

export async function loadPcsePilotInputs(fieldIdInput: string): Promise<PcsePilotInputsResult> {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) throw new Error('PCSE pilot girdileri için tarla kimliği gerekli.');
  if (!supabase) throw new Error('PCSE pilot girdileri için Supabase bağlantısı hazır değil.');

  const { data, error } = await supabase.functions.invoke('pcse-pilot-inputs', {
    body: { field_id: fieldId },
  });

  if (error) throw new Error(error.message || 'PCSE pilot girdileri alınamadı.');
  if (!data || data.ok === false) throw new Error(data?.error || 'PCSE pilot girdileri hazırlanamadı.');
  if (data.input_authority !== 'server-derived') {
    throw new Error('PCSE pilot girdileri sunucu otoritesinden gelmedi.');
  }
  if (data.production_authority !== false) {
    throw new Error('PCSE pilot girdileri yanlışlıkla production otoritesi işaretlendi.');
  }

  return {
    ok: true,
    engine: 'pcse',
    mode: 'pilot-input-adapter',
    fieldId: String(data.field_id ?? fieldId),
    ready: Boolean(data.ready),
    productionAuthority: false,
    inputAuthority: 'server-derived',
    availableInputs: Array.isArray(data.available_inputs) ? data.available_inputs.map(String) : [],
    missingInputs: Array.isArray(data.missing_inputs) ? data.missing_inputs.map(String) : [],
    adapters: data?.adapters && typeof data.adapters === 'object' ? data.adapters : {},
    context: data?.context && typeof data.context === 'object' ? data.context : {},
    note: String(data.note ?? ''),
  };
}
