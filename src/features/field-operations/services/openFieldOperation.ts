import {
  normalizeFieldOperationType,
  type FieldOperationType,
} from '../types/fieldOperation';

export const FIELD_OPERATION_OPEN_EVENT = 'tp:open-field-operation';

export type FieldOperationCompletionLink =
  | {
      kind: 'calendar-reminder';
      id: string;
    }
  | null;

export type OpenFieldOperationRequest = {
  fieldId: string;
  fieldName: string;
  type?: FieldOperationType | string;
  date?: string;
  source?: string;
  completion?: FieldOperationCompletionLink;
};

/**
 * Uygulamanın her yerinden tarla işlemi için TEK formu açar.
 * Menü/ekran yalnızca niyet gönderir; kayıt mantığını kendisi çalıştırmaz.
 */
export function openFieldOperation(input: OpenFieldOperationRequest) {
  if (typeof window === 'undefined') return;

  const fieldId = String(input.fieldId ?? '').trim();
  if (!fieldId) return;

  window.dispatchEvent(
    new CustomEvent<OpenFieldOperationRequest>(FIELD_OPERATION_OPEN_EVENT, {
      detail: {
        fieldId,
        fieldName: String(input.fieldName ?? '').trim() || 'Tarlan',
        type: normalizeFieldOperationType(input.type ?? 'Diğer'),
        date: input.date,
        source: String(input.source ?? 'unknown'),
        completion:
          input.completion?.kind === 'calendar-reminder' && input.completion.id
            ? { kind: 'calendar-reminder', id: String(input.completion.id) }
            : null,
      },
    }),
  );
}
