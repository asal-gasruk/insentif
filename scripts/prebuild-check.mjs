#!/usr/bin/env node
/**
 * Cegah npm run build saat dev server masih aktif — penyebab utama cache .next
 * korup dan CSS/chunk 404 di development.
 */
import { execSync } from "node:child_process";

function portInUse(port) {
  try {
    const out = execSync(`lsof -ti:${port} 2>/dev/null`, {
      encoding: "utf8",
    }).trim();
    return out.length > 0 ? out.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

const pids = portInUse(3000);
if (pids.length > 0) {
  console.error("");
  console.error("❌  npm run build dibatalkan: dev server masih aktif di port 3000.");
  console.error(`    PID: ${pids.join(", ")}`);
  console.error("");
  console.error("    Cache .next akan bentrok → CSS/JS 404, tampilan polos.");
  console.error("");
  console.error("    Perbaikan:");
  console.error("      1. Hentikan dev server (Ctrl+C di terminal dev)");
  console.error("      2. Atau: npm run reset");
  console.error("      3. Lalu: npm run build");
  console.error("");
  process.exit(1);
}
