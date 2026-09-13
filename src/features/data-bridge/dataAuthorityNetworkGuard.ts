let installed = false;

/**
 * Legacy HomeMap/UnifiedMap dosyalarında kalmış doğrudan Open-Meteo grid
 * fallback'inin ikinci bir iklim otoritesine dönüşmesini engeller.
 *
 * Sadece HARİTA için kullanılan çok-koordinatlı Historical Weather isteğini
 * yakalar. Normal hava tahmini, tek-konum geçmiş hava ve diğer API kullanımları
 * etkilenmez.
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
