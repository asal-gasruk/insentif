"use client";

import { formatRupiah } from "@/lib/calculator";
import { formatTarget } from "@/lib/format-target";
import { evaluatePenalties } from "@/lib/penalty-engine";
import type { AppData, DeliveryResult, IncentiveResult } from "@/types";

const mono = "font-[family-name:var(--font-mono)]";

function Block({
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

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <details className="group border-t border-[var(--border)]">
      <summary className="cursor-pointer select-none px-5 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)]">
        <span className="group-open:hidden">▸ Rincian perhitungan</span>
        <span className="hidden group-open:inline">▾ Rincian perhitungan</span>
      </summary>
      <div className="space-y-4 bg-[var(--surface-muted)]/40 px-5 pb-4 pt-2">
        {children}
      </div>
    </details>
  );
}

/** Rincian hasil skema parameter: input, per parameter, penalti, pembagian anggota. */
export function ParameterDetail({
  data,
  head,
  members,
}: {
  data: AppData;
  head: IncentiveResult;
  members: IncentiveResult[];
}) {
  const record = data.achievementRecords.find((r) => r.id === head.recordId);
  if (!record) return null;
  const scheme = data.schemes.find((s) => s.id === record.schemeId);
  const weights = data.schemeWeights.find(
    (w) => w.schemeId === record.schemeId && w.segmentId === record.segmentId,
  )?.weights;

  const paramIds = [
    ...new Set([
      ...Object.keys(record.achievements),
      ...Object.keys(head.parameterBreakdown),
    ]),
  ];
  const tierOf = (pct: number) =>
    data.achievementTiers.find((t) =>
      t.maxPct === null ? pct >= t.minPct : pct >= t.minPct && pct < t.maxPct,
    )?.label ?? "—";

  const rules = (scheme?.penalties ?? []).filter((r) => r.enabled);

  return (
    <Wrapper>
      <Block title="Input pencapaian">
        <p className="text-xs">
          Periode <b>{record.period}</b> · Overdue{" "}
          <b>{record.overduePct.toFixed(1)}%</b> · Bad debt{" "}
          <b>{record.badDebtDays} hari</b>
          {record.notes && (
            <span className="text-[var(--text-muted)]"> · {record.notes}</span>
          )}
        </p>
      </Block>

      <Block title="Per parameter">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--text-muted)]">
                <th className="py-1 text-left font-medium">Parameter</th>
                <th className="py-1 text-right font-medium">Bobot</th>
                <th className="py-1 text-right font-medium">Target</th>
                <th className="py-1 text-right font-medium">Actual</th>
                <th className="py-1 text-right font-medium">Pencapaian</th>
                <th className="py-1 text-left pl-3 font-medium">Tier</th>
                <th className="py-1 text-right font-medium">Insentif</th>
              </tr>
            </thead>
            <tbody>
              {paramIds.map((paramId) => {
                const param = data.parameters.find((p) => p.id === paramId);
                const pct = record.achievements[paramId];
                const target = data.parameterTargets.find(
                  (t) =>
                    t.paramId === paramId &&
                    t.period === record.period &&
                    (record.teamId
                      ? t.teamId === record.teamId
                      : t.employeeId === record.employeeId),
                );
                const weight = weights?.[paramId];
                return (
                  <tr
                    key={paramId}
                    className="border-t border-[var(--border)]/60"
                  >
                    <td className="py-1">{param?.shortLabel ?? paramId}</td>
                    <td className={`py-1 text-right ${mono}`}>
                      {weight === null || weight === undefined
                        ? "—"
                        : `${+(weight * 100).toFixed(1)}%`}
                    </td>
                    <td className={`py-1 text-right ${mono}`}>
                      {target
                        ? formatTarget(target.target, param?.unit ?? "")
                        : "—"}
                    </td>
                    <td className={`py-1 text-right ${mono}`}>
                      {target && pct !== undefined
                        ? formatTarget(
                            (pct / 100) * target.target,
                            param?.unit ?? "",
                          )
                        : "—"}
                    </td>
                    <td className={`py-1 text-right ${mono}`}>
                      {pct === undefined ? "—" : `${pct.toFixed(1)}%`}
                    </td>
                    <td className="py-1 pl-3">
                      {pct === undefined ? "—" : tierOf(pct)}
                    </td>
                    <td className={`py-1 text-right font-semibold ${mono}`}>
                      {formatRupiah(head.parameterBreakdown[paramId] ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
          Tier agregat skema: <b>{head.tierLabel}</b> · Gross{" "}
          <b>{formatRupiah(head.grossAmount)}</b>
        </p>
      </Block>

      {rules.length > 0 && (
        <Block title="Aturan penalti">
          <ul className="space-y-0.5 text-xs">
            {rules.map((rule) => {
              const hit =
                evaluatePenalties([rule], record).matchedRules.length > 0;
              const value =
                rule.condition.field === "overduePct"
                  ? `${record.overduePct.toFixed(1)}%`
                  : `${record.badDebtDays} hari`;
              return (
                <li key={rule.id} className="flex flex-wrap items-center gap-2">
                  <span
                    className={`badge ${hit ? "bg-amber-100 text-amber-800" : "bg-[var(--surface-muted)]"}`}
                  >
                    {hit ? "kena" : "aman"}
                  </span>
                  <span>
                    {rule.label}:{" "}
                    {rule.condition.field === "overduePct"
                      ? "overdue"
                      : "bad debt"}{" "}
                    {rule.condition.operator === "gt" ? ">" : "≥"}{" "}
                    {rule.condition.value}
                    {rule.condition.field === "overduePct" ? "%" : " hari"}
                  </span>
                  <span className="text-[var(--text-muted)]">
                    (nilai {value})
                  </span>
                </li>
              );
            })}
          </ul>
        </Block>
      )}

      <Block title="Pembagian ke anggota">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--text-muted)]">
                <th className="py-1 text-left font-medium">Anggota</th>
                <th className="py-1 text-center font-medium">Posisi</th>
                <th className="py-1 text-right font-medium">Bagian</th>
                <th className="py-1 text-right font-medium">Gross × bagian</th>
                <th className="py-1 text-right font-medium">Potongan</th>
                <th className="py-1 text-right font-medium">Final</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => {
                const share = m.grossAmount * m.splitRatio;
                return (
                  <tr
                    key={`${m.employeeId}-${i}`}
                    className="border-t border-[var(--border)]/60"
                  >
                    <td className="py-1">{m.employeeName}</td>
                    <td className="py-1 text-center text-[var(--text-muted)]">
                      {m.position}
                    </td>
                    <td className={`py-1 text-right ${mono}`}>
                      {(m.splitRatio * 100).toFixed(1)}%
                    </td>
                    <td className={`py-1 text-right ${mono}`}>
                      {formatRupiah(share)}
                    </td>
                    <td className={`py-1 text-right ${mono}`}>
                      {m.suspended || m.voided
                        ? "100%"
                        : m.penaltyPct > 0
                          ? `${m.penaltyPct}% (${formatRupiah(share * (m.penaltyPct / 100))})`
                          : "—"}
                    </td>
                    <td className={`py-1 text-right font-semibold ${mono}`}>
                      {formatRupiah(m.finalAmount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Block>
    </Wrapper>
  );
}

/** Rincian hasil Delivery: input record + nominal + pembagian anggota. */
export function DeliveryDetail({
  data,
  head,
  members,
}: {
  data: AppData;
  head: DeliveryResult;
  members: DeliveryResult[];
}) {
  const record = data.deliveryRecords.find((r) => r.id === head.recordId);
  if (!record) return null;

  return (
    <Wrapper>
      <Block title="Input pengiriman">
        <p className="text-xs">
          Periode <b>{record.period}</b> · Armada <b>{record.vehicleType}</b> ·
          Kartonase <b>{record.cartons.toLocaleString("id-ID")}</b> · Faktur /
          drop point <b>{record.invoices.toLocaleString("id-ID")}</b> · OTD{" "}
          <b>{record.otdPct}%</b> · Akurasi <b>{record.accuracyPct}%</b>
          {record.notes && (
            <span className="text-[var(--text-muted)]"> · {record.notes}</span>
          )}
        </p>
      </Block>
      <Block title="Nominal">
        <p className="text-xs">
          Kartonase <b>{formatRupiah(head.cartonNominal)}</b> + Drop point{" "}
          <b>{formatRupiah(head.dropPointNominal)}</b> = Gross{" "}
          <b>{formatRupiah(head.grossAmount)}</b> ·{" "}
          {head.qualityPassed ? "Quality lolos" : "Quality gagal (insentif 0)"}
        </p>
      </Block>
      <Block title="Pembagian ke anggota">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[var(--text-muted)]">
              <th className="py-1 text-left font-medium">Anggota</th>
              <th className="py-1 text-center font-medium">Posisi</th>
              <th className="py-1 text-right font-medium">Bagian</th>
              <th className="py-1 text-right font-medium">Gross × bagian</th>
              <th className="py-1 text-right font-medium">Final</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr
                key={`${m.employeeId}-${i}`}
                className="border-t border-[var(--border)]/60"
              >
                <td className="py-1">{m.employeeName}</td>
                <td className="py-1 text-center text-[var(--text-muted)]">
                  {m.position}
                </td>
                <td className={`py-1 text-right ${mono}`}>
                  {(m.splitRatio * 100).toFixed(1)}%
                </td>
                <td className={`py-1 text-right ${mono}`}>
                  {formatRupiah(m.grossAmount * m.splitRatio)}
                </td>
                <td className={`py-1 text-right font-semibold ${mono}`}>
                  {formatRupiah(m.finalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>
    </Wrapper>
  );
}
