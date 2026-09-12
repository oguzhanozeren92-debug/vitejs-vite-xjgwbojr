import { useEffect, useState } from 'react';
import './HomeScreen.css';
import './ClassicPusula.css';
import { onboardingStyles } from '../../styles/onboardingStyles';
import { useGamificationStore } from '../../gamification/useGamificationStore';
import AppDrawer from '../../components/AppDrawer';
import HomeNotificationsCard from '../../features/notifications/components/HomeNotificationsCard';
import { persistHomeNotifications } from '../../features/notifications/services/notificationQueue';
import HomeTodayCard from '../../features/today/components/HomeTodayCard';
import { useHomeFieldSelection } from '../../features/fields/hooks/useHomeFieldSelection';
import HomeFieldsSheet from '../../features/fields/components/HomeFieldsSheet';
import { useHomeWeatherSignals } from '../../features/weather/hooks/useHomeWeatherSignals';
import { useNextCalendarItem } from '../../features/calendar/hooks/useNextCalendarItem';
import { useHomeIrrigationDecision } from '../../features/irrigation/hooks/useHomeIrrigationDecision';
import { useHomePhenologyInsight } from '../../features/phenology/hooks/useHomePhenologyInsight';
import { useHomeNutrientContext } from '../../features/nutrition/hooks/useHomeNutrientContext';
import IrrigationDecisionDetailModal from '../../features/irrigation/components/IrrigationDecisionDetailModal';
import { useHomeDecisionEngine } from '../../features/decision/hooks/useHomeDecisionEngine';
import HomeFieldDataStatus from '../../features/decision/components/HomeFieldDataStatus';
import { buildHomeFieldDataStatuses } from '../../features/decision/services/homeFieldDataStatus.service';
import { useHomeProfile } from '../../features/home/hooks/useHomeProfile';
import { useEnsureHomeSatellite } from '../../features/home-map/hooks/useEnsureHomeSatellite';
import { useHomeSatelliteDate } from '../../features/home-map/hooks/useHomeSatelliteDate';
import HomeMapPusulaStrip from '../../features/pusula/components/HomeMapPusulaStrip';
import { useHomePusula } from '../../features/pusula/hooks/useHomePusula';
import PusulaFieldQuestion from '../../features/pusula/components/PusulaFieldQuestion';
import { usePusulaFieldCompletion } from '../../features/pusula/hooks/usePusulaFieldCompletion';
import NdviObservationFollowUpPrompt from '../../features/field-observations/components/NdviObservationFollowUpPrompt';
import { useNdviObservationFollowUp } from '../../features/field-observations/hooks/useNdviObservationFollowUp';
import HomeMapSection from '../../features/home-map/components/HomeMapSectionMapFirst';
import {
  type HomeClimateDepth,
  type HomeClimateLayer,
  type HomeLayer,
  type HomeSoilDepth,
  type HomeSoilProperty,
} from '../../features/home-map/HomeMapEngine';

type HomeScreenProps = Record<string, any>;


const HOME_NAV_V2 = {
  menu: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/transparent/nav-v2/menu.webp',
  home: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/transparent/nav-v2/home.webp',
  weather: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/transparent/nav-v2/weather.webp',
  ai: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/transparent/nav-v2/pusula-ai.webp',
  calendar: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/transparent/nav-v2/calendar.webp',
  depot: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/transparent/nav-v2/depot.webp',
  fields: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/02-tarlalarim-4.webp',
} as const;

const PREMIUM_ICON_BASE =
  'https://fkrqvwarxzmdrexsxtzw.supabase.co/storage/v1/object/public/ui-icons/premium';

const PREMIUM_ICON_CACHE_TAG = '20260907-set4';

const premiumIconUrl = (fileName: string) =>
  `${PREMIUM_ICON_BASE}/${fileName}?v=${PREMIUM_ICON_CACHE_TAG}`;

