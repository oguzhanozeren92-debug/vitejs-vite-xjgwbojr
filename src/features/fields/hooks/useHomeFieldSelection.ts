import { useEffect, useMemo, useState } from 'react';

type HomeFieldSelectionInput = {
  fields?: any[] | null;
  favoriteFieldId?: unknown;
};

export function useHomeFieldSelection({
  fields,
  favoriteFieldId,
}: HomeFieldSelectionInput) {
  const [fieldId, setFieldId] = useState(() =>
    String(favoriteFieldId ?? fields?.[0]?.id ?? ''),
  );

  useEffect(() => {
    if (!fieldId) {
      setFieldId(String(favoriteFieldId ?? fields?.[0]?.id ?? ''));
      return;
    }

    const stillExists = fields?.some(
      (field: any) => String(field?.id) === String(fieldId),
    );

    if (fields?.length && !stillExists) {
      setFieldId(String(favoriteFieldId ?? fields[0]?.id ?? ''));
    }
  }, [fields, favoriteFieldId, fieldId]);

  const field = useMemo(
    () =>
      fields?.find((item: any) => String(item?.id) === String(fieldId)) ??
      fields?.find(
        (item: any) => String(item?.id) === String(favoriteFieldId),
      ) ??
      fields?.[0] ??
      null,
    [fields, fieldId, favoriteFieldId],
  );

  return {
    fieldId,
    setFieldId,
    field,
    fieldKey: String(field?.id ?? ''),
  };
}
