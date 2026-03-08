import { TTLCache, TTL } from "../utils/cache.js";
import { parseLuaTable, type LuaTable, type LuaValue } from "../utils/lua-parser.js";

const FANDOM_API = "https://warframe.fandom.com/api.php";
const cache = new TTLCache<unknown>();

// Cache wiki data for 24h — blueprints change very rarely (only on game updates)
const TTL_WIKI = TTL.STATIC;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BlueprintPart {
  name: string;
  count: number;
  type: string; // "Resource" | "Item" | "PrimePart" | "WarframePart" | "Weapon"
  /** Sub-recipe if this part needs to be crafted */
  cost?: Blueprint;
}

export interface Blueprint {
  name?: string;
  result: string;
  credits: number;
  parts: BlueprintPart[];
  time: number; // seconds
  rush?: number; // platinum
  marketCost?: number; // platinum to buy from market
  bpCost?: number; // credits to buy blueprint
  productCategory?: string;
}

/** All blueprints indexed by item name */
export interface BlueprintDatabase {
  blueprints: Map<string, Blueprint>;
  /** Reverse index: resource/item name -> list of item names that use it */
  usedIn: Map<string, string[]>;
}

// ─── Fandom API ──────────────────────────────────────────────────────────────

/**
 * Fetch a Lua module's source code from the Fandom wiki API.
 */
async function fetchModuleSource(
  moduleName: string,
  timeout = 30_000
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const url = `${FANDOM_API}?action=query&titles=${encodeURIComponent(moduleName)}&prop=revisions&rvprop=content&format=json&rvlimit=1`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${moduleName}`);
    const data = (await response.json()) as {
      query: { pages: Record<string, { revisions?: Array<{ "*": string }> }> };
    };
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    const revisions = pages[pageId]?.revisions;
    if (!revisions || revisions.length === 0) {
      throw new Error(`No content found for ${moduleName}`);
    }
    return revisions[0]["*"];
  } finally {
    clearTimeout(timer);
  }
}

// ─── Lua → Blueprint conversion ──────────────────────────────────────────────

function luaToPart(lua: LuaValue): BlueprintPart | null {
  if (!lua || typeof lua !== "object" || Array.isArray(lua)) return null;
  const t = lua as LuaTable;
  const name = t.Name as string;
  const count = (t.Count as number) ?? 1;
  const type = (t.Type as string) ?? "Resource";
  if (!name) return null;

  const part: BlueprintPart = { name, count, type };

  // Some parts have a nested Cost object (sub-recipe)
  if (t.Cost && typeof t.Cost === "object" && !Array.isArray(t.Cost)) {
    part.cost = luaToBlueprint(t.Cost as LuaTable, name);
  }

  return part;
}

function luaToBlueprint(t: LuaTable, fallbackName: string): Blueprint {
  const parts: BlueprintPart[] = [];
  const luaParts = t.Parts;
  if (Array.isArray(luaParts)) {
    for (const p of luaParts) {
      const part = luaToPart(p);
      if (part) parts.push(part);
    }
  }

  return {
    name: (t.Name as string) ?? undefined,
    result: (t.Result as string) ?? fallbackName,
    credits: (t.Credits as number) ?? 0,
    parts,
    time: (t.Time as number) ?? 0,
    rush: (t.Rush as number) ?? undefined,
    marketCost: (t.MarketCost as number) ?? undefined,
    bpCost: (t.BPCost as number) ?? undefined,
    productCategory: (t.ProductCategory as string) ?? undefined,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Load and parse the complete blueprint database from the Fandom wiki.
 * Cached for 24 hours.
 */
export async function getBlueprintDatabase(): Promise<BlueprintDatabase> {
  const cacheKey = "wiki:blueprints";
  const cached = cache.get(cacheKey) as BlueprintDatabase | undefined;
  if (cached) return cached;

  const luaSrc = await fetchModuleSource("Module:Blueprints/data");
  const parsed = parseLuaTable(luaSrc) as LuaTable;

  const blueprints = new Map<string, Blueprint>();
  const usedIn = new Map<string, string[]>();

  // Process both "Blueprints" and "Suits" sections
  for (const section of ["Blueprints", "Suits"]) {
    const sectionData = parsed[section];
    if (!sectionData || typeof sectionData !== "object" || Array.isArray(sectionData)) continue;

    for (const [key, value] of Object.entries(sectionData as LuaTable)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const bp = luaToBlueprint(value as LuaTable, key);
      blueprints.set(key.toLowerCase(), bp);

      // Build reverse index
      for (const part of bp.parts) {
        const partKey = part.name.toLowerCase();
        const existing = usedIn.get(partKey) ?? [];
        if (!existing.includes(bp.result)) {
          existing.push(bp.result);
        }
        usedIn.set(partKey, existing);

        // Also index sub-recipe parts
        if (part.cost) {
          for (const subPart of part.cost.parts) {
            const subKey = subPart.name.toLowerCase();
            const subExisting = usedIn.get(subKey) ?? [];
            if (!subExisting.includes(bp.result)) {
              subExisting.push(bp.result);
            }
            usedIn.set(subKey, subExisting);
          }
        }
      }
    }
  }

  const db: BlueprintDatabase = { blueprints, usedIn };
  cache.set(cacheKey, db, TTL_WIKI);
  return db;
}

/**
 * Find a blueprint by name (case-insensitive, supports partial match).
 * Returns exact match first, then prefix match, then contains match.
 */
export function findBlueprint(
  db: BlueprintDatabase,
  query: string
): Blueprint | null {
  const q = query.toLowerCase().trim();

  // Exact match
  if (db.blueprints.has(q)) return db.blueprints.get(q)!;

  // Prefix match (shortest wins)
  let bestPrefix: Blueprint | null = null;
  let bestPrefixLen = Infinity;

  for (const [key, bp] of db.blueprints) {
    if (key.startsWith(q) && key.length < bestPrefixLen) {
      bestPrefix = bp;
      bestPrefixLen = key.length;
    }
  }
  if (bestPrefix) return bestPrefix;

  // Contains match (shortest wins)
  let bestContains: Blueprint | null = null;
  let bestContainsLen = Infinity;

  for (const [key, bp] of db.blueprints) {
    if (key.includes(q) && key.length < bestContainsLen) {
      bestContains = bp;
      bestContainsLen = key.length;
    }
  }

  return bestContains;
}

/**
 * Find all items that use a given resource/part as a crafting ingredient.
 */
export function findUsages(
  db: BlueprintDatabase,
  itemName: string
): string[] {
  const q = itemName.toLowerCase().trim();
  return db.usedIn.get(q) ?? [];
}
