import { calculateFieldRiskEngine } from './fieldRiskEngine.service';
import type { FieldRiskEngineResult, FieldRiskItem } from '../types/fieldRisk';

export type FieldRiskPusulaContext = {
  fieldId: string;
  generatedAt: string;
  productionAuthority: false;
  highestRisk: null | {
    key: FieldRiskItem['key'];
    label: string;
    level: FieldRiskItem['level'];
    headline: string;
    summary: string;
    action: string;
    evidence: FieldRiskItem['evidence'];
  };
  assessedRisks: Array<{
    key: FieldRiskItem['key'];
    label: string;
    level: FieldRiskItem['level'];
    headline: string;
  }>;
  unavailableRiskKeys: FieldRiskEngineResult['unavailableRiskKeys'];
  caution: string;
};

/**
 * Pusula'ya yalnız risk motorunun gerçek/grounded çıktısını taşır.
 * Yeni teşhis veya skor üretmez.
 */
export async function loadFieldRiskPusulaContext(
  field: { id?: unknown } | null | undefined,
): Promise<FieldRiskPusulaContext> {
  const result = await calculateFieldRiskEngine(field);

  return {
    fieldId: result.fieldId,
    generatedAt: result.generatedAt,
    productionAuthority: false,
    highestRisk: result.highestRisk
      ? {
          key: result.highestRisk.key,
          label: result.highestRisk.label,
          level: result.highestRisk.level,
          headline: result.highestRisk.headline,
          summary: result.highestRisk.summary,
          action: result.highestRisk.action,
          evidence: result.highestRisk.evidence,
        }
      : null,
    assessedRisks: result.risks
      .filter((item) => item.assessed)
      .map((item) => ({
        key: item.key,
        label: item.label,
        level: item.level,
        headline: item.headline,
      })),
    unavailableRiskKeys: result.unavailableRiskKeys,
    caution:
      'Bu bağlam erken uyarı içindir. Eksik bilimsel eşikler için sonuç üretilmez; saha doğrulaması ve mevcut üretim karar motorları önceliklidir.',
  };
}
