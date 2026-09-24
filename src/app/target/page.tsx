"use client";

import { FormEvent, useMemo, useState } from "react";
import { LoadingState } from "@/components/LoadingState";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { Select2 } from "@/components/Select2";
import { generateId } from "@/lib/storage";
import { useAppData } from "@/hooks/useAppData";
import type { ParameterTarget } from "@/types";

type SubjectMode = "team" | "employee";

type FormState = {
  subjectMode: SubjectMode;
  teamId: string;
  employeeId: string;
  paramId: string;
  period: string;
  target: number;
  notes: string;
};

function formatTarget(n: number, unit: string): string {
  if (unit === "Rp") {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(n);
  }
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 4,
  }).format(n);
}

export default function TargetPage() {
  const { data, ready, create, update, remove } = useAppData();
  const [filterPeriod, setFilterPeriod] = useState("2026-08");
  const [filterParam, setFilterParam] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | SubjectMode>("team");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ParameterTarget | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.parameterTargets.filter((row) => {
      if (filterPeriod && row.period !== filterPeriod) return false;
      if (filterParam && row.paramId !== filterParam) return false;
      if (filterMode === "team" && !row.teamId) return false;
      if (filterMode === "employee" && !row.employeeId) return false;
      if (filterBranch) {
        if (row.teamId) {
          const team = data.teams.find((t) => t.id === row.teamId);
          if (!team || team.branchId !== filterBranch) return false;
        } else if (row.employeeId) {
          const emp = data.employees.find((e) => e.id === row.employeeId);
          if (!emp || emp.branchId !== filterBranch) return false;
        }
      }
      return true;
    });
  }, [data, filterPeriod, filterParam, filterBranch, filterMode]);

  if (!ready || !data) return <LoadingState />;

  const periods = [
    ...new Set(data.parameterTargets.map((t) => t.period).concat(["2026-08"])),
  ].sort();

  const openCreate = () => {
    setEditing(null);
    setError(null);
    setForm({
      subjectMode: "team",
      teamId: data.teams.find((t) => t.active)?.id ?? "",
      employeeId: "",
      paramId: data.parameters[0]?.id ?? "allProduct",
      period: filterPeriod || "2026-08",
      target: 0,
      notes: "",
    });
    setOpen(true);
  };

  const openEdit = (row: ParameterTarget) => {
    setEditing(row);
    setError(null);
    setForm({
      subjectMode: row.teamId ? "team" : "employee",
      teamId: row.teamId ?? "",
      employeeId: row.employeeId ?? "",
      paramId: row.paramId,
      period: row.period,
      target: row.target,
      notes: row.notes ?? "",
    });
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditing(null);
    setForm(null);
    setError(null);
  };

  const naturalKeyConflict = (
    payload: ParameterTarget,
    excludeId?: string,
  ): boolean => {
    return data.parameterTargets.some((t) => {
      if (excludeId && t.id === excludeId) return false;
      if (t.paramId !== payload.paramId || t.period !== payload.period) {
        return false;
      }
      if (payload.teamId) return t.teamId === payload.teamId;
      return t.employeeId === payload.employeeId;
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (form.subjectMode === "team" && !form.teamId) {
      setError("Pilih Master Tim.");
      return;
    }
    if (form.subjectMode === "employee" && !form.employeeId) {
      setError("Pilih karyawan.");
      return;
    }
    if (!Number.isFinite(form.target) || form.target < 0) {
      setError("Target harus angka ≥ 0.");
      return;
    }

    const payload: ParameterTarget = {
      id: editing?.id ?? generateId("pt"),
      teamId: form.subjectMode === "team" ? form.teamId : undefined,
      employeeId: form.subjectMode === "employee" ? form.employeeId : undefined,
      paramId: form.paramId,
      period: form.period.trim(),
      target: form.target,
      notes: form.notes.trim() || undefined,
    };

    if (naturalKeyConflict(payload, editing?.id)) {
      setError(
        "Target untuk subjek + parameter + periode ini sudah ada. Edit baris yang ada.",
      );
      return;
    }

    if (editing) update("parameterTargets", payload);
    else create("parameterTargets", payload);
    close();
  };

  const subjectLabel = (row: ParameterTarget) => {
    if (row.teamId) {
      const team = data.teams.find((t) => t.id === row.teamId);
      return team?.name ?? row.teamId;
    }
    const emp = data.employees.find((e) => e.id === row.employeeId);
    return emp ? `${emp.name} (${emp.nik})` : (row.employeeId ?? "—");
  };

  const paramLabel = (paramId: string) => {
    const p = data.parameters.find((x) => x.id === paramId);
    return p?.shortLabel ?? p?.name ?? paramId;
  };

  const paramUnit = (paramId: string) =>
    data.parameters.find((x) => x.id === paramId)?.unit ?? "";

  return (
    <>
      <PageHeader
        title="Target Parameter"
        description="Target absolut per Tim (atau individu) × parameter × periode. Sumber seed: Excel Pencapaian Agustus 2026. Actual diisi nanti di halaman Pencapaian."
        action={
          <button type="button" className="btn-primary" onClick={openCreate}>
            + Tambah Target
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-[140px]">
          <label className="label">Periode</label>
          <Select2
            value={filterPeriod}
            onChange={setFilterPeriod}
            options={[
              { value: "", label: "Semua" },
              ...periods.map((p) => ({ value: p, label: p })),
            ]}
          />
        </div>
        <div className="min-w-[160px]">
          <label className="label">Parameter</label>
          <Select2
            value={filterParam}
            onChange={setFilterParam}
            options={[
              { value: "", label: "Semua" },
              ...data.parameters.map((p) => ({
                value: p.id,
                label: p.shortLabel ?? p.name,
              })),
            ]}
          />
        </div>
        <div className="min-w-[160px]">
          <label className="label">Cabang</label>
          <Select2
            value={filterBranch}
            onChange={setFilterBranch}
            options={[
              { value: "", label: "Semua" },
              ...data.branches.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </div>
        <div className="min-w-[140px]">
          <label className="label">Mode</label>
          <Select2
            value={filterMode}
            onChange={(v) => setFilterMode(v as "all" | SubjectMode)}
            options={[
              { value: "all", label: "Semua" },
              { value: "team", label: "Tim" },
              { value: "employee", label: "Individu" },
            ]}
          />
        </div>
      </div>

      <p className="mb-2 text-sm text-[var(--text-muted)]">
        Menampilkan {filtered.length} dari {data.parameterTargets.length} target
      </p>

      <div className="card overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--surface-muted)]">
              <tr>
                <th className="px-4 py-3 text-left">Periode</th>
                <th className="px-4 py-3 text-left">Subjek</th>
                <th className="px-4 py-3 text-left">Parameter</th>
                <th className="px-4 py-3 text-right">Target</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2 font-[family-name:var(--font-mono)] text-xs">
                    {row.period}
                  </td>
                  <td className="px-4 py-2">{subjectLabel(row)}</td>
                  <td className="px-4 py-2">
                    {paramLabel(row.paramId)}
                    <span className="ml-1 text-xs text-[var(--text-muted)]">
                      ({paramUnit(row.paramId)})
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-[family-name:var(--font-mono)] text-xs">
                    {formatTarget(row.target, paramUnit(row.paramId))}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="btn-secondary mr-2 px-3 py-1"
                      onClick={() => openEdit(row)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger px-3 py-1"
                      onClick={() => {
                        if (confirm("Hapus target ini?")) {
                          remove("parameterTargets", row.id);
                        }
                      }}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-[var(--text-muted)]"
                  >
                    Belum ada target untuk filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open && !!form}
        title={editing ? "Edit Target" : "Tambah Target"}
        onClose={close}
      >
        {form && (
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div>
              <label className="label">Mode subjek</label>
              <Select2
                value={form.subjectMode}
                onChange={(v) =>
                  setForm({
                    ...form,
                    subjectMode: v as SubjectMode,
                    teamId: v === "team" ? form.teamId : "",
                    employeeId: v === "employee" ? form.employeeId : "",
                  })
                }
                options={[
                  { value: "team", label: "Master Tim" },
                  { value: "employee", label: "Individu" },
                ]}
              />
            </div>
            {form.subjectMode === "team" ? (
              <div>
                <label className="label">Tim</label>
                <Select2
                  value={form.teamId}
                  onChange={(v) => setForm({ ...form, teamId: v })}
                  options={data.teams
                    .filter((t) => t.active)
                    .map((t) => ({ value: t.id, label: t.name }))}
                />
              </div>
            ) : (
              <div>
                <label className="label">Karyawan</label>
                <Select2
                  value={form.employeeId}
                  onChange={(v) => setForm({ ...form, employeeId: v })}
                  options={data.employees
                    .filter((e) => e.active)
                    .map((e) => ({
                      value: e.id,
                      label: `${e.name} (${e.nik})`,
                    }))}
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Parameter</label>
                <Select2
                  value={form.paramId}
                  onChange={(v) => setForm({ ...form, paramId: v })}
                  options={data.parameters.map((p) => ({
                    value: p.id,
                    label: `${p.shortLabel ?? p.name} (${p.unit})`,
                  }))}
                />
              </div>
              <div>
                <label className="label">Periode</label>
                <input
                  className="input"
                  value={form.period}
                  onChange={(e) =>
                    setForm({ ...form, period: e.target.value })
                  }
                  placeholder="2026-08"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">
                Target ({paramUnit(form.paramId) || "nilai"})
              </label>
              <input
                className="input font-[family-name:var(--font-mono)]"
                type="number"
                step="any"
                min={0}
                value={form.target}
                onChange={(e) =>
                  setForm({ ...form, target: Number(e.target.value) })
                }
                required
              />
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
