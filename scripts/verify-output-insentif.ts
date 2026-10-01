/**
 * Verifikasi Output Insentif: isi pencapaian dari Excel (kolom P:AV sheet
 * "Rekap Insentif Sales Copy") → kalkulator aplikasi → bandingkan TOTAL & DITERIMA dengan Excel,
 * lalu render PDF ke scratch (arg1) untuk dicek visual.
 */
import { writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { SEED_DATA } from "@/data/seed";
import { buildOutputInsentif } from "@/lib/output-insentif";
import { renderOutputInsentifPdf } from "@/lib/output-insentif-pdf";
import { buildAsmInsentif } from "@/lib/asm-insentif";
import { buildPencairanInsentif } from "@/lib/pencairan-insentif";
import { renderPencairanInsentifPdf } from "@/lib/pencairan-insentif-pdf";
import { defaultSegmentForTeam, schemeForTeam } from "@/lib/team-utils";
import type { AchievementRecord, AppData } from "@/types";

const outPdf = process.argv[2];
const period = "2026-08";
const wb = XLSX.readFile("docs/Pencapaian Agustus 2026 - Rev-2.xlsx");
const ws = wb.Sheets["Rekap Insentif Sales Copy"];
const cell = (col: string, row: number) => ws[`${col}${row}`]?.v as number | string | undefined;
const num = (v: unknown) => (typeof v === "number" ? v : undefined);

// kolom pencapaian Excel → paramId
const PCT_COL: Record<string, string> = {
  T: "allProduct", V: "focusVol", W: "focusRO", Y: "ec", AA: "noo", AC: "ao",
  AE: "iptIpo", AG: "pd", AI: "contract", AK: "coBranding", AM: "je",
};

const data: AppData = JSON.parse(JSON.stringify(SEED_DATA));
const expected = new Map<string, { total: number; diterima: number }>();
const records: AchievementRecord[] = [];

for (let r = 5; r <= 338; r++) {
  const code = cell("Q", r);
  if (typeof code !== "string" || code.split("-").length < 3) continue;
  const team = data.teams.find((t) => t.id === `sfa-team-${code}`);
  if (!team) continue;
  const scheme = schemeForTeam(data, team);
  if (!scheme) continue;
  const achievements: Record<string, number> = {};
  for (const [col, paramId] of Object.entries(PCT_COL)) {
    const v = num(cell(col, r));
    if (v !== undefined) achievements[paramId] = v * 100;
  }
  records.push({
    id: `v-${code}`,
    teamId: team.id,
    period,
    schemeId: scheme.id,
    segmentId: defaultSegmentForTeam(data, team),
    achievements,
    overduePct: (num(cell("AP", r)) ?? 0) * 100,
    badDebtDays: num(cell("AR", r)) ?? 0,
    notes: "verify",
  });
  expected.set(team.id, { total: num(cell("AO", r)) ?? 0, diterima: num(cell("AT", r)) ?? 0 });
}
data.achievementRecords = records;

const out = buildOutputInsentif(data, { period });
console.log(`records=${records.length} rows=${out.rowCount} areas=${out.areas.map((a) => a.area).join(", ")}`);

let okTotal = 0, okDiterima = 0, n = 0;
const diffs: string[] = [];
for (const area of out.areas) for (const cab of area.cabangs) for (const row of cab.rows) {
  const e = expected.get(row.teamId);
  if (!e) continue;
  n++;
  const t = Math.abs(row.total - e.total) < 1;
  const d = Math.abs(row.diterima - e.diterima) < 1;
  if (t) okTotal++;
  if (d) okDiterima++;
  if (!t || !d) diffs.push(`${row.code} total app=${Math.round(row.total)} xl=${e.total} | diterima app=${Math.round(row.diterima)} xl=${e.diterima}`);
}
console.log(`cocok TOTAL ${okTotal}/${n}, DITERIMA ${okDiterima}/${n}`);
console.log(diffs.slice(0, 15).join("\n"));

// --- Pencairan JABAR-1: bandingkan jumlah per orang dengan sheet Excel ---
const pencairan = buildPencairanInsentif(data, { period });
const pws = wb.Sheets["Pencairan JABAR-1"];
const xlAmount = new Map<string, number>();
for (let r = 8; r <= 111; r++) {
  const name = pws[`B${r}`]?.v;
  const amt = pws[`E${r}`]?.v;
  if (typeof name === "string" && typeof amt === "number" && name !== "TOTAL") {
    xlAmount.set(name.trim().toLowerCase(), amt);
  }
}
const jabar1 = pencairan.areas.find((a) => a.area === "JAWA BARAT-1");
let pOk = 0, pN = 0;
const pDiff: string[] = [];
for (const cab of jabar1?.cabangs ?? []) for (const team of cab.teams) for (const line of team.lines) {
  const x = xlAmount.get(line.name.trim().toLowerCase());
  if (x === undefined) continue;
  pN++;
  if (Math.abs(line.amount - x) < 1) pOk++;
  else pDiff.push(`${cab.cabang} ${line.name}: app=${Math.round(line.amount)} xl=${Math.round(x)}`);
}
console.log(`Pencairan JABAR-1: ${pOk}/${pN} orang cocok; total area app=${Math.round(jabar1?.total ?? 0)}`);
console.log(pDiff.slice(0, 8).join("\n"));

// --- ASM: akumulasi tim di area ---
const asm = buildAsmInsentif(data, { period });
const pa = wb.Sheets["Pencapaian ASM"];
const xlAsm = new Map<string, { actual: number; target: number; ins: number }>();
for (let r = 7; r <= 19; r++) {
  const nm = pa[`C${r}`]?.v;
  if (typeof nm === "string") {
    xlAsm.set(nm.trim().toLowerCase(), {
      actual: pa[`D${r}`]?.v as number,
      target: pa[`E${r}`]?.v as number,
      ins: pa[`H${r}`]?.v as number,
    });
  }
}
for (const r of asm.rows) {
  const x = xlAsm.get(r.name.trim().toLowerCase());
  console.log(
    `ASM ${r.area} ${r.name}: tim=${r.teamCount} SV%=${r.sv.pct?.toFixed(1)} AO%=${r.ao.pct?.toFixed(1)} insSV=${r.svIncentive} insAO=${r.aoIncentive} diterima=${r.diterima} [${r.keterangan}]` +
      (x ? ` | Excel SV actual=${Math.round(x.actual)} target=${Math.round(x.target)} insSV=${x.ins}` : ""),
  );
  for (const s of r.spvs) console.log(`    SPV ${s.name} (${s.cabang}) tim=${s.teamCount} SV%=${s.sv.pct?.toFixed(1)} tim-diterima=${Math.round(s.teamIncentive)}`);
}

async function main() {
  const pdoc = await renderPencairanInsentifPdf(pencairan, asm);
  if (outPdf) {
    writeFileSync(outPdf.replace(/\.pdf$/, "-pencairan.pdf"), Buffer.from(pdoc.output("arraybuffer")));
    console.log("PDF pencairan halaman=", pdoc.getNumberOfPages());
  }
  if (!outPdf) return;
  const doc = await renderOutputInsentifPdf(out, asm);
  writeFileSync(outPdf, Buffer.from(doc.output("arraybuffer")));
  console.log("PDF:", outPdf, `halaman=${doc.getNumberOfPages()}`);
}
main();

// Diagnosa tim dengan total 0 di aplikasi
import { calculateTeamParameterIncentive } from "@/lib/calculator";
for (const code of ["BDG-SLS-GT-014", "PWK-SLS-GT-002", "GRT-SLS-GT-008"]) {
  const rec = records.find((x) => x.id === `v-${code}`);
  const team = data.teams.find((t) => t.id === `sfa-team-${code}`);
  if (!rec || !team) continue;
  const res = calculateTeamParameterIncentive(data, rec, team);
  console.log(code, "size", team.members.length, "seg", rec.segmentId, res[0]?.tierLabel, res[0]?.schemeName, JSON.stringify(rec.achievements));
}
