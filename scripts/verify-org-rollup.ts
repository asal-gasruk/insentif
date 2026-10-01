/** Validasi rollup target: RSM = jumlah semua tim; SPV/ASM konsisten; tidak ada tim tanpa atasan. */
import { SEED_DATA as d } from "@/data/seed";
import {
  createRollup,
  supervisorChain,
  teamSupervisorNodeId,
} from "@/lib/org-rollup";

const period = "2026-08";
let failed = 0;
const assert = (c: boolean, m: string) => {
  if (!c) {
    console.error("FAIL:", m);
    failed++;
  }
};

const r = createRollup(d, { period });
// Tim demo Delivery memang tanpa atasan; semua tim SFA harus punya
const orphanSfa = r.unassignedTeams.filter((t) => t.id.startsWith("sfa-team-"));
assert(
  orphanSfa.length === 0,
  `tim SFA tanpa atasan: ${orphanSfa.map((t) => t.name)}`,
);

const sumAll = (paramId: string) =>
  d.parameterTargets
    .filter((t) => t.period === period && t.paramId === paramId && t.teamId)
    .reduce((n, t) => n + t.target, 0);

const rsms = d.orgNodes.filter((n) => n.level === "RSM");
for (const paramId of ["allProduct", "ao", "noo", "ec", "focusVol"]) {
  const total = rsms.reduce(
    (n, x) => n + (r.valueOf(x.id, paramId).value ?? 0),
    0,
  );
  assert(
    Math.abs(total - sumAll(paramId)) < 1e-6,
    `RSM total ${paramId} ${total} != ${sumAll(paramId)}`,
  );
}

for (const asm of d.orgNodes.filter((n) => n.level === "ASM")) {
  const kids = d.orgNodes.filter((n) => n.parentId === asm.id);
  const own = r.leavesOf(asm.id).length;
  const sum = kids.reduce(
    (n, k) => n + (r.valueOf(k.id, "allProduct").value ?? 0),
    0,
  );
  const ownSum = r
    .leavesOf(asm.id)
    .reduce(
      (n, l) => n + (r.targetOf(l.subjectId, "allProduct")?.target ?? 0),
      0,
    );
  const v = r.valueOf(asm.id, "allProduct").value ?? 0;
  assert(
    Math.abs(v - (sum + ownSum)) < 1e-6,
    `ASM ${asm.name} (${own} langsung) ${v} != ${sum + ownSum}`,
  );
}

const sample = d.teams.find((t) => t.id === "sfa-team-BDG-SLS-GT-001")!;
const chain = supervisorChain(
  teamSupervisorNodeId(sample, d.employees),
  d.orgNodes,
);
assert(
  chain.spv?.name === "ARIFIN SUFJAN" &&
    chain.asm?.name === "Benny Herdiana" &&
    chain.rsm?.name === "Sulin Rohdiansah",
  "rantai BDG-SLS-GT-001",
);

// IPO (SKU) = rata-rata, bukan jumlah
const ipo = r.valueOf(rsms[0].id, "iptIpo");
assert(
  ipo.mode === "avg" && (ipo.value ?? 0) < 100,
  `IPO rata-rata (${ipo.value})`,
);

console.log(
  "allProduct RSM:",
  rsms
    .map((x) => `${x.name}=${r.valueOf(x.id, "allProduct").value}`)
    .join(" | "),
);
if (failed) process.exit(1);
console.log("All org rollup checks passed.");
