"use client";

import { FormEvent, useState } from "react";
import { LoadingState } from "@/components/LoadingState";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { Select2 } from "@/components/Select2";
import { generateId } from "@/lib/storage";
import {
  defaultWorkforceMode,
  employeeAssignedTeamId,
  subjectPolicyOf,
} from "@/lib/team-utils";
import { useAppData } from "@/hooks/useAppData";
import type { Employee, EmployeePosition, WorkforceMode } from "@/types";

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
  workforceMode: "individu",
  active: true,
};

export default function KaryawanPage() {
  const { data, ready, create, update, remove } = useAppData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);

  if (!ready || !data) return <LoadingState />;

  const policy = subjectPolicyOf(data, form.roleId);
  const modeLocked = policy === "individu" || policy === "team";
  const effectiveMode: WorkforceMode =
    policy === "individu"
      ? "individu"
      : policy === "team"
        ? "team"
        : form.workforceMode;

  const openCreate = () => {
    setEditing(null);
    setError(null);
    const roleId = data.roles[0]?.id ?? "canvasser";
    setForm({
      ...empty,
      branchId: data.branches[0]?.id ?? "",
      roleId,
      workforceMode: defaultWorkforceMode(data, roleId),
    });
    setOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setError(null);
    setForm({
      name: emp.name,
      nik: emp.nik,
      roleId: emp.roleId,
      branchId: emp.branchId,
      position: emp.position,
      teamSize: emp.teamSize,
      vehicleType: emp.vehicleType,
      workforceMode: emp.workforceMode ?? defaultWorkforceMode(data, emp.roleId),
      active: emp.active,
    });
    setOpen(true);
  };

  const onRoleChange = (roleId: string) => {
    const nextPolicy = subjectPolicyOf(data, roleId);
    const workforceMode: WorkforceMode =
      nextPolicy === "individu"
        ? "individu"
        : nextPolicy === "team"
          ? "team"
          : form.workforceMode;
    setForm({
      ...form,
      roleId,
      workforceMode,
      vehicleType: roleId === "delivery" ? form.vehicleType ?? "PICKUP" : undefined,
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const workforceMode = effectiveMode;
    const payload = { ...form, workforceMode };
    setError(null);
    if (editing) {
      if (workforceMode === "team") {
        const assigned = employeeAssignedTeamId(data, editing.id);
        if (!assigned) {
          setError(
            "Mode Tim membutuhkan keanggotaan di Master Tim. Tambahkan karyawan ke tim dulu, atau set mode Individu.",
          );
          return;
        }
      }
      update("employees", { ...editing, ...payload });
    } else {
      create("employees", { id: generateId("emp"), ...payload });
    }
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Karyawan / Manpower"
        description="Kelola karyawan dan mode kerja (Individu / Tim). Role menentukan kebijakan; Manpower menentukan mode aktual."
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
              <th className="px-4 py-3 text-left">Mode</th>
              <th className="px-4 py-3 text-left">Ukuran</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.employees.map((emp) => {
              const role = data.roles.find((r) => r.id === emp.roleId);
              const branch = data.branches.find((b) => b.id === emp.branchId);
              const mode = emp.workforceMode ?? "individu";
              return (
                <tr key={emp.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs">
                    {emp.nik}
                  </td>
                  <td className="px-4 py-3 font-medium">{emp.name}</td>
                  <td className="px-4 py-3">{role?.name}</td>
                  <td className="px-4 py-3">{branch?.name}</td>
                  <td className="px-4 py-3 capitalize">{emp.position}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge ${
                        mode === "team"
                          ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                          : "bg-[var(--surface-muted)]"
                      }`}
                    >
                      {mode === "team" ? "Tim" : "Individu"}
                    </span>
                  </td>
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
                        if (confirm(`Hapus ${emp.name}?`))
                          remove("employees", emp.id);
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
          {error && (
            <p className="sm:col-span-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {error}
            </p>
          )}
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
              onChange={onRoleChange}
              options={data.roles.map((r) => ({
                value: r.id,
                label: `${r.name} (${r.subjectPolicy})`,
              }))}
            />
          </div>
          <div>
            <label className="label">Manpower / Mode kerja</label>
            <Select2
              value={effectiveMode}
              onChange={(v) =>
                setForm({ ...form, workforceMode: v as WorkforceMode })
              }
              options={[
                { value: "individu", label: "Individu (NIK)" },
                { value: "team", label: "Tim (Master Tim)" },
              ]}
              isDisabled={modeLocked}
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {policy === "individu" && "Role ini hanya Individu."}
              {policy === "team" && "Role ini wajib Tim."}
              {policy === "optional" &&
                "Role opsional — pilih Individu atau Tim."}
            </p>
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
            <label className="label">Ukuran Tim (nominal)</label>
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
