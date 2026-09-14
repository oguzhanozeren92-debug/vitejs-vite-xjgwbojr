import { supabase } from '../../../supabaseClient';

export type AquaCropPilotRunResponse =
  | {
      ok: true;
      blocked: true;
      engine: 'aquacrop';
      mode: 'pilot';
      fieldId: string;
      productionAuthority: false;
      missingInputs: string[];
      note: string;
      result: null;
    }
  | {
      ok: true;
      blocked: false;
      engine: 'aquacrop';
      mode: 'pilot';
      fieldId: string;
      productionAuthority: false;
      missingInputs: string[];
      note: string;
      result: Record<string, unknown>;
    };

/**
 * Gerçek AquaCrop pilotunu sadece field_id ile başlatır.
 * Tarımsal model girdileri istemciden gönderilmez; Edge Function bunları
 * sunucu tarafında gerçek TarlaPusula kayıtlarından ve gerçek hava/toprak
 * kaynaklarından hazırlar. Sonuç production sulama otoritesi değildir.
 */
export async function runAquaCropPilot(fieldIdInput: string): Promise<AquaCropPilotRunResponse> {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) throw new Error('AquaCrop pilotu için tarla kimliği gerekli.');
  if (!supabase) throw new Error('AquaCrop pilotu için Supabase bağlantısı hazır değil.');

  const { data, error } = await supabase.functions.invoke('aquacrop-pilot-run', {
    body: { field_id: fieldId },
  });

  if (error) {
    throw new Error(error.message || 'AquaCrop pilotu çalıştırılamadı.');
  }
  if (!data || data.ok === false) {
    throw new Error(data?.error || 'AquaCrop pilotu çalıştırılamadı.');
  }
  if (data.production_authority !== false || data.engine !== 'aquacrop' || data.mode !== 'pilot') {
    throw new Error('AquaCrop pilot yanıtı güvenli pilot sözleşmesine uymuyor.');
  }

  const blocked = Boolean(data.blocked);
  return {
    ok: true,
    blocked,
    engine: 'aquacrop',
    mode: 'pilot',
    fieldId: String(data.field_id ?? fieldId),
    productionAuthority: false,
    missingInputs: Array.isArray(data.missing_inputs) ? data.missing_inputs.map(String) : [],
    note: String(data.note ?? ''),
    result:
      !blocked && data.result && typeof data.result === 'object'
        ? (data.result as Record<string, unknown>)
        : null,
  } as AquaCropPilotRunResponse;
}
