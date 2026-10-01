import {
  calculateParameterIncentive,
  calculateTeamParameterIncentive,
} from "@/lib/calculator";
import { normalizeImportPeriod } from "@/lib/import-achievement";
import { splitPenalty } from "@/lib/output-insentif";
import { createRollup, orgNodeName } from "@/lib/org-rollup";
import { evaluatePenalties } from "@/lib/penalty-engine";
import type {
  AchievementRecord,
  AppData,
  Employee,
  IncentiveResult,
  OrgNode,
} from "@/types";

/**
 * Insentif ASM (sheet "Rekap Insentif ASM" / "Pencapaian ASM" / "Pencairan ASM").
 * Pencapaian ASM = akumulasi seluruh tim di bawahnya (SPV → tim): Σ actual ÷ Σ target.
 * Overdue/Bad Debt area diturunkan dari tim (rata-rata overdue, hari bad debt terbesar).
 */

const ASM_SCHEME_ID = "sch-asm";
const SV_PARAM = "allProduct";
const AO_PARAM = "ao";

export interface AsmAccumulation {
  actual: number | null;
  target: number | null;
  /** persen (100 = 100%) */
  pct: number | null;
}

export interface AsmSpvDetail {
  nodeId: string;
  name: string;
  title: string;
  cabang: string;
  teamCount: number;
  sv: AsmAccumulation;
  ao: AsmAccumulation;
  /** Σ insentif diterima tim di bawah SPV ini */
  teamIncentive: number;
}

export interface AsmRow {
  nodeId: string;
  area: string;
  name: string;
  typeSales: "ASM";
  teamCount: number;
  sv: AsmAccumulation;
  ao: AsmAccumulation;
  svIncentive: number;
  aoIncentive: number;
  total: number;
  overduePct: number;
  overduePenalty: number;
  badDebtDays: number;
  badDebtPenalty: number;
  diterima: number;
  keterangan: string;
  spvs: AsmSpvDetail[];
}

export interface AsmInsentif {
  period: string;
  rows: AsmRow[];
  totals: {
    svIncentive: number;
    aoIncentive: number;
    total: number;
    overduePenalty: number;
    badDebtPenalty: number;
    diterima: number;
  };
}

function accumulate(
  data: AppData,
  period: string,
  teamIds: string[],
  paramId: string,
): AsmAccumulation {
  let actual = 0;
  let target = 0;
  let any = false;
  for (const teamId of teamIds) {
    const record = data.achievementRecords.find(
      (r) => r.teamId === teamId && r.period === period,
    );
    const pct = record?.achievements[paramId];
    const t = data.parameterTargets.find(
      (x) =>
        x.teamId === teamId && x.paramId === paramId && x.period === period,
    )?.target;
    if (pct === undefined || t === undefined || t <= 0) continue;
    actual += (pct / 100) * t;
    target += t;
    any = true;
  }
  if (!any) return { actual: null, target: null, pct: null };
  return { actual, target, pct: (actual / target) * 100 };
}

function keterangan(
  data: AppData,
  record: AchievementRecord,
  result: IncentiveResult,
): string {
  const scheme = data.schemes.find((s) => s.id === record.schemeId);
  const rules = evaluatePenalties(scheme?.penalties ?? [], record).matchedRules;
  if (result.voided) return `HANGUS · ${rules.join(", ")}`;
  if (result.suspended) return `DITANGGUHKAN · ${rules.join(", ")}`;
  if (result.finalAmount <= 0) return "TIDAK ADA INSENTIF";
  return result.penaltyPct > 0
    ? `DICAIRKAN · Potongan ${result.penaltyPct}% (${rules.join(", ")})`
    : "DICAIRKAN";
}

