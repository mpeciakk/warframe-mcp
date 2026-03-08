import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { registerWorldstateTools } from "./tools/worldstate.js";
import { registerItemTools } from "./tools/items.js";
import { registerMarketTools } from "./tools/market.js";
import { registerDropTools } from "./tools/drops.js";
import { registerPrimeVaultTools } from "./tools/primeVault.js";
import { registerSimarisTools } from "./tools/simaris.js";
import { registerEnemyTools } from "./tools/enemy.js";
import { registerBuildTools } from "./tools/builds.js";
import { registerCraftingTools } from "./tools/crafting.js";
import { registerFarmOptimizerTools } from "./tools/farmOptimizer.js";
import { registerSynergyTools } from "./tools/synergy.js";
import { registerColorTools } from "./tools/colors.js";

// ─── Server factory ──────────────────────────────────────────────────────────

function createServer(): McpServer {
  const server = new McpServer({
    name: "warframe-mcp",
    version: "1.0.0",
  });

  registerWorldstateTools(server);
  registerItemTools(server);
  registerMarketTools(server);
  registerDropTools(server);
  registerPrimeVaultTools(server);
  registerSimarisTools(server);
  registerEnemyTools(server);
  registerBuildTools(server);
  registerCraftingTools(server);
  registerFarmOptimizerTools(server);
  registerSynergyTools(server);
  registerColorTools(server);

  return server;
}

// ─── Transport selection ─────────────────────────────────────────────────────

const useHttp = process.argv.includes("--http");

if (useHttp) {
  // ── Streamable HTTP transport ──────────────────────────────────────────────
  const port = parseInt(process.env.PORT ?? "3000", 10);
  const host = process.env.HOST ?? "127.0.0.1";

  // Build allowed hosts list for DNS rebinding protection.
  // When binding to 0.0.0.0 / ::, allow localhost + any hosts from ALLOWED_HOSTS env.
  // Example: HOST=0.0.0.0 ALLOWED_HOSTS=192.168.1.112,mypc.local
  const allowedHosts: string[] | undefined =
    host === "0.0.0.0" || host === "::"
      ? [
          "localhost",
          "127.0.0.1",
          "::1",
          ...(process.env.ALLOWED_HOSTS?.split(",").map((h) => h.trim()).filter(Boolean) ?? []),
        ]
      : undefined; // default localhost-only validation

  const app = createMcpExpressApp({ host, allowedHosts });

  // Session → transport map
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  // POST /mcp — JSON-RPC requests + session initialization
  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    try {
      // Reuse existing session
      if (sessionId && transports[sessionId]) {
        await transports[sessionId].handleRequest(req, res, req.body);
        return;
      }

      // New session — must be an initialize request
      if (!sessionId && isInitializeRequest(req.body)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            transports[id] = transport;
            console.error(`[http] Session initialized: ${id}`);
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            console.error(`[http] Session closed: ${sid}`);
            delete transports[sid];
          }
        };

        const server = createServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      // Bad request
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: null,
      });
    } catch (err) {
      console.error("[http] Error handling POST /mcp:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // GET /mcp — SSE stream for server→client notifications
  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  // DELETE /mcp — session termination
  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  const httpServer = app.listen(port, host, () => {
    const addr = host === "0.0.0.0" || host === "::" ? `<all interfaces>:${port}` : `${host}:${port}`;
    console.error(`[http] Warframe MCP server listening on http://${addr}/mcp`);
  });

  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[http] ERROR: Port ${port} is already in use. Set a different port with PORT=<number>`);
    } else {
      console.error("[http] Server error:", err.message);
    }
    process.exit(1);
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.error("[http] Shutting down...");
    for (const sid of Object.keys(transports)) {
      try {
        await transports[sid].close();
        delete transports[sid];
      } catch {
        // ignore cleanup errors
      }
    }
    httpServer.close();
    process.exit(0);
  });
} else {
  // ── Stdio transport (default) ─────────────────────────────────────────────
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
