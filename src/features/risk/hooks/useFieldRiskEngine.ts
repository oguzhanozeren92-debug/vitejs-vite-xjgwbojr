import { useCallback, useEffect, useRef, useState } from 'react';
import { calculateFieldRiskEngine } from '../services/fieldRiskEngine.service';
import type { FieldRiskEngineResult } from '../types/fieldRisk';

type Options = {
  auto?: boolean;
};

export function useFieldRiskEngine(
  field: { id?: unknown } | null | undefined,
  options: Options = {},
) {
  const fieldId = String(field?.id ?? '').trim();
  const [result, setResult] = useState<FieldRiskEngineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const run = useCallback(async () => {
    if (!fieldId) {
      setResult(null);
      setError(null);
      return null;
    }

    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);

    try {
      const next = await calculateFieldRiskEngine({ id: fieldId });
      if (requestId !== requestRef.current) return null;
      setResult(next);
      return next;
    } catch (runError) {
      if (requestId !== requestRef.current) return null;
      setError(
        runError instanceof Error
          ? runError.message
          : 'Tarla risk değerlendirmesi hazırlanamadı.',
      );
      return null;
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [fieldId]);

  useEffect(() => {
    ++requestRef.current;
    setResult(null);
    setError(null);
    setLoading(false);

    if (options.auto === false || !fieldId) return;
    const timer = window.setTimeout(() => void run(), 700);
    return () => window.clearTimeout(timer);
  }, [fieldId, options.auto, run]);

  return { result, loading, error, run };
}
