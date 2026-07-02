"use client";

import Link from "next/link";
import { useMemo } from "react";
import { LoadingState } from "@/components/LoadingState";
import { PageHeader } from "@/components/PageHeader";
import {
  calculateAllDelivery,
  calculateAllParameter,
  formatRupiah,
} from "@/lib/calculator";
import { useAppData } from "@/hooks/useAppData";

export default function DashboardPage() {
  const { data, ready } = useAppData();

  const stats = useMemo(() => {
    if (!data) return null;
    const paramResults = calculateAllParameter(data);
    const deliveryResults = calculateAllDelivery(data);
    const totalIncentive =
      paramResults.reduce((s, r) => s + r.finalAmount, 0) +
      deliveryResults.reduce((s, r) => s + r.finalAmount, 0);
    return {
      schemes: data.schemes.length,
      employees: data.employees.filter((e) => e.active).length,
      records: data.achievementRecords.length + data.deliveryRecords.length,
      totalIncentive,
      paramResults,
      deliveryResults,
    };
  }, [data]);

  if (!ready || !data || !stats) return <LoadingState />;

  return (
    <>
      <PageHeader
        title="Dashboard Insentif Reguler"
        description="Konfigurasi insentif dinamis berbasis Parameter Insentif — Plan 2026. Data tersimpan di localStorage."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Skema Insentif", value: stats.schemes, href: "/skema" },
          { label: "Karyawan Aktif", value: stats.employees, href: "/karyawan" },
          { label: "Data Periode Ini", value: stats.records, href: "/pencapaian" },
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
            <p className="mt-2 text-2xl font-bold text-[var(--primary-dark)]">
              {item.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h3 className="mb-4 font-bold">Skema Terkonfigurasi</h3>
          <ul className="space-y-2">
            {data.schemes.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-sm"
              >
                <span>{s.name}</span>
                <span className="flex gap-1">
                  <span className="badge bg-[var(--primary)]/10 text-[var(--primary)]">
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
          <h3 className="mb-4 font-bold">Hasil Perhitungan Terbaru</h3>
          {stats.paramResults.length === 0 &&
          stats.deliveryResults.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Belum ada data. Input via menu Pencapaian / Pengiriman.
            </p>
          ) : (
            <div className="space-y-2">
              {stats.paramResults.slice(0, 5).map((r) => (
                <div
                  key={r.recordId}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{r.employeeName}</p>
                    <p className="text-xs text-[var(--text-muted)]">
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
                  key={r.recordId}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{r.employeeName}</p>
                    <p className="text-xs text-[var(--text-muted)]">
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
          {data.parameters.length} parameter dari seluruh lampiran dokumen.
          Setiap parameter berdiri sendiri sesuai ketentuan skema.
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
