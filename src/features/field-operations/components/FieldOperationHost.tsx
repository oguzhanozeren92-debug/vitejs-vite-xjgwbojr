import { useEffect, useState } from 'react';

import FieldOperationModal from './FieldOperationModal';
import {
  FIELD_OPERATION_OPEN_EVENT,
  type OpenFieldOperationRequest,
} from '../services/openFieldOperation';
import { normalizeFieldOperationType } from '../types/fieldOperation';

export default function FieldOperationHost() {
  const [request, setRequest] = useState<OpenFieldOperationRequest | null>(null);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenFieldOperationRequest>).detail;
      if (!detail?.fieldId) return;

      setRequest({
        ...detail,
        fieldId: String(detail.fieldId),
        fieldName: String(detail.fieldName ?? '').trim() || 'Tarlan',
        type: normalizeFieldOperationType(detail.type ?? 'Diğer'),
      });
    };

    window.addEventListener(FIELD_OPERATION_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(FIELD_OPERATION_OPEN_EVENT, handleOpen);
  }, []);

  return (
    <FieldOperationModal
      open={Boolean(request)}
      fieldId={request?.fieldId ?? null}
      fieldName={request?.fieldName ?? 'Tarlan'}
      initialType={normalizeFieldOperationType(request?.type ?? 'Diğer')}
      initialDate={request?.date}
      onClose={() => setRequest(null)}
      onSaved={() => setRequest(null)}
    />
  );
}
