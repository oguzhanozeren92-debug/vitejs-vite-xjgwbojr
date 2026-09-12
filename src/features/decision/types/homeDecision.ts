import type { IrrigationDecisionResult } from '../../irrigation/types/irrigationDecision';
import type { PhenologyResult } from '../../phenology/types/phenology';
import type { FieldOperation } from '../../field-operations/types/fieldOperation';
import type { HomeNutrientSignal } from '../../nutrition/services/buildNutrientDecision';
import type { HomeSatelliteTrendSignal } from '../../satellite/services/buildHomeSatelliteDecision';

export type HomeDecisionTarget = 'home' | 'weather' | 'spray_weather' | 'calendar' | 'ai' | 'irrigation_detail' | 'soil' | 'map_vegetation';
export type HomeDecisionSource =
  | 'field' | 'weather' | 'calendar' | 'satellite' | 'pusula'
  | 'irrigation' | 'phenology' | 'operation' | 'nutrition';
export type HomeTodayIconKey = 'water' | 'rain' | 'document' | 'leaf-green' | 'leaf-gold';
export type HomePhenologySignal = Pick<PhenologyResult, 'stage' | 'stageLabel' | 'dataStatus' | 'warnings'>;
export type HomeIrrigationDecisionSignal = IrrigationDecisionResult;
export type HomeFieldOperationSignal = FieldOperation;
export type HomeQuickDecision = { title?: string; detail?: string; tone?: string };

export type HomeDecisionEvent = {
  id: string;
  group: string;
  source: HomeDecisionSource;
  priority: number;
  severity: 'info' | 'warning' | 'danger';
  target: HomeDecisionTarget;
  channels: Array<'today' | 'notification' | 'pusula'>;
  label: string;
  title: string;
  detail: string;
  evidence?: string[];
  today?: { tone: string; visual: 'irrigation' | 'spraying'; iconKey: HomeTodayIconKey; iconClass: 'leaf' | 'water' };
  notification?: { iconKey: 'leaf' | 'rain' | 'document'; iconTone: 'green' | 'cyan' | 'gold'; dotTone: 'info' | 'warning' | 'danger' };
};

export type HomeTodayDecision = {
  id: string;
  group: string;
  priority: number;
  label: string;
  title: string;
  detail: string;
  tone: string;
  visual: 'irrigation' | 'spraying';
  iconSrc: string;
  iconClass: 'leaf' | 'water';
  target: HomeDecisionTarget;
};

export type HomeSystemNotification = {
  id: string;
  priority: number;
  severity: 'info' | 'warning' | 'danger';
  source: HomeDecisionSource;
  title: string;
  detail: string;
  iconKey: 'leaf' | 'rain' | 'document';
  iconTone: 'green' | 'cyan' | 'gold';
  dotTone: 'info' | 'warning' | 'danger';
  target: HomeDecisionTarget;
};

export type HomeDecisionEngineInput = {
  fieldKey: string;
  now?: Date;
  activeHomeLayer?: string;
  weatherStatus?: string | null;
  hasUsableTodayWeather?: boolean;
  quickTemperatureMin?: number | null;
  quickTemperature?: number | null;
  quickWindKmh?: number | null;
  quickRainChance?: number | null;
  quickRainMm?: number | null;
  nextCalendarItem?: any | null;
  fieldSynthesis?: any;
  homePusulaResult?: any;
  irrigationDecision?: HomeIrrigationDecisionSignal | null;
  irrigationLoading?: boolean;
  irrigationError?: string | null;
  nutrient?: HomeNutrientSignal | null;
  satelliteTrend?: HomeSatelliteTrendSignal | null;
  phenology?: HomePhenologySignal | null;
  phenologyTimeSeriesStatus?: 'idle' | 'loading' | 'ready' | 'error';
  irrigationQuick?: HomeQuickDecision | null;
  sprayingQuick?: HomeQuickDecision | null;
  hourlySprayWindow?: boolean;
  hourlySprayNextWindow?: { from: number; to: number; label: string } | null;
  hourlySprayForecastReady?: boolean;
  hourlySprayRisk?: { at: number; detail: string } | null;
  resolvedHomeSatelliteDate?: string;
  homeFieldId?: string | number | null;
  homeFieldCrop?: string | null;
  recentFieldOperations?: HomeFieldOperationSignal[];
};
