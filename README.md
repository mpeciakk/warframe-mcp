# Warframe MCP Server

> **Warning:** This project was 100% vibecoded and exists purely for my personal needs. Use at your own risk.

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that gives AI assistants real-time access to Warframe game data. 19 tools covering world state, item stats, market prices, drop tables, builds, crafting, farming optimization, task synergy planning, and color palette matching — powered by public APIs with zero authentication required.

## Tools

| Tool | Description |
|------|-------------|
| `world_state` | Current sortie, archon hunt, nightwave, invasions, open world cycles, events, Steel Path, construction progress, daily deals |
| `baro_kiteer` | Baro Ki'Teer status, inventory, and plat-per-ducat value analysis |
| `active_fissures` | Void Fissure listings with tier/Steel Path/Void Storm/mission type filters |
| `lookup_warframe` | Warframe stats, abilities, component drops, build cost, vault status |
| `lookup_weapon` | Weapon damage per fire mode, crit/status, components, build info |
| `lookup_mod` | Mod stats at all ranks, polarity, drain, rarity, drop locations |
| `lookup_item` | Generic item lookup (arcanes, resources, blueprints, companions) |
| `market_price_check` | Live warframe.market prices — sell/buy stats, cheapest sellers, trade chat messages |
| `search_drops` | Drop table search — relics, missions, enemies, with drop chances |
| `relic_drops` | Which relics contain a prime part, refinement chances, relic farm locations |
| `prime_vault_status` | Vaulted / farmable / Varzia resurgence status for prime items |
| `simaris_target` | Today's Cephalon Simaris synthesis target and scan locations |
| `find_enemy_spawn` | Where specific enemies spawn — confirmed locations from drop tables |
| `lookup_builds` | Top community mod builds from Overframe.gg with mod lists and stats |
| `crafting_requirements` | Full crafting recipes — components, credits, build time, sub-recipes |
| `crafting_usage` | Reverse ingredient lookup — "what uses this?" / "safe to sell?" |
| `farm_route_optimizer` | Best nodes to farm multiple resources — dark sector bonuses, overlap scoring |
| `task_synergy_planner` | Cross-reference Nightwave with fissures/invasions/sortie for max efficiency |
| `color_palette_finder` | Find closest in-game color palette match for any hex color (Fashion Frame) |

Most lookup tools accept **arrays** (batch mode) to handle multiple items in a single call.

## Quick Start

### npm

```bash
git clone https://github.com/YOUR_USER/warframe-mcp.git
cd warframe-mcp
npm install
npm run build
```

**Stdio mode** (for MCP clients like Claude Desktop, OpenCode, Cursor):

```bash
npm start
```

**HTTP mode** (Streamable HTTP transport for remote/web clients):

```bash
npm run start:http
# Listening on http://127.0.0.1:3000/mcp
```

### Docker

```bash
docker build -t warframe-mcp .

# HTTP mode (default)
docker run -p 3000:3000 warframe-mcp

# Stdio mode
docker run -i warframe-mcp node dist/index.js
```

## Configuration

All configuration is via environment variables. None are required — defaults work out of the box.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP listen port |
| `HOST` | `127.0.0.1` | Bind address. Use `0.0.0.0` for LAN/container access |
| `ALLOWED_HOSTS` | — | Comma-separated hostnames/IPs allowed through DNS rebinding protection (only needed when `HOST=0.0.0.0`) |

**Example — LAN-accessible server:**

```bash
HOST=0.0.0.0 PORT=3000 ALLOWED_HOSTS=192.168.1.100,mypc.local npm run start:http
```

## Client Setup

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "warframe": {
      "command": "node",
      "args": ["/absolute/path/to/warframe-mcp/dist/index.js"]
    }
  }
}
```

### Claude Desktop (Docker)

```json
{
  "mcpServers": {
    "warframe": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "warframe-mcp", "node", "dist/index.js"]
    }
  }
}
```

### OpenCode

Add to `opencode.json`:

```json
{
  "mcpServers": {
    "warframe": {
      "command": "node",
      "args": ["/absolute/path/to/warframe-mcp/dist/index.js"]
    }
  }
}
```

### HTTP Clients (Streamable HTTP)

Start the server in HTTP mode, then connect to `http://localhost:3000/mcp`:

