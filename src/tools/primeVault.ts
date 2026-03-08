import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as ws from "../api/warframestat.js";
import * as fmt from "../utils/formatting.js";

// ─── Per-item handler ────────────────────────────────────────────────────────

async function handlePrimeVaultStatus(name: string): Promise<string> {
  // Try warframes first, fall back to items
  let item: { name: string; vaulted?: boolean; components?: Array<{ name: string; ducats?: number; drops?: Array<{ chance: number; location: string; rarity: string }> }> } | undefined;
  let isWarframe = false;

  try {
    const warframes = await ws.searchWarframes(name);
    if (warframes.length > 0) {
      const q = name.toLowerCase();
      item =
        warframes.find((w) => w.name.toLowerCase() === q) ??
        warframes.find((w) => w.name.toLowerCase().startsWith(q)) ??
        warframes[0];
      isWarframe = true;
    }
  } catch {
    // Not a warframe
  }

  if (!item) {
    const items = await ws.searchItems(name);
    if (items.length > 0) {
      const q = name.toLowerCase();
      item =
        items.find((i) => i.name.toLowerCase() === q) ??
        items.find((i) => i.name.toLowerCase().startsWith(q)) ??
        items[0];
    }
  }

  if (!item) {
    return `=== PRIME VAULT STATUS: ${name.toUpperCase()} ===\nNo prime item found for "${name}".\nCheck spelling (e.g., "Ash Prime" not "ash prime").`;
  }

  // Check Varzia
  let varzia;
  try {
    varzia = await ws.getVaultTrader("pc");
  } catch {
    // Varzia data unavailable
  }

  const itemNameLower = item.name.toLowerCase();
  const inVarzia =
    varzia?.inventory?.some((v) =>
      v.item.toLowerCase().includes(itemNameLower)
    ) ?? false;

  const vaulted = item.vaulted ?? false;
  let status: string;

  const lines: string[] = [`=== PRIME VAULT STATUS: ${item.name} ===`];

  if (!vaulted) {
    status = "FARMABLE";
    lines.push(`Status: ${status}`);
    lines.push("Relics containing this item's parts are currently available in the drop tables.\n");

    // Show relic sources from components
    if (item.components) {
      lines.push("RELIC DROP SOURCES:");
      for (const comp of item.components) {
        if (comp.drops && comp.drops.length > 0) {
          const relicDrops = comp.drops.filter((d) =>
            d.location.includes("Relic")
          );
          if (relicDrops.length > 0) {
            lines.push(`  ${comp.name}:`);
            relicDrops.forEach((d) => {
              lines.push(
                `    • ${d.location} — ${(d.chance * 100).toFixed(0)}% (${d.rarity})`
              );
            });
          }
        }
      }
    }
  } else if (inVarzia) {
    status = "PRIME RESURGENCE";
    lines.push(`Status: ${status}`);
    lines.push(
      `Available from Varzia at ${varzia?.location ?? "Maroo's Bazaar"}`
    );
    if (varzia) {
      lines.push(`Rotation expires: ${varzia.expiry?.substring(0, 10) ?? "unknown"}\n`);
      const varziaItems = varzia.inventory.filter((v) =>
        v.item.toLowerCase().includes(itemNameLower)
      );
      if (varziaItems.length > 0) {
        lines.push("VARZIA INVENTORY:");
        varziaItems.forEach((v) => {
          const costParts: string[] = [];
          if (v.ducats) costParts.push(`${v.ducats} Aya`);
          if (v.credits) costParts.push(`${fmt.formatNumber(v.credits)} credits`);
          lines.push(
            `  • ${v.item} — ${costParts.join(" + ") || "Free"}`
          );
        });
      }
    }
  } else {
    status = "FULLY VAULTED";
    lines.push(`Status: ${status}`);
    lines.push(
      "Not available in Varzia's current rotation.\n"
    );
    lines.push(
      "To obtain: trade with other players (use market_price_check)."
    );

    // Show current Varzia rotation info
    if (varzia && varzia.inventory.length > 0) {
      const primeItems = varzia.inventory
        .filter((v) => v.item.includes("Prime") && v.ducats && v.ducats > 0)
        .map((v) => v.item)
        .slice(0, 3);
      if (primeItems.length > 0) {
        lines.push(
          `Current Prime Resurgence: ${primeItems.join(", ")} — active until ${varzia.expiry?.substring(0, 10) ?? "unknown"}`
        );
      }
    }
  }

  // Part ducat values
  if (item.components && item.components.some((c) => c.ducats)) {
    lines.push("\nPARTS & DUCAT VALUES:");
    const ducatParts = item.components
      .filter((c) => c.ducats)
      .map((c) => `${c.name}: ${c.ducats} ducats`);
    lines.push(`  ${ducatParts.join("  |  ")}`);
  }

  return lines.join("\n");
}

// ─── Tool registration ──────────────────────────────────────────────────────

export function registerPrimeVaultTools(server: McpServer): void {
  server.tool(
    "prime_vault_status",
    "Check if one or more Prime items are vaulted, available from Varzia (Prime Resurgence), or currently farmable from relics.",
    {
      names: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe("Prime item name(s) (e.g. ['Ash Prime', 'Soma Prime'])"),
    },
    async (args) => {
      const results: string[] = [];

      for (const name of args.names) {
        try {
          results.push(await handlePrimeVaultStatus(name.trim()));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          results.push(
            `=== PRIME VAULT STATUS: ${name.toUpperCase()} ===\nError checking prime vault status: ${msg}`
          );
        }
      }

      return { content: [{ type: "text", text: results.join("\n\n") }] };
    }
  );
}
