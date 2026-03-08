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
    }, 15000);

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
    console.log(`\nRESPONSE (${elapsed}s):\n${text}`);
    const isError = text.startsWith("Error") || text.startsWith("Could not");
    console.log(`\nSTATUS: ${isError ? "⚠ RETURNED ERROR" : "✓ OK"}`);
    return !isError;
  } else if (result?.error) {
    console.log(`\nJSON-RPC ERROR (${elapsed}s):`, JSON.stringify(result.error, null, 2));
    console.log(`\nSTATUS: ✗ FAIL`);
    return false;
  } else {
    console.log(`UNEXPECTED (${elapsed}s):`, JSON.stringify(result, null, 2).substring(0, 500));
    return false;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const results = [];

  // Tier 1
  results.push(await runTest(
    "1: Market price for Bite mod",
    "market_price_check", { item_name: "Bite" }
  ));

  results.push(await runTest(
    "2: Prime vault status for Mesa Prime",
    "prime_vault_status", { name: "Mesa Prime" }
  ));

  results.push(await runTest(
    "3: World state (check for Kuva-related info)",
    "world_state", { sections: ["sortie", "nightwave", "steel_path"] }
  ));

  // Note: Test 3 alt — active fissures filtered for Requiem relics
  results.push(await runTest(
    "3b: Active Requiem fissures",
    "active_fissures", { tier: "Requiem" }
  ));

  results.push(await runTest(
    "4: Simaris target",
    "simaris_target", {}
  ));

  // Tier 2
  results.push(await runTest(
    "5a: Market price for Jahu",
    "market_price_check", { item_name: "Jahu" }
  ));

  results.push(await runTest(
    "5b: Active Requiem fissures (for Kuva farming)",
    "active_fissures", { tier: "Requiem" }
  ));

  results.push(await runTest(
    "6a: Baro Ki'Teer inventory",
    "baro_kiteer", { show_worth_analysis: false }
  ));

  results.push(await runTest(
    "6b: Market price for Primed Continuity",
    "market_price_check", { item_name: "Primed Continuity" }
  ));

  results.push(await runTest(
    "7a: Lookup Nataruk weapon stats",
    "lookup_weapon", { name: "Nataruk" }
  ));

  results.push(await runTest(
    "7b: Market price for Critical Delay",
    "market_price_check", { item_name: "Critical Delay" }
  ));

  // Tier 3
  results.push(await runTest(
    "8a: Lookup Umbral Intensify mod",
    "lookup_mod", { name: "Umbral Intensify" }
  ));

  results.push(await runTest(
    "8b: Market price for Umbral Intensify (should fail — untradeable)",
    "market_price_check", { item_name: "Umbral Intensify" }
  ));

  // Summary
  console.log(`\n${"=".repeat(70)}`);
  console.log("SUMMARY");
  console.log("=".repeat(70));
  const passed = results.filter(Boolean).length;
  console.log(`${passed}/${results.length} tests returned data`);
  const labels = [
    "1:Market-Bite", "2:Vault-Mesa", "3:WorldState", "3b:RequiemFissures",
    "4:Simaris", "5a:Market-Jahu", "5b:RequiemFissures2", "6a:Baro",
    "6b:Market-PrimedCont", "7a:Nataruk", "7b:Market-CritDelay",
    "8a:Mod-UmbralInt", "8b:Market-UmbralInt"
  ];
  labels.forEach((l, i) => {
    console.log(`  ${results[i] ? "✓" : "✗"} ${l}`);
  });
}

main().catch(console.error);
