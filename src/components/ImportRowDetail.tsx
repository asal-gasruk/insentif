"use client";

import { formatRupiah } from "@/lib/calculator";
import { formatTarget } from "@/lib/format-target";
import type {
  AchievementRecord,
  AppData,
  DeliveryRecord,
  DeliveryResult,
  IncentiveResult,
} from "@/types";

export type ImportRowDetailInput =
  | {
      kind: "achievement";
      raw: Record<string, string>;
      payload?: AchievementRecord;
      result?: IncentiveResult;
    }
  | {
      kind: "delivery";
      raw: Record<string, string>;
      payload?: DeliveryRecord;
      result?: DeliveryResult;
    };

const RAW_LABELS: Record<string, string> = {
  teamId: "Team ID",
  nik: "NIK",
  periode: "Periode",
  overduePct: "Overdue",
  badDebtDays: "Bad debt (hari)",
  catatan: "Catatan",
  vehicleType: "Armada",
  cartons: "Kartonase",
  invoices: "Faktur / drop point",
  otdPct: "OTD %",
  accuracyPct: "Akurasi %",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {title}
      </p>
      {children}
    </div>
  );
}

/** Detail satu baris import: data mentah Excel + konversi ke % + insentif per parameter. */
export function ImportRowDetail({
  data,
  input,
}: {
  data: AppData;
  input: ImportRowDetailInput;
}) {
  const { raw } = input;
  const rawEntries = Object.entries(raw).filter(
    ([, v]) => v !== undefined && String(v).trim() !== "",
  );
  const paramLabel = (id: string) => {
    const p = data.parameters.find((x) => x.id === id);
    return p?.shortLabel ?? p?.name ?? id;
  };
  const rawLabel = (key: string) => RAW_LABELS[key] ?? paramLabel(key);

  const achievement =
    input.kind === "achievement" && input.payload && input.result
      ? { payload: input.payload, result: input.result }
      : null;

  return (
    <div className="grid gap-4 bg-[var(--surface-muted)]/40 px-4 py-3 lg:grid-cols-2">
      <Section title="Data dari file Excel">
        <table className="w-full text-xs">
          <tbody>
            {rawEntries.map(([key, value]) => (
              <tr key={key} className="border-b border-[var(--border)]/60">
                <td className="py-1 pr-3 text-[var(--text-muted)]">
                  {rawLabel(key)}
                  {rawLabel(key) !== key && (
                    <span className="ml-1 font-[family-name:var(--font-mono)] text-[10px] opacity-60">
                      {key}
                    </span>
                  )}
                </td>
                <td className="py-1 text-right font-[family-name:var(--font-mono)]">
                  {String(value)}
                </td>
              </tr>
            ))}
            {rawEntries.length === 0 && (
              <tr>
                <td className="py-1 text-[var(--text-muted)]">Baris kosong.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      {achievement && (
        <Section title="Konversi & insentif per parameter">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--text-muted)]">
                <th className="py-1 text-left font-medium">Parameter</th>
                <th className="py-1 text-right font-medium">Excel</th>
                <th className="py-1 text-right font-medium">Target</th>
                <th className="py-1 text-right font-medium">Pencapaian</th>
                <th className="py-1 text-right font-medium">Insentif</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(achievement.payload.achievements).map(
                ([paramId, pct]) => {
                  const target = data.parameterTargets.find(
                    (t) =>
                      t.paramId === paramId &&
                      t.period === achievement.payload.period &&
                      (achievement.payload.teamId
                        ? t.teamId === achievement.payload.teamId
                        : t.employeeId === achievement.payload.employeeId),
                  );
                  const unit =
                    data.parameters.find((p) => p.id === paramId)?.unit ?? "";
                  return (
                    <tr
                      key={paramId}
                      className="border-t border-[var(--border)]/60"
                    >
                      <td className="py-1">{paramLabel(paramId)}</td>
                      <td className="py-1 text-right font-[family-name:var(--font-mono)]">
                        {raw[paramId] ?? "—"}
                      </td>
                      <td className="py-1 text-right font-[family-name:var(--font-mono)]">
                        {target ? formatTarget(target.target, unit) : "—"}
                      </td>
                      <td className="py-1 text-right font-[family-name:var(--font-mono)]">
                        {pct.toFixed(1)}%
                      </td>
                      <td className="py-1 text-right font-[family-name:var(--font-mono)]">
                        {formatRupiah(
                          achievement.result.parameterBreakdown[paramId] ?? 0,
                        )}
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Overdue {achievement.payload.overduePct.toFixed(1)}% · Bad debt{" "}
            {achievement.payload.badDebtDays} hari · Gross{" "}
            {formatRupiah(achievement.result.grossAmount)} · Potongan{" "}
            {achievement.result.penaltyPct}%
            {achievement.result.suspended && " · ditangguhkan"}
            {achievement.result.voided && " · hangus"}
          </p>
        </Section>
      )}

      {input.kind === "delivery" && input.payload && input.result && (
        <Section title="Hasil pengiriman">
          <table className="w-full text-xs">
            <tbody>
              {(
                [
                  ["Armada", input.payload.vehicleType],
                  ["Kartonase", input.payload.cartons.toLocaleString("id-ID")],
                  ["Faktur", input.payload.invoices.toLocaleString("id-ID")],
                  ["OTD", `${input.payload.otdPct}%`],
                  ["Akurasi", `${input.payload.accuracyPct}%`],
                  [
                    "Nominal kartonase",
                    formatRupiah(input.result.cartonNominal),
                  ],
                  [
                    "Nominal drop point",
                    formatRupiah(input.result.dropPointNominal),
                  ],
                  [
                    "Lolos kualitas",
                    input.result.qualityPassed ? "Ya" : "Tidak",
                  ],
                ] as [string, string][]
              ).map(([label, value]) => (
                <tr key={label} className="border-b border-[var(--border)]/60">
                  <td className="py-1 text-[var(--text-muted)]">{label}</td>
                  <td className="py-1 text-right font-[family-name:var(--font-mono)]">
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}
