#!/usr/bin/env node
/**
 * Validasi dump TARGET Excel + resolve ke team seed SFA.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const dump = JSON.parse(
  readFileSync(join(root, "src/data/parameter-targets-excel.json"), "utf8"),
);
const sfa = JSON.parse(
  readFileSync(join(root, "src/data/sfa-excel.json"), "utf8"),
);

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("OK:", msg);
  }
}

assert(dump.period === "2026-08", `period=${dump.period}`);
assert(dump.targets.length >= 300, `targets count=${dump.targets.length}`);

const sample = dump.targets.find(
  (t) => t.teamCode === "BDG-SLS-GT-001" && t.paramId === "allProduct",
);
assert(!!sample, "BDG-SLS-GT-001 allProduct ada");
assert(
  sample && sample.target === 578500000,
  `BDG target sales value=${sample?.target}`,
);

const sfaCodes = new Set(sfa.teams.map((t) => t.code));
const matched = dump.targets.filter((t) => sfaCodes.has(t.teamCode));
const unmatched = dump.targets.filter((t) => !sfaCodes.has(t.teamCode));
assert(
  matched.length >= 200,
  `resolve ke SFA teams: matched=${matched.length} unmatched=${unmatched.length}`,
);

const byParam = {};
for (const t of dump.targets) {
  byParam[t.paramId] = (byParam[t.paramId] ?? 0) + 1;
}
assert((byParam.allProduct ?? 0) >= 60, `allProduct=${byParam.allProduct}`);
assert((byParam.focusVol ?? 0) >= 30, `focusVol=${byParam.focusVol}`);
assert((byParam.ec ?? 0) >= 40, `ec=${byParam.ec}`);

if (unmatched.length > 0) {
  const codes = [...new Set(unmatched.map((t) => t.teamCode))].slice(0, 10);
  console.log("INFO: unmatched sample codes:", codes.join(", "));
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll parameter-target checks passed.");
