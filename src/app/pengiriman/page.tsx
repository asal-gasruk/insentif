"use client";

import { FormEvent, useState } from "react";
import { LoadingState } from "@/components/LoadingState";
import { Modal } from "@/components/Modal";
import { NotesPanel } from "@/components/NotesPanel";
import { PageHeader } from "@/components/PageHeader";
import { Select2 } from "@/components/Select2";
import { calculateDeliveryIncentive, formatRupiah } from "@/lib/calculator";
import { useAppData } from "@/hooks/useAppData";
import type { DeliveryRecord } from "@/types";

export default function PengirimanPage() {
  const { data, ready, update, remove } = useAppData();
  const [editing, setEditing] = useState<DeliveryRecord | null>(null);
  const [form, setForm] = useState<DeliveryRecord | null>(null);

  if (!ready || !data) return <LoadingState />;

  const deliveryScheme = data.schemes.find((s) => s.type === "volumeTier");
  const deliveryEmployees = data.employees.filter(
    (e) => e.roleId === "delivery",
  );

  const openEdit = (row: DeliveryRecord) => {
    setEditing(row);
    setForm({ ...row });
  };

  const close = () => {
    setEditing(null);
    setForm(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form || !editing) return;
    update("deliveryRecords", form);
    close();
  };

  return (
    <>
      <PageHeader
        title="Pengiriman (Delivery Team)"
        description="Data pengiriman dari import bulk. Insentif dihitung dari tier volume per jenis armada — Lampiran 14."
      />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-3 py-3 text-left">Karyawan</th>
              <th className="px-3 py-3 text-left">Periode</th>
              <th className="px-3 py-3 text-left">Armada</th>
              <th className="px-3 py-3 text-right">Karton</th>
              <th className="px-3 py-3 text-right">Faktur</th>
              <th className="px-3 py-3 text-center">Quality</th>
              <th className="px-3 py-3 text-right">Insentif</th>
              <th className="px-3 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.deliveryRecords.map((row) => {
              const emp = data.employees.find((e) => e.id === row.employeeId);
              const result = emp
                ? calculateDeliveryIncentive(data, row, emp)
                : null;
              return (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-medium">{emp?.name}</td>
                  <td className="px-3 py-2">{row.period}</td>
                  <td className="px-3 py-2">{row.vehicleType}</td>
                  <td className="px-3 py-2 text-right">
                    {new Intl.NumberFormat("id-ID").format(row.cartons)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {new Intl.NumberFormat("id-ID").format(row.invoices)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {result?.qualityPassed ? (
                      <span className="badge bg-[var(--success)]/10 text-[var(--success)]">Lolos</span>
                    ) : (
                      <span className="badge bg-red-100 text-red-700">Gagal</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-[var(--success)]">
                    {result ? formatRupiah(result.finalAmount) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="btn-secondary mr-1 px-2 py-1 text-xs"
                      onClick={() => openEdit(row)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger px-2 py-1 text-xs"
                      onClick={() => {
                        if (confirm("Hapus data pengiriman?"))
                          remove("deliveryRecords", row.id);
                      }}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              );
            })}
            {data.deliveryRecords.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  Belum ada data pengiriman. Tambahkan via menu Import.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {deliveryScheme?.notes && (
        <NotesPanel
          text={deliveryScheme.notes}
          title="Catatan Skema Delivery"
          className="mt-6"
        />
      )}

      <section className="card mt-6 p-5">
        <h3 className="mb-3 font-bold">Tier Volume (Lampiran 14)</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {["cartonnage", "dropPoint"].map((component) => (
            <div key={component}>
              <p className="mb-2 text-sm font-semibold">
                {component === "cartonnage"
                  ? "Kartonase (karton/bulan)"
                  : "Drop Point (faktur/bulan)"}
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-[var(--text-muted)]">
                    <th className="py-1 pr-2">Armada</th>
                    <th className="py-1 pr-2">Range</th>
                    <th className="py-1 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.volumeTiers
                    .filter(
                      (t) =>
                        t.component === component &&
                        (component === "cartonnage" || t.vehicleType === "PICKUP"),
                    )
                    .map((t) => (
                      <tr key={t.id} className="border-b border-[var(--border)]/50">
                        <td className="py-1 pr-2">
                          {component === "dropPoint" ? "Semua" : t.vehicleType}
                        </td>
                        <td className="py-1 pr-2">
                          {new Intl.NumberFormat("id-ID").format(t.minQty)}
                          {t.maxQty
                            ? ` – ${new Intl.NumberFormat("id-ID").format(t.maxQty)}`
                            : " ke atas"}
                        </td>
                        <td className="py-1 text-right">{formatRupiah(t.nominal)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        {deliveryScheme && (
          <p className="mt-4 text-xs text-[var(--text-muted)]">
            Pembagian tim:{" "}
            {deliveryScheme.teamSplits
              .map(
                (s) =>
                  `${s.key}: ${Object.entries(s.split)
                    .map(([p, r]) => `${p} ${Math.round(r * 100)}%`)
                    .join(" / ")}`,
              )
              .join(" · ")}
          </p>
        )}
      </section>

      <Modal
        open={form !== null}
        title="Edit Pengiriman"
        onClose={close}
      >
        {form && (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Karyawan</label>
                <Select2
                  value={form.employeeId}
                  onChange={(v) => {
                    const emp = data.employees.find((x) => x.id === v);
                    setForm({
                      ...form,
                      employeeId: v,
                      vehicleType: emp?.vehicleType ?? form.vehicleType,
                    });
                  }}
                  options={deliveryEmployees.map((e) => ({
                    value: e.id,
                    label: `${e.name} (${e.nik})`,
                  }))}
                />
              </div>
              <div>
                <label className="label">Periode (YYYY-MM)</label>
                <input
                  className="input"
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Jenis Armada</label>
                <Select2
                  value={form.vehicleType}
                  onChange={(v) => setForm({ ...form, vehicleType: v })}
                  options={
                    deliveryScheme?.segments.map((s) => ({
                      value: s.id,
                      label: s.name,
                    })) ?? []
                  }
                />
              </div>
              <div />
              <div>
                <label className="label">Jumlah Karton Terkirim</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={form.cartons}
                  onChange={(e) =>
                    setForm({ ...form, cartons: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="label">Jumlah Faktur (Drop Point)</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={form.invoices}
                  onChange={(e) =>
                    setForm({ ...form, invoices: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="label">On Time Delivery (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="input"
                  value={form.otdPct}
                  onChange={(e) =>
                    setForm({ ...form, otdPct: Number(e.target.value) })
                  }
                />
                <p className="mt-1 text-xs text-[var(--text-muted)]">Gate: ≥ 95%</p>
              </div>
              <div>
                <label className="label">Akurasi Produk (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="input"
                  value={form.accuracyPct}
                  onChange={(e) =>
                    setForm({ ...form, accuracyPct: Number(e.target.value) })
                  }
                />
                <p className="mt-1 text-xs text-[var(--text-muted)]">Gate: ≥ 97%</p>
              </div>
            </div>

            <div>
              <label className="label">Catatan</label>
              <input
                className="input"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={close}>
                Batal
              </button>
              <button type="submit" className="btn-primary">
                Simpan
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
