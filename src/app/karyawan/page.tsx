"use client";

import { FormEvent, useState } from "react";
import { LoadingState } from "@/components/LoadingState";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { Select2 } from "@/components/Select2";
import { generateId } from "@/lib/storage";
import { useAppData } from "@/hooks/useAppData";
import type { Employee, EmployeePosition } from "@/types";

const positions: { value: EmployeePosition; label: string }[] = [
  { value: "salesman", label: "Salesman" },
  { value: "driver", label: "Driver" },
  { value: "helper1", label: "Helper 1" },
  { value: "helper2", label: "Helper 2" },
  { value: "supervisor", label: "Supervisor" },
  { value: "manager", label: "Manager" },
  { value: "other", label: "Lainnya" },
];

const vehicleTypes = ["PICKUP", "ENGKEL", "DOUBLE"];

const empty: Omit<Employee, "id"> = {
  name: "",
  nik: "",
  roleId: "canvasser",
  branchId: "",
  position: "salesman",
  teamSize: 3,
  vehicleType: undefined,
  active: true,
};

export default function KaryawanPage() {
  const { data, ready, create, update, remove } = useAppData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(empty);

  if (!ready || !data) return <LoadingState />;

  const openCreate = () => {
    setEditing(null);
    setForm({ ...empty, branchId: data.branches[0]?.id ?? "" });
    setOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setForm({
      name: emp.name,
      nik: emp.nik,
      roleId: emp.roleId,
      branchId: emp.branchId,
      position: emp.position,
      teamSize: emp.teamSize,
      vehicleType: emp.vehicleType,
      active: emp.active,
    });
    setOpen(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (editing) {
      update("employees", { ...editing, ...form });
    } else {
      create("employees", { id: generateId("emp"), ...form });
    }
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Karyawan / Tim Sales"
        description="Kelola data karyawan yang dihitung insentifnya berdasarkan role dan ukuran tim."
        action={
          <button type="button" className="btn-primary" onClick={openCreate}>
            + Tambah Karyawan
          </button>
        }
      />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-3 text-left">NIK</th>
              <th className="px-4 py-3 text-left">Nama</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Cabang</th>
              <th className="px-4 py-3 text-left">Posisi</th>
              <th className="px-4 py-3 text-left">Tim</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.employees.map((emp) => {
              const role = data.roles.find((r) => r.id === emp.roleId);
              const branch = data.branches.find((b) => b.id === emp.branchId);
              return (
                <tr key={emp.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs">
                    {emp.nik}
                  </td>
                  <td className="px-4 py-3 font-medium">{emp.name}</td>
                  <td className="px-4 py-3">{role?.name}</td>
                  <td className="px-4 py-3">{branch?.name}</td>
                  <td className="px-4 py-3 capitalize">{emp.position}</td>
                  <td className="px-4 py-3">{emp.teamSize} org</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="btn-secondary mr-2 px-3 py-1"
                      onClick={() => openEdit(emp)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger px-3 py-1"
                      onClick={() => {
                        if (confirm(`Hapus ${emp.name}?`)) remove("employees", emp.id);
                      }}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        title={editing ? "Edit Karyawan" : "Tambah Karyawan"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">NIK</label>
            <input
              className="input"
              value={form.nik}
              onChange={(e) => setForm({ ...form, nik: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Nama</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Role</label>
            <Select2
              value={form.roleId}
              onChange={(v) => setForm({ ...form, roleId: v })}
              options={data.roles.map((r) => ({
                value: r.id,
                label: r.name,
              }))}
            />
          </div>
          <div>
            <label className="label">Cabang</label>
            <Select2
              value={form.branchId}
              onChange={(v) => setForm({ ...form, branchId: v })}
              options={data.branches.map((b) => ({
                value: b.id,
                label: `${b.name} (${b.branchType})`,
              }))}
            />
          </div>
          <div>
            <label className="label">Posisi</label>
            <Select2
              value={form.position}
              onChange={(v) =>
                setForm({ ...form, position: v as EmployeePosition })
              }
              options={positions.map((p) => ({
                value: p.value,
                label: p.label,
              }))}
            />
          </div>
          <div>
            <label className="label">Ukuran Tim</label>
            <input
              type="number"
              min={1}
              max={5}
              className="input"
              value={form.teamSize}
              onChange={(e) =>
                setForm({ ...form, teamSize: Number(e.target.value) })
              }
            />
          </div>
          {form.roleId === "delivery" && (
            <div>
              <label className="label">Jenis Armada</label>
              <Select2
                value={form.vehicleType ?? "PICKUP"}
                onChange={(v) => setForm({ ...form, vehicleType: v })}
                options={vehicleTypes.map((v) => ({ value: v, label: v }))}
              />
            </div>
          )}
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            <label htmlFor="active" className="text-sm">
              Karyawan aktif
            </label>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
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
