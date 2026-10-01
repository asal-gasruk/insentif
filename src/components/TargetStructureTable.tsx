"use client";

import { useMemo, useState } from "react";
import { formatTarget } from "@/lib/format-target";
import { createRollup, orgNodeName } from "@/lib/org-rollup";
import type { AppData, OrgNode, ParameterTarget } from "@/types";

interface Props {
  data: AppData;
  period: string;
  branchId: string;
  paramIds: string[];
  onEditTarget: (row: ParameterTarget) => void;
}

interface Row {
  key: string;
  kind: "node" | "team" | "employee";
  depth: number;
  node?: OrgNode;
  subjectId?: string;
  label: string;
  sub: string;
  expandable: boolean;
}

const LEVEL_STYLE: Record<OrgNode["level"], string> = {
  RSM: "bg-[var(--text)] text-white",
  ASM: "bg-[var(--action)] text-[var(--on-action)]",
  LEADER: "bg-amber-100 text-amber-900",
};

/** Tabel pohon target: Tim/Individu (input) → SPV → ASM → RSM (Σ otomatis dari bawahan). */
export function TargetStructureTable({
  data,
  period,
  branchId,
  paramIds,
  onEditTarget,
}: Props) {
  const rollup = useMemo(
    () => createRollup(data, { period, branchId: branchId || undefined }),
    [data, period, branchId],
  );
  const [expanded, setExpanded] = useState<Set<string>>(
    () =>
      new Set(
        data.orgNodes.filter((n) => n.level !== "LEADER").map((n) => n.id),
      ),
  );

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const params = paramIds.map((id) =>
    data.parameters.find((p) => p.id === id)!,
  );

  const rows = useMemo(() => {
    const out: Row[] = [];
    const childrenOf = (id: string) =>
      data.orgNodes.filter((n) => n.parentId === id);

    const walk = (node: OrgNode, depth: number) => {
      const teamIds = rollup.teamIdsUnder(node.id);
      const leaves = rollup.leavesOf(node.id);
      const kids = childrenOf(node.id);
      if (node.level === "LEADER" && teamIds.length + leaves.length === 0)
        return;
      out.push({
        key: node.id,
        kind: "node",
        depth,
        node,
        label: orgNodeName(node, data.employees),
        sub: `${node.cabang ?? node.area} · ${teamIds.length} tim`,
        expandable: kids.length + leaves.length > 0,
      });
      if (!expanded.has(node.id)) return;
      for (const leaf of leaves) {
        const label =
          leaf.kind === "team"
            ? (data.teams.find((t) => t.id === leaf.subjectId)?.name ??
              leaf.subjectId)
            : (data.employees.find((e) => e.id === leaf.subjectId)?.name ??
              leaf.subjectId);
        out.push({
          key: `${leaf.kind}-${leaf.subjectId}`,
          kind: leaf.kind,
          depth: depth + 1,
          subjectId: leaf.subjectId,
          label,
          sub: leaf.kind === "team" ? "Tim" : "Individu",
          expandable: false,
        });
      }
      for (const kid of kids) walk(kid, depth + 1);
    };

    for (const root of data.orgNodes.filter((n) => n.level === "RSM")) {
      walk(root, 0);
    }
    return out;
  }, [data, rollup, expanded]);

  const expandAll = () => setExpanded(new Set(data.orgNodes.map((n) => n.id)));
  const collapseAll = () =>
    setExpanded(
      new Set(data.orgNodes.filter((n) => n.level === "RSM").map((n) => n.id)),
    );

  if (!period) {
    return (
      <p className="card p-6 text-sm text-[var(--text-muted)]">
        Pilih satu periode untuk melihat rollup per struktur.
      </p>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <p className="text-xs text-[var(--text-muted)]">
          Baris{" "}
          <span className="badge bg-sky-100 text-sky-800">Σ otomatis</span>{" "}
          dijumlahkan dari bawahan (unit SKU dan % memakai rata-rata). Klik
          angka tim/individu untuk mengedit.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary px-3 py-1"
            onClick={expandAll}
          >
            Buka semua
          </button>
          <button
            type="button"
            className="btn-secondary px-3 py-1"
            onClick={collapseAll}
          >
            Tutup semua
          </button>
        </div>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface-muted)]">
            <tr>
              <th className="min-w-[280px] px-4 py-3 text-left">Struktur</th>
              {params.map((p) => (
                <th
                  key={p.id}
                  className="px-4 py-3 text-right whitespace-nowrap"
                >
                  {p.shortLabel ?? p.name}
                  <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">
                    ({p.unit})
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isNode = row.kind === "node";
              return (
                <tr
                  key={row.key}
                  className={`border-t border-[var(--border)] ${
                    isNode ? "bg-[var(--surface-muted)]/60" : ""
                  }`}
                >
                  <td className="px-4 py-2">
                    <div
                      className="flex items-center gap-2"
                      style={{ paddingLeft: row.depth * 18 }}
                    >
                      {row.expandable ? (
                        <button
                          type="button"
                          className="w-4 text-xs text-[var(--text-muted)]"
                          onClick={() => toggle(row.key)}
                          aria-label="Buka/tutup"
                        >
                          {expanded.has(row.key) ? "▾" : "▸"}
                        </button>
                      ) : (
                        <span className="w-4" />
                      )}
                      {row.node && (
                        <span
                          className={`badge ${LEVEL_STYLE[row.node.level]}`}
                        >
                          {row.node.title}
                        </span>
                      )}
                      <span className={isNode ? "font-semibold" : ""}>
                        {row.label}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {row.sub}
                      </span>
                    </div>
                  </td>
                  {params.map((p) => {
                    if (row.node) {
                      const cell = rollup.valueOf(row.node.id, p.id);
                      return (
                        <td
                          key={p.id}
                          className="px-4 py-2 text-right font-[family-name:var(--font-mono)] text-xs font-semibold"
                        >
                          {cell.value === null ? (
                            <span className="text-[var(--text-muted)]">—</span>
                          ) : (
                            <>
                              {formatTarget(cell.value, p.unit)}
                              {cell.mode === "avg" && (
                                <span className="ml-1 font-normal text-[var(--text-muted)]">
                                  rata²
                                </span>
                              )}
                            </>
                          )}
                        </td>
                      );
                    }
                    const target = rollup.targetOf(row.subjectId!, p.id);
                    return (
                      <td
                        key={p.id}
                        className="px-4 py-2 text-right font-[family-name:var(--font-mono)] text-xs"
                      >
                        {target ? (
                          <button
                            type="button"
                            className="underline-offset-2 hover:underline"
                            onClick={() => onEditTarget(target)}
                          >
                            {formatTarget(target.target, p.unit)}
                          </button>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={params.length + 1}
                  className="px-4 py-8 text-center text-[var(--text-muted)]"
                >
                  Tidak ada data untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
