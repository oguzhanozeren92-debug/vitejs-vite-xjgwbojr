import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { fetchNasaPowerData } from '../../../services/nasaPowerService';
import {
  geocodeFieldLocation,
  resolveHomeWeatherLocation,
} from '../../../services/weatherService';
import type {
  Field,
  FieldWeatherState,
} from '../../../types';
import { fetchHourlySprayForecast, type HourlySprayState } from '../services/hourlySprayForecast';
import { fetchWeatherCompareSnapshot } from '../services/weatherCompare.service';
import {
  combineFusionConfidence,
  fuseHistoricalPrecipitation,
  fuseHistoricalTemperature,
  type FusedClimateMetric,
} from '../services/multiSourceClimateFusion';

export type NasaPowerCardState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  fieldId?: string;
  fieldName?: string;
  data?: Awaited<ReturnType<typeof fetchNasaPowerData>>;
  message?: string;
};

export type Era5ClimateResponse = {
  success?: boolean;
  source?: string;
  provider?: string;
  underlyingDatasets?: {
    land?: string;
    precipitation?: string;
  };
  dataType?: string;
  latitude?: number;
  longitude?: number;
  era5LandGrid?: {
    latitude?: number | null;
    longitude?: number | null;
    elevation?: number | null;
    resolutionDegrees?: number | null;
  };
  era5PrecipGrid?: {
    latitude?: number | null;
    longitude?: number | null;
    elevation?: number | null;
    resolutionDegrees?: number | null;
  };
  requestedDays?: number;
  period?: {
    start?: string;
    end?: string;
  };
  hourlyCount?: number;
  precipitationValidCount?: number;
  summary?: {
    averageTemperatureC?: number | null;
    totalPrecipitationMm?: number | null;
    averageSoilTemperature0To7CmC?: number | null;
    averageSoilTemperature7To28CmC?: number | null;
    averageSoilMoisture0To7Cm?: number | null;
    averageSoilMoisture7To28Cm?: number | null;
    averageSoilMoisture28To100Cm?: number | null;
    averageSoilMoisture100To255Cm?: number | null;
  };
  units?: {
    temperature?: string;
    precipitation?: string;
    soilMoisture?: string;
  };
  rows?: Array<Record<string, unknown>>;
  fetchedAt?: string;
  error?: string;
};

export type Era5ClimateState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  fieldId?: string;
  fieldName?: string;
  data?: Era5ClimateResponse;
  message?: string;
};

