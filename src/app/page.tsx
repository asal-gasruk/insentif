"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LoadingState } from "@/components/LoadingState";
import { PageHeader } from "@/components/PageHeader";
import {
  calculateAllDelivery,
  calculateAllParameter,
  formatRupiah,
} from "@/lib/calculator";
import { useAppData } from "@/hooks/useAppData";
import type { DeliveryResult, IncentiveResult } from "@/types";

const CHART_COLORS = [
  "#fac300",
  "#16a34a",
  "#78716c",
  "#e0ad00",
  "#1c1917",
  "#a8a29e",
  "#ca8a04",
  "#15803d",
];

function shortTeamLabel(name: string, max = 22): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function buildDashboardCharts(
  paramResults: IncentiveResult[],
  deliveryResults: DeliveryResult[],
) {
  const byPeriod = new Map<string, number>();
  const byScheme = new Map<string, number>();
  const byTeam = new Map<string, number>();

  let paramTotal = 0;
  let deliveryTotal = 0;

  for (const r of paramResults) {
    paramTotal += r.finalAmount;
    byPeriod.set(r.period, (byPeriod.get(r.period) ?? 0) + r.finalAmount);
    byScheme.set(r.schemeName, (byScheme.get(r.schemeName) ?? 0) + r.finalAmount);
    if (r.teamName) {
      byTeam.set(r.teamName, (byTeam.get(r.teamName) ?? 0) + r.finalAmount);
    } else {
      const key = `Individu · ${r.employeeName}`;
      byTeam.set(key, (byTeam.get(key) ?? 0) + r.finalAmount);
    }
  }

  for (const r of deliveryResults) {
    deliveryTotal += r.finalAmount;
    byPeriod.set(r.period, (byPeriod.get(r.period) ?? 0) + r.finalAmount);
    byScheme.set("Delivery", (byScheme.get("Delivery") ?? 0) + r.finalAmount);
    if (r.teamName) {
      byTeam.set(r.teamName, (byTeam.get(r.teamName) ?? 0) + r.finalAmount);
    } else {
      const key = `Individu · ${r.employeeName}`;
      byTeam.set(key, (byTeam.get(key) ?? 0) + r.finalAmount);
    }
  }

  const periodChart = [...byPeriod.entries()]
    .map(([period, total]) => ({ period, total }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const schemeChart = [...byScheme.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  const teamChart = [...byTeam.entries()]
    .map(([name, total]) => ({
      name: shortTeamLabel(name),
      fullName: name,
      total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const mixChart = [
    { name: "Parameter", value: paramTotal },
    { name: "Delivery", value: deliveryTotal },
  ].filter((d) => d.value > 0);

  return { periodChart, schemeChart, teamChart, mixChart, paramTotal, deliveryTotal };
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; payload?: { fullName?: string } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const title = payload[0]?.payload?.fullName ?? label;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-md">
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-[var(--text-muted)]">
          {p.name ? `${p.name}: ` : ""}
          {formatRupiah(Number(p.value ?? 0))}
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { data, ready } = useAppData();

  const stats = useMemo(() => {
    if (!data) return null;
    const paramResults = calculateAllParameter(data);
    const deliveryResults = calculateAllDelivery(data);
    const totalIncentive =
      paramResults.reduce((s, r) => s + r.finalAmount, 0) +
      deliveryResults.reduce((s, r) => s + r.finalAmount, 0);
    const charts = buildDashboardCharts(paramResults, deliveryResults);
    const teamCount = data.teams.filter((t) => t.active).length;
    return {
      schemes: data.schemes.length,
      employees: data.employees.filter((e) => e.active).length,
      teams: teamCount,
      records: data.achievementRecords.length + data.deliveryRecords.length,
      totalIncentive,
      paramResults,
      deliveryResults,
      charts,
    };
  }, [data]);

  if (!ready || !data || !stats) return <LoadingState />;

  const hasResults =
    stats.paramResults.length > 0 || stats.deliveryResults.length > 0;
  const { periodChart, schemeChart, teamChart, mixChart } = stats.charts;

  return (
    <>
      <PageHeader
        title="Dashboard Insentif Reguler"
        description="Ringkasan master data dan visualisasi hasil perhitungan insentif. Data tersimpan di localStorage."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Skema", value: stats.schemes, href: "/skema" },
          { label: "Karyawan Aktif", value: stats.employees, href: "/karyawan" },
          { label: "Master Tim", value: stats.teams, href: "/tim" },
          { label: "Data Transaksi", value: stats.records, href: "/pencapaian" },
          {
            label: "Total Insentif",
            value: formatRupiah(stats.totalIncentive),
            href: "/perhitungan",
          },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="card p-5 transition hover:shadow-md"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {item.label}
            </p>
            <p className="mt-2 text-xl font-bold text-[var(--primary-dark)] sm:text-2xl">
              {item.value}
            </p>
          </Link>
        ))}
      </div>

      {!hasResults ? (
        <section className="card mb-6 p-8 text-center">
          <p className="font-semibold">Belum ada hasil perhitungan</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Import atau input data di{" "}
            <Link href="/import" className="text-[var(--primary-dark)] underline">
              Import
            </Link>{" "}
            /{" "}
            <Link
              href="/pencapaian"
              className="text-[var(--primary-dark)] underline"
            >
              Pencapaian
            </Link>
            , lalu buka{" "}
            <Link
              href="/perhitungan"
              className="text-[var(--primary-dark)] underline"
            >
              Perhitungan
            </Link>
            .
          </p>
        </section>
      ) : (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <section className="card p-5">
            <h3 className="mb-1 font-bold">Insentif per Periode</h3>
            <p className="mb-4 text-xs text-[var(--text-muted)]">
              Total final (parameter + delivery) per periode
            </p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) =>
                      v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}jt`
                        : v >= 1000
                          ? `${Math.round(v / 1000)}rb`
                          : String(v)
                    }
                    width={48}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="total" name="Insentif" fill="#fac300" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card p-5">
            <h3 className="mb-1 font-bold">Komposisi Parameter vs Delivery</h3>
            <p className="mb-4 text-xs text-[var(--text-muted)]">
              Proporsi total insentif final
            </p>
            <div className="h-64 w-full">
              {mixChart.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">Tidak ada data</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mixChart}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {mixChart.map((_, i) => (
                        <Cell
                          key={mixChart[i].name}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section className="card p-5 lg:col-span-2">
            <h3 className="mb-1 font-bold">Top Tim / Individu</h3>
            <p className="mb-4 text-xs text-[var(--text-muted)]">
              8 terbesar berdasarkan total insentif final
            </p>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={teamChart}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) =>
                      v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}jt`
                        : `${Math.round(v / 1000)}rb`
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="total" name="Insentif" radius={[0, 6, 6, 0]}>
                    {teamChart.map((_, i) => (
                      <Cell
                        key={teamChart[i].fullName}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card p-5 lg:col-span-2">
            <h3 className="mb-1 font-bold">Insentif per Skema</h3>
            <p className="mb-4 text-xs text-[var(--text-muted)]">
              Agregasi final amount per nama skema
            </p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={schemeChart}
                  margin={{ top: 8, right: 8, left: 0, bottom: 48 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) =>
                      v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}jt`
                        : `${Math.round(v / 1000)}rb`
                    }
                    width={48}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="total" name="Insentif" radius={[6, 6, 0, 0]}>
                    {schemeChart.map((_, i) => (
                      <Cell
                        key={schemeChart[i].name}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold">Skema Terkonfigurasi</h3>
            <Link href="/skema" className="text-xs font-semibold text-[var(--primary-dark)]">
              Kelola →
            </Link>
          </div>
          <ul className="space-y-2">
            {data.schemes.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-sm"
              >
                <span>{s.name}</span>
                <span className="flex gap-1">
                  <span className="badge bg-[var(--primary)]/10 text-[var(--primary-dark)]">
                    {s.type === "parameter" ? "Parameter" : "Volume"}
                  </span>
                  <span className="badge bg-white">
                    {s.period === "monthly" ? "Bulanan" : "Kuartal"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold">Hasil Terbaru</h3>
            <Link
              href="/perhitungan"
              className="text-xs font-semibold text-[var(--primary-dark)]"
            >
              Detail →
            </Link>
          </div>
          {!hasResults ? (
            <p className="text-sm text-[var(--text-muted)]">
              Belum ada data perhitungan.
            </p>
          ) : (
            <div className="space-y-2">
              {stats.paramResults.slice(0, 5).map((r) => (
                <div
                  key={`${r.recordId}-${r.employeeId}-${r.position}`}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{r.employeeName}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {r.teamName ? `Tim ${r.teamName} · ` : ""}
                      {r.schemeName} · {r.period}
                    </p>
                  </div>
                  <span className="font-semibold text-[var(--success)]">
                    {formatRupiah(r.finalAmount)}
                  </span>
                </div>
              ))}
              {stats.deliveryResults.slice(0, 3).map((r) => (
                <div
                  key={`${r.recordId}-${r.employeeId}-${r.position}`}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{r.employeeName}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {r.teamName ? `Tim ${r.teamName} · ` : ""}
                      Delivery {r.vehicleType} · {r.period}
                    </p>
                  </div>
                  <span className="font-semibold text-[var(--success)]">
                    {formatRupiah(r.finalAmount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card mt-6 p-5">
        <h3 className="mb-2 font-bold">Master Parameter Insentif</h3>
        <p className="mb-4 text-sm text-[var(--text-muted)]">
          {data.parameters.length} parameter dari lampiran dokumen.
        </p>
        <div className="flex flex-wrap gap-2">
          {data.parameters.map((p) => (
            <span
              key={p.id}
              className="badge border border-[var(--border)] bg-white"
              title={p.name}
            >
              {p.shortLabel ?? p.id}
            </span>
          ))}
        </div>
      </section>
    </>
  );
}
