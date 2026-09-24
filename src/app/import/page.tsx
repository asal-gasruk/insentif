"use client";

import Link from "next/link";
import { ChangeEvent, useState } from "react";
import { LoadingState } from "@/components/LoadingState";
import { PageHeader } from "@/components/PageHeader";
import { Select2 } from "@/components/Select2";
import {
  calculateDeliveryIncentive,
  calculateParameterIncentive,
  calculateTeamDeliveryIncentive,
  calculateTeamParameterIncentive,
  formatRupiah,
} from "@/lib/calculator";
import {
  activeParams,
  defaultSegment,
  schemeForEmployee,
} from "@/lib/scheme-utils";
import { downloadXlsx, parseImportFile } from "@/lib/import-file";
import {
  normalizeImportPeriod,
  normalizeOverduePct,
  resolveImportedAchievementPct,
} from "@/lib/import-achievement";
import {
  buildSchemeImportTemplate,
  getImportTemplateMeta,
  isTeamScheme,
  type ImportSubjectMode,
} from "@/lib/import-templates";
import { generateId } from "@/lib/storage";
import {
  defaultSegmentForTeam,
  resolveSubjectMode,
  schemeForTeam,
} from "@/lib/team-utils";
import { useAppData } from "@/hooks/useAppData";
import type {
  AchievementRecord,
  AppData,
  DeliveryRecord,
  DeliveryResult,
  Employee,
  IncentiveResult,
  Team,
} from "@/types";

/** Angka dengan dukungan desimal koma ("0,5") */
function parseNum(raw: string | undefined): number | undefined {
  if (!raw || raw.trim() === "") return undefined;
  const n = parseFloat(raw.replace(",", "."));
  return Number.isNaN(n) ? undefined : n;
}

// ---------------------------------------------------------------------------
// Validasi baris
// ---------------------------------------------------------------------------

type ParsedRow =
  | {
      line: number;
      kind: "achievement";
      status: "ok";
      subjectLabel: string;
      employee?: Employee;
      team?: Team;
      info: string;
      payload: AchievementRecord;
      isUpdate: boolean;
      result: IncentiveResult;
      results?: IncentiveResult[];
    }
  | {
      line: number;
      kind: "delivery";
      status: "ok";
      subjectLabel: string;
      employee?: Employee;
      team?: Team;
      info: string;
      payload: DeliveryRecord;
      isUpdate: boolean;
      result: DeliveryResult;
      results?: DeliveryResult[];
    }
  | {
      line: number;
      kind: "achievement" | "delivery";
      status: "error";
      info: string;
    };

function aggregateTeamResult(results: IncentiveResult[]): IncentiveResult {
  const first = results[0];
  return {
    ...first,
    employeeName: first.teamName
      ? `Tim ${first.teamName}`
      : first.employeeName,
    finalAmount: results.reduce((s, r) => s + r.finalAmount, 0),
    splitRatio: 1,
  };
}