const UI_3D_ICONS = {
  home: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/transparent/nav-anasayfa-transparent.webp',
  fields: premiumIconUrl('02-tarlalarim.webp'),
  ai: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/transparent/nav-pusula-ai-transparent.webp',
  calendar: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/transparent/nav-takvim-transparent.webp',
  profile: premiumIconUrl('05-profil.webp'),
  points: premiumIconUrl('pusula-puani-opD.webp'),
  notification: premiumIconUrl('07-bildirim.webp'),
  weather: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/transparent/nav-hava-durumu-transparent.webp',
  menu: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/transparent/menu-transparent.webp',
  location: premiumIconUrl('10-konum.webp'),
  addField: 'https://fkrqvwarxzmdrexsxtzw.supabase.co/storage/v1/object/public/ui-icons/actions/tarla-ekle-pusula-4.webp',
  depot: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/transparent/nav-depom-transparent.webp',
} as const;

const UI_3D_ICON_FALLBACKS: Partial<Record<keyof typeof UI_3D_ICONS, string>> = {
  home: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/transparent/nav-anasayfa-transparent.webp',
  fields: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/02-tarlalarim-4.webp',
  ai: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/transparent/nav-pusula-ai-transparent.webp',
  calendar: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/transparent/nav-takvim-transparent.webp',
  profile: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/05-profil-3.webp',
  points: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/06-puan-odul-2.webp',
  notification: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/07-bildirim-3.webp',
  weather: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/transparent/nav-hava-durumu-transparent.webp',
  menu: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/transparent/menu-transparent.webp',
  location: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/10-konum-2.webp',
  addField: 'https://fkrqvwarxzmdrexsxtzw.supabase.co/storage/v1/object/public/ui-icons/actions/tarla-ekle-pusula-4.webp',
  depot: 'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/transparent/nav-depom-transparent.webp',
};

type Ui3DIconName = keyof typeof UI_3D_ICONS;

function Ui3DIcon({
  name,
  className = '',
}: {
  name: Ui3DIconName;
  className?: string;
}) {
  return (
    <img
      src={UI_3D_ICONS[name]}
      className={`tp-ui3d-icon ${className}`.trim()}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={(event) => {
        const fallback = UI_3D_ICON_FALLBACKS[name];
        const image = event.currentTarget;

        if (fallback && image.dataset.tpFallback !== '1') {
          image.dataset.tpFallback = '1';
          image.src = fallback;
        }
      }}
    />
  );
}


type HomeNavIconName = 'menu' | 'home' | 'weather' | 'ai' | 'calendar' | 'fields';

