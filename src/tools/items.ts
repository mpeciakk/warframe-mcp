import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as ws from "../api/warframestat.js";
import * as fmt from "../utils/formatting.js";
import type {
  WarframeItem,
  WeaponItem,
  ModItem,
  GenericItem,
  ItemDrop,
} from "../types/index.js";

// ─── Name matching helper ─────────────────────────────────────────────────────

function bestMatch<T extends { name: string }>(
  results: T[],
  query: string
): T | undefined {
  if (results.length === 0) return undefined;
  if (results.length === 1) return results[0];
  const q = query.toLowerCase();
  return (
    results.find((r) => r.name.toLowerCase() === q) ??
    results.find((r) => r.name.toLowerCase().startsWith(q)) ??
    results[0]
  );
}

// ─── Per-item handlers ────────────────────────────────────────────────────────

async function handleWarframe(name: string): Promise<string> {
  const results = await ws.searchWarframes(name);
  const wf = bestMatch(results, name);
  if (!wf) {
    return `=== ${name.toUpperCase()} ===\nNo warframe found for "${name}".\nCheck spelling. Names are case-sensitive (e.g., "Rhino Prime" not "rhino prime").`;
  }
  return formatWarframe(wf);
}

async function handleWeapon(name: string): Promise<string> {
  const results = await ws.searchWeapons(name);
  const weapon = bestMatch(results, name);
  if (!weapon) {
    return `=== ${name.toUpperCase()} ===\nNo weapon found for "${name}".\nCheck spelling.`;
  }
  return formatWeapon(weapon);
}

async function handleMod(name: string): Promise<string> {
  const results = await ws.searchMods(name);
  const mod = bestMatch(results, name);
  if (!mod) {
    return `=== ${name.toUpperCase()} ===\nNo mod found for "${name}".\nCheck spelling.`;
  }
  return formatMod(mod);
}

async function handleItem(name: string): Promise<string> {
  const results = await ws.searchItems(name);
  const item = bestMatch(results, name);
  if (!item) {
    return `=== ${name.toUpperCase()} ===\nNo item found for "${name}".\nCheck spelling.`;
  }
  return formatGenericItem(item);
}

// ─── Batch runner ─────────────────────────────────────────────────────────────

async function batchLookup(
  names: string[],
  handler: (name: string) => Promise<string>,
  errorLabel: string
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const results: string[] = [];
  for (const name of names) {
    try {
      results.push(await handler(name.trim()));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      results.push(
        `=== ${name.toUpperCase()} ===\nError looking up ${errorLabel}: ${msg}`
      );
    }
  }
  return { content: [{ type: "text", text: results.join("\n\n") }] };
}

