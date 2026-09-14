import { supabase } from '../../../supabaseClient';

export type ModelEngineRunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'blocked'
  | 'failed';

export type ModelEngineRunRecord = {
  id: string;
  fieldId: string;
  engine: 'pyfao56' | 'pcse' | 'aquacrop';
  mode: 'shadow' | 'pilot' | 'readiness';
  status: ModelEngineRunStatus;
  inputFingerprint: string;
  inputSummary: Record<string, unknown>;
  sourceVersions: Record<string, unknown>;
  missingInputs: string[];
  engineVersion: string | null;
  adapterVersion: number;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRun(row: any): ModelEngineRunRecord {
  return {
    id: String(row.id),
    fieldId: String(row.field_id),
    engine: row.engine,
    mode: row.mode,
    status: row.status,
    inputFingerprint: String(row.input_fingerprint ?? ''),
    inputSummary:
      row.input_summary && typeof row.input_summary === 'object'
        ? row.input_summary
        : {},
    sourceVersions:
      row.source_versions && typeof row.source_versions === 'object'
        ? row.source_versions
        : {},
    missingInputs: Array.isArray(row.missing_inputs)
      ? row.missing_inputs.map(String)
      : [],
    engineVersion: row.engine_version ? String(row.engine_version) : null,
    adapterVersion: Number(row.adapter_version ?? 1),
    output:
      row.output && typeof row.output === 'object'
        ? row.output
        : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/**
 * Kullanıcının kendi tarlasındaki AquaCrop pilot kayıtlarını döndürür.
 * model_engine_runs RLS yalnız kullanıcının kendi kayıtlarını SELECT etmeye izin verir.
 */
export async function listAquaCropPilotRuns(
  fieldIdInput: string,
  limit = 10,
): Promise<ModelEngineRunRecord[]> {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) throw new Error('AquaCrop çalışma geçmişi için tarla kimliği gerekli.');
  if (!supabase) throw new Error('Model çalışma geçmişi için Supabase bağlantısı hazır değil.');

  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const { data, error } = await supabase
    .from('model_engine_runs')
    .select(
      'id,field_id,engine,mode,status,input_fingerprint,input_summary,source_versions,missing_inputs,engine_version,adapter_version,output,error_message,started_at,completed_at,created_at,updated_at',
    )
    .eq('field_id', fieldId)
    .eq('engine', 'aquacrop')
    .eq('mode', 'pilot')
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw error;
  return (data ?? []).map(mapRun);
}

export async function getLatestAquaCropPilotRun(
  fieldIdInput: string,
): Promise<ModelEngineRunRecord | null> {
  const rows = await listAquaCropPilotRuns(fieldIdInput, 1);
  return rows[0] ?? null;
}
