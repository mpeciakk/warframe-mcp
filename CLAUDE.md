# Warframe MCP Server

## WHAT YOU ARE BUILDING

TypeScript MCP server (stdio + Streamable HTTP transport) providing 19 tools for real-time Warframe game data. No auth, no database — HTTP calls to public APIs wrapped as MCP tools, plus bundled static data for resources and color palettes.

## READ THESE DOCS IN ORDER

1. `docs/01-OVERVIEW.md` — architecture, directory layout, full dependency list
2. `docs/02-API-REFERENCE.md` — every external API endpoint with real response examples
3. `docs/03-TOOL-SPECIFICATIONS.md` — all 18 tools: Zod schemas, API calls, output format
4. `docs/04-TYPE-DEFINITIONS.md` — copy these TypeScript types verbatim into `src/types/`
5. `docs/05-IMPLEMENTATION-GUIDE.md` — file-by-file implementation with code skeletons
6. `docs/06-BUILD-AND-INSTALL.md` — exact `package.json`, `tsconfig.json`, build commands
7. `docs/07-PLAYER-DATA.md` — player profile API details (NOTE: DE has shut down the profile API; player tools removed)

## CRITICAL RULES — DO NOT VIOLATE

1. **NEVER use `console.log`** — stdout is reserved for JSON-RPC. Use `console.error` for debug output only.
2. **ALWAYS import with `.js` extension** — e.g. `import { foo } from "./utils/cache.js"` (even though files are `.ts`). Required by `"module": "Node16"`.
3. **NEVER call warframe.market v1** — it returns 403. Always use `/v2/` endpoints.
4. **ALWAYS send `Accept-Language: en`** to `api.warframestat.us` — without it some endpoints return localized strings (Chinese node names observed on archon hunt).
5. **Every tool handler MUST have a top-level try/catch** — an unhandled error must never crash the server process.
6. **`/drops/search/` chance values are percentages** — `25.33` means 25.33%. But `/items/{query}` component drops have `chance` as a decimal (`0.02` = 2%). These are different scales, do not confuse them.

## IMPLEMENTATION ORDER

```
src/utils/cache.ts
src/utils/formatting.ts
src/utils/lua-parser.ts
src/types/warframestat.ts
src/types/warframe-market.ts
src/types/overframe.ts
src/types/index.ts
src/data/color-palettes.ts
src/data/planet-resources.ts
src/api/warframestat.ts
src/api/warframe-market.ts
src/api/overframe.ts
src/api/wiki.ts
src/tools/worldstate.ts    (world_state, baro_kiteer, active_fissures)
src/tools/items.ts         (lookup_warframe, lookup_weapon, lookup_mod, lookup_item)
src/tools/market.ts        (market_price_check)
src/tools/drops.ts         (search_drops, relic_drops)
src/tools/primeVault.ts    (prime_vault_status)
src/tools/simaris.ts       (simaris_target)
src/tools/enemy.ts         (find_enemy_spawn)
src/tools/builds.ts        (lookup_builds)
src/tools/crafting.ts      (crafting_requirements, crafting_usage)
src/tools/farmOptimizer.ts (farm_route_optimizer)
src/tools/synergy.ts       (task_synergy_planner)
src/tools/colors.ts        (color_palette_finder)
src/index.ts
```

## BUILD AND TEST

```bash
npm install
npm run build          # tsc — must produce zero errors
node dist/index.js     # hangs on stdin — correct. Ctrl+C to stop.

# Smoke test:
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/index.js
# Expect: JSON with 19 tools listed
```

## DEPENDENCIES (exactly these, no others)

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "express": "^5.1.0",
    "zod": "^3.25.1"
  },
  "devDependencies": {
    "@types/express": "^5.0.2",
    "@types/node": "^22.15.0",
    "typescript": "^5.8.3"
  }
}
```

Do NOT add `@wfcd/items`, `warframe-worldstate-data`, `warframe-nexus-query`, `node-fetch`, or any other packages. Node 18+ native `fetch` is used throughout.

## KEY API FACTS

| API | Base URL | Auth | Rate limit |
|-----|----------|------|-----------|
| warframestat.us | `https://api.warframestat.us` | none | none documented (cache 60s) |
| warframe.market | `https://api.warframe.market/v2` | none | 3 req/sec (429 on violation) |

## TOOL COUNT: 19

| File | Tools |
|------|-------|
| `worldstate.ts` | `world_state`, `baro_kiteer`, `active_fissures` |
| `items.ts` | `lookup_warframe`, `lookup_weapon`, `lookup_mod`, `lookup_item` |
| `market.ts` | `market_price_check` |
| `drops.ts` | `search_drops`, `relic_drops` |
| `primeVault.ts` | `prime_vault_status` |
| `simaris.ts` | `simaris_target` |
| `enemy.ts` | `find_enemy_spawn` |
| `builds.ts` | `lookup_builds` |
| `crafting.ts` | `crafting_requirements`, `crafting_usage` |
| `farmOptimizer.ts` | `farm_route_optimizer` |
| `synergy.ts` | `task_synergy_planner` |
| `colors.ts` | `color_palette_finder` |

NOTE: Player profile tools (player_profile, player_mastery_items, player_stats, player_syndicates, player_loadout) were removed because DE shut down the profile viewing API. See docs/07-PLAYER-DATA.md for historical reference.
