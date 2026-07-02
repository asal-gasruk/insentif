"use client";

import { FormEvent, Fragment, useState } from "react";
import { LoadingState } from "@/components/LoadingState";
import { Modal } from "@/components/Modal";
import { NotesPanel, truncateNotes } from "@/components/NotesPanel";
import { PageHeader } from "@/components/PageHeader";
import { Select2 } from "@/components/Select2";
import { GLOBAL_PARAMETER_NOTE } from "@/data/parameter-notes";
import { useAppData } from "@/hooks/useAppData";
import type { Parameter } from "@/types";

const empty: Omit<Parameter, "id"> = {
  name: "",
  unit: "%",
  shortLabel: "",
  notes: "",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
}

export default function ParameterPage() {
  const { data, ready, create, update, remove } = useAppData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Parameter | null>(null);
  const [form, setForm] = useState(empty);
  const [customId, setCustomId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!ready || !data) return <LoadingState />;

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setCustomId("");
    setOpen(true);
  };

  const openEdit = (param: Parameter) => {
    setEditing(param);
    setForm({
      name: param.name,
      unit: param.unit,
      shortLabel: param.shortLabel ?? "",
      notes: param.notes ?? "",
    });
    setCustomId(param.id);
    setOpen(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const id = editing?.id ?? (customId.trim() || slugify(form.name));
    if (!id) return;

    const payload: Parameter = {
      id,
      name: form.name,
      unit: form.unit,
      shortLabel: form.shortLabel || undefined,
      notes: form.notes?.trim() || undefined,
    };

    if (editing) {
      update("parameters", payload);
    } else {
      if (data.parameters.some((p) => p.id === id)) {
        alert(`Parameter ID "${id}" sudah ada.`);
        return;
      }
      create("parameters", payload);
    }
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Master Parameter"
        description="Definisikan parameter insentif beserta catatan/definisi dari dokumen. Kolom bobot mengikuti daftar ini."
        action={
          <button type="button" className="btn-primary" onClick={openCreate}>
            + Tambah Parameter
          </button>
        }
      />

      <NotesPanel
        text={GLOBAL_PARAMETER_NOTE}
        title="Catatan Umum (dari dokumen)"
        className="mb-4"
      />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Nama Parameter</th>
              <th className="px-4 py-3 text-left">Label</th>
              <th className="px-4 py-3 text-left">Unit</th>
              <th className="px-4 py-3 text-left">Catatan</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.parameters.map((p) => (
              <Fragment key={p.id}>
                <tr className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs">
                    {p.id}
                  </td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">{p.shortLabel ?? "—"}</td>
                  <td className="px-4 py-3">{p.unit}</td>
                  <td className="max-w-xs px-4 py-3">
                    <p className="line-clamp-2 text-xs text-[var(--text-muted)]">
                      {truncateNotes(p.notes, 100)}
                    </p>
                    {p.notes && (
                      <button
                        type="button"
                        className="mt-1 text-xs text-[var(--primary)] hover:underline"
                        onClick={() =>
                          setExpandedId(expandedId === p.id ? null : p.id)
                        }
                      >
                        {expandedId === p.id ? "Sembunyikan" : "Lihat lengkap"}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="btn-secondary mr-2 px-3 py-1"
                      onClick={() => openEdit(p)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger px-3 py-1"
                      onClick={() => {
                        if (
                          confirm(
                            `Hapus parameter "${p.name}"? Bobot yang memakai parameter ini tidak akan terhitung.`,
                          )
                        ) {
                          remove("parameters", p.id);
                        }
                      }}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
                {expandedId === p.id && p.notes && (
                  <tr className="border-t border-[var(--border)] bg-[var(--surface-muted)]/50">
                    <td colSpan={6} className="px-4 py-3">
                      <NotesPanel text={p.notes} title={`Definisi: ${p.name}`} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        title={editing ? "Edit Parameter" : "Tambah Parameter"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={submit} className="space-y-4">
          {!editing && (
            <div>
              <label className="label">ID Parameter</label>
              <input
                className="input font-[family-name:var(--font-mono)]"
                placeholder="Auto dari nama jika dikosongkan"
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="label">Nama Parameter</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Label Singkat (header tabel)</label>
              <input
                className="input"
                value={form.shortLabel}
                onChange={(e) => setForm({ ...form, shortLabel: e.target.value })}
                placeholder="Contoh: EC, PD, IPO"
              />
            </div>
            <div>
              <label className="label">Unit</label>
              <Select2
                value={form.unit}
                onChange={(v) => setForm({ ...form, unit: v })}
                options={["%", "Rp", "#", "Ctn", "Outlet", "SKU"].map((u) => ({
                  value: u,
                  label: u,
                }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Catatan / Definisi (dari dokumen)</label>
            <textarea
              className="input min-h-[100px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Penjelasan parameter sesuai baris Note di sheet Excel..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
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
