#!/usr/bin/env node
/**
 * Validasi mapping split vs contoh sheet Pembagian Insentif + konsistensi seed SFA.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const sfa = JSON.parse(
  readFileSync(join(root, "src/data/sfa-excel.json"), "utf8"),
);

const POOL = sfa.splits;

function resolvePool(teamSize, position, memberPositions) {
  const pool = POOL[String(teamSize)] ?? POOL["1"];
  if (!memberPositions.includes(position)) return 0;
  if (position === "salesman") return pool.salesman;
  const nonSales = memberPositions.filter((p) => p !== "salesman");
  if (nonSales.length === 0) return 0;
  return pool.poolNonSalesman / nonSales.length;
}

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("OK:", msg);
  }
}

// 1) Contoh Excel Pembagian Insentif
for (const ex of sfa.examples) {
  const team = sfa.teams.find((t) => t.code === ex.kode);
  assert(!!team, `tim ${ex.kode} ada di SFA dump`);
  if (!team) continue;

  const size = team.members.length;
  const expectedSize = ex.typeSales?.includes("3")
    ? 3
    : ex.typeSales?.includes("2")
      ? 2
      : size;
  assert(
    size === expectedSize,
    `${ex.kode} teamSize=${size} sesuai TYPE SALES (${ex.typeSales})`,
  );

  const positions = team.members.map((m) => m.position);
  const gross = ex.incentiveGross;
  const salesRatio = resolvePool(size, "salesman", positions);
  const salesAmt = Math.round(gross * salesRatio);
  assert(
    salesAmt === ex.salesShare,
    `${ex.kode} sales ${salesAmt} === ${ex.salesShare}`,
  );

  const nonSales = positions.filter((p) => p !== "salesman");
  const poolAmt = nonSales.reduce(
    (sum, p) => sum + Math.round(gross * resolvePool(size, p, positions)),
    0,
  );
  assert(
    poolAmt === ex.driverHelperShare,
    `${ex.kode} driver/helper pool ${poolAmt} === ${ex.driverHelperShare}`,
  );
}

// 2) Edge: Helper+Helper (tanpa driver) — pool dibagi rata
{
  const positions = ["salesman", "helper1", "helper2"];
  const r1 = resolvePool(3, "helper1", positions);
  const r2 = resolvePool(3, "helper2", positions);
  assert(r1 === 0.225 && r2 === 0.225, "Helper+Helper masing-masing 22.5%");
  assert(resolvePool(3, "salesman", positions) === 0.55, "salesman tetap 55%");
}

// 3) Konsistensi anggota vs employees
{
  const nikSet = new Set(sfa.employees.map((e) => e.nik));
  let missing = 0;
  for (const t of sfa.teams) {
    for (const m of t.members) {
      if (!nikSet.has(m.nik)) missing += 1;
    }
  }
  assert(missing === 0, `semua anggota tim ada di employees (missing=${missing})`);
}

assert(sfa.teams.length >= 60, `jumlah tim SFA fase-1 (${sfa.teams.length})`);

{
  const jt = sfa.teams.filter((t) => t.area === "JAWA TENGAH");
  assert(jt.length >= 12, `tim Jawa Tengah ter-import (${jt.length})`);
  const jtCodes = new Set(jt.map((t) => t.code));
  for (const code of [
    "SMG-SLS-GT-001",
    "TGL-SLS-GT-001",
    "WGN-SLS-GT-001",
    "WNS-SLS-GT-002",
    "SLO-SLS-GT-001",
  ]) {
    assert(jtCodes.has(code), `tim Jawa Tengah ${code} ada`);
  }
}

{
  const indNiks = sfa.individu.map((i) => i.nik);
  const dupInd = indNiks.filter((n, i) => indNiks.indexOf(n) !== i);
  assert(dupInd.length === 0, `individu NIK unik (dups=${dupInd.join(",") || "none"})`);
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll SFA mapping checks passed.");
