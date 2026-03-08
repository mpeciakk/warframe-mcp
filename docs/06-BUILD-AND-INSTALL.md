# Build & Install

## Requirements

- Node.js >= 18.0.0 (native `fetch`, top-level `await`)
- npm >= 9.0.0

## `package.json`

```json
{
  "name": "warframe-mcp",
  "version": "1.0.0",
  "description": "MCP server providing real-time Warframe game data to AI assistants",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "zod": "^3.25.1"
  },
  "devDependencies": {
    "@types/node": "^22.15.0",
    "typescript": "^5.8.3"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**`"module": "Node16"` requires `.js` extensions on all internal imports** — even when importing `.ts` source files:

```typescript
// CORRECT
import { TTLCache } from "../utils/cache.js";
// WRONG — TypeScript will error
import { TTLCache } from "../utils/cache";
```

## `.gitignore`

```
node_modules/
dist/
*.js.map
```

---

## Build

```bash
npm install        # ~5MB total, no heavy data packages
npm run build      # tsc — zero output = success
node dist/index.js # Hangs on stdin — correct. Ctrl+C to stop.
```

Smoke test:

```bash
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/index.js
```

Expect: JSON with all 18 tools listed.

Full tool call test:

```bash
printf '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}\n{"jsonrpc":"2.0","method":"tools/call","id":2,"params":{"name":"baro_kiteer","arguments":{}}}\n' | node dist/index.js
```

Expect: two JSON responses — initialize, then baro_kiteer result.

---

## Directory Structure

```
warframe-mcp/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── api/
│   │   ├── warframestat.ts
│   │   ├── warframe-market.ts
│   │   └── profile.ts
│   ├── tools/
│   │   ├── worldstate.ts
│   │   ├── items.ts
│   │   ├── market.ts
│   │   ├── drops.ts
│   │   ├── primeVault.ts
│   │   ├── simaris.ts
│   │   ├── enemy.ts
│   │   └── profile.ts
│   ├── utils/
│   │   ├── cache.ts
│   │   └── formatting.ts
│   └── types/
│       ├── index.ts
│       ├── warframestat.ts
│       ├── warframe-market.ts
│       └── profile.ts
└── dist/          # Generated — do not edit
```

---

## MCP Client Configuration

### Claude Desktop

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

Restart Claude Desktop after saving. 18 Warframe tools will appear.

### OpenCode

```json
{
  "mcp": {
    "warframe": {
      "type": "local",
      "command": ["node", "/absolute/path/to/warframe-mcp/dist/index.js"]
    }
  }
}
```

### Any MCP client

Transport: **stdio**. No env vars. No ports. No auth.

```
command: node
args: ["/path/to/warframe-mcp/dist/index.js"]
```

---

## Common Build Errors

**`error TS2835: Relative import paths need explicit file extensions`**
→ Add `.js` to all internal imports.

**`error TS1378: Top-level 'await' expressions are only allowed when...`**
→ Ensure `tsconfig.json` has `"target": "ES2022"` and `"module": "Node16"`.

**`SyntaxError: Cannot use import statement in a module`** (runtime)
→ Check `package.json` has `"type": "module"` and `tsconfig.json` has `"module": "Node16"`.

**`Error: Cannot find module`** (runtime)
→ Stale dist. Run `npm run build` again.

---

## Debugging

`process.stdout` is owned by the MCP transport. **NEVER use `console.log`.**

```typescript
// Safe — writes to stderr only
console.error("[DEBUG] fetchVoidTrader:", JSON.stringify(data, null, 2));
```

---

## Notes

- Server is a **local subprocess** — not a web service. No HTTP server, no auth, no persistent storage.
- Works offline for cached data. Requires internet for live API calls.
- No environment variables required.
