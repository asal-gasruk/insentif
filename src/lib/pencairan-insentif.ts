import { calculateTeamParameterIncentive } from "@/lib/calculator";
import { normalizeImportPeriod } from "@/lib/import-achievement";
import {
  areaCabangOf,
  outputOrderRanks,
  teamCode,
  teamTypeSales,
} from "@/lib/output-insentif";
import { evaluatePenalties } from "@/lib/penalty-engine";
import type { AppData, EmployeePosition, IncentiveResult, Team } from "@/types";

/**
 * Pencairan Insentif — daftar pembayaran per orang, per area
 * (sheet "Pencairan JABAR-1", "Pencairan JABAR-2", dst).
 */

export type PencairanStatus =
  "DICAIRKAN" | "DITANGGUHKAN" | "HANGUS" | "TIDAK ADA INSENTIF";

export interface PencairanLine {
  name: string;
  jabatan: string;
  /** Hanya di baris salesman (lead tim) */
  typeSales: string;
  amount: number;
  keterangan: string;
}

export interface PencairanTeam {
  teamId: string;
  code: string;
  lines: PencairanLine[];
  total: number;
}

export interface PencairanCabang {
  cabang: string;
  teams: PencairanTeam[];
  total: number;
}

export interface PencairanArea {
  area: string;
  cabangs: PencairanCabang[];
  total: number;
}

export interface PencairanInsentif {
  period: string;
  periodLabel: string;
  areas: PencairanArea[];
  total: number;
  lineCount: number;
}

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** `2026-08` → "Agustus 2026"; `2026-Q1` → "Q1 2026". */
export function periodLabel(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (m) return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
  const q = /^(\d{4})-(Q[1-4])$/i.exec(period);
  return q ? `${q[2].toUpperCase()} ${q[1]}` : period;
}

const POSITION_LABEL: Partial<Record<EmployeePosition, string>> = {
  salesman: "Salesman",
  driver: "Driver",
  helper1: "Helper",
  helper2: "Helper",
};

/** Jabatan baris salesman: label TYPE SALES khusus (TO, SE, KAE, ...) atau "Salesman". */
function leadJabatan(typeSales: string): string {
  return /orang/i.test(typeSales) || typeSales === "GT"
    ? "Salesman"
    : typeSales;
}

function statusOf(results: IncentiveResult[]): {
  status: PencairanStatus;
  note: string;
} {
  const head = results[0];
  const total = results.reduce((n, r) => n + r.finalAmount, 0);
  if (head.voided) return { status: "HANGUS", note: "" };
  if (head.suspended) return { status: "DITANGGUHKAN", note: "" };
  if (total <= 0) return { status: "TIDAK ADA INSENTIF", note: "" };
  return {
    status: "DICAIRKAN",
    note: head.penaltyPct > 0 ? `Potongan ${head.penaltyPct}%` : "",
  };
}

function keteranganText(
  data: AppData,
  results: IncentiveResult[],
  recordId: string,
): string {
  const { status, note } = statusOf(results);
  const record = data.achievementRecords.find((r) => r.id === recordId);
  const scheme = data.schemes.find((s) => s.id === record?.schemeId);
  let extra = note;
  if (record && scheme && (results[0].suspended || results[0].voided)) {
    extra = evaluatePenalties(scheme.penalties ?? [], record).matchedRules.join(
      ", ",
    );
  } else if (record && scheme && results[0].penaltyPct > 0) {
    const rules = evaluatePenalties(
      scheme.penalties ?? [],
      record,
    ).matchedRules;
    extra = `${note} (${rules.join(", ")})`;
  }
  return extra ? `${status} · ${extra}` : status;
}

function buildTeam(
  data: AppData,
  team: Team,
  recordId: string,
  results: IncentiveResult[],
): PencairanTeam {
  const typeSales = teamTypeSales(team);
  const keterangan = keteranganText(data, results, recordId);
  const order = ["salesman", "driver", "helper1", "helper2"];
  const sorted = [...results].sort(
    (a, b) => order.indexOf(a.position) - order.indexOf(b.position),
  );
  const lines: PencairanLine[] = sorted.map((r, i) => ({
    name: r.employeeName,
    jabatan:
      r.position === "salesman"
        ? leadJabatan(typeSales)
        : (POSITION_LABEL[r.position as EmployeePosition] ?? r.position),
    typeSales: i === 0 ? typeSales : "",
    amount: r.finalAmount,
    keterangan: i === 0 ? keterangan : "",
  }));
  return {
    teamId: team.id,
    code: teamCode(team),
    lines,
    total: lines.reduce((n, l) => n + l.amount, 0),
  };
}

/** Bangun daftar pencairan untuk satu periode (opsional satu area). */
export function buildPencairanInsentif(
  data: AppData,
  opts: { period: string; area?: string },
): PencairanInsentif {
  const period = normalizeImportPeriod(opts.period);
  const items: { area: string; cabang: string; team: PencairanTeam }[] = [];

  for (const record of data.achievementRecords) {
    if (!record.teamId || record.period !== period) continue;
    const team = data.teams.find((t) => t.id === record.teamId);
    if (!team) continue;
    const results = calculateTeamParameterIncentive(data, record, team);
    if (results.length === 0) continue;
    const { area, cabang } = areaCabangOf(team, data);
    if (opts.area && area !== opts.area) continue;
    items.push({
      area,
      cabang,
      team: buildTeam(data, team, record.id, results),
    });
  }

  const { areaRank, cabangRank, codeRank } = outputOrderRanks();
  const areas = [...new Set(items.map((i) => i.area))].sort(
    (a, b) => areaRank(a) - areaRank(b),
  );
  const outAreas: PencairanArea[] = areas.map((area) => {
    const inArea = items.filter((i) => i.area === area);
    const cabangs = [...new Set(inArea.map((i) => i.cabang))].sort(
      (a, b) => cabangRank(a) - cabangRank(b),
    );
    const outCabangs: PencairanCabang[] = cabangs.map((cabang) => {
      const teams = inArea
        .filter((i) => i.cabang === cabang)
        .map((i) => i.team)
        .sort((a, b) => codeRank(a.code) - codeRank(b.code));
      return {
        cabang,
        teams,
        total: teams.reduce((n, t) => n + t.total, 0),
      };
    });
    return {
      area,
      cabangs: outCabangs,
      total: outCabangs.reduce((n, c) => n + c.total, 0),
    };
  });

  return {
    period,
    periodLabel: periodLabel(period),
    areas: outAreas,
    total: outAreas.reduce((n, a) => n + a.total, 0),
    lineCount: items.reduce((n, i) => n + i.team.lines.length, 0),
  };
}
