type EdgeInvokeOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  [key: string]: unknown;
};

type EdgeInvokeResult<T = unknown> = {
  data: T | null;
  error: unknown | null;
};

type EdgeInvoker = <T = unknown>(
  functionName: string,
  options?: EdgeInvokeOptions,
) => Promise<EdgeInvokeResult<T>>;

type CachePolicy = {
  refreshAfterMs: number;
  version: (data: any, body: any) => string;
};

type BridgeEntry = {
  key: string;
  scope: string;
  functionName: string;
  body: unknown;
  savedAt: number;
  sourceVersion: string;
  data: unknown;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * SADECE salt-okuma yapan, haritada aynı verinin tekrar tekrar çekilmesine
 * sebep olan fonksiyonlar burada cache'lenir. Yazma / AI / bildirim / admin
 * fonksiyonları bilerek bu listenin dışındadır.
 */
const POLICIES: Record<string, CachePolicy> = {
  'satellite-field-analysis': {
    refreshAfterMs: 12 * HOUR,
    version: (data) =>
      String(
        data?.latestImageDate ??
          data?.selectedSceneDatetime ??
          data?.generatedAt ??
          'unknown',
      ),
  },
  'satellite-scene-list': {
    refreshAfterMs: 6 * HOUR,
    version: (data) =>
      String(
        Array.isArray(data?.dates) && data.dates.length
          ? data.dates[0]
          : data?.period?.to ?? 'empty',
      ),
  },
  'satellite-historical-analysis': {
    // Tarih sabit olduğu için geçmiş görüntü pratikte immutable kabul edilir.
    refreshAfterMs: 60 * DAY,
    version: (data, body) =>
      String(data?.latestImageDate ?? body?.imageDate ?? 'historical'),
  },
  'satellite-ndvi-timeseries': {
    refreshAfterMs: 12 * HOUR,
    version: (data) => {
      const points = Array.isArray(data?.points) ? data.points : [];
      return String(points[points.length - 1]?.date ?? data?.generatedAt ?? 'empty');
    },
  },
  'sentinel1-radar': {
    refreshAfterMs: 6 * HOUR,
    version: (data) =>
      String(
        data?.selectedSceneDatetime ??
          data?.timeRange?.to?.slice?.(0, 10) ??
          data?.generatedAt?.slice?.(0, 10) ??
          'radar',
      ),
  },
  soilgrids: {
    // SoilGrids model yüzeyi sık değişmez. Aynı koordinat için tek snapshot.
    refreshAfterMs: 30 * DAY,
    version: (data, body) =>
      [
        data?.product ?? 'SoilGrids250m',
        Number(body?.latitude ?? data?.requestedLatitude ?? 0).toFixed(5),
        Number(body?.longitude ?? data?.requestedLongitude ?? 0).toFixed(5),
      ].join(':'),
  },
  'era5-map': {
    refreshAfterMs: 6 * HOUR,
    version: (data, body) =>
      [
        body?.variable ?? data?.variable ?? data?.variableLabel ?? 'era5',
        data?.period?.end ?? data?.period?.to ?? new Date().toISOString().slice(0, 10),
      ].join(':'),
  },
  'field-biodiversity-context': {
    refreshAfterMs: DAY,
    version: (data) =>
      [
        data?.summary?.newestObservationAt ?? 'none',
        data?.summary?.totalObservations ?? 0,
      ].join(':'),
  },
  'field-satellite-fusion': {
    refreshAfterMs: 12 * HOUR,
    version: (data) =>
      String(
        data?.latestImageDate ??
          data?.sentinel2?.latestImageDate ??
          data?.generatedAt ??
          'fusion',
      ),
  },
};

const DB_NAME = 'tarlapusula-data-bridge-v1';
const STORE_NAME = 'snapshots';
const MAX_PERSISTED_ENTRIES = 96;

const memory = new Map<string, BridgeEntry>();
const inflight = new Map<string, Promise<EdgeInvokeResult<any>>>();
const refreshAttemptAt = new Map<string, number>();
let dbPromise: Promise<IDBDatabase | null> | null = null;
let hydrationPromise: Promise<void> | null = null;

function stableValue(value: any): any {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
}

function stableStringify(value: unknown) {
  try {
    return JSON.stringify(stableValue(value));
  } catch {
    return String(value ?? '');
  }
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cacheKey(scope: string, functionName: string, body: unknown) {
  return `${scope}:${functionName}:${hashText(stableStringify(body ?? null))}`;
}

function openDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve<IDBDatabase | null>(null);
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('savedAt', 'savedAt');
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

async function hydrate() {
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = (async () => {
    const db = await openDb();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).getAll();

        request.onsuccess = () => {
          const entries = Array.isArray(request.result)
            ? (request.result as BridgeEntry[])
            : [];

          entries.forEach((entry) => {
            if (entry?.key && entry?.data !== undefined) {
              memory.set(entry.key, entry);
            }
          });
          resolve();
        };

        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  })();

  return hydrationPromise;
}

async function persist(entry: BridgeEntry) {
  memory.set(entry.key, entry);

  const db = await openDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });

  // Basit LRU benzeri temizlik: en yeni 96 snapshot kalsın.
  try {
    const all = [...memory.values()].sort((a, b) => b.savedAt - a.savedAt);
    const overflow = all.slice(MAX_PERSISTED_ENTRIES);
    if (!overflow.length) return;

    overflow.forEach((item) => memory.delete(item.key));

    const cleanup = db.transaction(STORE_NAME, 'readwrite');
    overflow.forEach((item) => cleanup.objectStore(STORE_NAME).delete(item.key));
  } catch {
    // Cache temizliği uygulamanın çalışması için kritik değil.
  }
}

