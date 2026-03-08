import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getTopBuilds,
  getBuildDetail,
  inferCategory,
  type OverframeCategory,
} from "../api/overframe.js";
import type { OverframeBuildPageProps } from "../types/index.js";

const POLARITY_NAMES: Record<number, string> = {
  0: "None",
  1: "Madurai (=)",
  3: "Naramon (-)",
  4: "Zenurik (—)",
  9: "Aura",
};

/**
 * Extract mod names from guideMarkdown links.
 * Links look like: [\[Mod Name\]](/items/arsenal/{modId}/{mod-slug}/)
 */
function extractModNames(
  guideMarkdown: string,
  equippedModIds?: Set<number>
): string[] {
  const modRegex =
    /\[\\?\[?([^\]]+?)\\?\]?\]\(\/items\/arsenal\/(\d+)\/[^)]+\)/g;
  const mods: string[] = [];
  const seen = new Set<number>();
  let match: RegExpExecArray | null;
  while ((match = modRegex.exec(guideMarkdown)) !== null) {
    const name = match[1].replace(/\\/g, "").trim();
    const id = parseInt(match[2], 10);
    if (seen.has(id)) continue;
    seen.add(id);
    if (equippedModIds && !equippedModIds.has(id)) continue;
    mods.push(name);
  }
  return mods;
}

/**
 * Format Overframe stats for a warframe build.
 */
function formatBuildStats(
  stats: Record<string, number | null | undefined>
): string[] {
  const lines: string[] = [];
  const abilityStats: string[] = [];

  const str = stats.AVATAR_ABILITY_STRENGTH;
  const dur = stats.AVATAR_ABILITY_DURATION;
  const rng = stats.AVATAR_ABILITY_RANGE;
  const eff = stats.AVATAR_ABILITY_EFFICIENCY;

  if (str != null) abilityStats.push(`Strength: ${Math.round(str * 100)}%`);
  if (dur != null) abilityStats.push(`Duration: ${Math.round(dur * 100)}%`);
  if (rng != null) abilityStats.push(`Range: ${Math.round(rng * 100)}%`);
  if (eff != null) abilityStats.push(`Efficiency: ${Math.round(eff * 100)}%`);

  if (abilityStats.length > 0) {
    lines.push(`  Abilities: ${abilityStats.join(" | ")}`);
  }

  const hp = stats.AVATAR_HEALTH_MAX;
  const shield = stats.AVATAR_SHIELD_MAX;
  const armor = stats.AVATAR_ARMOUR;
  const energy = stats.AVATAR_POWER_MAX;
  const sprint = stats.AVATAR_SPRINT_SPEED;

  const survivalStats: string[] = [];
  if (hp != null) survivalStats.push(`Health: ${Math.round(hp)}`);
  if (shield != null) survivalStats.push(`Shield: ${Math.round(shield)}`);
  if (armor != null) survivalStats.push(`Armor: ${Math.round(armor)}`);
  if (energy != null) survivalStats.push(`Energy: ${Math.round(energy)}`);
  if (sprint != null) survivalStats.push(`Sprint: ${sprint.toFixed(2)}`);

  if (survivalStats.length > 0) {
    lines.push(`  Survivability: ${survivalStats.join(" | ")}`);
  }

  return lines;
}

/**
 * Format a single build detail into readable text.
 */
function formatBuildDetail(
  props: OverframeBuildPageProps,
  rank: number
): string[] {
  const { data, item, guideMarkdown } = props;
  const lines: string[] = [];

  lines.push(
    `\n--- BUILD #${rank}: ${data.title} ---`
  );
  lines.push(`By: ${data.author.username} | Votes: ${data.score} | Formas: ${data.formas}`);
  lines.push(`Item: ${item.name} (Rank ${data.item_rank})`);

  if (data.platinum_cost > 0 || data.endo_cost > 0) {
    const costs: string[] = [];
    if (data.platinum_cost > 0) costs.push(`${data.platinum_cost}p`);
    if (data.endo_cost > 0) costs.push(`${data.endo_cost.toLocaleString("en-US")} endo`);
    lines.push(`Estimated Cost: ${costs.join(" + ")}`);
  }

  // Stats
  if (data.stats && Object.keys(data.stats).length > 0) {
    const statLines = formatBuildStats(data.stats);
    if (statLines.length > 0) {
      lines.push("\nSTATS:");
      lines.push(...statLines);
    }
  }

  // Mods
  const equippedModIds = new Set<number>();
  if (props.buildState?.mods) {
    for (const m of props.buildState.mods) {
      if (m.modId > 0) equippedModIds.add(m.modId);
    }
  }
  const mods = extractModNames(guideMarkdown || "", equippedModIds.size > 0 ? equippedModIds : undefined);
  if (mods.length > 0) {
    lines.push("\nMODS:");
    mods.forEach((mod, i) => {
      lines.push(`  ${i + 1}. ${mod}`);
    });
  } else if (data.slots && data.slots.length > 0) {
    const filledSlots = data.slots.filter((s) => s.mod > 0);
    if (filledSlots.length > 0) {
      lines.push(`\nMODS: ${filledSlots.length} mods equipped (names unavailable — check Overframe for details)`);
    }
  }

  // Guide summary
  if (guideMarkdown && guideMarkdown.trim().length > 0) {
    const cleaned = guideMarkdown
      .replace(/\[\\?\[?([^\]]+?)\\?\]?\]\([^)]+\)/g, "$1")
      .replace(/[#*_]+/g, "")
      .trim();

    const paragraphs = cleaned
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20);

    if (paragraphs.length > 0) {
      let summary = paragraphs[0];
      if (summary.length > 300) {
        summary = summary.substring(0, 297) + "...";
      }
      lines.push(`\nGUIDE SUMMARY:\n  ${summary}`);
    }
  }

  lines.push(`\nFull build: https://overframe.gg${data.url}`);

  return lines;
}