function validateTeamAchievementRow(
  data: AppData,
  row: Record<string, string>,
  line: number,
): ParsedRow {
  const teamId = row.teamId?.trim();
  const period = normalizeImportPeriod(row.periode ?? "");
  if (!teamId || !period) {
    return {
      line,
      kind: "achievement",
      status: "error",
      info: "Kolom teamId / periode kosong",
    };
  }

  const team = data.teams.find((t) => t.id === teamId);
  if (!team) {
    return {
      line,
      kind: "achievement",
      status: "error",
      info: `teamId "${teamId}" tidak ditemukan di Master Tim`,
    };
  }
  if (!team.active) {
    return {
      line,
      kind: "achievement",
      status: "error",
      info: `Tim "${team.name}" tidak aktif`,
    };
  }

  const scheme = schemeForTeam(data, team);
  if (!scheme || scheme.type !== "parameter") {
    return {
      line,
      kind: "achievement",
      status: "error",
      info: `Role "${team.roleId}" tidak punya skema parameter (Delivery pakai template pengiriman)`,
    };
  }

  const segment = defaultSegmentForTeam(data, team);
  const active = activeParams(data, scheme.id, segment);

  const achievements: Record<string, number> = {};
  const missingTargets: string[] = [];
  for (const paramId of active) {
    const v = parseNum(row[paramId]);
    if (v === undefined) continue;
    const hasTarget = data.parameterTargets.some(
      (t) =>
        t.teamId === team.id && t.paramId === paramId && t.period === period,
    );
    if (!hasTarget && v > 200) {
      missingTargets.push(paramId);
    }
    achievements[paramId] = resolveImportedAchievementPct(data, {
      teamId: team.id,
      paramId,
      period,
      raw: v,
    });
  }
  if (Object.keys(achievements).length === 0) {
    return {
      line,
      kind: "achievement",
      status: "error",
      info: "Tidak ada nilai pencapaian yang terisi",
    };
  }
  if (missingTargets.length > 0) {
    return {
      line,
      kind: "achievement",
      status: "error",
      info: `Nilai besar terdeteksi sebagai ACTUAL tapi Target belum ada untuk: ${missingTargets.join(", ")} (periode ${period}). Isi Target Parameter dulu, atau isi % pencapaian (mis. 100.9).`,
    };
  }

  const existing = data.achievementRecords.find(
    (r) => r.teamId === team.id && r.period === period,
  );

  const payload: AchievementRecord = {
    id: existing?.id ?? generateId("ach"),
    teamId: team.id,
    period,
    schemeId: scheme.id,
    segmentId: existing?.segmentId ?? segment,
    achievements,
    overduePct: normalizeOverduePct(parseNum(row.overduePct) ?? 0),
    badDebtDays: parseNum(row.badDebtDays) ?? 0,
    notes: row.catatan?.trim() ?? "Import bulk",
  };

  const results = calculateTeamParameterIncentive(data, payload, team);
  const result = results.length > 0 ? aggregateTeamResult(results) : {
    recordId: payload.id,
    employeeId: "",
    employeeName: team.name,
    position: "salesman",
    period,
    schemeName: scheme.name,
    segmentName: segment,
    tierLabel: "-",
    parameterBreakdown: {},
    grossAmount: 0,
    splitRatio: 1,
    penaltyPct: 0,
    suspended: false,
    voided: false,
    finalAmount: 0,
    teamId: team.id,
    teamName: team.name,
  };

  return {
    line,
    kind: "achievement",
    status: "ok",
    subjectLabel: `Tim ${team.name}`,
    team,
    info: `${team.name} · ${scheme.name} · ${period}${existing ? " (update)" : ""} · ${team.members.length} anggota · gross ${Math.round(result.grossAmount).toLocaleString("id-ID")}`,
    payload,
    isUpdate: Boolean(existing),
    result,
    results,
  };
}

function validateAchievementRow(
  data: AppData,
  row: Record<string, string>,
  line: number,
): ParsedRow {
  if (row.teamId?.trim()) {
    return validateTeamAchievementRow(data, row, line);
  }

  const nik = row.nik?.trim();
  const period = normalizeImportPeriod(row.periode ?? "");
  if (!nik || !period) {
    return {
      line,
      kind: "achievement",
      status: "error",
      info: "Kolom nik / periode kosong (skema tim pakai teamId)",
    };
  }

  const employee = data.employees.find((e) => e.nik === nik);
  if (!employee) {
    return {
      line,
      kind: "achievement",
      status: "error",
      info: `NIK "${nik}" tidak ditemukan di master Karyawan`,
    };
  }

  if (resolveSubjectMode(data, employee) === "team") {
    return {
      line,
      kind: "achievement",
      status: "error",
      info: `${employee.name} mode Tim — unduh template dengan kolom teamId`,
    };
  }

  const scheme = schemeForEmployee(data, employee);
  if (!scheme) {
    return {
      line,
      kind: "achievement",
      status: "error",
      info: `Role "${employee.roleId}" tidak punya skema parameter (Delivery pakai template pengiriman)`,
    };
  }

  const segment = defaultSegment(data, employee);
  const active = activeParams(data, scheme.id, segment);

  const achievements: Record<string, number> = {};
  for (const paramId of active) {
    const v = parseNum(row[paramId]);
    if (v === undefined) continue;
    achievements[paramId] = resolveImportedAchievementPct(data, {
      employeeId: employee.id,
      paramId,
      period,
      raw: v,
    });
  }
  if (Object.keys(achievements).length === 0) {
    return {
      line,
      kind: "achievement",
      status: "error",
      info: "Tidak ada nilai pencapaian yang terisi",
    };
  }

  const existing = data.achievementRecords.find(
    (r) => r.employeeId === employee.id && r.period === period,
  );

  const payload: AchievementRecord = {
    id: existing?.id ?? generateId("ach"),
    employeeId: employee.id,
    period,
    schemeId: scheme.id,
    segmentId: existing?.segmentId ?? defaultSegment(data, employee),
    achievements,
    overduePct: normalizeOverduePct(parseNum(row.overduePct) ?? 0),
    badDebtDays: parseNum(row.badDebtDays) ?? 0,
    notes: row.catatan?.trim() ?? "Import bulk",
  };

  return {
    line,
    kind: "achievement",
    status: "ok",
    subjectLabel: employee.name,
    employee,
    info: `${employee.name} · ${scheme.name} · ${period}${existing ? " (update)" : ""}`,
    payload,
    isUpdate: Boolean(existing),
    result: calculateParameterIncentive(data, payload, employee),
  };
}

