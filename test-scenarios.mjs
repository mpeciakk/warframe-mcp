#!/usr/bin/env node
// Test harness: sends JSON-RPC tool/call requests to the MCP server via stdin/stdout
import { spawn } from "child_process";
import { resolve } from "path";

const serverPath = resolve("dist/index.js");

function callTool(toolName, args = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    // Send initialize, then the tool call
    const init = JSON.stringify({
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" },
      },
      id: 0,
    });

    const call = JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: toolName, arguments: args },
      id: 1,
    });

    proc.stdin.write(init + "\n");
    proc.stdin.write(call + "\n");

    // Give it time then close
    setTimeout(() => {
      proc.stdin.end();
      proc.kill("SIGTERM");
    }, 20000);

    proc.on("close", () => {
      // Parse the second JSON-RPC response (tool/call result)
      const lines = stdout.trim().split("\n");
      const toolResponse = lines.length >= 2 ? lines[1] : lines[0];
      try {
        const parsed = JSON.parse(toolResponse);
        resolve({ result: parsed, stderr });
      } catch (e) {
        resolve({ raw: stdout, stderr, error: e.message });
      }
    });

    proc.on("error", reject);
  });
}

async function runTest(label, toolName, args) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`TEST: ${label}`);
  console.log(`TOOL: ${toolName}(${JSON.stringify(args)})`);
  console.log("=".repeat(70));

  const start = Date.now();
  const { result, raw, stderr, error } = await callTool(toolName, args);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (error) {
    console.log(`ERROR (${elapsed}s): ${error}`);
    if (raw) console.log("RAW:", raw.substring(0, 500));
    return false;
  }

  if (result?.result?.content?.[0]?.text) {
    const text = result.result.content[0].text;
    // Truncate very long outputs for readability
    const display = text.length > 3000 ? text.substring(0, 3000) + "\n... [truncated]" : text;
    console.log(`\nRESPONSE (${elapsed}s):\n${display}`);
    const isError = text.startsWith("Error") || text.startsWith("Could not");
    console.log(`\nSTATUS: ${isError ? "WARNING - RETURNED ERROR" : "OK"}`);
    return !isError;
  } else if (result?.error) {
    console.log(`\nJSON-RPC ERROR (${elapsed}s):`, JSON.stringify(result.error, null, 2));
    console.log(`\nSTATUS: FAIL`);
    return false;
  } else {
    console.log(`UNEXPECTED (${elapsed}s):`, JSON.stringify(result, null, 2).substring(0, 500));
    return false;
  }
}

// ── Test Definitions ─────────────────────────────────────────────────────────
// Each test: [label, toolName, args]
const TESTS = [
  // ── Worldstate Tools ───────────────────────────────────────────────────────
  ["World state (sortie, nightwave, steel path)",
    "world_state", { sections: ["sortie", "nightwave", "steel_path"] }],

  ["Active fissures (Lith tier)",
    "active_fissures", { tier: "Lith" }],

  ["Active Requiem fissures",
    "active_fissures", { tier: "Requiem" }],

  ["Baro Ki'Teer inventory",
    "baro_kiteer", { show_worth_analysis: false }],

  // ── Item Lookup Tools ──────────────────────────────────────────────────────
  ["Lookup Warframe: Mesa",
    "lookup_warframe", { names: ["Mesa"] }],

  ["Lookup Warframe batch: Saryn, Wisp",
    "lookup_warframe", { names: ["Saryn", "Wisp"] }],

  ["Lookup Weapon: Nataruk",
    "lookup_weapon", { names: ["Nataruk"] }],

  ["Lookup Weapon batch: Ignis Wraith, Acceltra",
    "lookup_weapon", { names: ["Ignis Wraith", "Acceltra"] }],

  ["Lookup Mod: Umbral Intensify",
    "lookup_mod", { names: ["Umbral Intensify"] }],

  ["Lookup Mod batch: Serration, Split Chamber",
    "lookup_mod", { names: ["Serration", "Split Chamber"] }],

  ["Lookup Item: Neurodes",
    "lookup_item", { names: ["Neurodes"] }],

  // ── Market Tool ────────────────────────────────────────────────────────────
  ["Market price: Bite",
    "market_price_check", { item_names: ["Bite"] }],

  ["Market price: Primed Continuity",
    "market_price_check", { item_names: ["Primed Continuity"] }],

  ["Market price batch: Condition Overload, Blind Rage",
    "market_price_check", { item_names: ["Condition Overload", "Blind Rage"] }],

  ["Market price: Umbral Intensify (untradeable - expect error)",
    "market_price_check", { item_names: ["Umbral Intensify"] }],

  // ── Drop Tools ─────────────────────────────────────────────────────────────
  ["Search drops: Condition Overload",
    "search_drops", { queries: ["Condition Overload"] }],

  ["Relic drops: Lith B1",
    "relic_drops", { relics: ["Lith B1"] }],

  // ── Misc Lookup Tools ──────────────────────────────────────────────────────
  ["Prime vault status: Mesa Prime",
    "prime_vault_status", { name: "Mesa Prime" }],

  ["Simaris target",
    "simaris_target", {}],

  ["Find enemy spawn: Nox",
    "find_enemy_spawn", { enemy_name: "Nox" }],

  // ── Build Tool ─────────────────────────────────────────────────────────────
  ["Lookup builds: Mesa",
    "lookup_builds", { names: ["Mesa"] }],

  // ── Crafting Tools ─────────────────────────────────────────────────────────
  ["Crafting requirements: Wukong Prime",
    "crafting_requirements", { items: ["Wukong Prime"] }],

  ["Crafting usage: Neurodes",
    "crafting_usage", { items: ["Neurodes"] }],

  // ── Farm Optimizer Tool ────────────────────────────────────────────────────
  ["Farm route: Neurodes + Orokin Cell",
    "farm_route_optimizer", { resources: ["Neurodes", "Orokin Cell"] }],

  ["Farm route: Plastids + Polymer Bundle (survival preferred)",
    "farm_route_optimizer", { resources: ["Plastids", "Polymer Bundle"], prefer_mission_type: "survival" }],

  // ── Synergy Planner Tool ───────────────────────────────────────────────────
  ["Task synergy planner (PC)",
    "task_synergy_planner", {}],

  // ── Color Palette Tool ─────────────────────────────────────────────────────
  ["Color palette: gold (#FFD700)",
    "color_palette_finder", { hex_color: "FFD700", limit: 5 }],

  ["Color palette: red (#FF0000) in Classic palette only",
    "color_palette_finder", { hex_color: "#FF0000", limit: 3, palette: "Classic" }],
];

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Allow filtering: node test-scenarios.mjs [filter]
  // e.g. node test-scenarios.mjs market   — runs only tests with "market" in the label
  const filter = process.argv[2]?.toLowerCase();
  const testsToRun = filter
    ? TESTS.filter(([label]) => label.toLowerCase().includes(filter))
    : TESTS;

  if (filter) {
    console.log(`Filter: "${filter}" — running ${testsToRun.length}/${TESTS.length} tests\n`);
  }

  const results = [];
  for (const [label, tool, args] of testsToRun) {
    results.push({ label, ok: await runTest(label, tool, args) });
  }

  // Summary
  console.log(`\n${"=".repeat(70)}`);
  console.log("SUMMARY");
  console.log("=".repeat(70));
  const passed = results.filter((r) => r.ok).length;
  console.log(`${passed}/${results.length} tests returned data\n`);
  for (const { label, ok } of results) {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
  }
}

main().catch(console.error);
