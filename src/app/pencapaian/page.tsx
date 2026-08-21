"use client";

import { FormEvent, useState } from "react";
import { LoadingState } from "@/components/LoadingState";
import { Modal } from "@/components/Modal";
import { NotesPanel } from "@/components/NotesPanel";
import { PageHeader } from "@/components/PageHeader";
import { Select2 } from "@/components/Select2";
import {
  activeParams,
  defaultSegment,
  schemeForEmployee,
} from "@/lib/scheme-utils";
import { formatPenaltySummary } from "@/lib/penalty-engine";
import {
  defaultSegmentForTeam,
  resolveSubjectMode,
  schemeForTeam,
} from "@/lib/team-utils";
import { generateId } from "@/lib/storage";
import { useAppData } from "@/hooks/useAppData";
import type { AchievementRecord } from "@/types";

type SubjectMode = "team" | "employee";

export default function PencapaianPage() {
  const { data, ready, create, update, remove } = useAppData();
  const [editing, setEditing] = useState<AchievementRecord | null>(null);
  const [form, setForm] = useState<AchievementRecord | null>(null);
  const [mode, setMode] = useState<SubjectMode>("team");
  const [creating, setCreating] = useState(false);

  if (!ready || !data) return <LoadingState />;

  const eligibleTeams = data.teams.filter((t) => {
    if (!t.active) return false;
    const scheme = schemeForTeam(data, t);
    return scheme?.type === "parameter";
  });
  const eligibleEmployees = data.employees.filter((e) => {
    if (!schemeForEmployee(data, e)) return false;
    return resolveSubjectMode(data, e) === "individu";
  });

  const openCreate = (nextMode: SubjectMode) => {
    setCreating(true);
    setEditing(null);
    setMode(nextMode);

    if (nextMode === "team") {
      const team = eligibleTeams[0];
      const scheme = schemeForTeam(data, team);
      if (!team || !scheme) {
        setForm(null);
        return;
      }
      setForm({
        id: generateId("ach"),
        teamId: team.id,
        period: scheme.period === "quarterly" ? "2026-Q1" : "2026-02",
        schemeId: scheme.id,
        segmentId: defaultSegmentForTeam(data, team),
        achievements: {},
        overduePct: 0,
        badDebtDays: 0,
        notes: "",
      });
      return;
    }

    const emp = eligibleEmployees[0];
    const scheme = schemeForEmployee(data, emp);
    if (!emp || !scheme) {
      setForm(null);
      return;
    }
    setForm({
      id: generateId("ach"),
      employeeId: emp.id,
      period: scheme.period === "quarterly" ? "2026-Q1" : "2026-02",
      schemeId: scheme.id,
      segmentId: defaultSegment(data, emp),
      achievements: {},
      overduePct: 0,
      badDebtDays: 0,
      notes: "",
    });
  };

  const openEdit = (row: AchievementRecord) => {
    setCreating(false);
    setEditing(row);
    setMode(row.teamId ? "team" : "employee");
    setForm(JSON.parse(JSON.stringify(row)) as AchievementRecord);
  };

  const close = () => {
    setEditing(null);
    setForm(null);
    setCreating(false);
  };

  const onTeamChange = (teamId: string) => {
    if (!form) return;
    const team = data.teams.find((t) => t.id === teamId);
    const scheme = schemeForTeam(data, team);
    if (!scheme || !team) return;
    setForm({
      ...form,
      teamId,
      employeeId: undefined,
      schemeId: scheme.id,
      segmentId: defaultSegmentForTeam(data, team),
      achievements: {},
    });
  };

  const onEmployeeChange = (employeeId: string) => {
    if (!form) return;
    const emp = data.employees.find((e) => e.id === employeeId);
    const scheme = schemeForEmployee(data, emp);
    if (!scheme) return;
    setForm({
      ...form,
      employeeId,
      teamId: undefined,
      schemeId: scheme.id,
      segmentId: defaultSegment(data, emp),
      achievements: {},
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (editing) {
      update("achievementRecords", form);
    } else {
      create("achievementRecords", form);
    }
    close();
  };

  const formScheme = form
    ? data.schemes.find((s) => s.id === form.schemeId)
    : undefined;
  const formParams = form
    ? activeParams(data, form.schemeId, form.segmentId)
    : [];

  const subjectLabel = (row: AchievementRecord) => {
    if (row.teamId) {
      const team = data.teams.find((t) => t.id === row.teamId);
      if (!team) return row.teamId;
      return `Tim: ${team.name} (${team.teamType})`;
    }
    const emp = data.employees.find((e) => e.id === row.employeeId);
    return emp?.name ?? row.employeeId ?? "—";
  };

  return (
    <>
      <PageHeader
        title="Data Pencapaian"
        description="Mode Tim: input per Master Tim. Mode Individu: input per NIK (termasuk role optional yang Manpower-nya Individu)."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => openCreate("team")}
              disabled={eligibleTeams.length === 0}
            >
              + Pencapaian Tim
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => openCreate("employee")}
              disabled={eligibleEmployees.length === 0}
            >
              + Pencapaian Individu
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
              <th className="px-3 py-3 text-left">Skema</th>
              <th className="px-3 py-3 text-left">Segment</th>
              <th className="px-3 py-3 text-left">Pencapaian</th>
              <th className="px-3 py-3 text-center">Overdue</th>
              <th className="px-3 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.achievementRecords.map((row) => {
              const scheme = data.schemes.find((s) => s.id === row.schemeId);
              const segment = scheme?.segments.find(
                (s) => s.id === row.segmentId,
              );
              return (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-medium">{subjectLabel(row)}</td>
                  <td className="px-3 py-2">{row.period}</td>
                  <td className="px-3 py-2">{scheme?.name}</td>
                  <td className="px-3 py-2">{segment?.name ?? row.segmentId}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(row.achievements).map(([p, v]) => {
                        const param = data.parameters.find((x) => x.id === p);
                        return (
                          <span
                            key={p}
                            className="badge border border-[var(--border)] bg-white text-[10px]"
                          >
                            {param?.shortLabel ?? p}: {v}%
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">{row.overduePct}%</td>
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
                        if (confirm("Hapus data pencapaian?"))
                          remove("achievementRecords", row.id);
                      }}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              );
            })}
            {data.achievementRecords.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-[var(--text-muted)]"
                >
                  Belum ada data pencapaian. Tambah manual atau via Import.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={form !== null}
        title={creating ? "Tambah Pencapaian" : "Edit Pencapaian"}
        onClose={close}
      >
        {form && formScheme && (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {mode === "team" ? (
                <div>
                  <label className="label">Tim</label>
                  <Select2
                    value={form.teamId ?? ""}
                    onChange={onTeamChange}
                    options={eligibleTeams.map((t) => ({
                      value: t.id,
                      label: `${t.name} (${t.teamType} · ${t.members.length} org)`,
                    }))}
                  />
                </div>
              ) : (
                <div>
                  <label className="label">Karyawan</label>
                  <Select2
                    value={form.employeeId ?? ""}
                    onChange={onEmployeeChange}
                    options={eligibleEmployees.map((e) => ({
                      value: e.id,
                      label: `${e.name} (${e.nik})`,
                    }))}
                  />
                </div>
              )}
              <div>
                <label className="label">
                  Periode (
                  {formScheme.period === "monthly" ? "YYYY-MM" : "YYYY-Qn"})
                </label>
                <input
                  className="input"
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Skema</label>
                <input
                  className="input bg-[var(--surface-muted)]"
                  value={formScheme.name}
                  readOnly
                />
                {formScheme.notes && (
                  <NotesPanel
                    text={formScheme.notes}
                    title="Catatan Skema"
                    className="mt-2"
                  />
                )}
              </div>
              <div>
                <label className="label">Segment</label>
                <Select2
                  value={form.segmentId}
                  onChange={(v) =>
                    setForm({ ...form, segmentId: v, achievements: {} })
                  }
                  options={formScheme.segments.map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                />
              </div>
            </div>

            <div>
              <p className="label mb-2">
                % Pencapaian per Parameter (sesuai bobot skema)
              </p>
              {formParams.length === 0 ? (
                <p className="rounded-lg bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-muted)]">
                  Bobot belum dikonfigurasi untuk segment ini. Atur dulu di
                  halaman Bobot Parameter.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {formParams.map((paramId) => {
                    const param = data.parameters.find((p) => p.id === paramId);
                    return (
                      <div key={paramId}>
                        <label className="label" title={param?.name}>
                          {param?.shortLabel ?? paramId} (%)
                        </label>
                        {param?.notes && (
                          <p className="mb-1 line-clamp-2 text-[10px] leading-snug text-[var(--text-muted)]">
                            {param.notes}
                          </p>
                        )}
                        <input
                          type="number"
                          min={0}
                          max={300}
                          className="input"
                          value={form.achievements[paramId] ?? ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              achievements: {
                                ...form.achievements,
                                [paramId]: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Overdue Piutang (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="input"
                  value={form.overduePct}
                  onChange={(e) =>
                    setForm({ ...form, overduePct: Number(e.target.value) })
                  }
                />
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {formatPenaltySummary(formScheme.penalties ?? [])}
                </p>
              </div>
              <div>
                <label className="label">Bad Debt (hari)</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={form.badDebtDays}
                  onChange={(e) =>
                    setForm({ ...form, badDebtDays: Number(e.target.value) })
                  }
                />
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {formatPenaltySummary(formScheme.penalties ?? [])}
                </p>
              </div>
            </div>

            <div>
              <label className="label">Catatan</label>
              <textarea
                className="input min-h-[60px]"
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