const VEHICLE_TYPES = ["PICKUP", "ENGKEL", "DOUBLE"];

/** Armada delivery tim dari Karyawan anggota (driver dulu), bukan kolom upload */
function resolveTeamVehicleType(
  data: AppData,
  team: Team,
): string | undefined {
  const ordered = [
    ...team.members.filter((m) => m.position === "driver"),
    ...team.members,
  ];
  for (const m of ordered) {
    const emp = data.employees.find((e) => e.id === m.employeeId);
    const v = emp?.vehicleType?.trim().toUpperCase();
    if (v && VEHICLE_TYPES.includes(v)) return v;
  }
  return undefined;
}

function aggregateTeamDeliveryResult(results: DeliveryResult[]): DeliveryResult {
  const first = results[0];
  return {
    ...first,
    employeeName: first.teamName ? `Tim ${first.teamName}` : first.employeeName,
    finalAmount: results.reduce((s, r) => s + r.finalAmount, 0),
    splitRatio: 1,
  };
}

function validateTeamDeliveryRow(
  data: AppData,
  row: Record<string, string>,
  line: number,
): ParsedRow {
  const teamId = row.teamId?.trim();
  const period = normalizeImportPeriod(row.periode ?? "");
  if (!teamId || !period) {
    return {
      line,
      kind: "delivery",
      status: "error",
      info: "Kolom teamId / periode kosong",
    };
  }

  const team = data.teams.find((t) => t.id === teamId);
  if (!team) {
    return {
      line,
      kind: "delivery",
      status: "error",
      info: `teamId "${teamId}" tidak ditemukan di Master Tim`,
    };
  }
  if (!team.active) {
    return {
      line,
      kind: "delivery",
      status: "error",
      info: `Tim "${team.name}" tidak aktif`,
    };
  }

  const deliveryScheme = data.schemes.find(
    (s) => s.type === "volumeTier" && s.roleId === team.roleId,
  );
  if (!deliveryScheme) {
    return {
      line,
      kind: "delivery",
      status: "error",
      info: `Tim "${team.name}" bukan Delivery — gunakan template pencapaian`,
    };
  }

  const fromRow = (row.armada ?? "").trim().toUpperCase();
  const vehicleType =
    (fromRow && VEHICLE_TYPES.includes(fromRow) ? fromRow : undefined) ??
    resolveTeamVehicleType(data, team);

  if (!vehicleType) {
    return {
      line,
      kind: "delivery",
      status: "error",
      info: `Tim "${team.name}" belum punya jenis armada di Karyawan anggota (PICKUP / ENGKEL / DOUBLE)`,
    };
  }

  const existing = data.deliveryRecords.find(
    (r) => r.teamId === team.id && r.period === period,
  );

  const payload: DeliveryRecord = {
    id: existing?.id ?? generateId("del"),
    teamId: team.id,
    period,
    vehicleType,
    cartons: parseNum(row.karton) ?? 0,
    invoices: parseNum(row.faktur) ?? 0,
    otdPct: parseNum(row.otdPct) ?? 100,
    accuracyPct: parseNum(row.akurasiPct) ?? 100,
    notes: row.catatan?.trim() ?? "Import bulk",
  };

  const results = calculateTeamDeliveryIncentive(data, payload, team);
  const result =
    results.length > 0
      ? aggregateTeamDeliveryResult(results)
      : {
          recordId: payload.id,
          employeeId: "",
          employeeName: team.name,
          position: "driver",
          period,
          vehicleType,
          cartonNominal: 0,
          dropPointNominal: 0,
          grossAmount: 0,
          splitRatio: 1,
          qualityPassed: false,
          finalAmount: 0,
          teamId: team.id,
          teamName: team.name,
        };

  return {
    line,
    kind: "delivery",
    status: "ok",
    subjectLabel: `Tim ${team.name}`,
    team,
    info: `${team.name} · ${vehicleType} (dari tim) · ${period}${existing ? " (update)" : ""} · ${team.members.length} anggota`,
    payload,
    isUpdate: Boolean(existing),
    result,
    results,
  };
}

