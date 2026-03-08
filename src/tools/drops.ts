import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as ws from "../api/warframestat.js";
import type { DropResult } from "../types/index.js";

// ─── Per-query handlers ──────────────────────────────────────────────────────

async function handleSearchDrops(
  query: string,
  minChance: number,
  limit: number
): Promise<string> {
  let drops = await ws.searchDrops(query);

  // Filter by min chance
  if (minChance > 0) {
    drops = drops.filter((d) => d.chance >= minChance);
  }

  // Sort by chance desc
  drops.sort((a, b) => b.chance - a.chance);

  // Limit
  const total = drops.length;
  drops = drops.slice(0, limit);

  if (drops.length === 0) {
    return `=== DROP TABLE SEARCH: "${query}" ===\nNo drop sources found for "${query}".\nCheck spelling or try a broader search term.`;
  }

  const lines: string[] = [
    `=== DROP TABLE SEARCH: "${query}" ===`,
    `Found ${total} results (showing top ${drops.length})`,
  ];

  // Group by source type
  const relics = drops.filter((d) => d.place.includes("Relic"));
  const missions = drops.filter(
    (d) => !d.place.includes("Relic") && d.place.includes("(")
  );
  const enemies = drops.filter(
    (d) => !d.place.includes("Relic") && !d.place.includes("(")
  );

  if (relics.length > 0) {
    lines.push("\nFROM RELICS:");
    relics.forEach((d) => {
      lines.push(
        `  • ${d.place} — ${d.item} — ${d.chance.toFixed(2)}% (${d.rarity})`
      );
    });
  }

  if (missions.length > 0) {
    lines.push("\nFROM MISSIONS:");
    missions.forEach((d) => {
      lines.push(
        `  • ${d.place} — ${d.item} — ${d.chance.toFixed(2)}% (${d.rarity})`
      );
    });
  }

  if (enemies.length > 0) {
    lines.push("\nFROM ENEMIES:");
    enemies.forEach((d) => {
      lines.push(
        `  • ${d.place} — ${d.item} — ${d.chance.toFixed(2)}% (${d.rarity})`
      );
    });
  }

  return lines.join("\n");
}

async function handleRelicDrops(
  query: string,
  showRelicSources: boolean
): Promise<string> {
  const allDrops = await ws.searchDrops(query);
  const relicDrops = allDrops.filter((d) => d.place.includes("Relic"));

  if (relicDrops.length === 0) {
    return `=== RELIC DROPS: "${query}" ===\nNo relic sources found for "${query}".\nCheck spelling or try a broader term.`;
  }

  // Group by base relic name
  const relicMap = new Map<
    string,
    Array<{
      refinement: string;
      chance: number;
      rarity: string;
      item: string;
    }>
  >();

  for (const d of relicDrops) {
    const base = normalizeRelicName(d.place);
    if (!relicMap.has(base)) relicMap.set(base, []);
    relicMap.get(base)!.push({
      refinement: getRefinementLevel(d.place),
      chance: d.chance,
      rarity: d.rarity,
      item: d.item,
    });
  }

  const lines: string[] = [
    `=== RELIC DROPS: "${query}" ===`,
    "\nRELICS CONTAINING THIS PART:",
  ];

  for (const [relic, refinements] of relicMap) {
    const rarity = refinements[0]?.rarity ?? "Unknown";
    const sorted = refinements.sort(
      (a, b) =>
        REFINEMENT_ORDER.indexOf(a.refinement) -
        REFINEMENT_ORDER.indexOf(b.refinement)
    );

    const chances: string[] = [];
    for (const ref of REFINEMENT_ORDER) {
      const entry = sorted.find((r) => r.refinement === ref);
      if (entry) {
        chances.push(`${ref}: ${entry.chance.toFixed(0)}%`);
      }
    }

    lines.push(
      `  ${relic} (${rarity.toUpperCase()} slot):`
    );
    lines.push(`    ${chances.join("  |  ")}`);
  }

  // Relic farming locations
  if (showRelicSources) {
    for (const relic of relicMap.keys()) {
      try {
        const relicSources = await ws.searchDrops(relic);
        const missionSources = relicSources
          .filter(
            (d) => !d.place.includes("Relic") && d.place.includes("(")
          )
          .sort((a, b) => b.chance - a.chance)
          .slice(0, 5);

        if (missionSources.length > 0) {
          lines.push(`\nWHERE TO GET ${relic.toUpperCase()} RELICS:`);
          missionSources.forEach((d) => {
            lines.push(
              `  • ${d.place} — ${d.chance.toFixed(2)}%`
            );
          });
        }
      } catch {
        // Skip if relic source lookup fails
      }
    }
  }

  // Recommendation
  const firstRelic = relicMap.keys().next().value;
  const tier = firstRelic ? firstRelic.split(" ")[0] : "Axi";
  lines.push("\nRECOMMENDED:");
  lines.push(`  1. Farm ${tier} relics from the sources above.`);
  lines.push("  2. Refine to Radiant for best rare drop chance.");
  lines.push(
    "  3. Crack at any active fissure (use active_fissures tool)."
  );

  return lines.join("\n");
}

// ─── Tool registration ──────────────────────────────────────────────────────

export function registerDropTools(server: McpServer): void {
  // ─── search_drops ─────────────────────────────────────────────────────
  server.tool(
    "search_drops",
    "Search drop tables for one or more items: shows where they drop, from which relics, missions, and enemies, with drop chances.",
    {
      queries: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe("Item(s) to search for (e.g. ['Ash Prime Systems', 'Condition Overload'])"),
      min_chance: z
        .number()
        .min(0)
        .max(100)
        .default(0)
        .optional()
        .describe("Minimum drop chance percentage (0-100)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20)
        .optional()
        .describe("Max number of results per query"),
    },
    async (args) => {
      const minChance = args.min_chance ?? 0;
      const limit = args.limit ?? 20;
      const results: string[] = [];

      for (const query of args.queries) {
        try {
          results.push(await handleSearchDrops(query.trim(), minChance, limit));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          results.push(
            `=== DROP TABLE SEARCH: "${query}" ===\nError searching drops: ${msg}`
          );
        }
      }

      return { content: [{ type: "text", text: results.join("\n\n") }] };
    }
  );

  // ─── relic_drops ──────────────────────────────────────────────────────
  server.tool(
    "relic_drops",
    "Find which relics contain one or more specific prime parts, with refinement chances and optional relic farming locations.",
    {
      queries: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe("Prime part(s) to search for (e.g. ['Ash Prime Systems Blueprint', 'Nikana Prime Blade'])"),
      show_relic_sources: z
        .boolean()
        .default(true)
        .optional()
        .describe("Also show where to farm each relic"),
    },
    async (args) => {
      const showSources = args.show_relic_sources !== false;
      const results: string[] = [];

      for (const query of args.queries) {
        try {
          results.push(await handleRelicDrops(query.trim(), showSources));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          results.push(
            `=== RELIC DROPS: "${query}" ===\nError searching relic drops: ${msg}`
          );
        }
      }

      return { content: [{ type: "text", text: results.join("\n\n") }] };
    }
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REFINEMENT_ORDER = ["Intact", "Exceptional", "Flawless", "Radiant"];

function normalizeRelicName(place: string): string {
  return place
    .replace(/\s*\((Intact|Exceptional|Flawless|Radiant)\)\s*$/, "")
    .trim();
}

function getRefinementLevel(
  place: string
): string {
  const match = place.match(/\((Intact|Exceptional|Flawless|Radiant)\)/);
  return match?.[1] ?? "Intact";
}
