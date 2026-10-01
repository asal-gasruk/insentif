"use client";

import { FormEvent, useState } from "react";
import { LoadingState } from "@/components/LoadingState";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { Select2 } from "@/components/Select2";
import { generateId } from "@/lib/storage";
import {
  TEAM_MEMBER_POSITIONS,
  employeeAssignedTeamId,
  teamCapableRoles,
  teamTypeForRoleId,
  validateTeamMembers,
} from "@/lib/team-utils";
import {
  orgNodeName,
  supervisorChain,
  teamSupervisorNodeId,
} from "@/lib/org-rollup";
import { useAppData } from "@/hooks/useAppData";
import type { EmployeePosition, OrgNode, Team, TeamMember } from "@/types";

type TeamForm = Omit<Team, "id">;

const emptyForm = (branchId: string, roleId: string): TeamForm => ({
  name: "",
  teamType: teamTypeForRoleId(roleId),
  roleId,
  branchId,
  members: [{ employeeId: "", position: "salesman" }],
  active: true,
});

export default function TimPage() {
  const { data, ready, create, update, remove } = useAppData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [form, setForm] = useState<TeamForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"daftar" | "struktur">("daftar");
  const [fRsm, setFRsm] = useState("");
  const [fAsm, setFAsm] = useState("");
  const [fSpv, setFSpv] = useState("");

  if (!ready || !data) return <LoadingState />;

  const capableRoles = teamCapableRoles(data);

  const openCreate = () => {
    setEditing(null);
    setError(null);
    const roleId = capableRoles[0]?.id ?? "canvasser";
    setForm(emptyForm(data.branches[0]?.id ?? "", roleId));
    setOpen(true);
  };

  const openEdit = (team: Team) => {
    setEditing(team);
    setError(null);
    setForm({
      name: team.name,
      teamType: team.teamType,
      roleId: team.roleId,
      branchId: team.branchId,
      typeSales: team.typeSales,
      members: team.members.map((m) => ({ ...m })),
      active: team.active,
    });
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditing(null);
    setForm(null);
    setError(null);
  };

  const setRoleId = (roleId: string) => {
    if (!form) return;
    setForm({
      ...form,
      roleId,
      teamType: teamTypeForRoleId(roleId),
      members: form.members.map((m) => ({ ...m, employeeId: "" })),
    });
  };

  const updateMember = (index: number, patch: Partial<TeamMember>) => {
    if (!form) return;
    const members = form.members.map((m, i) =>
      i === index ? { ...m, ...patch } : m,
    );
    setForm({ ...form, members });
  };

  const addMember = () => {
    if (!form) return;
    const used = new Set(form.members.map((m) => m.position));
    const nextPos =
      TEAM_MEMBER_POSITIONS.find((p) => !used.has(p.value))?.value ?? "other";
    setForm({
      ...form,
      members: [...form.members, { employeeId: "", position: nextPos }],
    });
  };

  const removeMember = (index: number) => {
    if (!form || form.members.length <= 1) return;
    setForm({
      ...form,
      members: form.members.filter((_, i) => i !== index),
    });
  };

  const eligibleEmployees = (memberIndex: number) => {
    if (!form) return [];
    const currentId = form.members[memberIndex]?.employeeId;
    return data.employees.filter((e) => {
      if (!e.active) return false;
      if (e.roleId !== form.roleId) return false;
      if (e.id === currentId) return true;
      if (
        form.members.some((m, i) => i !== memberIndex && m.employeeId === e.id)
      ) {
        return false;
      }
      const other = employeeAssignedTeamId(data, e.id, editing?.id);
      return !other;
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;

    const members = form.members.filter((m) => m.employeeId);
    const validation = validateTeamMembers(
      data,
      members,
      editing?.id,
      form.roleId,
    );
    if (validation) {
      setError(validation);
      return;
    }
    if (!form.name.trim()) {
      setError("Nama tim wajib diisi");
      return;
    }

    const payload: Omit<Team, "id"> = {
      ...form,
      name: form.name.trim(),
      teamType: teamTypeForRoleId(form.roleId),
      members,
    };

    if (editing) {
      update("teams", { ...editing, ...payload });
    } else {
      create("teams", { id: generateId("team"), ...payload });
    }

    // Sync workforceMode=team for members
    for (const m of members) {
      const emp = data.employees.find((e) => e.id === m.employeeId);
      if (emp && emp.workforceMode !== "team") {
        update("employees", { ...emp, workforceMode: "team" });
      }
    }

    close();
  };

  const positionLabel = (pos: EmployeePosition) =>
    TEAM_MEMBER_POSITIONS.find((p) => p.value === pos)?.label ?? pos;

  const roleName = (roleId: string) =>
    data.roles.find((r) => r.id === roleId)?.name ?? roleId;

  // --- Struktur organisasi: atasan tim diturunkan dari atasan salesman ---
  const supNodeOf = (team: Team) => teamSupervisorNodeId(team, data.employees);
  const chainOf = (team: Team) =>
    supervisorChain(supNodeOf(team), data.orgNodes);
  const nodeName = (n?: OrgNode) => (n ? orgNodeName(n, data.employees) : "—");

  const shownTeams = data.teams.filter((t) => {
    const c = chainOf(t);
    if (fRsm && c.rsm?.id !== fRsm) return false;
    if (fAsm && c.asm?.id !== fAsm) return false;
    if (fSpv && c.spv?.id !== fSpv) return false;
    return true;
  });

  const nodeOptions = (level: OrgNode["level"], emptyLabel: string) => [
    { value: "", label: emptyLabel },
    ...data.orgNodes
      .filter((n) => n.level === level)
      .map((n) => ({
        value: n.id,
        label: `${nodeName(n)}${n.cabang ? ` (${n.cabang})` : ""}`,
      })),
  ];

  const teamsByNode = new Map<string, Team[]>();
  const noSupervisor: Team[] = [];
  for (const t of shownTeams) {
    const id = supNodeOf(t);
    if (id && data.orgNodes.some((n) => n.id === id)) {
      teamsByNode.set(id, [...(teamsByNode.get(id) ?? []), t]);
    } else {
      noSupervisor.push(t);
    }
  }
  const childNodes = (id: string) =>
    data.orgNodes.filter((n) => n.parentId === id);
  const teamCountUnder = (id: string): number =>
    (teamsByNode.get(id)?.length ?? 0) +
    childNodes(id).reduce((n, c) => n + teamCountUnder(c.id), 0);

  const renderTeamChips = (team: Team) => (
    <li
      key={team.id}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs"
    >
      <span className="font-semibold">{team.name}</span>
      <span className="badge bg-[var(--surface-muted)]">{team.teamType}</span>
      {team.members.map((m) => (
        <span
          key={`${m.employeeId}-${m.position}`}
          className="text-[var(--text-muted)]"
        >
          {positionLabel(m.position)}:{" "}
          {data.employees.find((e) => e.id === m.employeeId)?.name ?? "?"}
        </span>
      ))}
      <button
        type="button"
        className="btn-secondary ml-auto px-2 py-0.5 text-xs"
        onClick={() => openEdit(team)}
      >
        Edit
      </button>
    </li>
  );

  const renderStructureNode = (node: OrgNode) => {
    const count = teamCountUnder(node.id);
    if (count === 0) return null;
    const own = teamsByNode.get(node.id) ?? [];
    const levelStyle =
      node.level === "RSM"
        ? "bg-[var(--text)] text-white"
        : node.level === "ASM"
          ? "bg-[var(--action)] text-[var(--on-action)]"
          : "bg-amber-100 text-amber-900";
    return (
      <details key={node.id} open={node.level !== "LEADER"} className="mt-2">
        <summary className="flex cursor-pointer flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
          <span className={`badge ${levelStyle}`}>{node.title}</span>
          <span className="font-semibold">{nodeName(node)}</span>
          <span className="text-xs text-[var(--text-muted)]">
            {node.cabang ?? node.area} · {count} tim
          </span>
        </summary>
        <div className="ml-4 border-l border-[var(--border)] pl-4">
          {own.length > 0 && (
            <ul className="mt-2 space-y-1">{own.map(renderTeamChips)}</ul>
          )}
          {childNodes(node.id).map(renderStructureNode)}
        </div>
      </details>
    );
  };

  return (
    <>
      <PageHeader
        title="Master Tim"
        description="Tim untuk role yang mendukung Tim/Opsional (Canvass, Sales, Delivery, dll). Pencapaian/pengiriman diinput per tim, lalu split ke anggota."
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={openCreate}
            disabled={capableRoles.length === 0}
          >
            + Tambah Tim
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          {(
            [
              ["daftar", "Daftar"],
              ["struktur", "Per Struktur"],
            ] as const
          ).map(([id, text]) => (
            <button
              key={id}
              type="button"
              className={view === id ? "btn-primary" : "btn-secondary"}
              onClick={() => setView(id)}
            >
              {text}
            </button>
          ))}
        </div>
        {(
          [
            ["RSM", fRsm, setFRsm, "RSM", "Semua RSM"],
            ["ASM", fAsm, setFAsm, "ASM", "Semua ASM"],
            ["LEADER", fSpv, setFSpv, "SPV / Leader", "Semua SPV"],
          ] as const
        ).map(([level, value, setter, label, empty]) => (
          <div key={level} className="min-w-[180px]">
            <label className="label">{label}</label>
            <Select2
              value={value}
              onChange={setter}
              options={nodeOptions(level, empty)}
            />
          </div>
        ))}
        <p className="pb-2 text-sm text-[var(--text-muted)]">
          {shownTeams.length} dari {data.teams.length} tim
        </p>
      </div>

      {view === "struktur" && (
        <div className="card p-4">
          {data.orgNodes
            .filter((n) => n.level === "RSM")
            .map(renderStructureNode)}
          {noSupervisor.length > 0 && (
            <details open className="mt-4">
              <summary className="cursor-pointer rounded-lg border border-dashed border-[var(--border)] px-3 py-2 font-semibold text-[var(--text-muted)]">
                Tanpa atasan · {noSupervisor.length} tim
              </summary>
              <ul className="ml-4 mt-2 space-y-1">
                {noSupervisor.map(renderTeamChips)}
              </ul>
            </details>
          )}
        </div>
      )}

      <div
        className={`card overflow-x-auto ${view === "struktur" ? "hidden" : ""}`}
      >
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-3 text-left">Nama Tim</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Tipe</th>
              <th className="px-4 py-3 text-left">Cabang</th>
              <th className="px-4 py-3 text-left">SPV</th>
              <th className="px-4 py-3 text-left">ASM</th>
              <th className="px-4 py-3 text-left">RSM</th>
              <th className="px-4 py-3 text-left">Anggota</th>
              <th className="px-4 py-3 text-center">Ukuran</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {shownTeams.map((team) => {
              const chain = chainOf(team);
              const branch = data.branches.find((b) => b.id === team.branchId);
              return (
                <tr key={team.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium">{team.name}</td>
                  <td className="px-4 py-3">{roleName(team.roleId)}</td>
                  <td className="px-4 py-3">{team.teamType}</td>
                  <td className="px-4 py-3">{branch?.name ?? team.branchId}</td>
                  <td className="px-4 py-3 text-xs">{nodeName(chain.spv)}</td>
                  <td className="px-4 py-3 text-xs">{nodeName(chain.asm)}</td>
                  <td className="px-4 py-3 text-xs">{nodeName(chain.rsm)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {team.members.map((m) => {
                        const emp = data.employees.find(
                          (e) => e.id === m.employeeId,
                        );
                        return (
                          <span
                            key={`${m.employeeId}-${m.position}`}
                            className="badge border border-[var(--border)] bg-white text-[10px]"
                          >
                            {positionLabel(m.position)}: {emp?.name ?? "?"}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {team.members.length} org
                  </td>
                  <td className="px-4 py-3 text-center">
                    {team.active ? (
                      <span className="badge bg-[var(--success)]/10 text-[var(--success)]">
                        Aktif
                      </span>
                    ) : (
                      <span className="badge bg-[var(--surface-muted)]">
                        Nonaktif
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="btn-secondary mr-1 px-2 py-1 text-xs"
                      onClick={() => openEdit(team)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger px-2 py-1 text-xs"
                      onClick={() => {
                        if (confirm(`Hapus tim "${team.name}"?`))
                          remove("teams", team.id);
                      }}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              );
            })}
            {shownTeams.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="px-4 py-8 text-center text-[var(--text-muted)]"
                >
                  Tidak ada tim untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open && form !== null}
        title={editing ? "Edit Tim" : "Tambah Tim"}
        onClose={close}
      >
        {form && (
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            {editing && (
              <p className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-muted)]">
                Atasan (dari Struktur Organisasi):{" "}
                <strong>
                  SPV {nodeName(chainOf(editing).spv)} · ASM{" "}
                  {nodeName(chainOf(editing).asm)} · RSM{" "}
                  {nodeName(chainOf(editing).rsm)}
                </strong>
                . Ubah lewat /karyawan atau /organisasi.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Nama Tim</label>
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
                  onChange={setRoleId}
                  options={capableRoles.map((r) => ({
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
              <div className="sm:col-span-2">
                <label className="label">
                  TYPE SALES (label di Output Insentif)
                </label>
                <input
                  className="input"
                  value={form.typeSales ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, typeSales: e.target.value || undefined })
                  }
                  placeholder="mis. 3 Orang, TO, SE, MTC, KAE — kosong = otomatis"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) =>
                      setForm({ ...form, active: e.target.checked })
                    }
                  />
                  Tim aktif
                </label>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="label mb-0">Anggota</p>
                <button
                  type="button"
                  className="btn-secondary px-2 py-1 text-xs"
                  onClick={addMember}
                >
                  + Anggota
                </button>
              </div>
              <div className="space-y-3">
                {form.members.map((member, index) => (
                  <div
                    key={index}
                    className="grid gap-2 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[1fr_1fr_auto]"
                  >
                    <div>
                      <label className="label">Posisi</label>
                      <Select2
                        value={member.position}
                        onChange={(v) =>
                          updateMember(index, {
                            position: v as EmployeePosition,
                          })
                        }
                        options={TEAM_MEMBER_POSITIONS.map((p) => ({
                          value: p.value,
                          label: p.label,
                        }))}
                      />
                    </div>
                    <div>
                      <label className="label">Karyawan</label>
                      <Select2
                        value={member.employeeId}
                        onChange={(v) => updateMember(index, { employeeId: v })}
                        options={eligibleEmployees(index).map((e) => ({
                          value: e.id,
                          label: `${e.name} (${e.nik})`,
                        }))}
                        placeholder="Pilih karyawan"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        className="btn-danger px-2 py-2 text-xs"
                        disabled={form.members.length <= 1}
                        onClick={() => removeMember(index)}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Hanya karyawan dengan role yang sama. Ukuran tim ={" "}
                {form.members.filter((m) => m.employeeId).length} org — dipakai
                untuk nominal &amp; split.
              </p>
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
