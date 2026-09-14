import { useEffect, useMemo, useState } from 'react';

import FieldOperationModal from './FieldOperationModal';
import FieldOperationInventoryPreselector from './FieldOperationInventoryPreselector';
import {
  FIELD_OPERATION_OPEN_EVENT,
  type OpenFieldOperationRequest,
} from '../services/openFieldOperation';
import {
  clearPendingFieldOperationInventory,
  setPendingFieldOperationInventory,
} from '../services/fieldOperation.service';
import { normalizeFieldOperationType } from '../types/fieldOperation';
import { completeCalendarReminderAfterOperation } from '../../calendar/services/calendarOperationCompletion.service';

export default function FieldOperationHost() {
  const [request, setRequest] = useState<OpenFieldOperationRequest | null>(null);
  const [inventoryStepDone, setInventoryStepDone] = useState(false);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenFieldOperationRequest>).detail;
      if (!detail?.fieldId) return;

      clearPendingFieldOperationInventory();
      setInventoryStepDone(false);
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

  const operationType = normalizeFieldOperationType(request?.type ?? 'Diğer');
  const needsInventoryChoice =
    operationType === 'Gübreleme' || operationType === 'İlaçlama';
  const showInventoryStep = Boolean(request && needsInventoryChoice && !inventoryStepDone);
  const showOperationForm = Boolean(request && (!needsInventoryChoice || inventoryStepDone));

  const inventoryOperationType = useMemo(
    () => (operationType === 'Gübreleme' ? 'Gübreleme' : 'İlaçlama') as 'Gübreleme' | 'İlaçlama',
    [operationType],
  );

  const closeFlow = () => {
    clearPendingFieldOperationInventory();
    setInventoryStepDone(false);
    setRequest(null);
  };

  const finishFlowAfterSave = () => {
    const completion = request?.completion;
    if (completion?.kind === 'calendar-reminder') {
      void completeCalendarReminderAfterOperation(completion.id).catch((error) => {
        console.error('Takvim planı işlem sonrasında tamamlanamadı:', error);
      });
    }
    closeFlow();
  };

  return (
    <>
      <FieldOperationInventoryPreselector
        open={showInventoryStep}
        fieldId={request?.fieldId ?? ''}
        fieldName={request?.fieldName ?? 'Tarlan'}
        operationType={inventoryOperationType}
        onCancel={closeFlow}
        onContinue={(product) => {
          if (request && product) {
            setPendingFieldOperationInventory({
              fieldId: String(request.fieldId),
              type: inventoryOperationType,
              productId: product.id,
            });
          } else {
            clearPendingFieldOperationInventory();
          }
          setInventoryStepDone(true);
        }}
      />

      <FieldOperationModal
        open={showOperationForm}
        fieldId={request?.fieldId ?? null}
        fieldName={request?.fieldName ?? 'Tarlan'}
        initialType={operationType}
        initialDate={request?.date}
        onClose={closeFlow}
        onSaved={finishFlowAfterSave}
      />
    </>
  );
}
