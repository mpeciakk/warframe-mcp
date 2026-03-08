// ─── TTL Cache ────────────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  data: T;
  expiry: number; // Unix timestamp ms
}

/** TTL constants in milliseconds */
export const TTL = {
  WORLDSTATE: 60_000,
  DROPS: 5 * 60_000,
  MARKET_ITEMS: 24 * 60 * 60_000,
  STATIC: 24 * 60 * 60_000,
} as const;

export class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data;
  }

  set(key: string, data: T, ttl: number): void {
    this.store.set(key, { data, expiry: Date.now() + ttl });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
