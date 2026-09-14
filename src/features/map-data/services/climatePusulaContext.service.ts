import { interpretUnifiedMap, type UnifiedMapAiResult, type UnifiedMapActiveLayer } from '../../../services/unifiedMapAiService';
import { loadChirpsRain } from './chirpsRain.service';
import { loadFieldClimateLayers, type FieldClimateLayerKey } from './fieldClimateLayers.service';
import type { ClimateHistoryMode } from '../hooks/useClimateLayerHistory';

export type ClimatePusulaStatus = 'ready' | 'blocked';

export type ClimatePusulaContext = {
  status: ClimatePusulaStatus;
  mode: ClimateHistoryMode;
  activeLayer: UnifiedMapActiveLayer;
  activeLayerLabel: string;
  productionAuthority: false;
  dataAuthority: 'server-derived';
  context: Record<string, unknown> | null;
  blockedReason: string | null;
};

type InterpretOptions = {
  fieldId: string;
  fieldName?: string;
  crop?: string;
  mode: ClimateHistoryMode;
  periodDays?: number;
  endDate?: string;
};

const MODE_META: Record<ClimateHistoryMode, { layer: UnifiedMapActiveLayer; label: string }> = {
  et0: { layer: 'water-demand', label: 'Referans Evapotranspirasyon (ET₀)' },
  chirps: { layer: 'rain-history', label: 'CHIRPS Yağış Geçmişi' },
  frost: { layer: 'frost-risk', label: 'Don Riski' },
  modis_lst: { layer: 'surface-temperature', label: 'MODIS Yüzey Sıcaklığı (LST)' },
};

function safeDays(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.min(31, Math.round(number))) : 7;
}

function lastAvailableDay(days: Array<{ date: string; value: number | null; unit: string; quality: string; metadata?: Record<string, unknown> }>) {
  return [...days].reverse().find((day) => day.value !== null) ?? null;
}

export async function buildClimatePusulaContext(options: InterpretOptions): Promise<ClimatePusulaContext> {
  const fieldId = String(options.fieldId ?? '').trim();
  if (!fieldId) throw new Error('Pusula iklim yorumu için tarla kimliği gerekli.');

  const meta = MODE_META[options.mode];
  const days = safeDays(options.periodDays);

  if (options.mode === 'modis_lst') {
    return {
      status: 'blocked',
      mode: options.mode,
      activeLayer: meta.layer,
      activeLayerLabel: meta.label,
      productionAuthority: false,
      dataAuthority: 'server-derived',
      context: null,
      blockedReason:
        'MODIS GIBS LST katmanı gerçek tarihli rasterdır ancak tile görüntüsünden güvenilir sayısal tarla sıcaklığı çıkarılmıyor. Pusula, doğrulanmış MODIS sayısal/visual adapter hazır olmadan LST değeri uydurmaz.',
    };
  }

  if (options.mode === 'chirps') {
    const response = await loadChirpsRain(fieldId, {
      days,
      ...(options.endDate ? { endDate: options.endDate } : {}),
    });

    if (!response.available || !response.stats?.validDayCount) {
      return {
        status: 'blocked',
        mode: options.mode,
        activeLayer: meta.layer,
        activeLayerLabel: meta.label,
        productionAuthority: false,
        dataAuthority: 'server-derived',
        context: null,
        blockedReason: response.pending
          ? 'CHIRPS sağlayıcı işi henüz tamamlanmadı.'
          : response.unavailableReason || 'Bu dönem için doğrulanmış CHIRPS yağış verisi bulunamadı.',
      };
    }

    return {
      status: 'ready',
      mode: options.mode,
      activeLayer: meta.layer,
      activeLayerLabel: meta.label,
      productionAuthority: false,
      dataAuthority: 'server-derived',
      context: {
        source: response.source,
        provider: response.provider,
        dataset: response.dataset,
        spatialScope: response.spatialScope,
        spatialResolutionDegrees: response.spatialResolutionDegrees,
        aggregation: response.aggregation,
        period: response.period,
        totalMm: response.stats.totalMm,
        averageMm: response.stats.averageMm,
        validDayCount: response.stats.validDayCount,
        daily: response.daily.filter((day) => day.value !== null),
        note: response.note,
      },
      blockedReason: null,
    };
  }

  const layerKey: FieldClimateLayerKey = options.mode === 'et0' ? 'et0' : 'frost';
  const response = await loadFieldClimateLayers(fieldId, {
    days,
    ...(options.endDate ? { endDate: options.endDate } : {}),
    layers: [layerKey],
  });
  const layer = response.layers[layerKey];
  const availableDays = layer?.days?.filter((day) => day.value !== null) ?? [];
  const latest = lastAvailableDay(availableDays);

  if (!layer?.available || !latest) {
    return {
      status: 'blocked',
      mode: options.mode,
      activeLayer: meta.layer,
      activeLayerLabel: meta.label,
      productionAuthority: false,
      dataAuthority: 'server-derived',
      context: null,
      blockedReason: `Bu dönem için doğrulanmış ${meta.label} verisi bulunamadı.`,
    };
  }

  return {
    status: 'ready',
    mode: options.mode,
    activeLayer: meta.layer,
    activeLayerLabel: meta.label,
    productionAuthority: false,
    dataAuthority: 'server-derived',
    context: {
      source: layer.source,
      provider: layer.provider,
      sourceKind: layer.source_kind,
      metric: layer.metric,
      unit: layer.unit,
      spatialScope: response.spatialScope,
      locationSource: response.locationSource,
      period: response.period,
      latest,
      daily: availableDays,
      interpretationBoundary:
        options.mode === 'et0'
          ? 'ET₀ referans evapotranspirasyondur; gerçek ürün ET, sulama miktarı veya sulama emri değildir.'
          : 'Don riski reanalysis günlük minimum 2 m hava sıcaklığına dayanır; tarla içi sensör ölçümü değildir.',
    },
    blockedReason: null,
  };
}

export async function interpretClimateLayerWithPusula(options: InterpretOptions): Promise<{
  context: ClimatePusulaContext;
  analysis: UnifiedMapAiResult | null;
}> {
  const context = await buildClimatePusulaContext(options);
  if (context.status !== 'ready' || !context.context) {
    return { context, analysis: null };
  }

  const analysis = await interpretUnifiedMap({
    fieldId: options.fieldId,
    fieldName: options.fieldName,
    crop: options.crop,
    periodDays: safeDays(options.periodDays),
    activeLayer: context.activeLayer,
    activeLayerLabel: context.activeLayerLabel,
    activeLayerContext: context.context,
    context: {
      climate: context.context,
    },
  });

  return { context, analysis };
}
