import { supabase } from '../../../supabaseClient';
import { refreshGamification } from '../../../gamification/useGamificationStore';

export type FieldTask = {
  id: string;
  fieldId: string;
  taskKey: string;
  title: string;
  description: string | null;
  source: string;
  actionTarget: string | null;
  priority: number;
  rewardRuleKey: string | null;
  rewardPoints: number;
  dueDate: string | null;
};

export type FieldTaskCompletionResult = {
  completed: boolean;
  awarded: boolean;
  awardedPoints: number;
  reason: string;
};

function normalizeTask(row: any): FieldTask {
  const metadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};

  return {
    id: String(row?.id ?? ''),
    fieldId: String(row?.field_id ?? ''),
    taskKey: String(row?.task_key ?? ''),
    title: String(row?.title ?? 'Görev'),
    description: row?.description ? String(row.description) : null,
    source: String(row?.source ?? 'field-readiness'),
    actionTarget: row?.action_target ? String(row.action_target) : null,
    priority: Number.isFinite(Number(row?.priority)) ? Number(row.priority) : 50,
    rewardRuleKey: row?.reward_rule_key ? String(row.reward_rule_key) : null,
    rewardPoints: Math.max(0, Number(metadata?.rewardPoints ?? 0) || 0),
    dueDate: row?.due_date ? String(row.due_date) : null,
  };
}

export async function syncFieldTasks(fieldIdInput: string): Promise<FieldTask[]> {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) return [];

  const { data, error } = await supabase.rpc('tp_sync_field_tasks', {
    p_field_id: fieldId,
  });

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map(normalizeTask)
    .filter((item) => item.id && item.taskKey)
    .sort((a, b) => b.priority - a.priority);
}

export async function completeFieldTask(
  taskIdInput: string,
): Promise<FieldTaskCompletionResult> {
  const taskId = String(taskIdInput ?? '').trim();
  if (!taskId) throw new Error('Görev kimliği bulunamadı.');

  const { data, error } = await supabase.rpc('tp_complete_field_task', {
    p_task_id: taskId,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  const result: FieldTaskCompletionResult = {
    completed: Boolean(row?.completed),
    awarded: Boolean(row?.awarded),
    awardedPoints: Math.max(0, Number(row?.awarded_points ?? 0) || 0),
    reason: String(row?.reason ?? 'unknown'),
  };

  // Server state is authoritative; completion sonrası üst bardaki puanı da yenile.
  try {
    await refreshGamification();
  } catch {
    // Görev server'da tamamlandıysa puan ekranı sonraki normal refresh'te eşitlenir.
  }

  return result;
}

export function taskKeyForQuestionId(questionId: string | null | undefined) {
  const id = String(questionId ?? '');
  if (id.endsWith(':irrigation-status')) return 'irrigation-status';
  if (id.endsWith(':canopy-development')) return 'canopy-development';
  if (id.endsWith(':canopy-height-class')) return 'canopy-height';
  return null;
}