```bash
npm run start:http

# POST /mcp — JSON-RPC requests (initialize, tools/list, tools/call)
# GET  /mcp — SSE stream for server-to-client notifications
# DELETE /mcp — Session termination
```

Sessions are managed via the `Mcp-Session-Id` header. Send an `initialize` request without a session ID to start a new session.

## Smoke Test

```bash
# Stdio — should return JSON with 19 tools
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/index.js

# HTTP — initialize a session
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}},"id":1}'
```

## System Prompt

`SYSTEM_PROMPT.md` contains a ready-to-use system prompt for an AI assistant that uses this MCP server. It includes tool documentation, a decision tree for tool selection, multi-tool chaining strategies, batching guidance, and Warframe domain knowledge (relics, rotations, trading, modding, Steel Path, open world cycles).

## Architecture

```
src/
├── index.ts              # Entry point — stdio or HTTP transport
├── api/
│   ├── warframestat.ts   # warframestat.us client (items, drops, worldstate)
│   ├── warframe-market.ts # warframe.market v2 client (prices, orders)
│   ├── overframe.ts      # Overframe.gg scraper (community builds)
│   └── wiki.ts           # Fandom wiki API client (crafting recipes)
├── tools/
│   ├── worldstate.ts     # world_state, baro_kiteer, active_fissures
│   ├── items.ts          # lookup_warframe, lookup_weapon, lookup_mod, lookup_item
│   ├── market.ts         # market_price_check
│   ├── drops.ts          # search_drops, relic_drops
│   ├── primeVault.ts     # prime_vault_status
│   ├── simaris.ts        # simaris_target
│   ├── enemy.ts          # find_enemy_spawn
│   ├── builds.ts         # lookup_builds
│   ├── crafting.ts       # crafting_requirements, crafting_usage
│   ├── farmOptimizer.ts  # farm_route_optimizer
│   ├── synergy.ts        # task_synergy_planner
│   └── colors.ts         # color_palette_finder
├── types/
│   ├── warframestat.ts   # warframestat.us API types
│   ├── warframe-market.ts # warframe.market v2 types
│   ├── overframe.ts      # Overframe build types
│   └── index.ts          # Re-exports
├── data/
│   ├── color-palettes.ts # 31 Warframe color palettes (2,790 colors)
│   └── planet-resources.ts # Planet resource drops, dark sector nodes & bonuses
└── utils/
    ├── cache.ts          # TTL cache (60s–24h depending on data type)
    ├── formatting.ts     # Number/time formatting helpers
    └── lua-parser.ts     # Lua table parser for wiki blueprint data
```

### Data Sources

| API | Base URL | Auth | Used For |
|-----|----------|------|----------|
| [warframestat.us](https://warframestat.us) | `https://api.warframestat.us` | None | World state, items, drops, mods, weapons, warframes |
| [warframe.market](https://warframe.market) | `https://api.warframe.market/v2` | None | Live trading prices and orders |
| [Overframe.gg](https://overframe.gg) | `https://overframe.gg` | None (HTML scraping) | Community mod builds |
| [Warframe Wiki](https://warframe.fandom.com) | MediaWiki API | None | Crafting recipes (blueprint data) |
| Bundled static data | — | — | Planet resources, dark sector bonuses, 31 color palettes (2,790 colors) |

### Caching

| Data Type | TTL | Examples |
|-----------|-----|---------|
| World state | 60 seconds | Fissures, invasions, cycles |
| Drop tables | 5 minutes | Drop search results |
| Market items | 24 hours | Item listing catalog |
| Static data | 24 hours | Warframe/weapon/mod stats |
| Wiki data | 24 hours | Crafting recipes |
| Overframe builds | 6 hours | Community builds |

## Development

```bash
npm run dev    # tsc --watch
npm run build  # One-shot compile
npm start      # Run stdio mode
```

### Requirements

- Node.js >= 18 (uses native `fetch`)
- TypeScript 5.x
- No runtime dependencies beyond `@modelcontextprotocol/sdk`, `express`, and `zod`

## License

MIT