// ─── Per-item handler ────────────────────────────────────────────────────────

async function handleBuildLookup(
  itemName: string,
  categoryArg: OverframeCategory | undefined,
  limit: number
): Promise<string> {
  // Determine category
  let category: OverframeCategory | null = categoryArg ?? null;
  if (!category) {
    category = inferCategory(itemName);
  }

  if (!category) {
    const lower = itemName.toLowerCase();
    if (
      lower.includes("prime") &&
      !lower.includes("barrel") &&
      !lower.includes("stock") &&
      !lower.includes("blade")
    ) {
      category = "warframes";
    } else {
      category = "warframes";
    }
  }

  // Fetch build list
  let builds = await getTopBuilds(category, itemName, limit);

  // If no results and we guessed warframes, try other categories
  if (builds.length === 0 && !categoryArg) {
    const categoriesToTry: OverframeCategory[] = [
      "primary-weapons",
      "secondary-weapons",
      "melee-weapons",
      "archwing",
      "sentinels",
    ];
    const remaining = categoriesToTry.filter((c) => c !== category);

    for (const cat of remaining) {
      builds = await getTopBuilds(cat, itemName, limit);
      if (builds.length > 0) {
        category = cat;
        break;
      }
    }
  }

  if (builds.length === 0) {
    return `=== BUILDS: "${itemName}" ===\nNo builds found on Overframe for "${itemName}".\n\nPossible reasons:\n  • Item name misspelled (try the exact in-game name)\n  • No community builds submitted yet\n  • Item may be in a different category — try specifying the category parameter`;
  }

  const lines: string[] = [
    `=== TOP BUILDS: ${itemName.toUpperCase()} ===`,
    `Source: Overframe.gg | Category: ${category}`,
    `Showing top ${Math.min(builds.length, limit)} build(s)`,
  ];

  // Fetch details for each build
  const detailPromises = builds.slice(0, limit).map((b) =>
    getBuildDetail(b.id).catch(() => null)
  );
  const details = await Promise.all(detailPromises);

  let detailCount = 0;
  for (let i = 0; i < builds.length && i < limit; i++) {
    const detail = details[i];
    if (detail) {
      detailCount++;
      lines.push(...formatBuildDetail(detail, detailCount));
    } else {
      detailCount++;
      const b = builds[i];
      lines.push(`\n--- BUILD #${detailCount}: ${b.title} ---`);
      lines.push(`By: ${b.author.username} | Votes: ${b.score} | Formas: ${b.formas}`);
      lines.push(`Full build: https://overframe.gg${b.url}`);
    }
  }

  lines.push(
    `\nNOTE: Build data sourced from Overframe.gg community submissions. Stats may vary with mod rank and loadout configuration.`
  );

  return lines.join("\n");
}

// ─── Tool registration ──────────────────────────────────────────────────────

export function registerBuildTools(server: McpServer): void {
  server.tool(
    "lookup_builds",
    "Find popular community mod builds for one or more Warframes, weapons, or companions from Overframe.gg. Returns top-voted builds with mod lists, computed stats, and build guides.",
    {
      item_names: z
        .array(z.string())
        .min(1)
        .max(5)
        .describe(
          "Name(s) of items to find builds for (e.g. ['Saryn Prime', 'Ignis Wraith'])"
        ),
      category: z
        .enum([
          "warframes",
          "primary-weapons",
          "secondary-weapons",
          "melee-weapons",
          "archwing",
          "sentinels",
        ])
        .optional()
        .describe(
          "Overframe category. If omitted, the tool will try to infer it from the item name."
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(5)
        .default(3)
        .optional()
        .describe("Number of top builds to return per item (default 3, max 5)"),
    },
    async (args) => {
      const limit = args.limit ?? 3;
      const results: string[] = [];

      for (const itemName of args.item_names) {
        try {
          results.push(await handleBuildLookup(itemName.trim(), args.category, limit));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          results.push(
            `=== BUILDS: "${itemName}" ===\nError looking up builds: ${msg}\n\nOverframe.gg may be temporarily unavailable. Try again in a moment.`
          );
        }
      }

      return { content: [{ type: "text", text: results.join("\n\n") }] };
    }
  );
}
