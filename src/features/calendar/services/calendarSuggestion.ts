export type CalendarSuggestionRequest = {
  fieldId?: string | number | null;
  reminderType?: string | null;
  title?: string | null;
  date?: string | null;
  time?: string | null;
  notes?: string | null;
};

/**
 * Uygulamadaki herhangi bir feature'ın Takvim ekranını ve önceden doldurulmuş
 * hatırlatma formunu açması için tek sözleşme.
 *
 * Puan vermez. Takvime eklemek yalnızca planlama davranışıdır; Pusula puanı
 * ancak ilgili gerçek görev tamamlandığında server-side kuraldan gelebilir.
 */
export function requestCalendarSuggestion(request: CalendarSuggestionRequest) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<CalendarSuggestionRequest>('tp:calendar-add-suggestion', {
      detail: request,
    }),
  );
}
