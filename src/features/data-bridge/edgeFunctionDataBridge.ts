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
const DB_NAME = 'tarlapusula-data-bridge-v1';
const STORE_NAME = 'snapshots';
const MAX_PERSISTED_ENTRIES = 96;

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

/** Salt-okuma veri kaynakları için tek freshness/versiyon sözleşmesi. */
const POLICIES: Record<string, CachePolicy> = {
  'weather-compare': {
    refreshAfterMs: 30 * 60 * 1000,
    version: (data) => hashText(stableStringify(data?.forecast ?? [])),
  },
  'satellite-field-analysis': {
    refreshAfterMs: 12 * HOUR,
    version: (data, body) => {
      if (body?.listScenes) {
        return String(
          Array.isArray(data?.dates) && data.dates.length
            ? data.dates[0]
            : data?.period?.to ?? 'empty',
        );
      }

      if (body?.imageDate) {
        return String(data?.latestImageDate ?? body.imageDate);
      }

      return String(
        data?.latestImageDate ??
          data?.selectedSceneDatetime ??
          data?.generatedAt ??
          'unknown',
      );
    },
  },
  'satellite-scene-list': {
    refreshAfterMs: 6 * HOUR,
    version: (data) => String(
      Array.isArray(data?.dates) && data.dates.length
        ? data.dates[0]
        : data?.period?.to ?? 'empty',
    ),
  },
  'satellite-history-preview': {
    refreshAfterMs: 60 * DAY,
    version: (data, body) => String(
      data?.latestImageDate ?? body?.imageDate ?? 'history-preview',
    ),
  },
  'satellite-historical-analysis': {
    refreshAfterMs: 60 * DAY,
    version: (data, body) => String(
      data?.latestImageDate ?? body?.imageDate ?? 'historical',
    ),
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
    version: (data) => String(
      data?.selectedSceneDatetime ??
      data?.timeRange?.to?.slice?.(0, 10) ??
      data?.generatedAt?.slice?.(0, 10) ??
      'radar',
    ),
  },
  soilgrids: {
    refreshAfterMs: 30 * DAY,
    version: (data, body) => [
      data?.product ?? 'SoilGrids250m',
      Number(body?.latitude ?? data?.requestedLatitude ?? 0).toFixed(5),
      Number(body?.longitude ?? data?.requestedLongitude ?? 0).toFixed(5),
    ].join(':'),
  },
  'era5-map': {
    refreshAfterMs: 6 * HOUR,
    version: (data, body) => [
      body?.variable ?? data?.variable ?? data?.variableLabel ?? 'era5',
      data?.period?.end ?? data?.period?.to ?? 'no-period',
    ].join(':'),
  },
  'field-biodiversity-context': {
    refreshAfterMs: DAY,
    version: (data) => [
      data?.summary?.newestObservationAt ?? 'none',
      data?.summary?.totalObservations ?? 0,
    ].join(':'),
  },
  'field-satellite-fusion': {
    refreshAfterMs: 12 * HOUR,
    version: (data) => String(
      data?.latestImageDate ??
      data?.sentinel2?.latestImageDate ??
      data?.generatedAt ??
      'fusion',
    ),
  },
};

function isCacheableEdgeData(data: unknown): boolean {
  if (data == null) return false;
  if (
    typeof data === 'object' &&
    'success' in data &&
    (data as { success?: unknown }).success === false
  ) {
    return false;
  }
  return true;
}

const memory = new Map<string, BridgeEntry>();
const inflight = new Map<string, Promise<EdgeInvokeResult<any>>>();
const publicJsonInflight = new Map<string, Promise<unknown>>();
const refreshAttemptAt = new Map<string, number>();
let dbPromise: Promise<IDBDatabase | null> | null = null;
let hydrationPromise: Promise<void> | null = null;

function cacheKey(scope: string, namespace: string, body: unknown) {
  return `${scope}:${namespace}:${hashText(stableStringify(body ?? null))}`;
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
            if (entry?.key && entry?.data !== undefined) memory.set(entry.key, entry);
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

  try {
    const all = [...memory.values()].sort((a, b) => b.savedAt - a.savedAt);
    const overflow = all.slice(MAX_PERSISTED_ENTRIES);
    if (!overflow.length) return;
    overflow.forEach((item) => memory.delete(item.key));
    const cleanup = db.transaction(STORE_NAME, 'readwrite');
    overflow.forEach((item) => cleanup.objectStore(STORE_NAME).delete(item.key));
  } catch {
    // Cache temizliği kritik değil.
  }
}

function emitSnapshotUpdate(entry: BridgeEntry) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('tp:data-snapshot-updated', {
    detail: {
      key: entry.key,
      functionName: entry.functionName,
      sourceVersion: entry.sourceVersion,
      savedAt: entry.savedAt,
    },
  }));
}