function emitSnapshotUpdate(entry: BridgeEntry) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('tp:data-snapshot-updated', {
      detail: {
        key: entry.key,
        functionName: entry.functionName,
        sourceVersion: entry.sourceVersion,
        savedAt: entry.savedAt,
      },
    }),
  );
}

async function refresh<T>(input: {
  key: string;
  scope: string;
  functionName: string;
  body: unknown;
  options?: EdgeInvokeOptions;
  policy: CachePolicy;
  originalInvoke: EdgeInvoker;
  previous?: BridgeEntry | null;
}): Promise<EdgeInvokeResult<T>> {
  const existing = inflight.get(input.key);
  if (existing) return existing as Promise<EdgeInvokeResult<T>>;

  const promise = (async () => {
    const result = await input.originalInvoke<T>(
      input.functionName,
      input.options,
    );

    if (result.error || result.data == null) {
      if (input.previous?.data !== undefined) {
        // Ağ/servis hatasında doğru son snapshot ekranda kalır.
        return { data: input.previous.data as T, error: null };
      }
      return result;
    }

    const sourceVersion = input.policy.version(result.data, input.body);
    const now = Date.now();

    if (
      input.previous &&
      input.previous.sourceVersion &&
      sourceVersion === input.previous.sourceVersion
    ) {
      // Kaynak aynıysa görseli/state'i gereksiz yere değiştirme; yalnız kontrol
      // zamanını ilerlet ki ekran geçişi tekrar sorgu tetiklemesin.
      const same: BridgeEntry = {
        ...input.previous,
        savedAt: now,
      };
      await persist(same);
      return { data: input.previous.data as T, error: null };
    }

    const entry: BridgeEntry = {
      key: input.key,
      scope: input.scope,
      functionName: input.functionName,
      body: input.body,
      savedAt: now,
      sourceVersion,
      data: result.data,
    };

    await persist(entry);
    emitSnapshotUpdate(entry);
    return { data: result.data, error: null };
  })().finally(() => {
    inflight.delete(input.key);
  });

  inflight.set(input.key, promise as Promise<EdgeInvokeResult<any>>);
  return promise;
}

export async function warmEdgeFunctionDataBridge() {
  await hydrate();
}

/**
 * Supabase functions.invoke için tek okuma köprüsü.
 *
 * Davranış:
 * - Cache varsa ANINDA son doğru snapshot döner.
 * - Ekran/katman geçişi yeni ağ isteği başlatmaz.
 * - Snapshot belirlenen süreden eskiyse arka planda tek bir refresh yapılır.
 * - Kaynak versiyonu değişmediyse UI verisi değiştirilmez.
 * - Ağ hatasında eski doğru snapshot silinmez.
 */
export function createEdgeFunctionDataBridge(input: {
  originalInvoke: EdgeInvoker;
  getScope: () => Promise<string>;
}) {
  return async function bridgedInvoke<T = unknown>(
    functionName: string,
    options: EdgeInvokeOptions = {},
  ): Promise<EdgeInvokeResult<T>> {
    const policy = POLICIES[functionName];
    if (!policy) {
      return input.originalInvoke<T>(functionName, options);
    }

    await hydrate();

    const scope = (await input.getScope()) || 'anon';
    const body = options?.body ?? null;
    const key = cacheKey(scope, functionName, body);
    const cached = memory.get(key) ?? null;

    const forceRefresh =
      options?.headers?.['x-tp-force-refresh'] === '1' ||
      (body && typeof body === 'object' && (body as any).__tpForceRefresh === true);

    if (cached && !forceRefresh) {
      const age = Date.now() - cached.savedAt;

      if (age >= policy.refreshAfterMs) {
        const lastAttempt = refreshAttemptAt.get(key) ?? 0;

        // Aynı stale snapshot için her ekran geçişinde refresh başlatma.
        if (Date.now() - lastAttempt >= Math.min(policy.refreshAfterMs, 30 * 60 * 1000)) {
          refreshAttemptAt.set(key, Date.now());
          void refresh({
            key,
            scope,
            functionName,
            body,
            options,
            policy,
            originalInvoke: input.originalInvoke,
            previous: cached,
          }).catch(() => undefined);
        }
      }

      return { data: cached.data as T, error: null };
    }

    refreshAttemptAt.set(key, Date.now());
    return refresh<T>({
      key,
      scope,
      functionName,
      body,
      options,
      policy,
      originalInvoke: input.originalInvoke,
      previous: cached,
    });
  };
}
