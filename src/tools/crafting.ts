import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getBlueprintDatabase,
  findBlueprint,
  findUsages,
  type Blueprint,
  type BlueprintPart,
} from "../api/wiki.js";
import { formatDuration, formatNumber } from "../utils/formatting.js";

// ─── Formatting helpers ──────────────────────────────────────────────────────

function formatParts(parts: BlueprintPart[], indent = "  "): string[] {
  const lines: string[] = [];
  for (const part of parts) {
    let line = `${indent}• ${part.count}x ${part.name}`;
    if (part.type && part.type !== "Resource") {
      line += ` (${part.type})`;
    }
    lines.push(line);

    // Show sub-recipe if this part must be crafted
    if (part.cost) {
      lines.push(`${indent}  └─ Crafted from:`);
      lines.push(`${indent}     Credits: ${formatNumber(part.cost.credits)}`);
      for (const sub of part.cost.parts) {
        let subLine = `${indent}     • ${sub.count}x ${sub.name}`;
        if (sub.type && sub.type !== "Resource") {
          subLine += ` (${sub.type})`;
        }
        lines.push(subLine);
      }
      if (part.cost.time > 0) {
        lines.push(`${indent}     Build time: ${formatDuration(part.cost.time)}`);
      }
    }
  }
  return lines;
}

function formatBlueprint(bp: Blueprint): string {
  const lines: string[] = [];

  lines.push(`=== CRAFTING: ${bp.result.toUpperCase()} ===`);
  if (bp.productCategory) {
    lines.push(`Category: ${bp.productCategory}`);
  }
  lines.push("");

  // Credits
  lines.push(`Credits: ${formatNumber(bp.credits)}`);

  // Parts
  if (bp.parts.length > 0) {
    lines.push("\nComponents:");
    lines.push(...formatParts(bp.parts));
  }

  // Build time
  if (bp.time > 0) {
    lines.push(`\nBuild Time: ${formatDuration(bp.time)}`);
  }

  // Costs
  const costs: string[] = [];
  if (bp.rush != null && bp.rush > 0) {
    costs.push(`Rush: ${bp.rush}p`);
  }
  if (bp.marketCost != null && bp.marketCost > 0) {
    costs.push(`Market: ${bp.marketCost}p`);
  }
  if (bp.bpCost != null && bp.bpCost > 0) {
    costs.push(`Blueprint: ${formatNumber(bp.bpCost)} credits`);
  }
  if (costs.length > 0) {
    lines.push(costs.join(" | "));
  }

  // Total resource summary (flatten sub-recipes)
  const totalResources = new Map<string, number>();
  let totalCredits = bp.credits;

  for (const part of bp.parts) {
    if (part.cost) {
      totalCredits += part.cost.credits * part.count;
      for (const sub of part.cost.parts) {
        const key = sub.name;
        totalResources.set(key, (totalResources.get(key) ?? 0) + sub.count * part.count);
      }
    } else {
      totalResources.set(part.name, (totalResources.get(part.name) ?? 0) + part.count);
    }
  }

  const hasSubRecipes = bp.parts.some((p) => p.cost);
  if (hasSubRecipes && totalResources.size > 0) {
    lines.push("\n--- TOTAL RESOURCES (all components) ---");
    lines.push(`Credits: ${formatNumber(totalCredits)}`);
    const sorted = [...totalResources.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [name, count] of sorted) {
      lines.push(`  • ${count}x ${name}`);
    }
  }

  lines.push("\nSource: warframe.fandom.com blueprint data");
  return lines.join("\n");
}

// ─── Per-item handlers ──────────────────────────────────────────────────────

async function handleCraftingRequirements(itemName: string): Promise<string> {
  const db = await getBlueprintDatabase();
  const bp = findBlueprint(db, itemName);

  if (!bp) {
    return `=== CRAFTING: "${itemName.toUpperCase()}" ===\nNo crafting recipe found for "${itemName}".\n\nPossible reasons:\n  • Item name misspelled (try the exact in-game name)\n  • Item is not craftable (quest reward, event exclusive, etc.)\n  • Item purchased directly from the Market with Platinum`;
  }

  return formatBlueprint(bp);
}

async function handleCraftingUsage(itemName: string): Promise<string> {
  const db = await getBlueprintDatabase();
  const usages = findUsages(db, itemName);

  const lines: string[] = [
    `=== USAGE: ${itemName.toUpperCase()} ===`,
  ];

  if (usages.length === 0) {
    lines.push(`\n"${itemName}" is not used as a crafting ingredient in any known recipe.`);
    lines.push(`\nThis could mean:`);
    lines.push(`  • It's safe to sell or trade`);
    lines.push(`  • It's a finished item (not a component)`);
    lines.push(`  • The name might be slightly different — try the exact in-game name`);
  } else {
    lines.push(`\nUsed in ${usages.length} recipe(s):\n`);

    const sorted = [...usages].sort((a, b) => a.localeCompare(b));
    for (const item of sorted) {
      const bp = findBlueprint(db, item);
      if (bp) {
        const part = bp.parts.find(
          (p) => p.name.toLowerCase() === itemName.toLowerCase()
        );
        if (part) {
          lines.push(`  • ${bp.result} — needs ${part.count}x`);
        } else {
          let found = false;
          for (const p of bp.parts) {
            if (p.cost) {
              const sub = p.cost.parts.find(
                (s) => s.name.toLowerCase() === itemName.toLowerCase()
              );
              if (sub) {
                lines.push(`  • ${bp.result} (via ${p.name}) — needs ${sub.count}x`);
                found = true;
                break;
              }
            }
          }
          if (!found) {
            lines.push(`  • ${bp.result}`);
          }
        }
      } else {
        lines.push(`  • ${item}`);
      }
    }

    if (usages.length > 0) {
      lines.push(`\nDo NOT sell this item if you still need to craft any of the above.`);
    }
  }

  lines.push("\nSource: warframe.fandom.com blueprint data");
  return lines.join("\n");
}

// ─── Tool registration ──────────────────────────────────────────────────────

export function registerCraftingTools(server: McpServer): void {
  // ── crafting_requirements ──────────────────────────────────────────────────
  server.tool(
    "crafting_requirements",
    "Look up the full crafting recipe for one or more Warframe items — components, credits, build time, and sub-recipes. Answers 'what do I need to build X?'",
    {
      item_names: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe("Item name(s) to look up crafting for (e.g. ['Wisp', 'Ignis Wraith', 'Vauban Prime'])"),
    },
    async (args) => {
      const results: string[] = [];

      for (const itemName of args.item_names) {
        try {
          results.push(await handleCraftingRequirements(itemName.trim()));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          results.push(
            `=== CRAFTING: ${itemName.toUpperCase()} ===\nError looking up crafting recipe: ${msg}`
          );
        }
      }

      return { content: [{ type: "text", text: results.join("\n\n") }] };
    }
  );

  // ── crafting_usage ─────────────────────────────────────────────────────────
  server.tool(
    "crafting_usage",
    "Find all items that use one or more given resources or components as crafting ingredients. Answers 'what is this used for?' and 'is it safe to sell?'",
    {
      item_names: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe("Resource or component name(s) (e.g. ['Neurodes', 'Argon Crystal', 'Ash Systems'])"),
    },
    async (args) => {
      const results: string[] = [];

      for (const itemName of args.item_names) {
        try {
          results.push(await handleCraftingUsage(itemName.trim()));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          results.push(
            `=== USAGE: ${itemName.toUpperCase()} ===\nError looking up item usage: ${msg}`
          );
        }
      }

      return { content: [{ type: "text", text: results.join("\n\n") }] };
    }
  );
}