async function refreshEdge<T>(input: {
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

  const previous =
    input.previous && isCacheableEdgeData(input.previous.data)
      ? input.previous
      : null;

  const promise = (async () => {
    const result = await input.originalInvoke<T>(input.functionName, input.options);

    if (result.error || !isCacheableEdgeData(result.data)) {
      return previous?.data !== undefined
        ? { data: previous.data as T, error: null }
        : result;
    }

    const sourceVersion = input.policy.version(result.data, input.body);
    const now = Date.now();

    if (previous?.sourceVersion === sourceVersion) {
      const same = { ...previous, savedAt: now };
      await persist(same);
      return { data: previous.data as T, error: null };
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
  })().finally(() => inflight.delete(input.key));

  inflight.set(input.key, promise as Promise<EdgeInvokeResult<any>>);
  return promise;
}

export async function warmEdgeFunctionDataBridge() {
  await hydrate();
}

export function createEdgeFunctionDataBridge(input: {
  originalInvoke: EdgeInvoker;
  getScope: () => Promise<string>;
}) {
  return async function bridgedInvoke<T = unknown>(
    functionName: string,
    options: EdgeInvokeOptions = {},
  ): Promise<EdgeInvokeResult<T>> {
    const policy = POLICIES[functionName];
    if (!policy) return input.originalInvoke<T>(functionName, options);

    await hydrate();

    const scope = (await input.getScope()) || 'anon';
    const body = options?.body ?? null;
    const key = cacheKey(scope, functionName, body);
    const stored = memory.get(key) ?? null;
    const cached =
      stored && isCacheableEdgeData(stored.data)
        ? stored
        : null;

    // Eski sürümde hata gövdeleri snapshot olarak kalmış olabilir. Bunları
    // anında geçersiz say; sonraki başarılı çağrı aynı key'i üzerine yazar.
    if (stored && !cached) memory.delete(key);

    const forceRefresh =
      options?.headers?.['x-tp-force-refresh'] === '1' ||
      (body && typeof body === 'object' && (body as any).__tpForceRefresh === true);

    if (cached && !forceRefresh) {
      const age = Date.now() - cached.savedAt;
      if (age >= policy.refreshAfterMs) {
        const lastAttempt = refreshAttemptAt.get(key) ?? 0;
        if (Date.now() - lastAttempt >= Math.min(policy.refreshAfterMs, 30 * 60 * 1000)) {
          refreshAttemptAt.set(key, Date.now());
          void refreshEdge({
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
    return refreshEdge<T>({
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

function jsonResponseFromSnapshot(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-TarlaPusula-Cache': 'snapshot',
    },
  });
}

export async function fetchPublicJsonThroughDataBridge(input: {
  namespace: string;
  url: string;
  nativeFetch: typeof window.fetch;
  refreshAfterMs?: number;
}): Promise<Response> {
  await hydrate();

  const scope = 'public-map';
  const key = cacheKey(scope, input.namespace, input.url);
  const cached = memory.get(key) ?? null;
  const refreshAfterMs = input.refreshAfterMs ?? 6 * HOUR;

  const loadFresh = async () => {
    const existing = publicJsonInflight.get(key);
    if (existing) return existing;

    const promise = (async () => {
      const response = await input.nativeFetch(input.url);
      if (!response.ok) {
        throw new Error(`Public map source ${response.status} hatası verdi.`);
      }

      const data = await response.clone().json();
      const parsedUrl = new URL(input.url);
      const sourceVersion = [
        parsedUrl.searchParams.get('models') ?? 'fixed-model',
        parsedUrl.searchParams.get('end_date') ?? 'no-date',
        parsedUrl.searchParams.get('hourly') ??
          parsedUrl.searchParams.get('daily') ??
          input.namespace,
      ].join(':');

      const entry: BridgeEntry = {
        key,
        scope,
        functionName: input.namespace,
        body: input.url,
        savedAt: Date.now(),
        sourceVersion,
        data,
      };

      await persist(entry);
      emitSnapshotUpdate(entry);
      return data;
    })().finally(() => publicJsonInflight.delete(key));

    publicJsonInflight.set(key, promise);
    return promise;
  };

  if (cached) {
    const age = Date.now() - cached.savedAt;
    if (age >= refreshAfterMs) {
      const lastAttempt = refreshAttemptAt.get(key) ?? 0;
      if (Date.now() - lastAttempt >= Math.min(refreshAfterMs, 30 * 60 * 1000)) {
        refreshAttemptAt.set(key, Date.now());
        void loadFresh().catch(() => undefined);
      }
    }
    return jsonResponseFromSnapshot(cached.data);
  }

  const data = await loadFresh();
  return jsonResponseFromSnapshot(data);
}
