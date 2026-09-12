import { useEffect, useState } from 'react';
import { listSoilAnalyses, type SoilAnalysisRecord } from '../../../lib/soilAnalysisService';

type NutrientContextState = {
  fieldId: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  latestAnalysis: SoilAnalysisRecord | null;
};

const EMPTY: NutrientContextState = { fieldId: '', status: 'idle', latestAnalysis: null };

export function useHomeNutrientContext(fieldIdInput: string | number | null | undefined) {
  const fieldId = fieldIdInput == null ? '' : String(fieldIdInput).trim();
  const [state, setState] = useState<NutrientContextState>(EMPTY);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!fieldId) return;
    const onContextChange = (event: Event) => {
      const detail = (event as CustomEvent<{ fieldId?: string; changedFields?: string[] }>).detail;
      if (String(detail?.fieldId ?? '') === fieldId && detail?.changedFields?.includes('soil_analysis')) {
        setRevision((current) => current + 1);
      }
    };
    window.addEventListener('tp:field-context-updated', onContextChange);
    return () => window.removeEventListener('tp:field-context-updated', onContextChange);
  }, [fieldId]);

  useEffect(() => {
    if (!fieldId || fieldId.startsWith('demo')) return;
    let cancelled = false;
    setState({ fieldId, status: 'loading', latestAnalysis: null });
    void listSoilAnalyses(fieldId)
      .then((analyses) => {
        if (!cancelled) setState({ fieldId, status: 'ready', latestAnalysis: analyses[0] ?? null });
      })
      .catch((error) => {
        console.warn('[TarlaPusula] Besin bağlamı için toprak analizi okunamadı:', error);
        if (!cancelled) setState({ fieldId, status: 'error', latestAnalysis: null });
      });
    return () => { cancelled = true; };
  }, [fieldId, revision]);

  return state.fieldId === fieldId && !fieldId.startsWith('demo')
    ? state
    : { ...EMPTY, fieldId };
}
