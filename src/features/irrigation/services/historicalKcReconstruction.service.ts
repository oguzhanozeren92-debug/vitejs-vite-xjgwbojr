import { supabase } from '../../../supabaseClient';
import { loadFieldCompletionContext } from '../../fields/services/fieldCompletion.service';
import { buildFieldPhenology } from '../../phenology/services/buildFieldPhenology';
import { loadFieldPhenologyContext } from '../../phenology/services/fieldPhenologyContext.service';
import { resolveCropCoefficient } from './cropCoefficient.service';

const HISTORICAL_SOURCE_LABEL = 'historical_reconstructed:calendar_only';
const SHADOW_LOOKBACK_DAYS = 7;

type SnapshotConfidence = 'low' | 'medium' | 'high';

export type HistoricalKcReconstructionResult = {
  status:
    | 'created'
    | 'existing_verified_snapshot'
    | 'existing_historical_snapshot';
  fieldId: string;
  targetDate: string;
  kc: number;
  cropName: string;
  phenologyStage: string;
  stageLabel: string | null;
  confidence: SnapshotConfidence;
  sourceLabel: string;
  calculatedAt: string;
  evidence: string[];
  warnings: string[];
};

function requireSupabase() {
  if (!supabase) {
    throw new Error('Geçmiş Kc reconstruction için Supabase bağlantısı hazır değil.');
  }
  return supabase;
}

function normalizeIsoDate(value: string) {
  const date = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Geçmiş Kc için tarih YYYY-MM-DD biçiminde olmalı.');
  }

  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('Geçmiş Kc için geçerli bir tarih gerekli.');
  }

  return date;
}

