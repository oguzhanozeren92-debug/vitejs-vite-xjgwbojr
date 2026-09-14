import { supabase } from '../../../supabaseClient';

export const CALENDAR_UPDATED_EVENT = 'tp:calendar-updated';

export async function completeCalendarReminderAfterOperation(
  reminderIdInput: string,
): Promise<void> {
  const reminderId = String(reminderIdInput ?? '').trim();
  if (!reminderId) return;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Takvim kaydını tamamlamak için oturum gerekli.');

  const { data, error } = await supabase
    .from('calendar_reminders')
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', reminderId)
    .eq('user_id', authData.user.id)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Takvim kaydı bulunamadı veya erişim yetkin yok.');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CALENDAR_UPDATED_EVENT, {
        detail: { reminderId, source: 'field-operation' },
      }),
    );
  }
}
