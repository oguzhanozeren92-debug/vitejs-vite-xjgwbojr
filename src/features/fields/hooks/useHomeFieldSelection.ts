import { useEffect, useMemo, useState } from 'react';

type HomeFieldSelectionInput = {
  fields?: any[] | null;
  favoriteFieldId?: unknown;
};

type PendingNdviDeepLink = {
  fieldId: string;
  requestedAt: number;
};

const NDVI_DEEP_LINK_STORAGE_KEY = 'tp_pending_ndvi_deeplink_v1';

function readNdviDeepLinkFromLocation(): PendingNdviDeepLink | null {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('open') !== 'ndvi') return null;

    const fieldId = String(params.get('fieldId') ?? '').trim();
    if (!fieldId) return null;

    return { fieldId, requestedAt: Date.now() };
  } catch {
    return null;
  }
}

function readPendingNdviDeepLink(): PendingNdviDeepLink | null {
  const fromLocation = readNdviDeepLinkFromLocation();
  if (fromLocation) {
    try {
      window.sessionStorage.setItem(
        NDVI_DEEP_LINK_STORAGE_KEY,
        JSON.stringify(fromLocation),
      );
    } catch {
      // sessionStorage kapalı olsa da URL üzerinden seçim yapılabilir.
    }
    return fromLocation;
  }

  try {
    const raw = window.sessionStorage.getItem(NDVI_DEEP_LINK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingNdviDeepLink;
    if (!parsed?.fieldId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearHandledNdviDeepLink() {
  try {
    window.sessionStorage.removeItem(NDVI_DEEP_LINK_STORAGE_KEY);
  } catch {
    // no-op
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('open');
    url.searchParams.delete('fieldId');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // no-op
  }
}

export function useHomeFieldSelection({
  fields,
  favoriteFieldId,
}: HomeFieldSelectionInput) {
  const pendingNdviDeepLink = readPendingNdviDeepLink();
  const fallbackId = fields?.some((field: any) => String(field?.id) === String(favoriteFieldId))
    ? String(favoriteFieldId)
    : String(fields?.[0]?.id ?? '');
  const [selectedId, setFieldId] = useState(
    () => pendingNdviDeepLink?.fieldId ?? '',
  );

  const fieldId = fields?.some((field: any) => String(field?.id) === selectedId)
    ? selectedId
    : fallbackId;

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

  useEffect(() => {
    const pending = readPendingNdviDeepLink();
    if (!pending?.fieldId || !fields?.length) return;

    const ownedFieldExists = fields.some(
      (item: any) => String(item?.id) === pending.fieldId,
    );
    if (!ownedFieldExists) return;

    setFieldId(pending.fieldId);
    clearHandledNdviDeepLink();

    window.dispatchEvent(
      new CustomEvent('tp:ndvi-deeplink-ready', {
        detail: { fieldId: pending.fieldId },
      }),
    );
  }, [fields]);

  return {
    fieldId,
    setFieldId,
    field,
    fieldKey: String(field?.id ?? ''),
  };
}