function HomeNavIcon({
  name,
  className = '',
}: {
  name: HomeNavIconName;
  className?: string;
}) {
  return (
    <img
      src={HOME_NAV_V2[name]}
      className={`tp-nav-v2 ${className}`.trim()}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}


export default function HomeScreen(props: HomeScreenProps) {
  const {
    cmsRuntimeCss,
    realFields,
    favoriteFieldId,
    satelliteByField,
    loadFieldSatellite,
    fieldWeather,
    openAddField,
    openAiAnalysisScreen,
    openCalendarScreen,
    openSoilAnalysisForField,
    setFieldControlFieldId,
    setScreen,
    setSideMenuOpen,
    sideMenuOpen,
  } = props;

  const gamification = useGamificationStore();
  const { profileName, points } = useHomeProfile();
  const [fieldGateNotice, setFieldGateNotice] = useState<{
    nextFieldNumber?: number;
    requiredPoints?: number;
    remainingPoints?: number;
    reason?: string;
  } | null>(null);
  const [irrigationDetailOpen, setIrrigationDetailOpen] = useState(false);
  const [fieldsSheetOpen, setFieldsSheetOpen] = useState(false);
  const [activeHomeLayer, setActiveHomeLayer] =
    useState<HomeLayer>('vegetation');
  const [soilMenuOpen, setSoilMenuOpen] = useState(false);
  const [homeSoilProperty, setHomeSoilProperty] =
    useState<HomeSoilProperty>('phh2o');
  const [homeSoilDepth, setHomeSoilDepth] = useState<HomeSoilDepth>('0-5cm');
  const [climateMenuOpen, setClimateMenuOpen] = useState(false);
  const [homeClimateLayer, setHomeClimateLayer] =
    useState<HomeClimateLayer>('soil-moisture');
  const [homeClimateDepth, setHomeClimateDepth] =
    useState<HomeClimateDepth>('0-7cm');

  const {
    setFieldId: setHomeFieldId,
    field: homeField,
    fieldKey,
  } = useHomeFieldSelection({
    fields: realFields,
    favoriteFieldId,
  });

  const {
    question: pusulaFieldQuestion,
    answerQuestion: answerPusulaFieldQuestion,
  } = usePusulaFieldCompletion({
    field: homeField,
    fields: realFields,
  });

  const homeIrrigation = useHomeIrrigationDecision(homeField);
  const homeNutrient = useHomeNutrientContext(homeField?.id);
  const homePhenology = useHomePhenologyInsight(homeField);
  const decisionPhenology =
    homePhenology.phenologyContextStatus === 'ready' &&
    homePhenology.phenologyContext?.fieldId === fieldKey
      ? homePhenology.phenology
      : null;

  const satState = satelliteByField?.[fieldKey];
  const sat = satState?.data;
  const weather = fieldWeather?.__home__;

  useEnsureHomeSatellite({
    field: homeField,
    fieldKey,
    status: satState?.status,
    loadFieldSatellite,
  });

  const resolvedHomeSatelliteDate = useHomeSatelliteDate({
    fieldKey,
    parcelGeometry: homeField?.parcelGeometry,
    satelliteDate: sat?.latestImageDate,
  });

  const {
    todayWeather,
    headerTemperatureLabel: headerWeatherTemperatureLabel,
    headerCondition: headerWeatherCondition,
    headerLocation: headerWeatherLocation,
    rainChance: quickRainChance,
    rainMm: quickRainMm,
    windKmh: quickWindKmh,
    temperature: quickTemperature,
    temperatureMin: quickTemperatureMin,
    hasUsableTodayWeather,
    irrigationQuick,
    sprayingQuick,
  } = useHomeWeatherSignals({ weather, field: homeField });

  const homePusula = useHomePusula({
    field: homeField,
    fieldKey,
    layer: activeHomeLayer,
    soilProperty: homeSoilProperty,
    soilDepth: homeSoilDepth,
    climateLayer: homeClimateLayer,
    climateDepth: homeClimateDepth,
    weather,
    satellite: sat,
  });

  const {
    loading: homePusulaLoading,
    result: homePusulaResult,
    error: homePusulaError,
    fieldSynthesis,
    setSpatialSummary: setHomeLayerSpatialSummary,
    run: runHomePusula,
    layerLabel: activeHomeLayerLabel,
    headline: displayHeadline,
    summary: displaySummary,
  } = homePusula;

  const {
    followUp: ndviPhotoFollowUp,
    dismiss: dismissNdviPhotoFollowUp,
    consume: consumeNdviPhotoFollowUp,
  } = useNdviObservationFollowUp({
    fieldId: homeField?.id,
    satelliteDate: resolvedHomeSatelliteDate,
    pusulaResult: homePusulaResult,
  });

  // Alt katman veya derinlik değişirken önce önceki seçime ait uzamsal özeti
  // temizle. Böylece yeni veri gelene kadar eski katmanın sayısal özeti yeni
  // katmana taşınmaz.
  const setHomeSoilPropertySafe: typeof setHomeSoilProperty = (nextValue) => {
    setHomeLayerSpatialSummary(null);
    setHomeSoilProperty(nextValue);
  };

  const setHomeSoilDepthSafe: typeof setHomeSoilDepth = (nextValue) => {
    setHomeLayerSpatialSummary(null);
    setHomeSoilDepth(nextValue);
  };

  const setHomeClimateLayerSafe: typeof setHomeClimateLayer = (nextValue) => {
    setHomeLayerSpatialSummary(null);
    setHomeClimateLayer(nextValue);
  };

  const setHomeClimateDepthSafe: typeof setHomeClimateDepth = (nextValue) => {
    setHomeLayerSpatialSummary(null);
    setHomeClimateDepth(nextValue);
  };

  const resolvedPoints =
    gamification.status === 'ready' ? gamification.points : points;

  const headerPointsLabel =
    gamification.status === 'loading' && points == null
      ? '…'
      : `${Number(resolvedPoints ?? 0).toLocaleString('tr-TR')} P`;

  const nextCalendarItem = useNextCalendarItem({
    calendarItems: props.calendarItems,
    calendarEvents: props.calendarEvents,
    upcomingTasks: props.upcomingTasks,
    tasks: props.tasks,
    reminders: props.reminders,
  });

  const {
    todayDecisions: todayDecisionCards,
    notifications: homeSystemNotifications,
  } = useHomeDecisionEngine({
    fieldKey,
    activeHomeLayer,
    weatherStatus: weather?.status,
    hasUsableTodayWeather,
    quickTemperatureMin,
    quickTemperature,
    quickWindKmh,
    quickRainChance,
    quickRainMm,
    nextCalendarItem,
    fieldSynthesis,
    homePusulaResult,
    irrigationDecision: homeIrrigation.decision,
    irrigationLoading: homeIrrigation.loading,
    irrigationError: homeIrrigation.error,
    nutrient: homeNutrient,
    satelliteTrend: homePhenology.ndviTrend && homeField?.id != null
      ? {
          fieldId: fieldKey,
          status: homePhenology.timeSeriesStatus,
          quality: homePhenology.ndviTrend.quality,
          direction: homePhenology.ndviTrend.direction,
          observationCount: homePhenology.timeSeriesObservationCount,
          spanDays: homePhenology.timeSeriesSpanDays,
          latestDate: homePhenology.timeSeriesLatestDate,
        }
      : null,
    phenology: decisionPhenology,
    phenologyTimeSeriesStatus: homePhenology.timeSeriesStatus,
    irrigationQuick,
    sprayingQuick,
    resolvedHomeSatelliteDate,
    homeFieldId: homeField?.id,
    homeFieldCrop: homeField?.crop,
  });

  const homeNotificationPreview = homeSystemNotifications.slice(0, 3);
  const homeNotificationCount = homeSystemNotifications.length;
  const fieldDataStatuses = buildHomeFieldDataStatuses({
    weather: { status: weather?.status, available: hasUsableTodayWeather },
    phenology: {
      status: homePhenology.phenologyContextStatus,
      usable: decisionPhenology?.dataStatus === 'usable' && decisionPhenology.stage !== 'unknown',
      stageLabel: decisionPhenology?.stageLabel,
    },
    satellite: {
      status: homePhenology.timeSeriesStatus,
      quality: homePhenology.ndviTrend?.quality,
      observationCount: homePhenology.timeSeriesObservationCount,
      latestDate: homePhenology.timeSeriesLatestDate,
    },
    soil: {
      status: homeNutrient.status,
      reportDate: homeNutrient.latestAnalysis?.field_id === fieldKey
        ? homeNutrient.latestAnalysis.created_at : null,
    },
    irrigation: { status: homeIrrigation.status, decisionCode: homeIrrigation.decision?.decision },
  });

  /*
   * Pusula logosu normal analiz / karar / bildirim geldiğinde artık
   * aşağı inmez. Sadece kullanıcıdan gerçekten eksik bilgi istenirken
   * soru bileşeni aktif olur ve header logosu o sırada yerini bırakır.
   */
  const pusulaGuideAway = Boolean(pusulaFieldQuestion || ndviPhotoFollowUp);

  const openHomeInsightTarget = (
    target: 'weather' | 'calendar' | 'ai' | 'home' | 'irrigation_detail' | 'soil' | 'map_vegetation',
  ) => {
    if (target === 'map_vegetation') {
      openMapLayer('vegetation');
      window.setTimeout(() => {
        document.querySelector('.tp-map-stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
      return;
    }

    if (target === 'irrigation_detail') {
      if (homeIrrigation.decision) {
        setIrrigationDetailOpen(true);
      } else {
        setScreen?.('weatherHub');
      }
      return;
    }

    if (target === 'soil') {
      if (typeof openSoilAnalysisForField === 'function') {
        openSoilAnalysisForField(homeField);
      } else {
        setScreen?.('soilAnalysisHub');
      }
      return;
    }

    if (target === 'calendar') {
      if (typeof openCalendarScreen === 'function') {
        openCalendarScreen();
      } else {
        setScreen?.('calendar');
      }
      return;
    }

    if (target === 'ai') {
      if (typeof openAiAnalysisScreen === 'function') {
        openAiAnalysisScreen();
      } else {
        setScreen?.('aiAnalysis');
      }
      return;
    }

    if (target === 'weather') {
      setScreen?.('weatherHub');
      return;
    }

    setScreen?.('home');
  };

  useEffect(() => {
    setIrrigationDetailOpen(false);
  }, [fieldKey]);

  useEffect(() => {
    persistHomeNotifications({
      fieldId: fieldKey,
      fieldName: String(homeField?.name ?? 'Tarlan'),
      notifications: homeSystemNotifications,
    });
  }, [fieldKey, homeField?.name, homeSystemNotifications]);


  const openMapLayer = (section: HomeLayer) => {
    setActiveHomeLayer(section);
    setHomeLayerSpatialSummary(null);

    setSoilMenuOpen(section === 'soil');
    setClimateMenuOpen(section === 'climate');
  };

  const goDrawer = (screen: string, label: string) => {
    setSideMenuOpen(false);
    if (label === 'Tarlalarım') {
      setScreen('home');
      window.setTimeout(
        () =>
          document
            .querySelector('.tp-home-field')
            ?.scrollIntoView({ behavior: 'smooth' }),
        80
      );
      return;
    }
    setScreen(screen);
  };

  const handleAddFieldClick = () => {
    try {
      window.sessionStorage.removeItem('tp_field_gate_notice');
    } catch {
      // sessionStorage kullanılamıyorsa normal akış devam eder.
    }

    try {
      if (typeof openAddField === 'function') {
        openAddField();
      } else {
        setScreen?.('addField');
        return;
      }
    } catch (error) {
      console.error('Tarla ekleme ekranı açılamadı:', error);
      setScreen?.('addField');
      return;
    }

    // App.tsx, puan/tarla hakkı yetersiz olduğunda ekranı home'da bırakıp
    // sebebi tp_field_gate_notice içine yazıyor. Bunu görünür bir uyarıya çevir.
    window.setTimeout(() => {
      try {
        const raw = window.sessionStorage.getItem('tp_field_gate_notice');
        if (!raw) return;

        const parsed = JSON.parse(raw);
        setFieldGateNotice({
          nextFieldNumber: Number(parsed?.nextFieldNumber) || undefined,
          requiredPoints: Number(parsed?.requiredPoints) || undefined,
          remainingPoints: Number(parsed?.remainingPoints) || undefined,
          reason: String(parsed?.reason || ''),
        });

        window.sessionStorage.removeItem('tp_field_gate_notice');
      } catch {
        // Geçersiz/geçici storage verisinde uyarı göstermeden devam et.
      }
    }, 0);
  };

  return (
    <>
      <style>{cmsRuntimeCss + onboardingStyles}</style>

      {pusulaFieldQuestion ? (
        <PusulaFieldQuestion
          question={pusulaFieldQuestion}
          onAnswer={answerPusulaFieldQuestion}
        />
      ) : ndviPhotoFollowUp ? (
        <NdviObservationFollowUpPrompt
          point={ndviPhotoFollowUp}
          fieldName={String(homeField?.name ?? 'Tarlan')}
          onLater={() => void dismissNdviPhotoFollowUp()}
          onOpen={() => {
            consumeNdviPhotoFollowUp();
            openMapLayer('vegetation');

            if (typeof window !== 'undefined') {
              window.setTimeout(() => {
                window.dispatchEvent(
                  new CustomEvent('tp:home-map-show-pusula-area', {
                    detail: {
                      fieldId: String(homeField?.id ?? ''),
                      layer: 'vegetation',
                      openPhoto: true,
                      importantArea: {
                        area: ndviPhotoFollowUp.direction,
                        geometry: ndviPhotoFollowUp.areaGeometry,
                      },
                    },
                  }),
                );

                document
                  .querySelector('.tp-map-stage')
                  ?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                  });
              }, 180);
            }
          }}
        />
      ) : null}

      <div className="tp-v1">
        <AppDrawer
          open={sideMenuOpen}
          onClose={() => setSideMenuOpen(false)}
          onNavigate={(target, label) => goDrawer(String(target), label)}
          profileName={profileName}
          points={resolvedPoints}
        />

        <header className="tp-v1-header">
          <button
            className="tp-menu-btn"
            onClick={() => setSideMenuOpen(true)}
            aria-label="Menüyü aç"
          >
            <HomeNavIcon name="menu" className="tp-ui3d-menu" />
          </button>
          <div className="tp-brand-pusula-wrap">
            <button
              type="button"
              className={`tp-brand-pusula-anchor${
                pusulaGuideAway ? ' tp-brand-pusula-away' : ''
              }`}
              aria-label="Pusula"
              title="Pusula"
            >
              <img
                src="https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/compass-body.webp"
                alt="Pusula"
                draggable={false}
              />
              <img
                className="tp-brand-pusula-needle"
                src="https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/compass-needle-centered.webp"
                alt=""
                aria-hidden="true"
                draggable={false}
              />
            </button>
          </div>
          <div className="tp-header-right">
            <button
              type="button"
              className="tp-header-weather"
              onClick={() => setScreen?.('weatherHub')}
              aria-label={`${headerWeatherLocation}, ${headerWeatherTemperatureLabel}, ${headerWeatherCondition}`}
              title="Hava Durumu"
            >
              <Ui3DIcon name="weather" className="tp-ui3d-header-weather" />
              <span className="tp-header-weather-copy">
                <small>{headerWeatherLocation}</small>
                <strong>{headerWeatherTemperatureLabel}</strong>
                <em>{headerWeatherCondition}</em>
              </span>
            </button>

            <button
              type="button"
              className="tp-score"
              aria-label={`Pusula puanı ${headerPointsLabel}`}
              title="Pusula Puanı"
            >
              <span className="tp-score-opd-emblem" aria-hidden="true">
                <Ui3DIcon name="points" className="tp-ui3d-score-opd-source" />
              </span>
              <span className="tp-score-opd-label">PUSULA PUANI</span>
              <span className="tp-score-opd-value">{headerPointsLabel}</span>
              <span className="tp-score-opd-chevron">›</span>
            </button>
          </div>
        </header>

        <main className="tp-main">
          <section
            className="tp-home-top-split"
            aria-label="Bugünün kararları ve bildirimler"
          >
            <HomeTodayCard
              decisions={todayDecisionCards}
              onOpenDecision={openHomeInsightTarget}
            />
            <HomeNotificationsCard
              notifications={homeNotificationPreview}
              notificationCount={homeNotificationCount}
              fieldName={homeField?.name?.trim() || undefined}
              onOpen={() => setScreen('notificationsHub')}
            />
          </section>

          <div className="tp-home-map-pusula-shell">
            <HomeMapSection
              homeField={homeField}
              realFields={realFields}
              setHomeFieldId={setHomeFieldId}
              setFieldControlFieldId={setFieldControlFieldId}
              onAddField={handleAddFieldClick}
              activeHomeLayer={activeHomeLayer}
              openMapLayer={openMapLayer}
              soilMenuOpen={soilMenuOpen}
              setSoilMenuOpen={setSoilMenuOpen}
              homeSoilProperty={homeSoilProperty}
              setHomeSoilProperty={setHomeSoilPropertySafe}
              homeSoilDepth={homeSoilDepth}
              setHomeSoilDepth={setHomeSoilDepthSafe}
              climateMenuOpen={climateMenuOpen}
              setClimateMenuOpen={setClimateMenuOpen}
              homeClimateLayer={homeClimateLayer}
              setHomeClimateLayer={setHomeClimateLayerSafe}
              homeClimateDepth={homeClimateDepth}
              setHomeClimateDepth={setHomeClimateDepthSafe}
              satelliteData={sat}
              satelliteStatus={satState?.status}
              satelliteMessage={satState?.message}
              onRetrySatellite={() => {
                if (homeField && typeof loadFieldSatellite === 'function') {
                  void loadFieldSatellite(homeField, true);
                }
              }}
              resolvedSatelliteDate={resolvedHomeSatelliteDate}
              onSpatialSummary={setHomeLayerSpatialSummary}
            />

            <HomeMapPusulaStrip
              fieldName={String(homeField?.name ?? 'Tarlan')}
              layerLabel={activeHomeLayerLabel}
              loading={homePusulaLoading}
              headline={displayHeadline}
              summary={displaySummary}
              result={homePusulaResult}
              synthesis={fieldSynthesis}
              error={homePusulaError}
              onOpenLayer={(layer) => {
                openMapLayer(layer as HomeLayer);

                if (typeof window !== 'undefined') {
                  window.setTimeout(() => {
                    document
                      .querySelector('.tp-map-stage')
                      ?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                  }, 40);
                }
              }}
              onShowOnMap={() => {
                openMapLayer(activeHomeLayer);

                if (typeof window !== 'undefined') {
                  window.dispatchEvent(
                    new CustomEvent('tp:home-map-show-pusula-area', {
                      detail: {
                        fieldId: String(homeField?.id ?? ''),
                        layer: activeHomeLayer,
                        importantArea:
                          homePusulaResult?.analysis?.importantArea ?? null,
                        spatial:
                          activeHomeLayer === 'vegetation'
                            ? homePusulaResult?.context?.ndvi?.spatial ?? null
                            : activeHomeLayer === 'radar-vv' ||
                                activeHomeLayer === 'radar-vh' ||
                                activeHomeLayer === 'radar-water'
                              ? homePusulaResult?.context?.radar?.spatial ?? null
                              : null,
                      },
                    }),
                  );

                  window.setTimeout(() => {
                    document
                      .querySelector('.tp-map-stage')
                      ?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                  }, 40);
                }
              }}
            />
            <HomeFieldDataStatus
              fieldName={homeField?.demo || String(homeField?.id ?? '').startsWith('demo') ? null : homeField?.name}
              items={fieldDataStatuses}
            />
          </div>

          <section className="tp-today">
            <div className="tp-mini">
              <Ui3DIcon name="weather" className="tp-ui3d-weather-today" />
              <small>Bugün</small>
              <strong>
                {todayWeather?.temperatureMax != null
                  ? `${Math.round(todayWeather.temperatureMax)}°C`
                  : 'Hava'}
              </strong>
              <small>
                <Ui3DIcon name="location" className="tp-ui3d-location-today" />
                {weather?.locationLabel || 'Aktif tarla'}
              </small>
            </div>
            <div className="tp-mini">
              <small>Sonraki adım</small>
              <strong>Takvimi kontrol et</strong>
              <small>Görev ve destek tarihlerini kaçırma.</small>
            </div>
          </section>

          {!realFields?.length && (
            <button
              style={{
                width: '100%',
                marginTop: 14,
                minHeight: 50,
                borderRadius: 16,
                border: '1px solid rgba(211,181,116,.34)',
                background: '#0d130f',
                color: '#f1e6d2',
                fontWeight: 800,
              }}
              onClick={handleAddFieldClick}
            >
              + İlk Tarlamı Ekle
            </button>
          )}
        </main>

        {fieldGateNotice && (
          <div
            className="tp-field-gate-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setFieldGateNotice(null);
              }
            }}
          >
            <section
              className="tp-field-gate-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="tp-field-gate-title"
            >
              <small>TARLA HAKKI</small>
              <h3 id="tp-field-gate-title">
                {fieldGateNotice.reason === 'configured_limit'
                  ? 'Tarla Limitine Ulaştın'
                  : `${fieldGateNotice.nextFieldNumber ?? 'Yeni'}. Tarla Henüz Kilitli`}
              </h3>

              <p>
                {fieldGateNotice.reason === 'configured_limit'
                  ? 'Şimdilik hesabında tanımlı en yüksek tarla sayısına ulaştın.'
                  : `Yeni tarla eklemek için toplam ${Number(
                      fieldGateNotice.requiredPoints ?? 0
                    ).toLocaleString('tr-TR')} P gerekiyor.`}
              </p>

              {fieldGateNotice.reason !== 'configured_limit' && (
                <div className="tp-field-gate-progress">
                  <span>Kalan Puan</span>
                  <strong>
                    {Number(
                      fieldGateNotice.remainingPoints ?? 0
                    ).toLocaleString('tr-TR')} P
                  </strong>
                </div>
              )}

              <div className="tp-field-gate-actions">
                <button
                  type="button"
                  className="tp-field-gate-close"
                  onClick={() => setFieldGateNotice(null)}
                >
                  Kapat
                </button>
                <button
                  type="button"
                  className="tp-field-gate-points"
                  onClick={() => {
                    setFieldGateNotice(null);
                    setScreen?.('pointsHub');
                  }}
                >
                  Puanlarımı Gör
                </button>
              </div>
            </section>
          </div>
        )}

        <IrrigationDecisionDetailModal
          open={irrigationDetailOpen}
          decision={homeIrrigation.decision}
          fallbackFieldName={String(homeField?.name ?? 'Tarlan')}
          onClose={() => setIrrigationDetailOpen(false)}
          onOpenWeather={() => {
            setIrrigationDetailOpen(false);
            setScreen?.('weatherHub');
          }}
        />

        <HomeFieldsSheet
          open={fieldsSheetOpen}
          fields={realFields ?? []}
          selectedId={fieldKey}
          onClose={() => setFieldsSheetOpen(false)}
          onSelect={(id) => {
            setHomeFieldId(id);
            setFieldControlFieldId?.(id);
            setFieldsSheetOpen(false);
            window.setTimeout(() => document.querySelector('.tp-home-field')?.scrollIntoView({ behavior: 'smooth' }), 80);
          }}
          onAdd={() => {
            setFieldsSheetOpen(false);
            handleAddFieldClick();
          }}
        />

        <nav className="tp-bottom" aria-label="Ana menü">
          <button className="active" type="button">
            <span className="tp-bottom-icon-shell">
              <HomeNavIcon name="home" className="tp-ui3d-bottom" />
            </span>
            Ana Sayfa
          </button>

          <button
            type="button"
            onClick={() => setScreen('weatherHub')}
            aria-label="Hava Durumu"
          >
            <span className="tp-bottom-icon-shell">
              <HomeNavIcon name="weather" className="tp-ui3d-bottom" />
            </span>
            Hava Durumu
          </button>

          <button className="ai" type="button" onClick={openAiAnalysisScreen}>
            <span className="tp-bottom-ai-shell">
              <HomeNavIcon name="ai" className="tp-ui3d-bottom-ai" />
            </span>
            Pusula AI
          </button>

          <button type="button" onClick={openCalendarScreen}>
            <span className="tp-bottom-icon-shell">
              <HomeNavIcon name="calendar" className="tp-ui3d-bottom" />
            </span>
            Takvim
          </button>

          <button type="button" onClick={() => setFieldsSheetOpen(true)} aria-label="Tarlalarım listesini aç">
            <span className="tp-bottom-icon-shell">
              <HomeNavIcon name="fields" className="tp-ui3d-bottom" />
            </span>
            Tarlalarım
          </button>
        </nav>
      </div>
    </>
  );
}