export type UnifiedClimateContext = {
  version: 1;
  fieldId: string;
  fieldName: string;
  coordinates: {
    latitude: number | null;
    longitude: number | null;
  };
  generatedAt: string;
  confidence: 'high' | 'medium' | 'limited';
  sourcePriority: string[];
  nasaPower: {
    status: NasaPowerCardState['status'];
    data: NasaPowerCardState['data'] | null;
  };
  era5: {
    status: Era5ClimateState['status'];
    data: Era5ClimateResponse | null;
  };
  fusion: {
    averageTemperatureC: FusedClimateMetric;
    totalPrecipitationMm: FusedClimateMetric;
  };
  normalized: {
    averageTemperatureC: number | null;
    totalPrecipitationMm: number | null;
    averageHumidityPercent: number | null;
    averageWindSpeed: number | null;
    averageSolarRadiation: number | null;
    soilTemperature0To7CmC: number | null;
    soilTemperature7To28CmC: number | null;
    soilMoisture0To7Cm: number | null;
    soilMoisture7To28Cm: number | null;
    soilMoisture28To100Cm: number | null;
    soilMoisture100To255Cm: number | null;
  };
  notes: string[];
};

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildUnifiedClimateContext(
  field: Field | null,
  nasaPowerState: NasaPowerCardState,
  era5ClimateState: Era5ClimateState,
): UnifiedClimateContext | null {
  if (!field) return null;

  const fieldId = String(field.id);
  const nasaMatches =
    nasaPowerState.status === 'ready' &&
    String(nasaPowerState.fieldId ?? '') === fieldId &&
    Boolean(nasaPowerState.data);
  const era5Matches =
    era5ClimateState.status === 'ready' &&
    String(era5ClimateState.fieldId ?? '') === fieldId &&
    Boolean(era5ClimateState.data);

  if (!nasaMatches && !era5Matches) return null;

  const nasaSummary = nasaMatches ? nasaPowerState.data?.summary : null;
  const eraSummary = era5Matches ? era5ClimateState.data?.summary : null;

  const temperatureFusion = fuseHistoricalTemperature(
    eraSummary?.averageTemperatureC,
    nasaSummary?.averageTemperature,
  );
  const precipitationFusion = fuseHistoricalPrecipitation(
    eraSummary?.totalPrecipitationMm,
    nasaSummary?.totalPrecipitation,
  );

  const notes: string[] = [
    'ERA5-Land/ERA5 bölgesel reanalysis ana iklim kaynağıdır; NASA POWER bağımsız referans ve doğrulama katmanı olarak birlikte değerlendirilir.',
    'Kaynaklar ciddi biçimde ayrışırsa yapay bir orta değer üretilmez; ana reanalysis değeri korunur ve güven seviyesi düşürülür.',
    'Bu veriler tarla içi sensör ölçümü değildir; Pusula AI kararlarında kullanıcı kaydı, gerçek laboratuvar analizi ve saha gözlemleri daha yüksek öncelik taşır.',
  ];

  if (temperatureFusion.agreement === 'diverge') {
    notes.push(
      `ERA5 ile NASA POWER sıcaklık referansları ${temperatureFusion.difference?.toFixed(1) ?? '?'} °C ayrışıyor; sıcaklık güveni sınırlı kabul edildi.`,
    );
  } else if (temperatureFusion.agreement === 'moderate') {
    notes.push(
      `Sıcaklık kaynakları arasında ${temperatureFusion.difference?.toFixed(1) ?? '?'} °C fark var; ağırlıklı birleşim orta güvenle kullanılıyor.`,
    );
  }

  if (precipitationFusion.agreement === 'diverge') {
    notes.push(
      `ERA5 ile NASA POWER yağış referansları ${precipitationFusion.difference?.toFixed(1) ?? '?'} mm ayrışıyor; yağış için ERA5 ana değer olarak korundu.`,
    );
  } else if (precipitationFusion.agreement === 'moderate') {
    notes.push(
      `Yağış kaynaklarında ${precipitationFusion.difference?.toFixed(1) ?? '?'} mm fark var; ağırlıklı birleşim orta güvenle kullanılıyor.`,
    );
  }

  return {
    version: 1,
    fieldId,
    fieldName: field.name,
    coordinates: {
      latitude: finiteNumber(field.parcelCentroidLat ?? field.latitude),
      longitude: finiteNumber(field.parcelCentroidLng ?? field.longitude),
    },
    generatedAt: new Date().toISOString(),
    confidence: combineFusionConfidence(
      temperatureFusion,
      precipitationFusion,
    ),
    sourcePriority: [
      'Kullanıcı saha kaydı / sensör / laboratuvar',
      'TarlaPusula birleşik kısa vadeli hava tahmini',
      'ERA5-Land + ERA5 bölgesel reanalysis',
      'NASA POWER bağımsız iklim referansı',
    ],
    nasaPower: {
      status: nasaPowerState.status,
      data: nasaMatches ? nasaPowerState.data ?? null : null,
    },
    era5: {
      status: era5ClimateState.status,
      data: era5Matches ? era5ClimateState.data ?? null : null,
    },
    fusion: {
      averageTemperatureC: temperatureFusion,
      totalPrecipitationMm: precipitationFusion,
    },
    normalized: {
      averageTemperatureC: temperatureFusion.value,
      totalPrecipitationMm: precipitationFusion.value,
      averageHumidityPercent: finiteNumber(nasaSummary?.averageHumidity),
      averageWindSpeed: finiteNumber(nasaSummary?.averageWindSpeed),
      averageSolarRadiation: finiteNumber(nasaSummary?.averageSolarRadiation),
      soilTemperature0To7CmC: finiteNumber(eraSummary?.averageSoilTemperature0To7CmC),
      soilTemperature7To28CmC: finiteNumber(eraSummary?.averageSoilTemperature7To28CmC),
      soilMoisture0To7Cm: finiteNumber(eraSummary?.averageSoilMoisture0To7Cm),
      soilMoisture7To28Cm: finiteNumber(eraSummary?.averageSoilMoisture7To28Cm),
      soilMoisture28To100Cm: finiteNumber(eraSummary?.averageSoilMoisture28To100Cm),
      soilMoisture100To255Cm: finiteNumber(eraSummary?.averageSoilMoisture100To255Cm),
    },
    notes,
  };
}

type UseAppWeatherDataOptions = {
  realFields: Field[];
  favoriteFieldId: string;
};