/** Bangun insentif ASM per area untuk satu periode (opsional satu area). */
export function buildAsmInsentif(
  data: AppData,
  opts: { period: string; area?: string },
): AsmInsentif {
  const period = normalizeImportPeriod(opts.period);
  const scheme = data.schemes.find((s) => s.id === ASM_SCHEME_ID);
  const rollup = createRollup(data, { period });
  const nodesByParent = (id: string) =>
    data.orgNodes.filter((n) => n.parentId === id);

  const rows: AsmRow[] = [];
  const asmNodes = data.orgNodes.filter(
    (n): n is OrgNode =>
      n.level === "ASM" && (!opts.area || n.area === opts.area),
  );

  for (const node of asmNodes) {
    const teamIds = rollup.teamIdsUnder(node.id);
    const records = teamIds
      .map((id) =>
        data.achievementRecords.find(
          (r) => r.teamId === id && r.period === period,
        ),
      )
      .filter((r): r is AchievementRecord => Boolean(r));
    if (records.length === 0 || !scheme) continue;

    const sv = accumulate(data, period, teamIds, SV_PARAM);
    const ao = accumulate(data, period, teamIds, AO_PARAM);
    const overduePct =
      records.reduce((n, r) => n + r.overduePct, 0) / records.length;
    const badDebtDays = Math.max(...records.map((r) => r.badDebtDays));

    const achievements: Record<string, number> = {};
    if (sv.pct !== null) achievements[SV_PARAM] = sv.pct;
    if (ao.pct !== null) achievements[AO_PARAM] = ao.pct;

    const segmentId = /LUAR/i.test(node.area) ? "LUAR" : "JAWA";
    const virtual: Employee = {
      id: `asm:${node.id}`,
      name: orgNodeName(node, data.employees),
      nik: "",
      roleId: "asm",
      branchId: "",
      position: "manager",
      teamSize: 1,
      workforceMode: "individu",
      active: true,
    };
    const record: AchievementRecord = {
      id: `asm-${node.id}-${period}`,
      employeeId: virtual.id,
      period,
      schemeId: scheme.id,
      segmentId,
      achievements,
      overduePct,
      badDebtDays,
      notes: "Akumulasi tim di area",
    };
    const result = calculateParameterIncentive(data, record, virtual);
    const split = splitPenalty(scheme, record, result.grossAmount);

    const spvs: AsmSpvDetail[] = [];
    for (const leader of nodesByParent(node.id)) {
      const ids = rollup.teamIdsUnder(leader.id);
      if (ids.length === 0) continue;
      const teamIncentive = ids.reduce((sum, teamId) => {
        const team = data.teams.find((t) => t.id === teamId);
        const rec = data.achievementRecords.find(
          (r) => r.teamId === teamId && r.period === period,
        );
        if (!team || !rec) return sum;
        const members = calculateTeamParameterIncentive(data, rec, team);
        return sum + members.reduce((n, m) => n + m.finalAmount, 0);
      }, 0);
      spvs.push({
        nodeId: leader.id,
        name: orgNodeName(leader, data.employees),
        title: leader.title,
        cabang: leader.cabang ?? leader.area,
        teamCount: ids.length,
        sv: accumulate(data, period, ids, SV_PARAM),
        ao: accumulate(data, period, ids, AO_PARAM),
        teamIncentive,
      });
    }

    rows.push({
      nodeId: node.id,
      area: node.area,
      name: virtual.name,
      typeSales: "ASM",
      teamCount: teamIds.length,
      sv,
      ao,
      svIncentive: result.parameterBreakdown[SV_PARAM] ?? 0,
      aoIncentive: result.parameterBreakdown[AO_PARAM] ?? 0,
      total: result.grossAmount,
      overduePct,
      overduePenalty: -split.overdue,
      badDebtDays,
      badDebtPenalty: -split.badDebt,
      diterima: result.finalAmount,
      keterangan: keterangan(data, record, result),
      spvs,
    });
  }

  const sum = (pick: (r: AsmRow) => number) =>
    rows.reduce((n, r) => n + pick(r), 0);
  return {
    period,
    rows,
    totals: {
      svIncentive: sum((r) => r.svIncentive),
      aoIncentive: sum((r) => r.aoIncentive),
      total: sum((r) => r.total),
      overduePenalty: sum((r) => r.overduePenalty),
      badDebtPenalty: sum((r) => r.badDebtPenalty),
      diterima: sum((r) => r.diterima),
    },
  };
}
