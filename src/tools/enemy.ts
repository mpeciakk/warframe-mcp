import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as ws from "../api/warframestat.js";

// ─── Per-enemy handler ──────────────────────────────────────────────────────

async function handleEnemySpawn(
  enemy: string,
  missionPreference: string,
  steelPath: boolean
): Promise<string> {
  const [dropResults, solNodeResults] = await Promise.allSettled([
    ws.searchDrops(enemy),
    ws.searchSolNodes(enemy),
  ]);

  const confirmed: Array<{
    node: string;
    type?: string;
    enemy?: string;
  }> = [];
  const likely: Array<{
    node: string;
    type?: string;
    enemy?: string;
  }> = [];

  // Confirmed from drop tables
  if (dropResults.status === "fulfilled") {
    const drops = dropResults.value;
    const enemyWordRe = new RegExp(
      `(?:^|[\\s/,(-])${enemy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[\\s/,)\\-]|$)`,
      "i"
    );

    for (const d of drops) {
      // Skip relics, syndicate shops
      if (/relic(\s*\(|$)/i.test(d.place)) continue;

      // Mission node format: "Planet/Node (Type)" — must contain "/"
      if (d.place.includes("/") && d.place.includes("(")) {
        if (enemyWordRe.test(d.place) || enemyWordRe.test(d.item)) {
          if (!confirmed.some((c) => c.node === d.place)) {
            confirmed.push({ node: d.place });
          }
        }
      }
    }
  }

  // Likely from sol nodes (faction nodes)
  if (solNodeResults.status === "fulfilled") {
    const results = solNodeResults.value;
    for (const result of results) {
      for (const node of result.nodes) {
        if (!confirmed.some((c) => c.node === node.value)) {
          if (!likely.some((l) => l.node === node.value)) {
            likely.push({
              node: node.value,
              type: node.type,
              enemy: node.enemy,
            });
          }
        }
      }
    }
  }

  // Apply mission preference filter
  if (missionPreference !== "any") {
    const prefLower = missionPreference.toLowerCase();
    const filterFn = (n: { type?: string; node: string }) => {
      const type = (n.type ?? n.node).toLowerCase();
      return type.includes(prefLower);
    };
    const filteredLikely = likely.filter(filterFn);
    if (filteredLikely.length > 0) {
      likely.length = 0;
      likely.push(...filteredLikely);
    }
  }

  const lines: string[] = [
    `=== ENEMY SPAWN FINDER: "${enemy}" ===`,
  ];

  if (steelPath) {
    lines.push("Mode: Steel Path (enemies are level 100+)");
  }

  if (confirmed.length === 0 && likely.length === 0) {
    lines.push(
      `\nNo spawn locations found for "${enemy}".`
    );
    lines.push(
      "This enemy may not have specific confirmed nodes in the drop tables."
    );
    lines.push(
      "Try checking the Warframe Wiki for detailed spawn information."
    );
    return lines.join("\n");
  }

  if (confirmed.length > 0) {
    lines.push("\nCONFIRMED (from drop tables):");
    confirmed.slice(0, 10).forEach((c) => {
      const typePart = c.type ? ` — ${c.type}` : "";
      const enemyPart = c.enemy ? `, ${c.enemy}` : "";
      lines.push(`  • ${c.node}${typePart}${enemyPart}`);
    });
  }

  if (likely.length > 0) {
    lines.push("\nLIKELY (faction nodes):");
    likely.slice(0, 10).forEach((l) => {
      const typePart = l.type ? ` — ${l.type}` : "";
      const enemyPart = l.enemy ? `, ${l.enemy}` : "";
      lines.push(`  • ${l.node}${typePart}${enemyPart}`);
    });
  }

  return lines.join("\n");
}

// ─── Tool registration ──────────────────────────────────────────────────────

export function registerEnemyTools(server: McpServer): void {
  server.tool(
    "find_enemy_spawn",
    "Find where one or more specific enemies spawn: confirmed locations from drop tables and likely faction nodes.",
    {
      enemies: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe("Enemy name(s) (e.g. ['Nox', 'Corrupted Bombard'])"),
      mission_preference: z
        .enum([
          "any",
          "survival",
          "defense",
          "extermination",
          "capture",
          "interception",
        ])
        .default("any")
        .optional()
        .describe("Preferred mission type"),
      steel_path: z
        .boolean()
        .default(false)
        .optional()
        .describe("Note Steel Path level scaling"),
    },
    async (args) => {
      const pref = args.mission_preference ?? "any";
      const steelPath = args.steel_path ?? false;
      const results: string[] = [];

      for (const enemy of args.enemies) {
        try {
          results.push(await handleEnemySpawn(enemy.trim(), pref, steelPath));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          results.push(
            `=== ENEMY SPAWN FINDER: "${enemy}" ===\nError finding enemy spawns: ${msg}`
          );
        }
      }

      return { content: [{ type: "text", text: results.join("\n\n") }] };
    }
  );
}
