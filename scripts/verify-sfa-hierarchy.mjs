#!/usr/bin/env node
/** Validasi sfa-hierarchy.json: leader unik, semua bawahan punya atasan valid, area/region konsisten. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const h = JSON.parse(readFileSync(join(root, "src/data/sfa-hierarchy.json"), "utf8"));
let failed = 0;
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL:", m);
    failed++;
  }
};

const leaderIds = new Set(h.leaders.map((l) => l.id));
const areaNames = new Set(h.areas.map((a) => a.name));
const regionIds = new Set(h.regions.map((r) => r.id));

assert(leaderIds.size === h.leaders.length, "leader id unik");
assert(h.regions.length === 2, "2 region (Barat, Timur)");
assert(h.areas.length === 5, "5 area (Jabar 1-3, Jateng, Jatim)");
assert(h.areas.every((a) => a.asm), "setiap area punya ASM");
assert(h.regions.every((r) => r.rsm), "setiap region punya RSM");
for (const a of h.areas) assert(regionIds.has(a.region), `region valid ${a.name}`);
for (const l of h.leaders) assert(areaNames.has(l.area), `area leader ${l.id}`);
for (const m of h.members) {
  assert(m.leaderId && leaderIds.has(m.leaderId), `atasan valid: ${m.name} (row ${m.row})`);
  const l = h.leaders.find((x) => x.id === m.leaderId);
  assert(!l || l.cabang === m.cabang, `atasan satu cabang: ${m.name}`);
}
const asm = h.leaders.filter((l) => (l.jabatan ?? "").toUpperCase() === "ASM");
assert(asm.length === 1 && asm[0].area === "JAWA BARAT-2", "ASM Excel = Garut (Jabar-2)");
const review = h.members.filter((m) => m.needsReview).length + h.leaders.filter((l) => l.needsReview).length;
console.log(`leaders=${h.leaders.length} members=${h.members.length} needsReview=${review}`);
if (failed) process.exit(1);
console.log("All SFA hierarchy checks passed.");
