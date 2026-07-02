"use client";

import { FormEvent, useState } from "react";
import { LoadingState } from "@/components/LoadingState";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { Select2 } from "@/components/Select2";
import { generateId } from "@/lib/storage";
import { useAppData } from "@/hooks/useAppData";
import type { Branch, BranchTypeId } from "@/types";

const empty: Omit<Branch, "id"> = { name: "", branchType: "MB" };

export default function CabangPage() {
  const { data, ready, create, update, remove } = useAppData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState(empty);
  const [filter, setFilter] = useState("");

  if (!ready || !data) return <LoadingState />;

  const branchTypeName = (id: BranchTypeId) =>
    data.branchTypes.find((b) => b.id === id)?.name ?? id;

  const filtered = data.branches.filter((b) =>
    b.name.toLowerCase().includes(filter.toLowerCase()),
  );

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setEditing(branch);
    setForm({ name: branch.name, branchType: branch.branchType });
    setOpen(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (editing) {
      update("branches", { ...editing, ...form });
    } else {
      create("branches", { id: generateId("br"), ...form });
    }
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Master Cabang"
        description="CRUD cabang berdasarkan kategori MB, SB, NB dari dokumen skema."
        action={
          <button type="button" className="btn-primary" onClick={openCreate}>
            + Tambah Cabang
          </button>
        }
      />

      <div className="card mb-4 p-4">
        <input
          className="input max-w-md"
          placeholder="Cari cabang..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-3 text-left">Nama Cabang</th>
              <th className="px-4 py-3 text-left">Kategori</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3">
                  <span className="badge bg-[var(--primary)]/10 text-[var(--primary)]">
                    {b.branchType} · {branchTypeName(b.branchType)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="btn-secondary mr-2 px-3 py-1"
                    onClick={() => openEdit(b)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-danger px-3 py-1"
                    onClick={() => {
                      if (confirm(`Hapus cabang ${b.name}?`)) remove("branches", b.id);
                    }}
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        title={editing ? "Edit Cabang" : "Tambah Cabang"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Nama Cabang</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Kategori Cabang</label>
            <Select2
              value={form.branchType}
              onChange={(v) =>
                setForm({ ...form, branchType: v as BranchTypeId })
              }
              options={data.branchTypes.map((bt) => ({
                value: bt.id,
                label: `${bt.id} — ${bt.name}`,
              }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
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
