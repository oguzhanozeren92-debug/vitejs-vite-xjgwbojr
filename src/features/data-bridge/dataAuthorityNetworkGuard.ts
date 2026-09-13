import { fetchPublicJsonThroughDataBridge } from './edgeFunctionDataBridge';

let installed = false;

function canonicalizeHomeAgroRequest(url: URL) {
  const hourly = url.searchParams.get('hourly') ?? '';
  const daily = url.searchParams.get('daily') ?? '';

  if (hourly === 'soil_temperature_0_to_7cm') {
    // Ana haritadaki kullanıcı-dostu 0–7 cm etiketi Open-Meteo'nun ERA5-Land
    // 0 cm model değişkenine bağlanır. Tek model: ERA5-Land.
    url.searchParams.set('hourly', 'soil_temperature_0cm');
    url.searchParams.set('models', 'era5_land');
    url.searchParams.set('cell_selection', 'land');
    return { namespace: 'home-agro:surface-temperature', url };
  }

  if (daily === 'et0_fao_evapotranspiration') {
    // ET₀ aynı FAO-56 türetilmiş seri + ERA5-Land meteorolojik girdileri ile
    // sabitlenir; provider ekranlar arasında değişmez.
    url.searchParams.set('models', 'era5_land');
    url.searchParams.set('cell_selection', 'land');
    return { namespace: 'home-agro:et0', url };
  }

  if (daily === 'precipitation_sum') {
    // Yağış geçmişinin tek reanalysis otoritesi ERA5.
    url.searchParams.set('models', 'era5');
    url.searchParams.set('cell_selection', 'land');
    return { namespace: 'home-agro:rain-history', url };
  }

  return null;
}

/**
 * Legacy HomeMap/UnifiedMap dosyalarında kalmış browser grid çağrılarını tek
 * veri otoritesi sözleşmesine zorlar.
 *
 * - `models=best_match` iklim fallback'i yasaktır; harita iklimi `era5-map`tir.
 * - Home agro katmanları (yüzey sıcaklığı / ET₀ / yağış geçmişi) sabit modele
 *   normalize edilir ve ana persistent data bridge'te saklanır.
 * - Normal hava tahmini ve tek-konum servisleri etkilenmez.
 */
export function installDataAuthorityNetworkGuard() {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return;
  }

  installed = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const rawUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      const url = new URL(rawUrl, window.location.origin);
      const isArchive = url.hostname === 'archive-api.open-meteo.com';
      const latitudes = url.searchParams.get('latitude') ?? '';
      const longitudes = url.searchParams.get('longitude') ?? '';
      const isGridRequest = latitudes.includes(',') || longitudes.includes(',');
      const isLegacyBestMatchMap =
        url.searchParams.get('models') === 'best_match' &&
        url.searchParams.get('cell_selection') === 'land';

      if (isArchive && isGridRequest && isLegacyBestMatchMap) {
        throw new Error(
          'TarlaPusula veri otoritesi: harita iklim verisi yalnız era5-map üzerinden alınabilir.',
        );
      }

      if (isArchive && isGridRequest && (!init?.method || init.method === 'GET')) {
        const canonical = canonicalizeHomeAgroRequest(new URL(url.toString()));

        if (canonical) {
          return fetchPublicJsonThroughDataBridge({
            namespace: canonical.namespace,
            url: canonical.url.toString(),
            nativeFetch,
            refreshAfterMs: 6 * 60 * 60 * 1000,
          });
        }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith('TarlaPusula veri otoritesi:')
      ) {
        return Promise.reject(error);
      }
      // URL parse edilemiyorsa native fetch kendi davranışına devam eder.
    }

    return nativeFetch(input, init);
  }) as typeof window.fetch;
}
