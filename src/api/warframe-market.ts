import { TTLCache, TTL } from "../utils/cache.js";
import type {
  MarketItem,
  MarketOrder,
  MarketOrdersResponse,
  MarketPriceResult,
  PriceSummary,
} from "../types/index.js";

const BASE_URL = "https://api.warframe.market/v2";
const HEADERS: Record<string, string> = { Accept: "application/json" };
const cache = new TTLCache<unknown>();

// ─── Rate limiter ─────────────────────────────────────────────────────────────

class RateLimiter {
  private timestamps: number[] = [];
  constructor(
    private maxRequests = 3,
    private windowMs = 1000
  ) {}

  async throttle(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldest) + 10;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.timestamps.push(Date.now());
  }
}

const rateLimiter = new RateLimiter(3, 1000);

async function get<T>(path: string): Promise<T> {
  await rateLimiter.throttle();
  const response = await fetch(`${BASE_URL}${path}`, { headers: HEADERS });
  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return get<T>(path);
  }
  if (!response.ok)
    throw new Error(`warframe.market HTTP ${response.status}: ${path}`);
  return (await response.json()) as T;
}

// ─── Items map (name → slug) ─────────────────────────────────────────────────

/** Returns Map<normalizedName, slug>. Cached 24h. */
export async function getItemsMap(): Promise<Map<string, string>> {
  const cacheKey = "market:items";
  const hit = cache.get(cacheKey) as Map<string, string> | undefined;
  if (hit) return hit;

  const response = await get<{ data: MarketItem[] }>("/items");
  const items = response.data ?? (response as unknown as MarketItem[]);
  const map = new Map<string, string>();

  for (const item of items) {
    const name = item.i18n?.en?.name;
    if (name && item.slug) {
      map.set(name.toLowerCase().trim(), item.slug);
    }
  }

  cache.set(cacheKey, map, TTL.MARKET_ITEMS);
  return map;
}

/** Resolves item name to market slug. Throws with suggestions if not found. */
export async function resolveSlug(itemName: string): Promise<string> {
  const map = await getItemsMap();
  const normalized = itemName.toLowerCase().trim();

  // Exact match
  const exact = map.get(normalized);
  if (exact) return exact;

  // Contains match — pick shortest key
  const containsMatches: Array<[string, string]> = [];
  for (const [key, slug] of map) {
    if (key.includes(normalized)) {
      containsMatches.push([key, slug]);
    }
  }
  if (containsMatches.length > 0) {
    containsMatches.sort((a, b) => a[0].length - b[0].length);
    return containsMatches[0][1];
  }

  // No match — suggest closest
  const allKeys = Array.from(map.keys());
  const scored = allKeys
    .map((key) => ({ key, score: substringScore(key, normalized) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const suggestions =
    scored.length > 0
      ? scored.map((s) => `  • ${s.key}`).join("\n")
      : "  (no similar items found)";

  throw new Error(
    `Item "${itemName}" not found on warframe.market.\nDid you mean:\n${suggestions}`
  );
}

function substringScore(candidate: string, query: string): number {
  let score = 0;
  const words = query.split(/\s+/);
  for (const word of words) {
    if (candidate.includes(word)) score += word.length;
  }
  return score;
}

/** Fetch live orders for a slug. */
export async function getOrders(slug: string): Promise<MarketOrder[]> {
  const response = await get<MarketOrdersResponse>(`/orders/item/${slug}`);
  return response.data ?? [];
}

/** Full price check pipeline. */
export async function priceCheck(
  itemName: string,
  options?: { modRank?: number; onlineOnly?: boolean; platform?: string }
): Promise<MarketPriceResult> {
  const onlineOnly = options?.onlineOnly ?? true;
  const modRank = options?.modRank;
  const platform = options?.platform;

  const slug = await resolveSlug(itemName);
  let orders = await getOrders(slug);

  // Filter offline
  if (onlineOnly) {
    orders = orders.filter((o) => o.user.status !== "offline");
  }

  // Filter by mod rank
  if (modRank !== undefined) {
    orders = orders.filter((o) => o.rank === modRank);
  }

  // Filter by platform
  if (platform) {
    orders = orders.filter(
      (o) => o.user.platform === platform || o.user.crossplay
    );
  }

  const sells = orders
    .filter((o) => o.type === "sell")
    .sort((a, b) => a.platinum - b.platinum);
  const buys = orders
    .filter((o) => o.type === "buy")
    .sort((a, b) => b.platinum - a.platinum);

  const sellSummary = computeSummary(sells.map((o) => o.platinum));
  const buySummary = computeSummary(buys.map((o) => o.platinum));

  const cheapestSellers = sells.slice(0, 5).map((o) => ({
    ingameName: o.user.ingameName,
    platinum: o.platinum,
    quantity: o.quantity,
    status: o.user.status,
    rank: o.rank,
  }));

  // Resolve display name from items map
  const map = await getItemsMap();
  let displayName = itemName;
  for (const [key, s] of map) {
    if (s === slug) {
      // Capitalize properly
      displayName = key
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      break;
    }
  }

  return {
    itemName: displayName,
    slug,
    sell: sellSummary,
    buy: buySummary,
    cheapestSellers,
  };
}

function computeSummary(prices: number[]): PriceSummary {
  if (prices.length === 0) {
    return { min: 0, max: 0, median: 0, average: 0, count: 0 };
  }
  const sorted = [...prices].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];
  const average = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
  return { min, max, median, average, count: sorted.length };
}