export function useAppWeatherData({ realFields, favoriteFieldId }: UseAppWeatherDataOptions) {
  const [fieldWeather, setFieldWeather] = useState<Record<string, FieldWeatherState>>({});
  const [fieldHourlyWeather, setFieldHourlyWeather] = useState<Record<string, HourlySprayState>>({});
  const hourlyInFlight = useRef(new Set<string>());
  const hourlyFetchedAt = useRef(new Map<string, number>());
  const [weatherHubFieldId, setWeatherHubFieldId] = useState('');
  const [nasaPowerState, setNasaPowerState] = useState<NasaPowerCardState>({ status: 'idle' });
  const [era5ClimateState, setEra5ClimateState] = useState<Era5ClimateState>({ status: 'idle' });

  const loadHomeWeather = async (field?: Field | null) => {
    const key = '__home__';

    setFieldWeather((current) => ({
      ...current,
      [key]: {
        status: 'loading',
        forecast: current[key]?.forecast ?? [],
        providers: current[key]?.providers ?? [],
        locationLabel: current[key]?.locationLabel,
      },
    }));

    try {
      const location = await resolveHomeWeatherLocation(field);
      const snapshot = await fetchWeatherCompareSnapshot(
        location.latitude,
        location.longitude,
      );
      setFieldWeather((current) => ({
        ...current,
        [key]: {
          status: 'ready',
          forecast: snapshot.forecast,
          providers: snapshot.providers,
          locationLabel: location.label,
        },
      }));
    } catch (error) {
      console.error('Ana sayfa hava durumu yüklenemedi:', error);
      setFieldWeather((current) => ({
        ...current,
        [key]: {
          status: 'error',
          forecast: current[key]?.forecast ?? [],
          providers: current[key]?.providers ?? [],
          locationLabel: current[key]?.locationLabel,
          message: error instanceof Error ? error.message : 'Hava tahmini alınamadı.',
        },
      }));
    }
  };

  const loadFieldWeather = async (field: Field) => {
    const key = String(field.id);
    if (fieldWeather[key]?.status === 'loading') return;

    setFieldWeather((current) => ({
      ...current,
      [key]: {
        status: 'loading',
        forecast: current[key]?.forecast ?? [],
        providers: current[key]?.providers ?? [],
        locationLabel: current[key]?.locationLabel,
      },
    }));

    try {
      const location = await geocodeFieldLocation(field);
      if (!location) {
        throw new Error('Bu tarla için hava tahmini göstermek üzere il veya ilçe bilgisi gerekli.');
      }

      const snapshot = await fetchWeatherCompareSnapshot(
        location.latitude,
        location.longitude,
      );

      setFieldWeather((current) => ({
        ...current,
        [key]: {
          status: 'ready',
          forecast: snapshot.forecast,
          providers: snapshot.providers,
          locationLabel: location.label,
        },
      }));
    } catch (error) {
      console.error('Tarla hava durumu yüklenemedi:', error);
      setFieldWeather((current) => ({
        ...current,
        [key]: {
          status: 'error',
          forecast: current[key]?.forecast ?? [],
          providers: current[key]?.providers ?? [],
          locationLabel: current[key]?.locationLabel,
          message: error instanceof Error ? error.message : 'Hava tahmini güncelleniyor.',
        },
      }));
    }
  };

  const loadFieldHourlyWeather = useCallback(async (field: Field, force = false) => {
    const key = String(field.id);
    if (hourlyInFlight.current.has(key)) return;
    if (!force && Date.now() - (hourlyFetchedAt.current.get(key) ?? 0) < 30 * 60 * 1000) return;
    hourlyInFlight.current.add(key);
    setFieldHourlyWeather((current) => ({
      ...current,
      [key]: { status: 'loading', data: current[key]?.data },
    }));
    try {
      const location = await geocodeFieldLocation(field);
      if (!location) throw new Error('Tarla konumu bulunamadı.');
      const data = await fetchHourlySprayForecast(location.latitude, location.longitude);
      hourlyFetchedAt.current.set(key, Date.now());
      setFieldHourlyWeather((current) => ({ ...current, [key]: { status: 'ready', data } }));
    } catch (error) {
      setFieldHourlyWeather((current) => ({
        ...current,
        [key]: {
          status: 'error',
          message: error instanceof Error ? error.message : 'Saatlik tahmin alınamadı.',
        },
      }));
      hourlyFetchedAt.current.set(key, Date.now());
    } finally {
      hourlyInFlight.current.delete(key);
    }
  }, []);

  const climateTargetField = useMemo(
    () =>
      realFields.find((field) => String(field.id) === String(weatherHubFieldId)) ??
      realFields.find((field) => String(field.id) === String(favoriteFieldId)) ??
      realFields[0] ??
      null,
    [realFields, weatherHubFieldId, favoriteFieldId],
  );

  useEffect(() => {
    if (!climateTargetField) {
      setNasaPowerState({ status: 'idle' });
      return;
    }

    const latitude = Number(climateTargetField.parcelCentroidLat ?? climateTargetField.latitude ?? NaN);
    const longitude = Number(climateTargetField.parcelCentroidLng ?? climateTargetField.longitude ?? NaN);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setNasaPowerState({
        status: 'error',
        fieldId: String(climateTargetField.id),
        fieldName: climateTargetField.name,
        message: 'Bu tarla için iklim referansı oluşturacak koordinat bulunamadı.',
      });
      return;
    }

    let active = true;
    setNasaPowerState({
      status: 'loading',
      fieldId: String(climateTargetField.id),
      fieldName: climateTargetField.name,
    });

    void fetchNasaPowerData(latitude, longitude, 7)
      .then((data) => {
        if (!active) return;
        setNasaPowerState({
          status: 'ready',
          fieldId: String(climateTargetField.id),
          fieldName: climateTargetField.name,
          data,
        });
      })
      .catch((error) => {
        if (!active) return;
        setNasaPowerState({
          status: 'error',
          fieldId: String(climateTargetField.id),
          fieldName: climateTargetField.name,
          message: error instanceof Error ? error.message : 'NASA POWER iklim verisi alınamadı.',
        });
      });

    return () => {
      active = false;
    };
  }, [climateTargetField?.id, climateTargetField?.parcelCentroidLat, climateTargetField?.parcelCentroidLng, climateTargetField?.latitude, climateTargetField?.longitude]);

  useEffect(() => {
    if (!climateTargetField) {
      setEra5ClimateState({ status: 'idle' });
      return;
    }

    const latitude = Number(climateTargetField.parcelCentroidLat ?? climateTargetField.latitude ?? NaN);
    const longitude = Number(climateTargetField.parcelCentroidLng ?? climateTargetField.longitude ?? NaN);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setEra5ClimateState({
        status: 'error',
        fieldId: String(climateTargetField.id),
        fieldName: climateTargetField.name,
        message: 'Bu tarla için ERA5 iklim bağlamı oluşturacak koordinat bulunamadı.',
      });
      return;
    }

    let active = true;
    setEra5ClimateState({
      status: 'loading',
      fieldId: String(climateTargetField.id),
      fieldName: climateTargetField.name,
    });

    void supabase.functions
      .invoke('era5-land', { body: { latitude, longitude, days: 7 } })
      .then(({ data, error }) => {
        if (error) throw error;
        if (!active) return;

        const result = (data ?? {}) as Era5ClimateResponse;
        if (result.success === false) {
          throw new Error(result.error || 'ERA5-Land verisi alınamadı.');
        }

        setEra5ClimateState({
          status: 'ready',
          fieldId: String(climateTargetField.id),
          fieldName: climateTargetField.name,
          data: result,
        });
      })
      .catch((error) => {
        if (!active) return;
        console.error(`❌ ERA5-Land + ERA5 HATASI → ${climateTargetField.name}`, error);
        setEra5ClimateState({
          status: 'error',
          fieldId: String(climateTargetField.id),
          fieldName: climateTargetField.name,
          message: error instanceof Error ? error.message : 'ERA5-Land iklim verisi alınamadı.',
        });
      });

    return () => {
      active = false;
    };
  }, [climateTargetField?.id, climateTargetField?.parcelCentroidLat, climateTargetField?.parcelCentroidLng, climateTargetField?.latitude, climateTargetField?.longitude]);

  const unifiedClimateContext = useMemo(
    () => buildUnifiedClimateContext(climateTargetField, nasaPowerState, era5ClimateState),
    [climateTargetField, nasaPowerState, era5ClimateState],
  );

  return {
    fieldWeather,
    fieldHourlyWeather,
    loadFieldHourlyWeather,
    weatherHubFieldId,
    setWeatherHubFieldId,
    loadHomeWeather,
    loadFieldWeather,
    nasaPowerState,
    era5ClimateState,
    unifiedClimateContext,
  };
}