function validateDeliveryRow(
  data: AppData,
  row: Record<string, string>,
  line: number,
): ParsedRow {
  if (row.teamId?.trim()) {
    return validateTeamDeliveryRow(data, row, line);
  }

  const nik = row.nik?.trim();
  const period = normalizeImportPeriod(row.periode ?? "");
  if (!nik || !period) {
    return {
      line,
      kind: "delivery",
      status: "error",
      info: "Kolom nik / periode kosong (mode Tim pakai teamId)",
    };
  }

  const employee = data.employees.find((e) => e.nik === nik);
  if (!employee) {
    return {
      line,
      kind: "delivery",
      status: "error",
      info: `NIK "${nik}" tidak ditemukan di master Karyawan`,
    };
  }

  if (resolveSubjectMode(data, employee) === "team") {
    return {
      line,
      kind: "delivery",
      status: "error",
      info: `${employee.name} mode Tim — unduh template pengiriman dengan kolom teamId`,
    };
  }

  const deliveryScheme = data.schemes.find(
    (s) => s.type === "volumeTier" && s.roleId === employee.roleId,
  );
  if (!deliveryScheme) {
    return {
      line,
      kind: "delivery",
      status: "error",
      info: `${employee.name} (${nik}) bukan Delivery — gunakan template pencapaian`,
    };
  }

  const vehicleType = (row.armada ?? "").trim().toUpperCase();
  if (!VEHICLE_TYPES.includes(vehicleType)) {
    return {
      line,
      kind: "delivery",
      status: "error",
      info: `Armada "${row.armada}" tidak dikenal (gunakan PICKUP / ENGKEL / DOUBLE)`,
    };
  }

  const existing = data.deliveryRecords.find(
    (r) => r.employeeId === employee.id && r.period === period,
  );

  const payload: DeliveryRecord = {
    id: existing?.id ?? generateId("del"),
    employeeId: employee.id,
    period,
    vehicleType,
    cartons: parseNum(row.karton) ?? 0,
    invoices: parseNum(row.faktur) ?? 0,
    otdPct: parseNum(row.otdPct) ?? 100,
    accuracyPct: parseNum(row.akurasiPct) ?? 100,
    notes: row.catatan?.trim() ?? "Import bulk",
  };

  return {
    line,
    kind: "delivery",
    status: "ok",
    subjectLabel: employee.name,
    employee,
    info: `${employee.name} · ${vehicleType} · ${period}${existing ? " (update)" : ""}`,
    payload,
    isUpdate: Boolean(existing),
    result: calculateDeliveryIncentive(data, payload, employee),
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type OkRow = Extract<ParsedRow, { status: "ok" }>;

/** Badge status hasil — penalty/suspend/void (parameter) atau quality gate (delivery) */
function ResultStatusBadge({ row }: { row: OkRow }) {
  if (row.kind === "achievement") {
    const r = row.result;
    if (r.voided)
      return <span className="badge bg-red-100 text-red-700">Hangus</span>;
    if (r.suspended)
      return (
        <span className="badge bg-amber-100 text-amber-700">Ditangguhkan</span>
      );
    if (r.penaltyPct > 0)
      return (
        <span className="badge bg-amber-100 text-amber-700">
          Penalty {r.penaltyPct}%
        </span>
      );
    return <span className="badge bg-[var(--success)]/10 text-[var(--success)]">Penuh</span>;
  }
  return row.result.qualityPassed ? (
    <span className="badge bg-[var(--success)]/10 text-[var(--success)]">Quality OK</span>
  ) : (
    <span className="badge bg-red-100 text-red-700">Quality Gagal</span>
  );
}

/** Tabel hasil perhitungan — dipakai untuk preview & ringkasan after-import */
function ResultTable({ rows }: { rows: ParsedRow[] }) {
  const hasTeamRows = rows.some((r) => r.status === "ok" && Boolean(r.team));

  type PreviewLine = {
    key: string;
    lineLabel: string;
    statusLabel: "valid" | "update" | "member" | "error";
    teamName: string;
    teamId: string;
    subject: string;
    period: string;
    schemeOrArmada: string;
    tierOrVolume: string;
    badgeRow: OkRow | null;
    errorInfo?: string;
    finalAmount: number;
    emphasize: boolean;
  };

  const lines: PreviewLine[] = [];

  for (const row of rows) {
    if (row.status === "error") {
      lines.push({
        key: `e-${row.line}`,
        lineLabel: String(row.line),
        statusLabel: "error",
        teamName: "—",
        teamId: "",
        subject: "—",
        period: "—",
        schemeOrArmada: "—",
        tierOrVolume: "—",
        badgeRow: null,
        errorInfo: row.info,
        finalAmount: 0,
        emphasize: false,
      });
      continue;
    }

    const schemeOrArmada =
      row.kind === "achievement"
        ? `${row.result.schemeName} · ${row.result.segmentName}`
        : `Delivery · ${row.result.vehicleType}`;
    const tierOrVolume =
      row.kind === "achievement"
        ? row.result.tierLabel || "—"
        : `${row.payload.cartons.toLocaleString("id-ID")} karton · ${row.payload.invoices.toLocaleString("id-ID")} faktur`;

    lines.push({
      key: `t-${row.line}`,
      lineLabel: String(row.line),
      statusLabel: row.isUpdate ? "update" : "valid",
      teamName: row.team?.name ?? "—",
      teamId: row.team?.id ?? "",
      subject: row.team
        ? `Σ Total tim (${row.results?.length ?? row.team.members.length} anggota)`
        : row.subjectLabel,
      period: row.payload.period,
      schemeOrArmada,
      tierOrVolume,
      badgeRow: row,
      finalAmount: row.result.finalAmount,
      emphasize: true,
    });

    if (row.team && row.results && row.results.length > 0) {
      for (const m of row.results) {
        lines.push({
          key: `m-${row.line}-${m.employeeId}`,
          lineLabel: "",
          statusLabel: "member",
          teamName: row.team.name,
          teamId: row.team.id,
          subject: `${m.employeeName} · ${m.position}`,
          period: row.payload.period,
          schemeOrArmada,
          tierOrVolume: `bagian ${(m.splitRatio * 100).toFixed(1)}%`,
          badgeRow: null,
          finalAmount: m.finalAmount,
          emphasize: false,
        });
      }
    }
  }

  const errorColSpan = hasTeamRows ? 7 : 6;

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[var(--surface-muted)]">
          <tr>
            <th className="px-3 py-3 text-left">Baris</th>
            <th className="px-3 py-3 text-center">Status</th>
            {hasTeamRows && <th className="px-3 py-3 text-left">Tim</th>}
            <th className="px-3 py-3 text-left">
              {hasTeamRows ? "Subjek / Anggota" : "Karyawan"}
            </th>
            <th className="px-3 py-3 text-left">Periode</th>
            <th className="px-3 py-3 text-left">Skema / Armada</th>
            <th className="px-3 py-3 text-left">Tier / Volume</th>
            <th className="px-3 py-3 text-center">Hasil</th>
            <th className="px-3 py-3 text-right">Insentif Final</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr
              key={line.key}
              className={`border-t border-[var(--border)] ${
                line.statusLabel === "member"
                  ? "bg-[var(--surface-muted)]/35"
                  : ""
              }`}
            >
              <td className="px-3 py-2 font-[family-name:var(--font-mono)] text-xs">
                {line.lineLabel}
              </td>
              <td className="px-3 py-2 text-center">
                {line.statusLabel === "error" && (
                  <span className="badge bg-red-100 text-red-700">Error</span>
                )}
                {line.statusLabel === "valid" && (
                  <span className="badge bg-[var(--success)]/10 text-[var(--success)]">
                    Valid
                  </span>
                )}
                {line.statusLabel === "update" && (
                  <span className="badge bg-[var(--success)]/10 text-[var(--success)]">
                    Valid · update
                  </span>
                )}
                {line.statusLabel === "member" && (
                  <span className="text-xs text-[var(--text-muted)]">anggota</span>
                )}
              </td>
              {line.statusLabel === "error" ? (
                <td
                  colSpan={errorColSpan}
                  className="px-3 py-2 text-xs text-red-700"
                >
                  {line.errorInfo}
                </td>
              ) : (
                <>
                  {hasTeamRows && (
                    <td className="px-3 py-2">
                      <div className={line.emphasize ? "font-medium" : ""}>
                        {line.teamName}
                      </div>
                      {line.teamId && line.emphasize && (
                        <div className="mt-0.5 font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-muted)]">
                          {line.teamId}
                        </div>
                      )}
                    </td>
                  )}
                  <td
                    className={`px-3 py-2 ${
                      line.statusLabel === "member"
                        ? "pl-5 text-[var(--text-muted)]"
                        : "font-medium"
                    }`}
                  >
                    {line.subject}
                  </td>
                  <td className="px-3 py-2">{line.period}</td>
                  <td className="px-3 py-2 text-xs">{line.schemeOrArmada}</td>
                  <td className="px-3 py-2 text-xs">{line.tierOrVolume}</td>
                  <td className="px-3 py-2 text-center">
                    {line.badgeRow ? (
                      <ResultStatusBadge row={line.badgeRow} />
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-semibold ${
                      line.emphasize
                        ? "text-[var(--success)]"
                        : "text-[var(--text)]"
                    }`}
                  >
                    {formatRupiah(line.finalAmount)}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ImportPage() {
  const { data, ready, create, update } = useAppData();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [imported, setImported] = useState<ParsedRow[]>([]);
  const [subjectMode, setSubjectMode] = useState<ImportSubjectMode>("team");
  const [selectedSchemeId, setSelectedSchemeId] = useState("");

  if (!ready || !data) return <LoadingState />;

  const schemesForMode = data.schemes.filter((s) =>
    subjectMode === "team" ? isTeamScheme(data, s) : true,
  );

  const schemeId =
    (schemesForMode.some((s) => s.id === selectedSchemeId)
      ? selectedSchemeId
      : schemesForMode[0]?.id) || "";
  const templateMeta = schemeId
    ? getImportTemplateMeta(data, schemeId, subjectMode)
    : null;

  const setMode = (mode: ImportSubjectMode) => {
    setSubjectMode(mode);
    setSelectedSchemeId("");
    setRows([]);
    setImported([]);
    setResult(null);
    setFileName("");
  };

  const downloadSchemeTemplate = () => {
    if (!schemeId) return;
    const built = buildSchemeImportTemplate(data, schemeId, subjectMode);
    if (!built) return;
    downloadXlsx(built.filename, built.headers, built.rows, built.sheetName);
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setFileName(file.name);
    setResult(null);
    setImported([]);

    let parsed: Record<string, string>[];
    try {
      parsed = await parseImportFile(file);
    } catch {
      setRows([]);
      setResult("Gagal membaca file. Pastikan format .xlsx atau .csv valid.");
      return;
    }

    if (parsed.length === 0) {
      setRows([]);
      setResult("File kosong atau format tidak dikenali.");
      return;
    }

    const isDelivery =
      "karton" in parsed[0] ||
      "faktur" in parsed[0] ||
      "armada" in parsed[0];
    const hasTeamId = "teamId" in parsed[0];

    if (subjectMode === "team" && !hasTeamId) {
      setRows([]);
      setResult(
        "Mode Tim membutuhkan kolom teamId. Unduh ulang template di mode Tim.",
      );
      return;
    }
    if (subjectMode === "individu" && hasTeamId) {
      setRows([]);
      setResult(
        "File berisi teamId — itu template Tim. Ganti mode ke Tim, atau unduh template Individu.",
      );
      return;
    }

    const validated = parsed.map((row, i) =>
      isDelivery
        ? validateDeliveryRow(data, row, i + 2)
        : validateAchievementRow(data, row, i + 2),
    );
    setRows(validated);
  };

  const validRows = rows.filter((r): r is OkRow => r.status === "ok");
  const errorRows = rows.filter((r) => r.status === "error");
  const previewTotal = validRows.reduce(
    (sum, r) => sum + r.result.finalAmount,
    0,
  );
  const importedTotal = imported.reduce(
    (sum, r) => sum + (r.status === "ok" ? r.result.finalAmount : 0),
    0,
  );

  const doImport = () => {
    let created = 0;
    let updated = 0;
    for (const row of validRows) {
      if (row.status !== "ok") continue;
      const key =
        row.kind === "achievement" ? "achievementRecords" : "deliveryRecords";
      if (row.isUpdate) {
        update(key, row.payload);
        updated++;
      } else {
        create(key, row.payload);
        created++;
      }
    }
    setImported(validRows);
    setRows([]);
    setResult(
      `Import selesai: ${created} data baru, ${updated} data diperbarui.`,
    );
  };

  return (
    <>
      <PageHeader
        title="Import Bulk Data Transaksi"
        description="Satu alur import — pilih Individu atau Tim, unduh template Excel (.xlsx). Untuk pencapaian: isi ACTUAL (sistem konversi ke % via Target Parameter)."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h3 className="mb-1 font-bold">1 · Unduh Template</h3>
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            Pilih subjek dulu, lalu skema. Template Tim memakai{" "}
            <b>teamId</b>; Individu memakai <b>NIK</b> (termasuk Delivery).
          </p>

          <div className="mb-4">
            <label className="label">Subjek Import</label>
            <div className="flex gap-2">
              <button
                type="button"
                className={
                  subjectMode === "team"
                    ? "btn-primary flex-1"
                    : "btn-secondary flex-1"
                }
                onClick={() => setMode("team")}
              >
                Tim
              </button>
              <button
                type="button"
                className={
                  subjectMode === "individu"
                    ? "btn-primary flex-1"
                    : "btn-secondary flex-1"
                }
                onClick={() => setMode("individu")}
              >
                Individu
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {subjectMode === "team"
                ? "Role capable Tim (Canvass, Sales, Delivery, …) — 1 baris = 1 tim"
                : "Semua role mode Individu — 1 baris = 1 karyawan (NIK)"}
            </p>
          </div>

          <div className="mb-4">
            <label className="label">Skema Insentif</label>
            <Select2
              value={schemeId}
              onChange={setSelectedSchemeId}
              options={schemesForMode.map((s) => ({
                value: s.id,
                label: `${s.name} (${s.type === "volumeTier" ? "Pengiriman" : "Pencapaian"})`,
              }))}
              placeholder={
                schemesForMode.length === 0
                  ? "Tidak ada skema untuk mode ini"
                  : "Pilih skema"
              }
              isDisabled={schemesForMode.length === 0}
            />
          </div>

          {templateMeta && (
            <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50 p-3 text-xs">
              <p>
                <span className="font-semibold">Mode:</span>{" "}
                {subjectMode === "team" ? "Tim (teamId)" : "Individu (NIK)"}
              </p>
              <p>
                <span className="font-semibold">Tipe:</span>{" "}
                {templateMeta.kind === "delivery"
                  ? "Volume tier · pengiriman"
                  : "Parameter · pencapaian"}
              </p>
              <p>
                <span className="font-semibold">Periode:</span>{" "}
                {templateMeta.scheme.period === "quarterly"
                  ? "Kuartalan"
                  : "Bulanan"}{" "}
                · format {templateMeta.periodLabel}
              </p>
              <p>
                <span className="font-semibold">Segment:</span>{" "}
                {templateMeta.segmentLabels}
              </p>
              <p>
                <span className="font-semibold">Rumus:</span>{" "}
                {templateMeta.formulaLabel}
              </p>
              {templateMeta.kind === "achievement" && (
                <p className="mt-1">
                  <span className="font-semibold">Kolom parameter:</span>{" "}
                  {templateMeta.paramColumns.length > 0
                    ? templateMeta.paramColumns
                        .map((p) => `${p.label} (${p.id})`)
                        .join(" · ")
                    : "Belum ada bobot — atur di Bobot & Nominal"}
                </p>
              )}
              <p className="mt-1 text-[var(--text-muted)]">
                {templateMeta.subjectKind === "team"
                  ? templateMeta.teamCount > 0
                    ? `${templateMeta.teamCount} tim cocok di Master Tim`
                    : "Belum ada tim role ini — template berisi baris placeholder"
                  : templateMeta.employeeCount > 0
                    ? `${templateMeta.employeeCount} karyawan cocok di master`
                    : "Belum ada karyawan role ini — template berisi baris placeholder"}
              </p>
            </div>
          )}

          <button
            type="button"
            className="btn-primary"
            disabled={
              !templateMeta ||
              (templateMeta.kind === "achievement" &&
                templateMeta.paramColumns.length === 0)
            }
            onClick={downloadSchemeTemplate}
          >
            ⇩ Unduh Template Excel (.xlsx){" "}
            {subjectMode === "team"
              ? "Tim"
              : templateMeta?.kind === "delivery"
                ? "Pengiriman"
                : "Individu"}
          </button>

          <ul className="mt-4 space-y-1 text-xs text-[var(--text-muted)]">
            {subjectMode === "team" ? (
              <>
                <li>
                  • Kolom identitas: <b>teamId</b> (lihat Master Tim)
                </li>
                <li>
                  • Satu baris pencapaian dibagi ke semua anggota saat perhitungan
                </li>
                <li>
                  • Delivery Tim: tanpa kolom armada — diambil dari Karyawan
                  anggota Tim
                </li>
              </>
            ) : (
              <>
                <li>
                  • Kolom identitas: <b>NIK</b> (lihat Karyawan)
                </li>
                <li>
                  • Delivery Tim: tanpa kolom armada — jenis armada dari Karyawan
                  anggota Master Tim
                </li>
                <li>
                  • Delivery Individu: kolom armada / karton / faktur / OTD /
                  akurasi
                </li>
              </>
            )}
            <li>
              • Periode sesuai skema:{" "}
              <b>{templateMeta?.periodLabel ?? "YYYY-MM"}</b>
            </li>
            <li>• Jika subjek + periode sudah ada, data akan <b>diperbarui</b></li>
            <li>
              • Template unduhan: <b>.xlsx</b> · upload juga menerima .csv lama
            </li>
            <li>
              • Pencapaian: isi <b>ACTUAL</b> per parameter (bukan %). % = ACTUAL ÷
              Target (menu Target Parameter). Overdue isi seperti Excel (0.059)
              atau persen (5.9).
            </li>
          </ul>
        </section>

        <section className="card p-5">
          <h3 className="mb-1 font-bold">2 · Upload File Excel</h3>
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            Pastikan file sesuai mode{" "}
            <b>{subjectMode === "team" ? "Tim" : "Individu"}</b> di sebelah kiri.
            Data divalidasi dulu — tidak langsung tersimpan.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] px-4 py-8 text-center hover:border-[var(--primary)] hover:bg-[var(--surface-muted)]">
            <span className="text-2xl">⇪</span>
            <span className="mt-2 text-sm font-medium">
              Klik untuk pilih file .xlsx
            </span>
            {fileName && (
              <span className="mt-1 text-xs text-[var(--text-muted)]">
                {fileName}
              </span>
            )}
            <input
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              className="hidden"
              onChange={handleFile}
            />
          </label>
        </section>
      </div>

      {rows.length > 0 && (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold">
                3 · Preview, Validasi &amp; Estimasi Hasil —{" "}
                {rows[0].kind === "delivery" ? "Pengiriman" : "Pencapaian"}{" "}
                ({subjectMode === "team" ? "Tim" : "Individu"})
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {validRows.length} baris valid · {errorRows.length} baris error
                (dilewati saat import) · Total estimasi insentif:{" "}
                <b className="text-[var(--success)]">
                  {formatRupiah(previewTotal)}
                </b>
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={validRows.length === 0}
              onClick={doImport}
            >
              Import {validRows.length} Baris Valid
            </button>
          </div>
          <ResultTable rows={rows} />
        </>
      )}

      {imported.length > 0 && (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold">✓ Hasil Import &amp; Perhitungan Insentif</h3>
              <p className="text-xs text-[var(--text-muted)]">
                {result} Total insentif:{" "}
                <b className="text-[var(--success)]">
                  {formatRupiah(importedTotal)}
                </b>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {imported.some((r) => r.kind === "achievement") && (
                <Link href="/pencapaian" className="btn-secondary">
                  Data Pencapaian
                </Link>
              )}
              {imported.some((r) => r.kind === "delivery") && (
                <Link href="/pengiriman" className="btn-secondary">
                  Data Pengiriman
                </Link>
              )}
              <Link href="/perhitungan" className="btn-primary">
                Buka Perhitungan →
              </Link>
            </div>
          </div>
          <ResultTable rows={imported} />
        </>
      )}

      {result && imported.length === 0 && rows.length === 0 && (
        <div className="card border-l-4 border-l-amber-500 p-4 text-sm font-medium">
          {result}
        </div>
      )}
    </>
  );
}
