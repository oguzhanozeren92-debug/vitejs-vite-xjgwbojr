export const FIELD_SEASON_OPEN_EVENT = 'tp:open-field-season';

export type OpenFieldSeasonRequest = {
  fieldId: string;
  source?: string;
};

/**
 * Uygulamanın her yerinden mevcut Tarla Detayı sezon formunu açar.
 * Yeni bir ekim/dikim tarihi formu yaratmaz; tek canonical kayıt field_seasons'tır.
 */
export function openFieldSeason(input: OpenFieldSeasonRequest) {
  if (typeof window === 'undefined') return;

  const fieldId = String(input.fieldId ?? '').trim();
  if (!fieldId) return;

  window.dispatchEvent(
    new CustomEvent<OpenFieldSeasonRequest>(FIELD_SEASON_OPEN_EVENT, {
      detail: {
        fieldId,
        source: String(input.source ?? 'unknown'),
      },
    }),
  );
}
