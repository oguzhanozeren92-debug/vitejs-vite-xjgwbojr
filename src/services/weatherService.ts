import type { Field, WeatherForecastDay } from '../types';
import { supabase } from '../supabaseClient';

export type WeatherLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

export const geocodeFieldLocation = async (
  field: Field,
): Promise<WeatherLocation | null> => {
  if (field.demo) {
    return {
      latitude: 39.9334,
      longitude: 32.8597,
      label: 'Örnek konum',
    };
  }

  const rawLatitude = field.parcelCentroidLat ?? field.latitude;
  const rawLongitude = field.parcelCentroidLng ?? field.longitude;
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (rawLatitude != null && rawLongitude != null &&
      Number.isFinite(latitude) && Number.isFinite(longitude) &&
      latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
    return {
      latitude,
      longitude,
      label: [field.village, field.district, field.city].filter(Boolean).join(' / ') || field.name || 'Tarla konumu',
    };
  }

  const searchCandidates = [
    [field.village, field.district, field.city].filter(Boolean).join(', '),
    [field.district, field.city].filter(Boolean).join(', '),
    field.city ?? '',
  ].filter((value, index, all) => value && all.indexOf(value) === index);

  for (const query of searchCandidates) {
    try {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
      url.searchParams.set('name', query);
      url.searchParams.set('count', '1');
      url.searchParams.set('language', 'tr');
      url.searchParams.set('format', 'json');
      url.searchParams.set('countryCode', 'TR');

      const response = await fetch(url);
      if (!response.ok) continue;

      const payload = await response.json();
      const result = payload?.results?.[0];

      if (
        result &&
        Number.isFinite(Number(result.latitude)) &&
        Number.isFinite(Number(result.longitude))
      ) {
        return {
          latitude: Number(result.latitude),
          longitude: Number(result.longitude),
          label:
            [field.village, field.district, field.city]
              .filter(Boolean)
              .join(' / ') || result.name || 'Tarla konumu',
        };
      }
    } catch (error) {
      console.warn('Tarla konumu çözümlenemedi:', error);
    }
  }

  return null;
};

/**
 * Eski isim geriye dönük importları kırmamak için korunuyor.
 * Artık doğrudan tek bir Open-Meteo modelini çağırmaz; production
 * `weather-compare` Edge Function'ının ECMWF + GFS + ICON consensus
 * tahminini döndürür. Böylece Home ve Weather ekranı aynı sayıları kullanır.
 */
export const fetchOpenMeteoForecast = async (
  latitude: number,
  longitude: number,
): Promise<WeatherForecastDay[]> => {
  if (!supabase) {
    throw new Error('Hava tahmini için Supabase bağlantısı hazır değil.');
  }

  const { data, error } = await supabase.functions.invoke('weather-compare', {
    body: { latitude, longitude },
  });

  if (error) {
    throw new Error(`Hava karşılaştırma servisi yanıt vermedi: ${error.message}`);
  }

  const forecast = Array.isArray(data?.forecast)
    ? (data.forecast as WeatherForecastDay[]).slice(0, 5)
    : [];

  if (!forecast.length) {
    throw new Error(data?.message ?? 'Hava tahmini alınamadı.');
  }

  return forecast;
};

const getDeviceWeatherLocation = () =>
  new Promise<WeatherLocation | null>((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: 'Mevcut konum',
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 10 * 60 * 1000,
      },
    );
  });

export const resolveHomeWeatherLocation = async (
  field?: Field | null,
): Promise<WeatherLocation> => {
  const deviceLocation = await getDeviceWeatherLocation();
  if (deviceLocation) return deviceLocation;

  if (field && !field.demo) {
    const latitude = field.parcelCentroidLat ?? field.latitude;
    const longitude = field.parcelCentroidLng ?? field.longitude;

    if (
      latitude !== null &&
      latitude !== undefined &&
      longitude !== null &&
      longitude !== undefined &&
      Number.isFinite(Number(latitude)) &&
      Number.isFinite(Number(longitude))
    ) {
      return {
        latitude: Number(latitude),
        longitude: Number(longitude),
        label:
          [field.village, field.district, field.city].filter(Boolean).join(' / ') ||
          field.name ||
          'Tarla konumu',
      };
    }

    const geocoded = await geocodeFieldLocation(field);
    if (geocoded) return geocoded;
  }

  return {
    latitude: 38.6743,
    longitude: 39.2232,
    label: 'Elazığ',
  };
};
