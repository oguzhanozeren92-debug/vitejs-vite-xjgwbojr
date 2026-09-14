import { useCallback, useEffect, useState } from 'react';
import {
  completeFieldTask,
  syncFieldTasks,
  type FieldTask,
  type FieldTaskCompletionResult,
} from '../services/fieldTasks.service';

export function useFieldTasks(fieldIdInput: unknown) {
  const fieldId = String(fieldIdInput ?? '').trim();
  const [tasks, setTasks] = useState<FieldTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!fieldId) {
      setTasks([]);
      setError(null);
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const next = await syncFieldTasks(fieldId);
      setTasks(next);
      return next;
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Görevler yüklenemedi.';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [fieldId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!fieldId || typeof window === 'undefined') return;

    const handleContextUpdated = (event: Event) => {
      const detail = (event as CustomEvent)?.detail ?? {};
      if (String(detail?.fieldId ?? '') !== fieldId) return;

      // Save akışına yarış koşulu yaratmamak için veri transaction'ının hemen
      // arkasından değil bir sonraki event-loop turunda senkronla.
      window.setTimeout(() => void refresh(), 0);
    };

    window.addEventListener(
      'tp:field-context-updated',
      handleContextUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        'tp:field-context-updated',
        handleContextUpdated as EventListener,
      );
    };
  }, [fieldId, refresh]);

  const complete = useCallback(
    async (taskId: string): Promise<FieldTaskCompletionResult> => {
      const result = await completeFieldTask(taskId);
      await refresh();
      return result;
    },
    [refresh],
  );

  return {
    tasks,
    activeCount: tasks.length,
    loading,
    error,
    refresh,
    complete,
  };
}
