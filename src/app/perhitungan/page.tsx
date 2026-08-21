"use client";

import { useMemo } from "react";
import { LoadingState } from "@/components/LoadingState";
import { PageHeader } from "@/components/PageHeader";
import {
  calculateAllDelivery,
  calculateAllParameter,
  formatRupiah,
} from "@/lib/calculator";
import { useAppData } from "@/hooks/useAppData";

export default function PerhitunganPage() {
  const { data, ready } = useAppData();

  const { paramResults, deliveryResults, total } = useMemo(() => {
    if (!data)
      return { paramResults: [], deliveryResults: [], total: 0 };
    const paramResults = calculateAllParameter(data);
    const deliveryResults = calculateAllDelivery(data);
    const total =
      paramResults.reduce((s, r) => s + r.finalAmount, 0) +
      deliveryResults.reduce((s, r) => s + r.finalAmount, 0);
    return { paramResults, deliveryResults, total };
  }, [data]);

  if (!ready || !data) return <LoadingState />;

  return (
    <>
      <PageHeader
        title="Perhitungan Insentif"
        description="Hasil kalkulasi semua skema: parameter (GT/MT/Horeca/Manager) dan volume tier (Delivery)."
      />

      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-[var(--text-muted)]">Total Insentif</p>
          <p className="text-3xl font-bold text-[var(--primary-dark)]">
            {formatRupiah(total)}
          </p>
        </div>
        <div className="text-sm text-[var(--text-muted)]">
          {paramResults.length} pencapaian · {deliveryResults.length} pengiriman
        </div>
      </div>

      <h3 className="mb-3 font-bold">Skema Parameter</h3>
      {paramResults.length === 0 ? (
        <div className="card mb-6 p-6 text-center text-[var(--text-muted)]">
          Belum ada data pencapaian.
        </div>
      ) : (
        <div className="mb-8 space-y-4">
          {paramResults.map((r) => (
            <article
              key={`${r.recordId}-${r.employeeId}`}
              className="card p-5"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold">{r.employeeName}</h4>
                  <p className="text-sm text-[var(--text-muted)]">
                    {r.teamName ? `Tim ${r.teamName} · ` : ""}
                    {r.schemeName} · {r.segmentName} · {r.period} · Tier{" "}
                    {r.tierLabel}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[var(--success)]">
                    {formatRupiah(r.finalAmount)}
                  </p>
                  <div className="mt-1 flex flex-wrap justify-end gap-1">
                    {r.splitRatio < 1 && (
                      <span className="badge bg-[var(--surface-muted)]">
                        {r.position} {Math.round(r.splitRatio * 100)}%
                      </span>
                    )}
                    {r.penaltyPct > 0 && (
                      <span className="badge bg-amber-100 text-amber-700">
                        Penalty {r.penaltyPct}%
                      </span>
                    )}
                    {r.suspended && !r.voided && (
                      <span className="badge bg-orange-100 text-orange-700">
                        Ditangguhkan
                      </span>
                    )}
                    {r.voided && (
                      <span className="badge bg-red-100 text-red-700">Dihapus</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="badge bg-[var(--primary)]/10 text-[var(--primary)]">
                  Gross: {formatRupiah(r.grossAmount)}
                </span>
                {Object.entries(r.parameterBreakdown).map(([p, v]) => {
                  const param = data.parameters.find((x) => x.id === p);
                  return (
                    <span
                      key={p}
                      className="badge border border-[var(--border)] bg-white"
                    >
                      {param?.shortLabel ?? p}: {formatRupiah(v)}
                    </span>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}

      <h3 className="mb-3 font-bold">Delivery Team (Volume Tier)</h3>
      {deliveryResults.length === 0 ? (
        <div className="card p-6 text-center text-[var(--text-muted)]">
          Belum ada data pengiriman.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-3 py-3 text-left">Karyawan</th>
                <th className="px-3 py-3 text-left">Periode</th>
                <th className="px-3 py-3 text-left">Armada</th>
                <th className="px-3 py-3 text-right">Kartonase</th>
                <th className="px-3 py-3 text-right">Drop Point</th>
                <th className="px-3 py-3 text-right">Gross</th>
                <th className="px-3 py-3 text-center">Bagian</th>
                <th className="px-3 py-3 text-center">Quality</th>
                <th className="px-3 py-3 text-right">Final</th>
              </tr>
            </thead>
            <tbody>
              {deliveryResults.map((r) => (
                <tr
                  key={`${r.recordId}-${r.employeeId}`}
                  className="border-t border-[var(--border)]"
                >
                  <td className="px-3 py-2 font-medium">
                    {r.employeeName}
                    {r.teamName ? (
                      <span className="ml-1 text-xs text-[var(--text-muted)]">
                        · {r.teamName}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{r.period}</td>
                  <td className="px-3 py-2">{r.vehicleType}</td>
                  <td className="px-3 py-2 text-right">
                    {formatRupiah(r.cartonNominal)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatRupiah(r.dropPointNominal)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatRupiah(r.grossAmount)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.position} {Math.round(r.splitRatio * 100)}%
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.qualityPassed ? (
                      <span className="badge bg-[var(--success)]/10 text-[var(--success)]">OK</span>
                    ) : (
                      <span className="badge bg-red-100 text-red-700">Gagal</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-[var(--success)]">
                    {formatRupiah(r.finalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="card mt-6 p-5">
        <h3 className="mb-3 font-bold">Aturan Perhitungan (dari dokumen)</h3>
        <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
          <li>• Setiap parameter berdiri sendiri — insentif = Σ nominal parameter pada tier pencapaiannya</li>
          <li>• Breakdown nominal per parameter = bobot × total nominal tier</li>
          <li>• Penalty overdue & bad debt mengikuti konfigurasi per skema (10% GT, 20% ASM/RSM/NSM)</li>
          <li>• Pembagian tim sesuai konfigurasi skema (mis. Canvasser 3 org: 55/22.5/22.5)</li>
          <li>• Role.subjectPolicy + Manpower: Individu (NIK) atau Tim (Master Tim); Delivery juga bisa 1 record per tim → split</li>
          <li>• Delivery: tier kartonase + drop point per armada; quality gate OTD ≥ 95%, akurasi ≥ 97%</li>
        </ul>
      </section>
    </>
  );
}
