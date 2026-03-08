import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  PLANET_RESOURCES,
  RESOURCE_ALIASES,
  PREFERRED_MISSION_TYPES,
} from "../data/planet-resources.js";
import type { DarkSectorNode } from "../data/planet-resources.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize a resource name to its canonical form */
function normalizeResource(input: string): string {
  const lower = input.toLowerCase().trim();
  if (RESOURCE_ALIASES[lower]) return RESOURCE_ALIASES[lower];

  // Try exact match (case-insensitive) against known resources
  const allResources = new Set<string>();
  for (const pd of Object.values(PLANET_RESOURCES)) {
    for (const r of pd.resources) allResources.add(r);
  }
  for (const r of allResources) {
    if (r.toLowerCase() === lower) return r;
  }

  // Partial match
  for (const r of allResources) {
    if (r.toLowerCase().includes(lower) || lower.includes(r.toLowerCase())) return r;
  }

  // Return title-cased original if no match
  return input
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Find which planets drop a given resource */
function findPlanetsForResource(resource: string): string[] {
  const planets: string[] = [];
  for (const [planet, data] of Object.entries(PLANET_RESOURCES)) {
    if (data.resources.some((r) => r.toLowerCase() === resource.toLowerCase())) {
      planets.push(planet);
    }
  }
  return planets;
}

interface FarmNode {
  name: string;
  planet: string;
  missionType: string;
  isDarkSector: boolean;
  resourceBonus: number;
  creditBonus: number;
  resources: string[];        // resources from the requested list available here
  otherResources: string[];   // bonus resources also on this planet
  score: number;
}

function scoreMissionType(type: string): number {
  const idx = PREFERRED_MISSION_TYPES.findIndex(
    (t) => t.toLowerCase() === type.toLowerCase()
  );
  return idx >= 0 ? PREFERRED_MISSION_TYPES.length - idx : 0;
}

// ─── Registration ────────────────────────────────────────────────────────────

export function registerFarmOptimizerTools(server: McpServer): void {
  server.tool(
    "farm_route_optimizer",
    "Find the best mission nodes to farm multiple resources simultaneously. Cross-references planet drop tables and dark sector bonuses to find overlapping farm spots.",
    {
      resources: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe(
          'Resources you need to farm (e.g. ["Plastids", "Orokin Cells", "Polymer Bundle"])'
        ),
      prefer_mission_type: z
        .enum(["survival", "defense", "excavation", "disruption", "exterminate", "capture", "any"])
        .default("any")
        .optional()
        .describe("Preferred mission type for farming"),
    },
    async (args) => {
      try {
        const preference = args.prefer_mission_type ?? "any";

        // Normalize resource names
        const normalized = args.resources.map(normalizeResource);
        const unique = [...new Set(normalized)];

        // Build planet → matching resources map
        const planetMatches: Record<string, string[]> = {};
        const unknownResources: string[] = [];

        for (const resource of unique) {
          const planets = findPlanetsForResource(resource);
          if (planets.length === 0) {
            unknownResources.push(resource);
            continue;
          }
          for (const planet of planets) {
            if (!planetMatches[planet]) planetMatches[planet] = [];
            planetMatches[planet].push(resource);
          }
        }

        // Build candidate nodes (prefer dark sectors, but include planets without them)
        const candidates: FarmNode[] = [];

        for (const [planet, matchedResources] of Object.entries(planetMatches)) {
          const planetData = PLANET_RESOURCES[planet];
          if (!planetData) continue;

          const otherResources = planetData.resources.filter(
            (r) => !matchedResources.includes(r)
          );

          // Add dark sector nodes
          for (const ds of planetData.darkSectors) {
            candidates.push({
              name: ds.name,
              planet,
              missionType: ds.missionType.replace("Dark Sector ", ""),
              isDarkSector: true,
              resourceBonus: ds.resourceBonus,
              creditBonus: ds.creditBonus,
              resources: matchedResources,
              otherResources,
              score: 0,
            });
          }

          // Add a generic planet entry for non-dark-sector farming
          candidates.push({
            name: `${planet} (any node)`,
            planet,
            missionType: "Various",
            isDarkSector: false,
            resourceBonus: 0,
            creditBonus: 0,
            resources: matchedResources,
            otherResources,
            score: 0,
          });
        }

        // Score candidates
        for (const c of candidates) {
          // Primary: how many requested resources overlap here
          c.score = c.resources.length * 100;

          // Bonus for dark sector
          if (c.isDarkSector) c.score += 30;

          // Bonus for preferred mission type
          if (preference !== "any") {
            if (c.missionType.toLowerCase() === preference.toLowerCase()) {
              c.score += 25;
            }
          } else {
            c.score += scoreMissionType(c.missionType);
          }

          // Small bonus for resource bonus percentage
          c.score += c.resourceBonus;
        }

        // Sort by score descending, deduplicate by name
        candidates.sort((a, b) => b.score - a.score);
        const seen = new Set<string>();
        const top: FarmNode[] = [];
        for (const c of candidates) {
          const key = `${c.planet}/${c.name}`;
          if (seen.has(key)) continue;
          seen.add(key);
          top.push(c);
          if (top.length >= 10) break;
        }

        // ─── Format output ───────────────────────────────────────────────
        const lines: string[] = [];
        lines.push(`## Farm Route Optimizer`);
        lines.push(`**Looking for:** ${unique.join(", ")}`);

        if (unknownResources.length > 0) {
          lines.push(
            `\n**Unknown resources** (not in planet drop tables): ${unknownResources.join(", ")}`
          );
          lines.push(
            `These may be special drops from specific enemies/missions. Try \`search_drops\` for these.`
          );
        }

        if (top.length === 0) {
          lines.push("\nNo farming nodes found for the given resources.");
        } else {
          // Group by overlap count
          const maxOverlap = top[0].resources.length;

          if (maxOverlap >= 2) {
            lines.push(
              `\n### Best Overlap Nodes (${maxOverlap}/${unique.length} resources at once)`
            );
          }

          for (let i = 0; i < top.length; i++) {
            const node = top[i];
            const prevOverlap = i > 0 ? top[i - 1].resources.length : maxOverlap + 1;

            if (node.resources.length < prevOverlap && node.resources.length >= 2) {
              lines.push(
                `\n### ${node.resources.length}-Resource Overlap Nodes`
              );
            } else if (node.resources.length < prevOverlap && node.resources.length === 1) {
              lines.push(`\n### Single-Resource Nodes`);
            }

            const tag = node.isDarkSector ? " [Dark Sector]" : "";
            lines.push(
              `\n**${i + 1}. ${node.name} (${node.planet})** — ${node.missionType}${tag}`
            );
            lines.push(`   Farms: ${node.resources.join(", ")}`);
            if (node.isDarkSector) {
              lines.push(
                `   Bonus: +${node.resourceBonus}% resource drop rate, +${node.creditBonus}% credits`
              );
            }
            if (node.otherResources.length > 0) {
              lines.push(`   Also drops: ${node.otherResources.join(", ")}`);
            }
          }

          // Summary recommendation
          const best = top[0];
          if (best.resources.length >= 2) {
            lines.push(`\n---`);
            lines.push(`### Recommendation`);
            const dsNote = best.isDarkSector
              ? ` with a +${best.resourceBonus}% resource drop rate bonus`
              : "";
            lines.push(
              `Run **${best.name}** on **${best.planet}** (${best.missionType})${dsNote} to farm **${best.resources.join(" and ")}** simultaneously.`
            );
            if (unique.length > best.resources.length) {
              const missing = unique.filter((r) => !best.resources.includes(r));
              lines.push(
                `You'll still need separate runs for: ${missing.join(", ")}`
              );
            }
          }

          lines.push(`\n> **Tip:** Bring a Smeeta Kavat for double resource procs and use Resource Boosters for maximum yield.`);
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Error in farm_route_optimizer: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}
