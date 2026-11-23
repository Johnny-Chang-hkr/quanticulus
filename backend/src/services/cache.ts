type CacheEntry<T> = {
  expiresAt: number;
  updatedAt?: string;
  value?: T;
  pending?: Promise<CachedValue<T>>;
};

export type CachedValue<T> = { value: T; updatedAt: string };
const entries = new Map<string, CacheEntry<unknown>>();
const maximumEntries = 1000;

function pruneCache(now: number) {
  for (const [key, entry] of entries) {
    if (!entry.pending && entry.expiresAt <= now) entries.delete(key);
  }
  if (entries.size < maximumEntries) return;
  for (const [key, entry] of entries) {
    if (!entry.pending) {
      entries.delete(key);
      break;
    }
  }
}

export async function cachedValue<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<CachedValue<T>> {
  const now = Date.now();
  let existing = entries.get(key) as CacheEntry<T> | undefined;
  if (existing?.value !== undefined && existing.expiresAt > Date.now()) {
    return { value: existing.value, updatedAt: existing.updatedAt ?? new Date().toISOString() };
  }
  if (existing?.pending) return existing.pending;
  pruneCache(now);
  existing = entries.get(key) as CacheEntry<T> | undefined;
  if (existing?.value !== undefined && existing.expiresAt > now) {
    return { value: existing.value, updatedAt: existing.updatedAt ?? new Date().toISOString() };
  }
  if (existing?.pending) return existing.pending;

  const pending = load().then((value) => {
    const updatedAt = new Date().toISOString();
    entries.set(key, { value, updatedAt, expiresAt: Date.now() + ttlMs });
    return { value, updatedAt };
  }).catch((error: unknown) => {
    entries.delete(key);
    throw error;
  });
  entries.set(key, { pending, expiresAt: 0 });
  return pending;
}

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const result = await cachedValue(key, ttlMs, load);
  return result.value;
}

export function clearCache() {
  entries.clear();
}