export function registerItemTools(server: McpServer): void {
  // ─── lookup_warframe ────────────────────────────────────────────────────
  server.tool(
    "lookup_warframe",
    "Look up one or more Warframes by name: stats, abilities, component drop sources, build requirements, and vault status.",
    {
      names: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe("Warframe name(s) (e.g. ['Rhino Prime', 'Wisp'])"),
    },
    async (args) => batchLookup(args.names, handleWarframe, "warframe")
  );

  // ─── lookup_weapon ──────────────────────────────────────────────────────
  server.tool(
    "lookup_weapon",
    "Look up one or more weapons by name: damage stats per fire mode, crit/status, components, and build info.",
    {
      names: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe("Weapon name(s) (e.g. ['Soma Prime', 'Kuva Zarr'])"),
    },
    async (args) => batchLookup(args.names, handleWeapon, "weapon")
  );

  // ─── lookup_mod ─────────────────────────────────────────────────────────
  server.tool(
    "lookup_mod",
    "Look up one or more mods by name: stats progression, polarity, drain, rarity, and drop locations.",
    {
      names: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe("Mod name(s) (e.g. ['Serration', 'Primed Continuity'])"),
    },
    async (args) => batchLookup(args.names, handleMod, "mod")
  );

  // ─── lookup_item ────────────────────────────────────────────────────────
  server.tool(
    "lookup_item",
    "Look up one or more items (arcanes, resources, blueprints, etc.) by name with dynamic formatting of available fields.",
    {
      names: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe(
          "Item name(s) (e.g. ['Arcane Energize', 'Neurodes', 'Forma Blueprint'])"
        ),
    },
    async (args) => batchLookup(args.names, handleItem, "item")
  );
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatWarframe(wf: WarframeItem): string {
  const lines: string[] = [];

  // Header
  const vaultStatus = wf.vaulted ? " | VAULTED" : "";
  const primeTag = wf.isPrime ? "Yes" : "No";
  lines.push(`=== ${wf.name.toUpperCase()} ===`);
  lines.push(
    `Type: ${wf.type ?? "Warframe"} | Prime: ${primeTag}${vaultStatus}`
  );
  lines.push(`Mastery Requirement: ${wf.masteryReq ?? 0}`);

  // Stats
  lines.push("\nSTATS:");
  lines.push(
    `  Health: ${wf.health ?? "?"}    Shield: ${wf.shield ?? "?"}    Armor: ${wf.armor ?? "?"}`
  );
  lines.push(
    `  Energy: ${wf.power ?? wf.energy ?? "?"}    Sprint: ${wf.sprint ?? "?"}`
  );
  if (wf.passiveDescription) {
    lines.push(`Passive: ${wf.passiveDescription}`);
  }

  // Polarities
  if (wf.aura) {
    lines.push(`\nAURA POLARITY: ${fmt.formatPolarity(wf.aura)}`);
  }
  if (wf.polarities && wf.polarities.length > 0) {
    lines.push(
      `MOD POLARITIES: ${wf.polarities.map(fmt.formatPolarity).join(", ")}`
    );
  }

  // Abilities
  if (wf.abilities && wf.abilities.length > 0) {
    lines.push("\nABILITIES:");
    wf.abilities.forEach((a, i) => {
      lines.push(`  ${i + 1}. ${a.name} — ${a.description}`);
    });
  }

  // Components
  if (wf.components && wf.components.length > 0) {
    lines.push("\nCOMPONENTS:");
    wf.components.forEach((comp) => {
      const ducatStr = comp.ducats
        ? ` (${comp.ducats} ducats)`
        : "";
      lines.push(`  ${comp.name}${ducatStr}:`);
      if (comp.drops && comp.drops.length > 0) {
        formatItemDrops(comp.drops).forEach((d) => lines.push(`    ${d}`));
      }
    });
  }

  // Build info
  if (wf.buildPrice) {
    const buildTime = wf.buildTime
      ? fmt.formatDuration(wf.buildTime)
      : "unknown";
    lines.push(
      `\nBuild Cost: ${fmt.formatNumber(wf.buildPrice)} credits | Build Time: ${buildTime}`
    );
  }

  if (wf.introduced) {
    lines.push(`Introduced: ${wf.introduced.name} (${wf.introduced.date})`);
  }

  return lines.join("\n");
}

function formatWeapon(w: WeaponItem): string {
  const lines: string[] = [];

  const vaultStatus = w.vaulted ? " | VAULTED" : "";
  lines.push(`=== ${w.name.toUpperCase()} ===`);
  lines.push(`Category: ${w.type ?? w.category}${vaultStatus}`);
  lines.push(`Mastery Requirement: ${w.masteryReq ?? 0}`);

  // Attacks
  if (w.attacks && w.attacks.length > 0) {
    w.attacks.forEach((atk) => {
      const totalDamage = atk.damage
        ? Object.values(atk.damage).reduce((a, b) => a + b, 0)
        : 0;
      const dmgBreakdown = atk.damage
        ? Object.entries(atk.damage)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${fmt.capitalize(k)} ${v}`)
            .join(" / ")
        : "N/A";
      const trigger = w.trigger ?? "";

      lines.push(
        `\nFIRE MODE: ${atk.name}${trigger ? ` (${trigger})` : ""}`
      );
      lines.push(
        `  Damage: ${totalDamage.toFixed(1)} total (${dmgBreakdown})`
      );
      if (atk.crit_chance !== undefined)
        lines.push(
          `  Crit Chance: ${atk.crit_chance}%  |  Crit Multiplier: ${atk.crit_mult ?? 0}x`
        );
      if (atk.status_chance !== undefined)
        lines.push(`  Status Chance: ${atk.status_chance}%`);
      if (atk.speed !== undefined) lines.push(`  Fire Rate: ${atk.speed} rounds/sec`);
      if (w.magazineSize !== undefined) {
        let magLine = `  Magazine: ${w.magazineSize}`;
        if (w.noise) magLine += `  |  Noise: ${w.noise}`;
        lines.push(magLine);
      }
    });
  }

  // Polarities
  if (w.polarities && w.polarities.length > 0) {
    lines.push(
      `\nMOD POLARITIES: ${w.polarities.map(fmt.formatPolarity).join(", ")}`
    );
  }

  // Components
  if (w.components && w.components.length > 0) {
    lines.push("\nCOMPONENTS:");
    w.components.forEach((comp) => {
      const ducatStr = comp.ducats
        ? ` (${comp.ducats} ducats)`
        : "";
      lines.push(`  ${comp.name}${ducatStr}:`);
      if (comp.drops && comp.drops.length > 0) {
        formatItemDrops(comp.drops).forEach((d) => lines.push(`    ${d}`));
      }
    });
  }

  // Build info
  if (w.buildPrice) {
    const buildTime = w.buildTime
      ? fmt.formatDuration(w.buildTime)
      : "unknown";
    lines.push(
      `\nBuild Cost: ${fmt.formatNumber(w.buildPrice)} credits | Build Time: ${buildTime}`
    );
  }

  if (w.introduced) {
    lines.push(`Introduced: ${w.introduced.name} (${w.introduced.date})`);
  }

  return lines.join("\n");
}

function formatMod(mod: ModItem): string {
  const lines: string[] = [];

  lines.push(`=== ${mod.name.toUpperCase()} ===`);
  lines.push(
    `Type: ${mod.type} | Rarity: ${mod.rarity} | Tradeable: ${mod.tradable ? "Yes" : "No"} | Transmutable: ${mod.transmutable ? "Yes" : "No"}`
  );
  lines.push(
    `Polarity: ${fmt.formatPolarity(mod.polarity)} | Base Drain: ${mod.baseDrain} | Max Rank: ${mod.fusionLimit}`
  );

  // Stats progression
  if (mod.levelStats && mod.levelStats.length > 0) {
    lines.push("\nSTATS PROGRESSION:");
    const show = [0, Math.floor(mod.fusionLimit / 2), mod.fusionLimit];
    const unique = [...new Set(show)].filter(
      (i) => i < mod.levelStats!.length
    );
    unique.forEach((rank) => {
      const stats = mod.levelStats![rank].stats.join(", ");
      const drain = mod.baseDrain + rank;
      const maxLabel = rank === mod.fusionLimit ? "  ← MAX" : "";
      lines.push(`  Rank ${rank}:  ${stats}  (drain: ${drain})${maxLabel}`);
    });
  }

  // Drop locations
  if (mod.drops && mod.drops.length > 0) {
    const sorted = [...mod.drops]
      .sort((a, b) => b.chance - a.chance)
      .slice(0, 10);

    const missions = sorted.filter(
      (d) => d.location.includes("(") || d.location.includes("/")
    );
    const enemies = sorted.filter(
      (d) => !d.location.includes("(") && !d.location.includes("/")
    );

    lines.push("\nBEST DROP LOCATIONS (top 10):");
    if (missions.length > 0) {
      lines.push("  Missions:");
      missions.forEach((d) => {
        lines.push(
          `    • ${d.location} — ${(d.chance * 100).toFixed(2)}% (${d.rarity})`
        );
      });
    }
    if (enemies.length > 0) {
      lines.push("  Enemies:");
      enemies.forEach((d) => {
        lines.push(
          `    • ${d.location} — ${(d.chance * 100).toFixed(2)}% (${d.rarity})`
        );
      });
    }
  }

  return lines.join("\n");
}

function formatGenericItem(item: GenericItem): string {
  const lines: string[] = [];

  lines.push(`=== ${item.name.toUpperCase()} ===`);
  const typeParts: string[] = [];
  if (item.category) typeParts.push(`Category: ${item.category}`);
  if (item.rarity) typeParts.push(`Rarity: ${item.rarity}`);
  if (item.tradable !== undefined)
    typeParts.push(`Tradeable: ${item.tradable ? "Yes" : "No"}`);
  if (typeParts.length > 0) lines.push(typeParts.join(" | "));
  if (item.fusionLimit !== undefined) lines.push(`Max Rank: ${item.fusionLimit}`);

  // Arcane/mod stats progression
  if (item.levelStats && item.levelStats.length > 0) {
    lines.push("\nSTATS PROGRESSION:");
    const maxRank = item.fusionLimit ?? item.levelStats.length - 1;
    const show = [0, maxRank].filter(
      (i) => i < item.levelStats!.length
    );
    const unique = [...new Set(show)];
    unique.forEach((rank) => {
      lines.push(
        `  Rank ${rank}: ${item.levelStats![rank].stats.join(", ")}`
      );
    });
  }

  // Components
  if (item.components && item.components.length > 0) {
    lines.push("\nCOMPONENTS:");
    item.components.forEach((comp) => {
      const ducatStr = comp.ducats ? ` (${comp.ducats} ducats)` : "";
      lines.push(`  ${comp.name}${ducatStr}`);
      if (comp.drops && comp.drops.length > 0) {
        formatItemDrops(comp.drops)
          .slice(0, 5)
          .forEach((d) => lines.push(`    ${d}`));
      }
    });
  }

  // Direct drops
  if (item.drops && item.drops.length > 0 && !item.components?.length) {
    lines.push("\nACQUISITION:");
    item.drops.slice(0, 10).forEach((d) => {
      lines.push(
        `  • ${d.location} — ${(d.chance * 100).toFixed(2)}% (${d.rarity})`
      );
    });
  }

  if (item.vaulted) {
    lines.push("\nVault Status: VAULTED");
  }

  if (item.introduced) {
    lines.push(`Introduced: ${item.introduced.name} (${item.introduced.date})`);
  }

  return lines.join("\n");
}

/** Format ItemDrop[] (decimal chance) into display strings. */
function formatItemDrops(drops: ItemDrop[]): string[] {
  // Group by base relic name for multi-refinement display
  const relicDrops = drops.filter((d) => d.location.includes("Relic"));
  const otherDrops = drops.filter((d) => !d.location.includes("Relic"));

  const lines: string[] = [];

  // Group relics by base name
  const relicMap = new Map<
    string,
    Array<{ refinement: string; chance: number; rarity: string }>
  >();
  for (const d of relicDrops) {
    const base = d.location
      .replace(/\s*\((Intact|Exceptional|Flawless|Radiant)\)\s*$/, "")
      .trim();
    const match = d.location.match(/\((Intact|Exceptional|Flawless|Radiant)\)/);
    const refinement = match?.[1] ?? "Intact";
    if (!relicMap.has(base)) relicMap.set(base, []);
    relicMap.get(base)!.push({
      refinement,
      chance: d.chance,
      rarity: d.rarity,
    });
  }

  for (const [relic, refinements] of relicMap) {
    const chances = refinements
      .sort(
        (a, b) =>
          ["Intact", "Exceptional", "Flawless", "Radiant"].indexOf(
            a.refinement
          ) -
          ["Intact", "Exceptional", "Flawless", "Radiant"].indexOf(
            b.refinement
          )
      )
      .map((r) => `${(r.chance * 100).toFixed(0)}%`)
      .join(" / ");
    const rarity = refinements[0]?.rarity ?? "";
    lines.push(`• ${relic} — ${rarity} (${chances} by refinement)`);
  }

  for (const d of otherDrops) {
    lines.push(
      `• ${d.location} — ${(d.chance * 100).toFixed(2)}% (${d.rarity})`
    );
  }

  return lines;
}
