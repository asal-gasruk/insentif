"use client";

import Link from "next/link";
import { ChangeEvent, useState } from "react";
import { LoadingState } from "@/components/LoadingState";
import { PageHeader } from "@/components/PageHeader";
import { Select2 } from "@/components/Select2";
import {
  calculateDeliveryIncentive,
  calculateParameterIncentive,
  formatRupiah,
} from "@/lib/calculator";
import {
  activeParams,
  defaultSegment,
  schemeForEmployee,
} from "@/lib/scheme-utils";
import {
  buildSchemeImportTemplate,
  getImportTemplateMeta,
} from "@/lib/import-templates";
import { generateId } from "@/lib/storage";
import { useAppData } from "@/hooks/useAppData";
import type {
  AchievementRecord,
  AppData,
  DeliveryRecord,
  DeliveryResult,
  Employee,
  IncentiveResult,
} from "@/types";

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([`\uFEFF${content}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parse CSV sederhana — dukung pemisah koma atau titik-koma (format Excel ID) */
function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^\uFEFF/, "").trim();
  const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter).map((c) => c.trim());
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

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
      employee: Employee;
      info: string;
      payload: AchievementRecord;
      isUpdate: boolean;
      result: IncentiveResult;
    }
  | {
      line: number;
      kind: "delivery";
      status: "ok";
      employee: Employee;
      info: string;
      payload: DeliveryRecord;
      isUpdate: boolean;
      result: DeliveryResult;
    }
  | {
      line: number;
      kind: "achievement" | "delivery";
      status: "error";
      info: string;
    };

function validateAchievementRow(
  data: AppData,
  row: Record<string, string>,
  line: number,
): ParsedRow {
  const nik = row.nik?.trim();
  const period = row.periode?.trim();
  if (!nik || !period) {
    return {
      line,
      kind: "achievement",
      status: "error",
      info: "Kolom nik / periode kosong",
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
    if (v !== undefined) achievements[paramId] = v;
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
    overduePct: parseNum(row.overduePct) ?? 0,
    badDebtDays: parseNum(row.badDebtDays) ?? 0,
    notes: row.catatan?.trim() ?? "Import bulk",
  };

  return {
    line,
    kind: "achievement",
    status: "ok",
    employee,
    info: `${employee.name} · ${scheme.name} · ${period}${existing ? " (update)" : ""}`,
    payload,
    isUpdate: Boolean(existing),
    result: calculateParameterIncentive(data, payload, employee),
  };
}

const VEHICLE_TYPES = ["PICKUP", "ENGKEL", "DOUBLE"];

function validateDeliveryRow(
  data: AppData,
  row: Record<string, string>,
  line: number,
): ParsedRow {
  const nik = row.nik?.trim();
  const period = row.periode?.trim();
  if (!nik || !period) {
    return {
      line,
      kind: "delivery",
      status: "error",
      info: "Kolom nik / periode kosong",
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

  const deliveryScheme = data.schemes.find(
    (s) => s.type === "volumeTier" && s.roleId === employee.roleId,
  );
  if (!deliveryScheme) {
    return {
      line,
      kind: "delivery",
      status: "error",
      info: `${employee.name} (${nik}) bukan tim Delivery — gunakan template pencapaian`,
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
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[var(--surface-muted)]">
          <tr>
            <th className="px-3 py-3 text-left">Baris</th>
            <th className="px-3 py-3 text-center">Status</th>
            <th className="px-3 py-3 text-left">Karyawan</th>
            <th className="px-3 py-3 text-left">Periode</th>
            <th className="px-3 py-3 text-left">Skema / Armada</th>
            <th className="px-3 py-3 text-left">Tier / Volume</th>
            <th className="px-3 py-3 text-center">Hasil</th>
            <th className="px-3 py-3 text-right">Insentif Final</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.line} className="border-t border-[var(--border)]">
              <td className="px-3 py-2 font-[family-name:var(--font-mono)] text-xs">
                {row.line}
              </td>
              <td className="px-3 py-2 text-center">
                {row.status === "ok" ? (
                  <span className="badge bg-[var(--success)]/10 text-[var(--success)]">
                    Valid{row.isUpdate ? " · update" : ""}
                  </span>
                ) : (
                  <span className="badge bg-red-100 text-red-700">Error</span>
                )}
              </td>
              {row.status === "error" ? (
                <td colSpan={6} className="px-3 py-2 text-xs text-red-700">
                  {row.info}
                </td>
              ) : (
                <>
                  <td className="px-3 py-2 font-medium">
                    {row.employee.name}
                  </td>
                  <td className="px-3 py-2">{row.payload.period}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.kind === "achievement"
                      ? `${row.result.schemeName} · ${row.result.segmentName}`
                      : `Delivery · ${row.result.vehicleType}`}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.kind === "achievement"
                      ? row.result.tierLabel || "—"
                      : `${row.payload.cartons.toLocaleString("id-ID")} karton · ${row.payload.invoices.toLocaleString("id-ID")} faktur`}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <ResultStatusBadge row={row} />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-[var(--success)]">
                    {formatRupiah(row.result.finalAmount)}
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
  const [selectedSchemeId, setSelectedSchemeId] = useState("");

  if (!ready || !data) return <LoadingState />;

  const schemeId = selectedSchemeId || data.schemes[0]?.id || "";
  const templateMeta = getImportTemplateMeta(data, schemeId);

  const downloadSchemeTemplate = () => {
    const built = buildSchemeImportTemplate(data, schemeId);
    if (!built) return;
    downloadCsv(built.filename, built.content);
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setFileName(file.name);
    setResult(null);
    setImported([]);

    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      setRows([]);
      setResult("File kosong atau format tidak dikenali.");
      return;
    }

    const isDelivery = "armada" in parsed[0];
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
        description="Upload hasil penjualan (pencapaian) atau data pengiriman dalam jumlah banyak via CSV — hasil insentif langsung terhitung di halaman Perhitungan."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h3 className="mb-1 font-bold">1 · Unduh Template</h3>
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            Pilih skema insentif — kolom CSV menyesuaikan parameter/bobot skema
            tersebut. Baris contoh memakai karyawan dengan role yang sama (jika
            ada di master).
          </p>

          <div className="mb-4">
            <label className="label">Skema Insentif</label>
            <Select2
              value={schemeId}
              onChange={setSelectedSchemeId}
              options={data.schemes.map((s) => ({
                value: s.id,
                label: `${s.name} (${s.type === "volumeTier" ? "Pengiriman" : "Pencapaian"})`,
              }))}
            />
          </div>

          {templateMeta && (
            <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50 p-3 text-xs">
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
                {templateMeta.employeeCount > 0
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
            ⇩ Unduh Template{" "}
            {templateMeta?.kind === "delivery" ? "Pengiriman" : "Pencapaian"}
          </button>

          <ul className="mt-4 space-y-1 text-xs text-[var(--text-muted)]">
            <li>• Identitas karyawan memakai <b>NIK</b> (lihat menu Karyawan)</li>
            <li>• Periode sesuai skema: <b>{templateMeta?.periodLabel ?? "YYYY-MM"}</b></li>
            <li>• Hanya kolom parameter dengan bobot &gt; 0 di skema terpilih</li>
            <li>• Skema &amp; segment ditentukan otomatis dari role dan cabang karyawan</li>
            <li>• Jika NIK + periode sudah ada, data akan <b>diperbarui</b> (bukan duplikat)</li>
            <li>• Mendukung pemisah koma maupun titik-koma (CSV dari Excel)</li>
          </ul>
        </section>

        <section className="card p-5">
          <h3 className="mb-1 font-bold">2 · Upload File CSV</h3>
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            Jenis template terdeteksi otomatis. Data divalidasi dulu — tidak
            langsung tersimpan.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] px-4 py-8 text-center hover:border-[var(--primary)] hover:bg-[var(--surface-muted)]">
            <span className="text-2xl">⇪</span>
            <span className="mt-2 text-sm font-medium">
              Klik untuk pilih file .csv
            </span>
            {fileName && (
              <span className="mt-1 text-xs text-[var(--text-muted)]">
                {fileName}
              </span>
            )}
            <input
              type="file"
              accept=".csv,text/csv"
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
                {rows[0].kind === "delivery" ? "Pengiriman" : "Pencapaian"}
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
