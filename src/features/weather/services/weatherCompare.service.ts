import { supabase } from '../../../supabaseClient';
import type {
  WeatherForecastDay,
  WeatherProviderResult,
} from '../../../types';

export type WeatherCompareSnapshot = {
  forecast: WeatherForecastDay[];
  providers: WeatherProviderResult[];
  source: string;
  generatedAt: string | null;
};

function normalizeProviders(raw: any): WeatherProviderResult[] {
  const candidates = Array.isArray(raw?.providers)
    ? raw.providers
    : Array.isArray(raw?.sources)
      ? raw.sources
      : Array.isArray(raw?.results)
        ? raw.results
        : [];

  return candidates
    .map((provider: any, index: number) => {
      const providerForecast = Array.isArray(provider?.forecast)
        ? provider.forecast.slice(0, 5)
        : Array.isArray(provider?.days)
          ? provider.days.slice(0, 5)
          : [];

      return {
        name:
          String(
            provider?.name ??
              provider?.provider ??
              provider?.source ??
              `Kaynak ${index + 1}`,
          ).trim() || `Kaynak ${index + 1}`,
        forecast: providerForecast,
      } satisfies WeatherProviderResult;
    })
    .filter((provider: WeatherProviderResult) => provider.forecast.length > 0)
    .slice(0, 3);
}

export async function fetchWeatherCompareSnapshot(
  latitude: number,
  longitude: number,
): Promise<WeatherCompareSnapshot> {
  const { data, error } = await supabase.functions.invoke('weather-compare', {
    body: { latitude, longitude },
  });

  if (error) throw error;

  const providers = normalizeProviders(data);
  const canonicalForecast = Array.isArray(data?.forecast)
    ? (data.forecast as WeatherForecastDay[]).slice(0, 5)
    : [];
  const forecast = canonicalForecast.length
    ? canonicalForecast
    : providers[0]?.forecast ?? [];

  if (!forecast.length && providers.length === 0) {
    throw new Error(data?.message ?? 'Hava tahmini güncelleniyor.');
  }

  return {
    forecast,
    providers,
    source: String(data?.source ?? 'TarlaPusula MultiSource Weather'),
    generatedAt:
      typeof data?.generatedAt === 'string'
        ? data.generatedAt
        : typeof data?.fetchedAt === 'string'
          ? data.fetchedAt
          : null,
  };
}
