"use client";

import { FormEvent, useState } from "react";
import { LoadingState } from "@/components/LoadingState";
import { Modal } from "@/components/Modal";
import { NotesPanel } from "@/components/NotesPanel";
import { PageHeader } from "@/components/PageHeader";
import { Select2 } from "@/components/Select2";
import {
  calculateDeliveryIncentive,
  calculateTeamDeliveryIncentive,
  formatRupiah,
} from "@/lib/calculator";
import { generateId } from "@/lib/storage";
import { resolveSubjectMode } from "@/lib/team-utils";
import { useAppData } from "@/hooks/useAppData";
import type { DeliveryRecord } from "@/types";

type SubjectMode = "team" | "employee";

export default function PengirimanPage() {
  const { data, ready, create, update, remove } = useAppData();
  const [editing, setEditing] = useState<DeliveryRecord | null>(null);
  const [form, setForm] = useState<DeliveryRecord | null>(null);
  const [mode, setMode] = useState<SubjectMode>("team");
  const [creating, setCreating] = useState(false);

  if (!ready || !data) return <LoadingState />;

  const deliveryScheme = data.schemes.find((s) => s.type === "volumeTier");
  const deliveryTeams = data.teams.filter(
    (t) => t.active && t.roleId === "delivery",
  );
  const deliveryEmployees = data.employees.filter(
    (e) =>
      e.roleId === "delivery" &&
      e.active &&
      resolveSubjectMode(data, e) === "individu",
  );

  const openCreate = (nextMode: SubjectMode) => {
    setCreating(true);
    setEditing(null);
    setMode(nextMode);
    if (nextMode === "team") {
      const team = deliveryTeams[0];
      if (!team) {
        setForm(null);
        return;
      }
      const lead = data.employees.find(
        (e) => e.id === team.members[0]?.employeeId,
      );
      setForm({
        id: generateId("del"),
        teamId: team.id,
        period: "2026-02",
        vehicleType: lead?.vehicleType ?? "ENGKEL",
        cartons: 0,
        invoices: 0,
        otdPct: 100,
        accuracyPct: 100,
        notes: "",
      });
      return;
    }
    const emp = deliveryEmployees[0];
    if (!emp) {
      setForm(null);
      return;
    }
    setForm({
      id: generateId("del"),
      employeeId: emp.id,
      period: "2026-02",
      vehicleType: emp.vehicleType ?? "ENGKEL",
      cartons: 0,
      invoices: 0,
      otdPct: 100,
      accuracyPct: 100,
      notes: "",
    });
  };

  const openEdit = (row: DeliveryRecord) => {
    setCreating(false);
    setEditing(row);
    setMode(row.teamId ? "team" : "employee");
    setForm({ ...row });
  };

  const close = () => {
    setEditing(null);
    setForm(null);
    setCreating(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (editing) {
      update("deliveryRecords", form);
    } else {
      create("deliveryRecords", form);
    }
    close();
  };

  const subjectLabel = (row: DeliveryRecord) => {
    if (row.teamId) {
      const team = data.teams.find((t) => t.id === row.teamId);
      return team ? `Tim: ${team.name}` : row.teamId;
    }
    const emp = data.employees.find((e) => e.id === row.employeeId);
    return emp?.name ?? row.employeeId ?? "—";
  };

  const previewAmount = (row: DeliveryRecord) => {
    if (row.teamId) {
      const team = data.teams.find((t) => t.id === row.teamId);
      if (!team) return null;
      const results = calculateTeamDeliveryIncentive(data, row, team);
      return {
        qualityPassed: results[0]?.qualityPassed ?? false,
        finalAmount: results.reduce((s, r) => s + r.finalAmount, 0),
      };
    }
    const emp = data.employees.find((e) => e.id === row.employeeId);
    if (!emp) return null;
    const result = calculateDeliveryIncentive(data, row, emp);
    return {
      qualityPassed: result.qualityPassed,
      finalAmount: result.finalAmount,
    };
  };

  return (
    <>
      <PageHeader
        title="Pengiriman (Delivery Team)"
        description="Input per Tim (Master Tim) atau Individu (NIK). Insentif dari tier volume per armada — Lampiran 14."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => openCreate("team")}
              disabled={deliveryTeams.length === 0}
            >
              + Pengiriman Tim
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => openCreate("employee")}
              disabled={deliveryEmployees.length === 0}
            >
              + Pengiriman Individu
            </button>
          </div>
        }
      />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-3 py-3 text-left">Subjek</th>
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
              const preview = previewAmount(row);
              return (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-medium">{subjectLabel(row)}</td>
                  <td className="px-3 py-2">{row.period}</td>
                  <td className="px-3 py-2">{row.vehicleType}</td>
                  <td className="px-3 py-2 text-right">
                    {new Intl.NumberFormat("id-ID").format(row.cartons)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {new Intl.NumberFormat("id-ID").format(row.invoices)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {preview?.qualityPassed ? (
                      <span className="badge bg-[var(--success)]/10 text-[var(--success)]">
                        Lolos
                      </span>
                    ) : (
                      <span className="badge bg-red-100 text-red-700">
                        Gagal
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-[var(--success)]">
                    {preview ? formatRupiah(preview.finalAmount) : "—"}
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
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-[var(--text-muted)]"
                >
                  Belum ada data pengiriman. Tambah manual atau via Import.
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
                        (component === "cartonnage" ||
                          t.vehicleType === "PICKUP"),
                    )
                    .map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-[var(--border)]/50"
                      >
                        <td className="py-1 pr-2">
                          {component === "dropPoint" ? "Semua" : t.vehicleType}
                        </td>
                        <td className="py-1 pr-2">
                          {new Intl.NumberFormat("id-ID").format(t.minQty)}
                          {t.maxQty
                            ? ` – ${new Intl.NumberFormat("id-ID").format(t.maxQty)}`
                            : " ke atas"}
                        </td>
                        <td className="py-1 text-right">
                          {formatRupiah(t.nominal)}
                        </td>
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
        title={creating ? "Tambah Pengiriman" : "Edit Pengiriman"}
        onClose={close}
      >
        {form && (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {mode === "team" ? (
                <div>
                  <label className="label">Tim Delivery</label>
                  <Select2
                    value={form.teamId ?? ""}
                    onChange={(v) => {
                      const team = data.teams.find((t) => t.id === v);
                      const lead = data.employees.find(
                        (e) => e.id === team?.members[0]?.employeeId,
                      );
                      setForm({
                        ...form,
                        teamId: v,
                        employeeId: undefined,
                        vehicleType:
                          lead?.vehicleType ?? form.vehicleType,
                      });
                    }}
                    options={deliveryTeams.map((t) => ({
                      value: t.id,
                      label: `${t.name} (${t.members.length} org)`,
                    }))}
                  />
                </div>
              ) : (
                <div>
                  <label className="label">Karyawan</label>
                  <Select2
                    value={form.employeeId ?? ""}
                    onChange={(v) => {
                      const emp = data.employees.find((x) => x.id === v);
                      setForm({
                        ...form,
                        employeeId: v,
                        teamId: undefined,
                        vehicleType: emp?.vehicleType ?? form.vehicleType,
                      });
                    }}
                    options={deliveryEmployees.map((e) => ({
                      value: e.id,
                      label: `${e.name} (${e.nik})`,
                    }))}
                  />
                </div>
              )}
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
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Gate: ≥ 95%
                </p>
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
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Gate: ≥ 97%
                </p>
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
