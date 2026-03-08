# Warframe MCP Server — Overview

TypeScript MCP server. Stdio transport. 18 tools. Real-time Warframe data via HTTP. No auth, no DB, no web server.

## External Data Sources

| Source | Base URL | Provides |
|--------|----------|----------|
| warframestat.us | `https://api.warframestat.us` | Worldstate, items, weapons, mods, drops, player profiles |
| warframe.market v2 | `https://api.warframe.market/v2` | Live P2P platinum trading prices |

**DO NOT** add `@wfcd/items`, `warframe-worldstate-data`, `warframe-nexus-query`, `node-fetch`. All data comes from HTTP. Only 4 npm packages total.

## Directory Structure

```
warframe-mcp/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                   # Server init + transport + tool registration
│   ├── api/
│   │   ├── warframestat.ts        # HTTP client for api.warframestat.us
│   │   ├── warframe-market.ts     # HTTP client for api.warframe.market/v2
│   │   └── profile.ts             # Thin wrapper for player profile calls
│   ├── tools/
│   │   ├── worldstate.ts          # world_state, baro_kiteer, active_fissures
│   │   ├── items.ts               # lookup_warframe, lookup_weapon, lookup_mod, lookup_item
│   │   ├── market.ts              # market_price_check
│   │   ├── drops.ts               # search_drops, relic_drops
│   │   ├── primeVault.ts          # prime_vault_status
│   │   ├── simaris.ts             # simaris_target
│   │   ├── enemy.ts               # find_enemy_spawn
│   │   └── profile.ts             # player_profile, player_mastery_items, player_stats, player_syndicates, player_loadout
│   ├── utils/
│   │   ├── cache.ts               # TTLCache<T> — Map-based in-memory TTL cache
│   │   └── formatting.ts          # Pure text formatting helpers
│   └── types/
│       ├── warframestat.ts        # Types for api.warframestat.us responses
│       ├── warframe-market.ts     # Types for api.warframe.market/v2 responses
│       ├── profile.ts             # Types for player profile + xpToRank utility
│       └── index.ts               # Re-export barrel
└── dist/                          # Compiled output (gitignored)
```

## Cache TTLs

| Data type | TTL |
|-----------|-----|
| Worldstate (fissures, sortie, etc.) | 60s |
| Drop tables | 5 min |
| Market items list (`/v2/items`) | 24h |
| Static item/weapon/mod data | 24h |
| Player profile | 5 min |

## Tool Summary

| File | Tools | Count |
|------|-------|-------|
| `worldstate.ts` | `world_state`, `baro_kiteer`, `active_fissures` | 3 |
| `items.ts` | `lookup_warframe`, `lookup_weapon`, `lookup_mod`, `lookup_item` | 4 |
| `market.ts` | `market_price_check` | 1 |
| `drops.ts` | `search_drops`, `relic_drops` | 2 |
| `primeVault.ts` | `prime_vault_status` | 1 |
| `simaris.ts` | `simaris_target` | 1 |
| `enemy.ts` | `find_enemy_spawn` | 1 |
| `profile.ts` | `player_profile`, `player_mastery_items`, `player_stats`, `player_syndicates`, `player_loadout` | 5 |
| **Total** | | **18** |

## Design Decisions

| Decision | Reason |
|----------|--------|
| No npm data packages | warframestat.us is backed by the same packages server-side; HTTP keeps install <5MB and data always fresh |
| In-memory TTL cache only | Server is a short-lived stdio process; no Redis needed |
| warframe.market v2 only | v1 returns 403; `warframe-nexus-query` targets v1 — do not use |
| warframestat.us profile proxy | Preferred over raw DE endpoint — normalizes inconsistent response structure |
| Default platform: `pc` | All worldstate endpoints are platform-scoped; `platform` param is optional |
| `"module": "Node16"` | All internal imports MUST use `.js` extensions |
| `NEVER console.log` | stdout is the JSON-RPC channel; use `console.error` only |
| `Accept-Language: en` on every request | Without it, some warframestat.us endpoints return localized strings (Chinese observed on archon hunt) |