function shiftDate(isoDate: string, days: number) {
  const value = new Date(`${isoDate}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function weakestConfidence(
  a: SnapshotConfidence,
  b: SnapshotConfidence,
): SnapshotConfidence {
  const rank: Record<SnapshotConfidence, number> = {
    low: 0,
    medium: 1,
    high: 2,
  };
  return rank[a] <= rank[b] ? a : b;
}

function mapExistingSnapshot(
  fieldId: string,
  targetDate: string,
  snapshot: any,
  status: HistoricalKcReconstructionResult['status'],
): HistoricalKcReconstructionResult {
  const kc = Number(snapshot?.kc);
  if (!Number.isFinite(kc) || kc <= 0 || kc > 3) {
    throw new Error('Mevcut geçmiş Kc kaydı geçersiz.');
  }

  return {
    status,
    fieldId,
    targetDate,
    kc,
    cropName: String(snapshot?.crop_name ?? ''),
    phenologyStage: String(snapshot?.phenology_stage ?? ''),
    stageLabel: snapshot?.stage_label ? String(snapshot.stage_label) : null,
    confidence:
      snapshot?.coefficient_confidence === 'high' ||
      snapshot?.coefficient_confidence === 'medium'
        ? snapshot.coefficient_confidence
        : 'low',
    sourceLabel: String(snapshot?.source_label ?? ''),
    calculatedAt: String(snapshot?.calculated_at ?? ''),
    evidence: [],
    warnings: [],
  };
}

/**
 * Reconstructs a past single-Kc snapshot only for the current pyfao56 shadow window.
 *
 * Important safeguards:
 * - never writes today/future dates;
 * - never overwrites a real daily Kc snapshot;
 * - uses calendar/field context only, so current/future NDVI or climate signals cannot
 *   leak into a historical reconstruction;
 * - provenance is explicit in source_label;
 * - production Irrigation Engine remains untouched and authoritative.
 */
export async function reconstructHistoricalKcSnapshotForShadow(
  fieldIdInput: string,
  targetDateInput: string,
): Promise<HistoricalKcReconstructionResult> {
  const fieldId = String(fieldIdInput ?? '').trim();
  if (!fieldId) {
    throw new Error('Geçmiş Kc reconstruction için tarla kimliği gerekli.');
  }

  const targetDate = normalizeIsoDate(targetDateInput);
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = shiftDate(today, -SHADOW_LOOKBACK_DAYS);

  if (targetDate >= today) {
    throw new Error('Geçmiş Kc reconstruction yalnız tamamlanmış geçmiş günler için çalışır.');
  }
  if (targetDate < cutoff) {
    throw new Error(
      `Mevcut pyfao56 shadow hattı yalnız son ${SHADOW_LOOKBACK_DAYS} günü okuyor. ` +
        `En eski uygun tarih ${cutoff}.`,
    );
  }

  const client = requireSupabase();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError) throw userError;
  if (!user) {
    throw new Error('Geçmiş Kc reconstruction için oturum gerekli.');
  }

  const { data: existing, error: existingError } = await client
    .from('field_irrigation_kc_snapshots')
    .select(
      'snapshot_date,kc,crop_name,phenology_stage,stage_label,coefficient_confidence,source_label,calculated_at',
    )
    .eq('user_id', user.id)
    .eq('field_id', fieldId)
    .eq('snapshot_date', targetDate)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const sourceLabel = String(existing.source_label ?? '');
    return mapExistingSnapshot(
      fieldId,
      targetDate,
      existing,
      sourceLabel.startsWith('historical_reconstructed:')
        ? 'existing_historical_snapshot'
        : 'existing_verified_snapshot',
    );
  }

  const [completion, phenologyContext] = await Promise.all([
    loadFieldCompletionContext(fieldId),
    loadFieldPhenologyContext({ id: fieldId }),
  ]);

  if (!completion) {
    throw new Error('Tarla bulunamadı veya geçmiş Kc için tarla bağlamı okunamadı.');
  }

  const cropName = phenologyContext.cropName ?? completion.cropName;
  if (!cropName) {
    throw new Error('Geçmiş Kc için ürün adı eksik.');
  }

  const phenology = buildFieldPhenology(
    {
      cropName,
      cropCycle: phenologyContext.cropCycle ?? completion.cropCycle,
      sowingDate: phenologyContext.actualPlantingDate,
      actualHarvestDate: phenologyContext.actualHarvestDate,
    },
    null,
    targetDate,
  );

  if (phenology.dataStatus !== 'usable' || phenology.stage === 'unknown') {
    throw new Error(
      `Geçmiş fenoloji güvenilir biçimde çözülemedi: ${phenology.summary || phenology.stage}.`,
    );
  }

  const kcResult = resolveCropCoefficient({
    cropName,
    stage: phenology.stage,
    stageLabel: phenology.stageLabel,
    bearing: completion.bearing,
    canopyCoverPercent: completion.canopyCoverPercent,
    canopyHeightM: completion.canopyHeightM,
  });

  if (kcResult.status !== 'usable' || kcResult.kc === null) {
    const reason = kcResult.warnings[0] ?? kcResult.caution ?? kcResult.status;
    throw new Error(`Geçmiş Kc üretilemedi: ${reason}`);
  }

  const confidence = weakestConfidence(
    phenology.confidence,
    kcResult.confidence,
  );
  const calculatedAt = new Date().toISOString();

  const { data: inserted, error: insertError } = await client
    .from('field_irrigation_kc_snapshots')
    .insert({
      user_id: user.id,
      field_id: fieldId,
      snapshot_date: targetDate,
      kc: kcResult.kc,
      crop_name: kcResult.cropName ?? cropName,
      phenology_stage: phenology.stage,
      stage_label: phenology.stageLabel,
      coefficient_confidence: confidence,
      source_label: HISTORICAL_SOURCE_LABEL,
      calculated_at: calculatedAt,
    })
    .select(
      'snapshot_date,kc,crop_name,phenology_stage,stage_label,coefficient_confidence,source_label,calculated_at',
    )
    .single();

  if (insertError) throw insertError;

  return {
    ...mapExistingSnapshot(fieldId, targetDate, inserted, 'created'),
    evidence: [
      ...phenology.basis,
      ...kcResult.basis,
      'Historical reconstruction: takvim + gerçek tarla bağlamı; NDVI/iklim sinyali kullanılmadı.',
    ],
    warnings: [
      ...phenology.warnings,
      ...kcResult.warnings,
      'Bu Kc yalnız pyfao56 shadow karşılaştırması içindir; production sulama kararını değiştirmez.',
    ],
  };
}
