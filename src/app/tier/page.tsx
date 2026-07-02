"use client";

import { FormEvent, useMemo, useState } from "react";
import { LoadingState } from "@/components/LoadingState";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { useAppData } from "@/hooks/useAppData";
import type { AchievementTier } from "@/types";

const empty: Omit<AchievementTier, "id"> = {
  label: "",
  minPct: 70,
  maxPct: 80,
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
}

export default function TierPage() {
  const { data, ready, create, update, remove } = useAppData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AchievementTier | null>(null);
  const [form, setForm] = useState(empty);
  const [customId, setCustomId] = useState("");
  const [unbounded, setUnbounded] = useState(false);

  const sortedTiers = useMemo(() => {
    if (!data) return [];
    return [...data.achievementTiers].sort((a, b) => a.minPct - b.minPct);
  }, [data]);

  if (!ready || !data) return <LoadingState />;

  const nominalUsage = (tierId: string) =>
    data.schemeNominals.filter((n) => n.achievementTierId === tierId).length;

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setCustomId("");
    setUnbounded(false);
    setOpen(true);
  };

  const openEdit = (tier: AchievementTier) => {
    setEditing(tier);
    setForm({
      label: tier.label,
      minPct: tier.minPct,
      maxPct: tier.maxPct,
    });
    setCustomId(tier.id);
    setUnbounded(tier.maxPct === null);
    setOpen(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) return;

    const id = editing?.id ?? (customId.trim() || `t-${slugify(form.label)}`);
    if (!id) return;

    const payload: AchievementTier = {
      id,
      label: form.label.trim(),
      minPct: form.minPct,
      maxPct: unbounded ? null : form.maxPct,
    };

    if (editing) {
      update("achievementTiers", payload);
    } else {
      if (data.achievementTiers.some((t) => t.id === id)) {
        alert(`Tier ID "${id}" sudah ada.`);
        return;
      }
      create("achievementTiers", payload);
    }
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Master Tier Pencapaian"
        description="Definisikan tier pencapaian (rentang %) yang dipakai di nominal insentif dan kalkulasi. Urutan ditentukan oleh batas minimum."
        action={
          <button type="button" className="btn-primary" onClick={openCreate}>
            + Tambah Tier
          </button>
        }
      />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Label</th>
              <th className="px-4 py-3 text-center">Min (%)</th>
              <th className="px-4 py-3 text-center">Max (%)</th>
              <th className="px-4 py-3 text-center">Dipakai Nominal</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {sortedTiers.map((t) => (
              <tr key={t.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs">
                  {t.id}
                </td>
                <td className="px-4 py-3 font-medium">{t.label}</td>
                <td className="px-4 py-3 text-center font-[family-name:var(--font-mono)]">
                  {t.minPct}
                </td>
                <td className="px-4 py-3 text-center font-[family-name:var(--font-mono)]">
                  {t.maxPct === null ? "∞" : t.maxPct}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="badge bg-[var(--surface-muted)]">
                    {nominalUsage(t.id)} baris
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    className="btn-secondary mr-2 px-3 py-1"
                    onClick={() => openEdit(t)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-danger px-3 py-1"
                    onClick={() => {
                      const used = nominalUsage(t.id);
                      const msg =
                        used > 0
                          ? `Tier "${t.label}" dipakai ${used} baris nominal. Hapus tetap lanjut?`
                          : `Hapus tier "${t.label}"?`;
                      if (confirm(msg)) remove("achievementTiers", t.id);
                    }}
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
            {sortedTiers.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-[var(--text-muted)]"
                >
                  Belum ada tier. Tambahkan minimal satu tier untuk perhitungan
                  insentif.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        title={editing ? "Edit Tier" : "Tambah Tier"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={submit} className="space-y-4">
          {!editing && (
            <div>
              <label className="label">ID Tier</label>
              <input
                className="input font-[family-name:var(--font-mono)]"
                placeholder="Auto dari label jika dikosongkan, contoh: t6"
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="label">Label Tier</label>
            <input
              className="input"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Contoh: ≥ 120% ; < 130%"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Batas Minimum (%)</label>
              <input
                type="number"
                min={0}
                step={1}
                className="input"
                value={form.minPct}
                onChange={(e) =>
                  setForm({ ...form, minPct: Number(e.target.value) })
                }
                required
              />
            </div>
            <div>
              <label className="label">Batas Maksimum (%)</label>
              <input
                type="number"
                min={0}
                step={1}
                className="input"
                value={unbounded ? "" : (form.maxPct ?? "")}
                disabled={unbounded}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxPct: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
              <label className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  checked={unbounded}
                  onChange={(e) => {
                    setUnbounded(e.target.checked);
                    if (e.target.checked) {
                      setForm({ ...form, maxPct: null });
                    } else {
                      setForm({ ...form, maxPct: form.minPct + 10 });
                    }
                  }}
                />
                Tanpa batas atas (tier tertinggi)
              </label>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Pencapaian masuk tier jika ≥ min dan &lt; max (kecuali tier tanpa
            batas atas: ≥ min saja).
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setOpen(false)}
            >
              Batal
            </button>
            <button type="submit" className="btn-primary">
              Simpan
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
