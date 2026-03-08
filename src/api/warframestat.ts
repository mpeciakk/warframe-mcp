import { TTLCache, TTL } from "../utils/cache.js";
import type {
  VoidTrader,
  VaultTrader,
  Fissure,
  Sortie,
  ArchonHunt,
  Nightwave,
  Invasion,
  SteelPath,
  CetusCycle,
  VallisCycle,
  CambionCycle,
  EarthCycle,
  GameEvent,
  ConstructionProgress,
  DailyDeal,
  Simaris,
  RivenSearchResult,
  GenericItem,
  WarframeItem,
  WeaponItem,
  ModItem,
  DropResult,
  SolNodeResult,
} from "../types/index.js";

const BASE_URL = "https://api.warframestat.us";
const HEADERS: Record<string, string> = {
  Accept: "application/json",
  "Accept-Language": "en",
};
const cache = new TTLCache<unknown>();

async function get<T>(path: string, timeout = 10_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: HEADERS,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** The warframestat.us search endpoints return a single object on exact match, or an array on fuzzy match. Normalize to always return an array. */
async function getArray<T>(path: string, timeout = 10_000): Promise<T[]> {
  const data = await get<T | T[]>(path, timeout);
  if (Array.isArray(data)) return data;
  return [data];
}

function cached<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const hit = cache.get(key) as T | undefined;
  if (hit !== undefined) return Promise.resolve(hit);
  return fetcher().then((data) => {
    cache.set(key, data, ttl);
    return data;
  });
}

// ─── Worldstate (platform-scoped, TTL.WORLDSTATE) ─────────────────────────────

export function getVoidTrader(platform: string): Promise<VoidTrader> {
  return cached(`voidTrader:${platform}`, TTL.WORLDSTATE, () =>
    get<VoidTrader>(`/${platform}/voidTrader`)
  );
}

export function getVaultTrader(platform: string): Promise<VaultTrader> {
  return cached(`vaultTrader:${platform}`, TTL.WORLDSTATE, () =>
    get<VaultTrader>(`/${platform}/vaultTrader`)
  );
}

export function getFissures(platform: string): Promise<Fissure[]> {
  return cached(`fissures:${platform}`, TTL.WORLDSTATE, () =>
    get<Fissure[]>(`/${platform}/fissures`)
  );
}

export function getSortie(platform: string): Promise<Sortie> {
  return cached(`sortie:${platform}`, TTL.WORLDSTATE, () =>
    get<Sortie>(`/${platform}/sortie`)
  );
}

export function getArchonHunt(platform: string): Promise<ArchonHunt> {
  return cached(`archonHunt:${platform}`, TTL.WORLDSTATE, () =>
    get<ArchonHunt>(`/${platform}/archonHunt`)
  );
}

export function getNightwave(platform: string): Promise<Nightwave> {
  return cached(`nightwave:${platform}`, TTL.WORLDSTATE, () =>
    get<Nightwave>(`/${platform}/nightwave`)
  );
}

export function getInvasions(platform: string): Promise<Invasion[]> {
  return cached(`invasions:${platform}`, TTL.WORLDSTATE, () =>
    get<Invasion[]>(`/${platform}/invasions`)
  );
}

export function getSteelPath(platform: string): Promise<SteelPath> {
  return cached(`steelPath:${platform}`, TTL.WORLDSTATE, () =>
    get<SteelPath>(`/${platform}/steelPath`)
  );
}

export function getCetusCycle(platform: string): Promise<CetusCycle> {
  return cached(`cetusCycle:${platform}`, TTL.WORLDSTATE, () =>
    get<CetusCycle>(`/${platform}/cetusCycle`)
  );
}

export function getVallisCycle(platform: string): Promise<VallisCycle> {
  return cached(`vallisCycle:${platform}`, TTL.WORLDSTATE, () =>
    get<VallisCycle>(`/${platform}/vallisCycle`)
  );
}

export function getCambionCycle(platform: string): Promise<CambionCycle> {
  return cached(`cambionCycle:${platform}`, TTL.WORLDSTATE, () =>
    get<CambionCycle>(`/${platform}/cambionCycle`)
  );
}

export function getEarthCycle(platform: string): Promise<EarthCycle> {
  return cached(`earthCycle:${platform}`, TTL.WORLDSTATE, () =>
    get<EarthCycle>(`/${platform}/earthCycle`)
  );
}

export function getEvents(platform: string): Promise<GameEvent[]> {
  return cached(`events:${platform}`, TTL.WORLDSTATE, () =>
    get<GameEvent[]>(`/${platform}/events`)
  );
}

export function getConstructionProgress(
  platform: string
): Promise<ConstructionProgress> {
  return cached(`construction:${platform}`, TTL.WORLDSTATE, () =>
    get<ConstructionProgress>(`/${platform}/constructionProgress`)
  );
}

export function getDailyDeals(platform: string): Promise<DailyDeal[]> {
  return cached(`dailyDeals:${platform}`, TTL.WORLDSTATE, () =>
    get<DailyDeal[]>(`/${platform}/dailyDeals`)
  );
}

export function getSimaris(platform: string): Promise<Simaris> {
  return cached(`simaris:${platform}`, TTL.WORLDSTATE, () =>
    get<Simaris>(`/${platform}/simaris`)
  );
}

export function searchRivens(
  platform: string,
  query: string
): Promise<RivenSearchResult> {
  const q = encodeURIComponent(query);
  return cached(`rivens:${platform}:${query}`, TTL.WORLDSTATE, () =>
    get<RivenSearchResult>(`/${platform}/rivens/search/${q}`)
  );
}

// ─── Static data (no platform prefix, TTL.STATIC) ────────────────────────────

export function searchItems(query: string): Promise<GenericItem[]> {
  const q = encodeURIComponent(query);
  return cached(`items:${query}`, TTL.STATIC, () =>
    getArray<GenericItem>(`/items/${q}`)
  );
}

export function searchWarframes(query: string): Promise<WarframeItem[]> {
  const q = encodeURIComponent(query);
  return cached(`warframes:${query}`, TTL.STATIC, () =>
    getArray<WarframeItem>(`/warframes/${q}`)
  );
}

export function searchWeapons(query: string): Promise<WeaponItem[]> {
  const q = encodeURIComponent(query);
  return cached(`weapons:${query}`, TTL.STATIC, () =>
    getArray<WeaponItem>(`/weapons/${q}`)
  );
}

export function searchMods(query: string): Promise<ModItem[]> {
  const q = encodeURIComponent(query);
  return cached(`mods:${query}`, TTL.STATIC, () =>
    getArray<ModItem>(`/mods/${q}`)
  );
}

// ─── Drop tables (TTL.DROPS) ─────────────────────────────────────────────────

export function searchDrops(query: string): Promise<DropResult[]> {
  const q = encodeURIComponent(query);
  return cached(`drops:${query}`, TTL.DROPS, () =>
    get<DropResult[]>(`/drops/search/${q}`)
  );
}

// ─── Sol nodes (TTL.STATIC) ──────────────────────────────────────────────────

export function searchSolNodes(query: string): Promise<SolNodeResult[]> {
  const q = encodeURIComponent(query);
  return cached(`solNodes:${query}`, TTL.STATIC, () =>
    get<SolNodeResult[]>(`/solNodes/${q}`)
  );
}


