import {
  synthesizeFieldObservations as synthesizeBaseFieldObservations,
  type FieldSynthesisInput,
  type FieldSynthesisResult,
} from '../../../services/unifiedMapAiService';
import { loadFieldObservationEvidence } from '../../field-observations/services/fieldObservationEvidence.service';
import { applyFieldObservationEvidenceToSynthesis } from '../../field-observations/services/applyFieldObservationEvidence.service';

/**
 * Home Pusula'nın genel tarla sentezini, yalnızca kullanıcının kaydettiği gerçek
 * saha gözlem geçmişi ile zenginleştirir. Gözlem geçmişi yardımcı kanıttır;
 * temel sentez veya üretim otoritesi değildir.
 */
export async function synthesizeFieldObservations(
  input: FieldSynthesisInput,
): Promise<FieldSynthesisResult> {
  const [baseSynthesis, observationEvidence] = await Promise.all([
    synthesizeBaseFieldObservations(input),
    loadFieldObservationEvidence(input.fieldId).catch((error) => {
      console.warn('[Pusula] saha gözlem geçmişi alınamadı:', error);
      return null;
    }),
  ]);

  return applyFieldObservationEvidenceToSynthesis(
    baseSynthesis,
    observationEvidence,
  );
}
