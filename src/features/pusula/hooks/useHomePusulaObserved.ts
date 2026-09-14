import { useEffect, useState } from 'react';
import { useHomePusula as useHomePusulaBase } from './useHomePusulaBase';
import { loadFieldObservationEvidence } from '../../field-observations/services/fieldObservationEvidence.service';
import { applyFieldObservationEvidenceToSynthesis } from '../../field-observations/services/applyFieldObservationEvidence.service';

type Inputs = Parameters<typeof useHomePusulaBase>[0];

export function useHomePusulaObserved(inputs: Inputs) {
  const base = useHomePusulaBase(inputs);
  const fieldId = String(inputs.field?.id ?? '').trim();
  const [observedSynthesis, setObservedSynthesis] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    if (!fieldId || !base.fieldSynthesis) {
      setObservedSynthesis(null);
      return () => {
        cancelled = true;
      };
    }

    void loadFieldObservationEvidence(fieldId)
      .then((evidence) => {
        if (cancelled) return;
        setObservedSynthesis(
          applyFieldObservationEvidenceToSynthesis(base.fieldSynthesis, evidence),
        );
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[Pusula] saha gözlem geçmişi genel senteze eklenemedi:', error);
        setObservedSynthesis(base.fieldSynthesis);
      });

    return () => {
      cancelled = true;
    };
  }, [fieldId, base.fieldSynthesis]);

  const fieldSynthesis = observedSynthesis ?? base.fieldSynthesis;
  const observationRaisedAttention = Boolean(
    base.fieldSynthesis &&
      fieldSynthesis &&
      base.fieldSynthesis.status === 'normal' &&
      fieldSynthesis.status !== 'normal',
  );

  return {
    ...base,
    fieldSynthesis,
    arrivalVisible: base.arrivalVisible || observationRaisedAttention,
  };
}
