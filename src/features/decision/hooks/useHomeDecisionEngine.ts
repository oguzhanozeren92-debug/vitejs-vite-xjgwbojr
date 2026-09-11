import { useMemo } from 'react';
import { HOME_REFERENCE_ASSETS } from '../../home/homeAssets';
import { useRecentFieldOperations } from '../../field-operations/hooks/useRecentFieldOperations';
import { buildHomeDecisionEvents } from '../services/homeDecisionEngine';
import type {
  HomeDecisionEngineInput,
  HomeDecisionEvent,
  HomeSystemNotification,
  HomeTodayDecision,
  HomeTodayIconKey,
} from '../types/homeDecision';

function todayIconSrc(iconKey: HomeTodayIconKey): string {
  if (iconKey === 'water') return HOME_REFERENCE_ASSETS.iconWater;
  if (iconKey === 'rain') return HOME_REFERENCE_ASSETS.iconRain;
  if (iconKey === 'document') return HOME_REFERENCE_ASSETS.iconDocument;
  if (iconKey === 'leaf-green') return HOME_REFERENCE_ASSETS.iconLeafGreen;
  return HOME_REFERENCE_ASSETS.iconLeafGold;
}

function selectTodayEvents(events: HomeDecisionEvent[]): HomeDecisionEvent[] {
  const todayEvents = events.filter(
    (event) => event.channels.includes('today') && event.today,
  );

  const seenGroups = new Set<string>();
  const selected = todayEvents.filter((event) => {
    if (seenGroups.has(event.group)) return false;
    seenGroups.add(event.group);
    return true;
  });

  return selected.slice(0, 2);
}

function makeAllClearEvent(fieldKey: string): HomeDecisionEvent {
  return {
    id: `status:${fieldKey || 'home'}:all-clear`,
    group: 'status',
    source: 'field',
    priority: 1,
    severity: 'info',
    target: 'home',
    channels: ['today'],
    label: 'BUGÜN',
    title: 'Acil İşlem Görünmüyor',
    detail: 'Yeni veri geldikçe burası otomatik güncellenecek',
    today: {
      tone: 'green',
      visual: 'irrigation',
      iconKey: 'leaf-green',
      iconClass: 'leaf',
    },
  };
}

function toTodayDecision(event: HomeDecisionEvent): HomeTodayDecision | null {
  if (!event.today) return null;

  return {
    id: event.id,
    group: event.group,
    priority: event.priority,
    label: event.label,
    title: event.title,
    detail: event.detail,
    tone: event.today.tone,
    visual: event.today.visual,
    iconSrc: todayIconSrc(event.today.iconKey),
    iconClass: event.today.iconClass,
    target: event.target,
  };
}

function toNotification(event: HomeDecisionEvent): HomeSystemNotification | null {
  if (!event.notification || !event.channels.includes('notification')) return null;

  return {
    id: event.id,
    priority: event.priority,
    severity: event.severity,
    source: event.source,
    title: event.title,
    detail: event.detail,
    iconKey: event.notification.iconKey,
    iconTone: event.notification.iconTone,
    dotTone: event.notification.dotTone,
    target: event.target,
  };
}

/**
 * Home kararlarının tek React giriş noktası.
 *
 * Tarımsal eşikler HomeScreen, Today veya Notifications içine eklenmez.
 * Yeni kararlar homeDecisionEngine.ts içinde oluşur ve buradan dağıtılır.
 */
export function useHomeDecisionEngine(input: HomeDecisionEngineInput) {
  const recentOperations = useRecentFieldOperations(input.homeFieldId, 30);

  const resolvedInput = useMemo<HomeDecisionEngineInput>(
    () => ({
      ...input,
      recentFieldOperations: recentOperations.operations,
    }),
    [input, recentOperations.operations],
  );
  const events = useMemo(
    () => buildHomeDecisionEvents(resolvedInput),
    [
      input.fieldKey,
      input.activeHomeLayer,
      input.weatherStatus,
      input.hasUsableTodayWeather,
      input.quickTemperatureMin,
      input.quickTemperature,
      input.quickWindKmh,
      input.quickRainChance,
      input.quickRainMm,
      input.nextCalendarItem,
      input.fieldSynthesis,
      input.homePusulaResult,
      input.irrigationDecision,
      input.irrigationLoading,
      input.irrigationError,
      input.phenology,
      input.phenologyTimeSeriesStatus,
      input.irrigationQuick?.title,
      input.irrigationQuick?.detail,
      input.irrigationQuick?.tone,
      input.sprayingQuick?.title,
      input.sprayingQuick?.detail,
      input.sprayingQuick?.tone,
      input.resolvedHomeSatelliteDate,
      input.homeFieldId,
      input.homeFieldCrop,
      recentOperations.signature,
    ],
  );

  const todayDecisions = useMemo(() => {
    const selected = selectTodayEvents(events);
    const source = selected.length > 0 ? selected : [makeAllClearEvent(input.fieldKey)];

    return source
      .map(toTodayDecision)
      .filter((item): item is HomeTodayDecision => Boolean(item));
  }, [events, input.fieldKey]);

  const notifications = useMemo(
    () =>
      events
        .map(toNotification)
        .filter((item): item is HomeSystemNotification => Boolean(item))
        .slice(0, 12),
    [events],
  );

  const primaryDecision = useMemo(
    () => events.find((event) => event.channels.includes('today')) ?? events[0] ?? null,
    [events],
  );

  const pusulaDecision = useMemo(
    () => events.find((event) => event.channels.includes('pusula')) ?? null,
    [events],
  );

  return {
    events,
    todayDecisions,
    notifications,
    primaryDecision,
    pusulaDecision,
  };
}
