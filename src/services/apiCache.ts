type CacheEntry<T> = {
    data: T;
    expiresAt: number;
    inflight?: Promise<unknown>;
};

const store = new Map<string, CacheEntry<unknown>>();

export const CACHE_KEY = {
    members: "members",
    persons: "persons",
    serviceProviders: "service-providers",
    receiptConcepts: "receipt-concepts",
    externalServices: "external-services",
    services: "services",
    specialServices: "special-services",
    duesConfig: "dues-config",
    membersDebtStatus: "members-debt-status",
} as const;

const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Returns cached data if present and fresh.
 * If stale, serves the stale value immediately and revalidates in the
 * background so the next call returns fresh data.
 * If there is no cached value at all, awaits the network fetch.
 */
export function getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs: number = DEFAULT_TTL_MS): Promise<T> {
    const entry = store.get(key) as CacheEntry<T> | undefined;

    if (entry) {
        if (entry.inflight) return entry.inflight as Promise<T>;
        if (Date.now() < entry.expiresAt) return Promise.resolve(entry.data);
        // stale: return stale data now and revalidate in the background
        const stale = Promise.resolve(entry.data);
        const background: Promise<void> = fetcher()
            .then((data) => {
                store.set(key, { data, expiresAt: Date.now() + ttlMs });
            })
            .catch(() => {
                store.delete(key);
            })
            .finally(() => {
                const cur = store.get(key) as CacheEntry<T> | undefined;
                if (cur && cur.inflight === background) delete cur.inflight;
            });
        entry.inflight = background;
        return stale;
    }

    const promise = fetcher()
        .then((data) => {
            store.set(key, { data, expiresAt: Date.now() + ttlMs });
            return data;
        })
        .catch((err) => {
            store.delete(key);
            throw err;
        });
    store.set(key, { data: undefined as unknown as T, expiresAt: 0, inflight: promise });
    return promise;
}

/** Forces a fresh network fetch and replaces the cached value. */
export async function revalidate<T>(key: string, fetcher: () => Promise<T>, ttlMs: number = DEFAULT_TTL_MS): Promise<T> {
    const data = await fetcher();
    store.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
}

/** Removes cached entries whose key starts with the given prefix. */
export function invalidate(keyOrPrefix: string): void {
    for (const key of Array.from(store.keys())) {
        if (key === keyOrPrefix || key.startsWith(`${keyOrPrefix}:`)) {
            store.delete(key);
        }
    }
}
