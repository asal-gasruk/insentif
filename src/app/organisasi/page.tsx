"use client";

import { FormEvent, useState } from "react";
import { LoadingState } from "@/components/LoadingState";
import { Modal } from "@/components/Modal";
import { OrgDiagram } from "@/components/OrgDiagram";
import { PageHeader } from "@/components/PageHeader";
import { Select2 } from "@/components/Select2";
import { useAppData } from "@/hooks/useAppData";
import type { AppData, Employee, OrgNode } from "@/types";

const LEVEL_STYLE: Record<OrgNode["level"], string> = {
  RSM: "bg-[var(--text)] text-white",
  ASM: "bg-[var(--action)] text-[var(--on-action)]",
  LEADER: "bg-amber-100 text-amber-900",
};

function nodeLabel(
  node: OrgNode,
  data: AppData,
): { name: string; vacant: boolean } {
  const emp = node.employeeId
    ? data.employees.find((e) => e.id === node.employeeId)
    : undefined;
  const name = emp?.name ?? node.name;
  return { name: name || "Vacant", vacant: !name };
}

export default function OrganisasiPage() {
  const { data, ready, update } = useAppData();
  const [area, setArea] = useState("");
  const [cabang, setCabang] = useState("");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"diagram" | "daftar">("diagram");
  const [editing, setEditing] = useState<OrgNode | null>(null);
  const [form, setForm] = useState({ name: "", employeeId: "" });

  if (!ready || !data) return <LoadingState />;

  const areas = data.orgNodes
    .filter((n) => n.level === "ASM")
    .map((n) => n.area);
  const cabangs = Array.from(
    new Set(
      data.orgNodes
        .filter((n) => n.level === "LEADER" && n.cabang)
        .filter((n) => !area || n.area === area)
        .map((n) => n.cabang as string),
    ),
  ).sort();
  const q = search.trim().toLowerCase();

  const reportsOf = (node: OrgNode): Employee[] =>
    data.employees.filter(
      (e) => e.supervisorNodeId === node.id && e.id !== node.employeeId,
    );

  const childrenOf = (id: string) =>
    data.orgNodes.filter((n) => n.parentId === id);

  /** Total orang di bawah node (rekursif, termasuk leader & bawahannya). */
  const totalOf = (node: OrgNode): number =>
    reportsOf(node).length +
    childrenOf(node.id).reduce((n, k) => n + totalOf(k), 0);

  const roots = data.orgNodes.filter((n) => n.level === "RSM");

  const matchesFilter = (node: OrgNode): boolean => {
    if (area && node.area !== area) return false;
    if (node.level === "LEADER" && cabang && node.cabang !== cabang)
      return false;
    if (!q) return true;
    const self = nodeLabel(node, data).name.toLowerCase().includes(q);
    return (
      self || reportsOf(node).some((e) => e.name.toLowerCase().includes(q))
    );
  };

  /** Node tampil jika lolos filter, atau punya turunan yang lolos. */
  const visible = (node: OrgNode): boolean => {
    if (node.level === "LEADER") return matchesFilter(node);
    const filtering = Boolean(area || cabang || q);
    if (node.level === "RSM") {
      return !filtering || childrenOf(node.id).some(visible);
    }
    // ASM: node.area = nama area; RSM.area = nama region (tidak dicocokkan)
    if (area && node.area !== area) return false;
    return !(cabang || q) || childrenOf(node.id).some(visible);
  };

  const openEdit = (node: OrgNode) => {
    setEditing(node);
    setForm({ name: node.name, employeeId: node.employeeId ?? "" });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    update("orgNodes", {
      ...editing,
      name: form.employeeId ? "" : form.name.trim(),
      employeeId: form.employeeId || undefined,
      needsReview: false,
    });
    setEditing(null);
  };

  const renderReports = (node: OrgNode) => {
    const list = reportsOf(node).filter(
      (e) =>
        !q ||
        e.name.toLowerCase().includes(q) ||
        nodeLabel(node, data).name.toLowerCase().includes(q),
    );
    if (list.length === 0) return null;
    return (
      <ul className="mt-2 grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs"
          >
            <span className="truncate font-medium">{e.name}</span>
            <span className="shrink-0 text-[var(--text-muted)]">
              {data.roles.find((r) => r.id === e.roleId)?.name.split(" (")[0]} ·{" "}
              {e.position}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  const renderNode = (node: OrgNode) => {
    if (!visible(node)) return null;
    const { name, vacant } = nodeLabel(node, data);
    const kids = childrenOf(node.id);
    const total = totalOf(node);
    return (
      <details key={node.id} open={node.level !== "LEADER"} className="mt-2">
        <summary className="flex cursor-pointer flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
          <span className={`badge ${LEVEL_STYLE[node.level]}`}>
            {node.title}
          </span>
          <span
            className={`font-semibold ${vacant ? "italic text-[var(--text-muted)]" : ""}`}
          >
            {name}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {node.level === "LEADER" ? node.cabang : node.area} · {total} org
          </span>
          {node.needsReview && (
            <span
              className="badge bg-amber-100 text-amber-800"
              title={node.note}
            >
              perlu cek
            </span>
          )}
          <button
            type="button"
            className="btn-secondary ml-auto px-3 py-1"
            onClick={(ev) => {
              ev.preventDefault();
              openEdit(node);
            }}
          >
            Isi / Ubah
          </button>
        </summary>
        <div className="ml-4 border-l border-[var(--border)] pl-4">
          {renderReports(node)}
          {kids.map(renderNode)}
        </div>
      </details>
    );
  };

  return (
    <>
      <PageHeader
        title="Struktur Organisasi"
        description="RSM → ASM → SPV/Leader → Salesman & tim. RSM/ASM mengikuti tabel struktur per area; leader dibaca dari font kuning sheet Sales Team SFA. Nama bisa diubah lewat tombol Isi / Ubah."
      />

      <>
        <div className="mb-4 flex gap-2">
          {(
            [
              ["diagram", "Diagram"],
              ["daftar", "Daftar"],
            ] as const
          ).map(([id, text]) => (
            <button
              key={id}
              type="button"
              className={mode === id ? "btn-primary" : "btn-secondary"}
              onClick={() => setMode(id)}
            >
              {text}
            </button>
          ))}
        </div>
        <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-3">
          <div>
            <label className="label">Area</label>
            <Select2
              value={area}
              onChange={(v) => {
                setArea(v);
                setCabang("");
              }}
              options={[
                { value: "", label: "Semua area" },
                ...areas.map((a) => ({ value: a, label: a })),
              ]}
            />
          </div>
          <div>
            <label className="label">Cabang</label>
            <Select2
              value={cabang}
              onChange={setCabang}
              options={[
                { value: "", label: "Semua cabang" },
                ...cabangs.map((c) => ({ value: c, label: c })),
              ]}
            />
          </div>
          <div>
            <label className="label">Cari nama</label>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nama leader / karyawan"
            />
          </div>
        </div>
        {mode === "diagram" ? (
          <OrgDiagram
            roots={roots}
            childrenOf={childrenOf}
            visible={visible}
            label={(n) => nodeLabel(n, data)}
            reports={reportsOf}
            total={totalOf}
            roleName={(id) =>
              data.roles.find((r) => r.id === id)?.name.split(" (")[0] ?? id
            }
            onEdit={openEdit}
          />
        ) : (
          <div className="card p-4">{roots.map(renderNode)}</div>
        )}
      </>

      <Modal
        open={editing !== null}
        title={editing ? `${editing.title} · ${editing.area}` : ""}
        onClose={() => setEditing(null)}
      >
        <form onSubmit={submit} className="grid gap-4">
          <div>
            <label className="label">Pilih dari Karyawan</label>
            <Select2
              value={form.employeeId}
              onChange={(v) => setForm({ ...form, employeeId: v })}
              options={[
                { value: "", label: "— tidak ada / isi manual —" },
                ...data.employees.map((e) => ({
                  value: e.id,
                  label: `${e.name} (${e.nik || "tanpa NIK"})`,
                })),
              ]}
            />
          </div>
          {!form.employeeId && (
            <div>
              <label className="label">Nama manual (kosong = Vacant)</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setEditing(null)}
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
