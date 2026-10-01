"use client";

import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Employee, OrgNode } from "@/types";

const CARD_W = 248;
const CARD_H = 84;
const H_GAP = 20;
const V_GAP = 72;
const M_H = 30;
const M_GAP = 6;
const M_TOP = 14;
/** Baris maksimum tumpukan di samping node yang punya anak (ASM) */
const SIDE_ROWS = Math.floor((CARD_H + V_GAP - 10) / (M_H + M_GAP));
const MIN_SCALE = 0.2;
const MAX_SCALE = 1.6;

interface Props {
  roots: OrgNode[];
  childrenOf: (id: string) => OrgNode[];
  visible: (node: OrgNode) => boolean;
  label: (node: OrgNode) => { name: string; vacant: boolean };
  reports: (node: OrgNode) => Employee[];
  total: (node: OrgNode) => number;
  roleName: (roleId: string) => string;
  onEdit: (node: OrgNode) => void;
}

interface Placed {
  node: OrgNode;
  cx: number;
  y: number;
  parent?: Placed;
  /** Bawahan langsung yang digambar sebagai kartu kecil */
  members: Employee[];
  /** below = di bawah kartu (leader); side = di samping kanan (node yang punya anak) */
  stack: "below" | "side";
  /** Jumlah bawahan yang tidak muat (hanya mode side) */
  extra: number;
}

interface Layout {
  placed: Placed[];
  width: number;
  height: number;
}

const LEVEL_COLOR: Record<OrgNode["level"], string> = {
  RSM: "#f4f4f5",
  ASM: "#fac300",
  LEADER: "#fde68a",
};

/** "KEY ACCOUNT SUPERVISOR" → "KAS"; singkatan pendek dipakai apa adanya. */
function abbr(title: string): string {
  const t = title.trim();
  if (t.length <= 4) return t.toUpperCase();
  return t
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

const POS_ORDER = ["salesman", "driver", "helper1", "helper2"];
const POS_LABEL: Record<string, string> = {
  salesman: "Salesman",
  driver: "Driver",
  helper1: "Helper",
  helper2: "Helper",
};

function sortMembers(list: Employee[]): Employee[] {
  const rank = (e: Employee) => {
    const i = POS_ORDER.indexOf(e.position);
    return i === -1 ? POS_ORDER.length : i;
  };
  return [...list].sort(
    (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name),
  );
}

/** Posisi kartu kecil + garis tulang punggung untuk satu node. */
function stackGeometry(p: Placed) {
  const shown = p.extra ? p.members.slice(0, SIDE_ROWS - 1) : p.members;
  const rows = shown.length + (p.extra ? 1 : 0);
  if (rows === 0) return null;
  const below = p.stack === "below";
  const x0 = below ? p.cx - CARD_W / 2 + 10 : p.cx + CARD_W / 2 + 10;
  const w = below ? CARD_W - 22 : 190;
  const top = below ? p.y + CARD_H + M_TOP : p.y;
  const items = Array.from({ length: rows }, (_, i) => ({
    x: x0 + 12,
    y: top + i * (M_H + M_GAP),
    w,
  }));
  const startY = below ? p.y + CARD_H : p.y + CARD_H / 2;
  const startX = below ? x0 : p.cx + CARD_W / 2;
  const lastMid = items[rows - 1].y + M_H / 2;
  const path = below
    ? `M${x0},${startY} V${lastMid} ` +
      items.map((it) => `M${x0},${it.y + M_H / 2} H${it.x}`).join(" ")
    : `M${startX},${startY} H${x0} V${lastMid} ` +
      items.map((it) => `M${x0},${it.y + M_H / 2} H${it.x}`).join(" ");
  return { shown, items, path, bottom: items[rows - 1].y + M_H };
}

function computeLayout(
  roots: OrgNode[],
  childrenOf: (id: string) => OrgNode[],
  visible: (n: OrgNode) => boolean,
  reports: (n: OrgNode) => Employee[],
): Layout {
  interface T {
    node: OrgNode;
    kids: T[];
    w: number;
  }
  const build = (node: OrgNode): T => {
    const kids = childrenOf(node.id).filter(visible).map(build);
    const kidsW =
      kids.reduce((n, k) => n + k.w, 0) + H_GAP * Math.max(0, kids.length - 1);
    return { node, kids, w: Math.max(CARD_W, kidsW) };
  };
  const trees = roots.filter(visible).map(build);
  const placed: Placed[] = [];
  let maxDepth = 0;

  const place = (t: T, left: number, depth: number, parent?: Placed) => {
    maxDepth = Math.max(maxDepth, depth);
    const me: Placed = {
      node: t.node,
      cx: left + t.w / 2,
      y: depth * (CARD_H + V_GAP),
      parent,
      members: sortMembers(reports(t.node)),
      stack: t.kids.length === 0 ? "below" : "side",
      extra: 0,
    };
    if (me.stack === "side" && me.members.length > SIDE_ROWS) {
      me.extra = me.members.length - (SIDE_ROWS - 1);
    }
    placed.push(me);
    const kidsW =
      t.kids.reduce((n, k) => n + k.w, 0) +
      H_GAP * Math.max(0, t.kids.length - 1);
    let x = left + (t.w - kidsW) / 2;
    for (const k of t.kids) {
      place(k, x, depth + 1, me);
      x += k.w + H_GAP;
    }
  };

  let cursor = 0;
  for (const t of trees) {
    place(t, cursor, 0);
    cursor += t.w + H_GAP * 3;
  }
  const baseHeight = (maxDepth + 1) * CARD_H + maxDepth * V_GAP;
  const stackBottom = placed.reduce(
    (m, p) => Math.max(m, stackGeometry(p)?.bottom ?? 0),
    0,
  );
  return {
    placed,
    width: Math.max(CARD_W, cursor - H_GAP * 3),
    height: Math.max(baseHeight, stackBottom),
  };
}

export function OrgDiagram({
  roots,
  childrenOf,
  visible,
  label,
  reports,
  total,
  roleName,
  onEdit,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 20, y: 40, k: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const drag = useRef<{
    px: number;
    py: number;
    vx: number;
    vy: number;
  } | null>(null);

  const layout = useMemo(
    () => computeLayout(roots, childrenOf, visible, reports),
    [roots, childrenOf, visible, reports],
  );

  const fit = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    const k = Math.min(
      1,
      Math.max(MIN_SCALE, (box.clientWidth - 48) / layout.width),
      (box.clientHeight - 80) / layout.height,
    );
    const scale = Math.max(MIN_SCALE, k);
    setView({
      k: scale,
      x: Math.max(24, (box.clientWidth - layout.width * scale) / 2),
      y: 48,
    });
  }, [layout.width, layout.height]);

  useEffect(() => {
    fit();
  }, [fit]);

  // Zoom roda mouse di sekitar kursor (listener non-passive agar bisa preventDefault)
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = box.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setView((v) => {
        const k = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, v.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1)),
        );
        const r = k / v.k;
        return { k, x: mx - (mx - v.x) * r, y: my - (my - v.y) * r };
      });
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (f: number) =>
    setView((v) => ({
      ...v,
      k: Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.k * f)),
    }));

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-card],[data-ui]")) return;
    drag.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setView((v) => ({
      ...v,
      x: d.vx + e.clientX - d.px,
      y: d.vy + e.clientY - d.py,
    }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const renderStack = (p: Placed) => {
    const geo = stackGeometry(p);
    if (!geo) return null;
    return (
      <>
        {geo.shown.map((e, i) => (
          <div
            key={e.id}
            className="absolute flex items-center justify-between gap-2 rounded-lg border border-[#2e2e32] bg-[#1a1a1c] px-2.5"
            style={{
              left: geo.items[i].x,
              top: geo.items[i].y,
              width: geo.items[i].w,
              height: M_H,
            }}
          >
            <span className="truncate text-[12px] font-medium text-zinc-100">
              {e.name}
            </span>
            <span className="shrink-0 text-[10px] text-zinc-500">
              {POS_LABEL[e.position] ?? roleName(e.roleId)}
            </span>
          </div>
        ))}
        {p.extra > 0 && (
          <div
            className="absolute flex items-center rounded-lg border border-dashed border-[#3f3f46] px-2.5 text-[11px] text-zinc-500"
            style={{
              left: geo.items[geo.items.length - 1].x,
              top: geo.items[geo.items.length - 1].y,
              width: geo.items[geo.items.length - 1].w,
              height: M_H,
            }}
          >
            +{p.extra} lainnya (klik kartu)
          </div>
        )}
      </>
    );
  };

  const selected = layout.placed.find((p) => p.node.id === selectedId)?.node;
  const selectedReports = selected ? reports(selected) : [];

  return (
    <div
      ref={boxRef}
      className="relative h-[72vh] min-h-[520px] cursor-grab select-none overflow-hidden rounded-xl border border-[#2a2a2d] bg-[#0f0f10] active:cursor-grabbing"
      style={{
        backgroundImage: "radial-gradient(#2c2c30 1px, transparent 1px)",
        backgroundSize: "18px 18px",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
          transformOrigin: "0 0",
        }}
      >
        <svg
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
          width={layout.width}
          height={layout.height}
        >
          {layout.placed.map((p) => {
            if (!p.parent) return null;
            const x1 = p.parent.cx;
            const y1 = p.parent.y + CARD_H;
            const midY = y1 + V_GAP / 2;
            return (
              <g key={p.node.id}>
                <path
                  d={`M${x1},${y1} V${midY} H${p.cx} V${p.y}`}
                  fill="none"
                  stroke="#3f3f46"
                  strokeWidth={1.5}
                />
                <circle cx={x1} cy={y1} r={2.5} fill="#e4e4e7" />
                <circle cx={p.cx} cy={p.y} r={2.5} fill="#e4e4e7" />
              </g>
            );
          })}
          {layout.placed.map((p) => {
            const geo = stackGeometry(p);
            return geo ? (
              <path
                key={`stack-${p.node.id}`}
                d={geo.path}
                fill="none"
                stroke="#3f3f46"
                strokeWidth={1.5}
              />
            ) : null;
          })}
        </svg>

        {layout.placed.map((p) => {
          const { node } = p;
          const { name, vacant } = label(node);
          const active = node.id === selectedId;
          const pill = node.level === "LEADER" ? node.cabang : undefined;
          return (
            <div key={node.id}>
              {pill && p.parent && (
                <span
                  className="absolute -translate-x-1/2 whitespace-nowrap rounded-md border border-[#3f3f46] bg-[#18181b] px-2 py-0.5 text-[10px] font-medium text-zinc-300"
                  style={{ left: p.cx, top: p.y - V_GAP / 2 - 10 }}
                >
                  {pill}
                </span>
              )}
              <div
                data-card
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(active ? null : node.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSelectedId(active ? null : node.id);
                }}
                className={`absolute cursor-pointer overflow-hidden rounded-xl border bg-[#1a1a1c] shadow-lg transition-colors hover:border-zinc-500 ${
                  active ? "border-[#fac300]" : "border-[#2e2e32]"
                }`}
                style={{
                  left: p.cx - CARD_W / 2,
                  top: p.y,
                  width: CARD_W,
                  height: CARD_H,
                }}
              >
                <div className="flex h-[52px] items-center gap-3 px-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-zinc-900"
                    style={{ background: LEVEL_COLOR[node.level] }}
                  >
                    {abbr(node.title)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-[13px] font-semibold ${
                        vacant ? "italic text-zinc-500" : "text-white"
                      }`}
                    >
                      {name}
                    </p>
                    <p className="truncate text-[11px] text-zinc-400">
                      {node.title}
                    </p>
                  </div>
                </div>
                <div className="flex h-[32px] items-center gap-2 border-t border-[#2e2e32] bg-[#151517] px-3 text-[11px] text-zinc-400">
                  <span
                    className={
                      node.needsReview
                        ? "text-amber-400"
                        : vacant
                          ? "text-zinc-600"
                          : "text-emerald-500"
                    }
                  >
                    {node.needsReview ? "!" : vacant ? "—" : "✓"}
                  </span>
                  <span className="truncate">
                    {node.needsReview
                      ? "Perlu cek"
                      : vacant
                        ? "Vacant"
                        : "Terisi"}{" "}
                    · {total(node)} org
                  </span>
                </div>
              </div>
              {renderStack(p)}
            </div>
          );
        })}
      </div>

      <div data-ui className="absolute bottom-3 left-3 flex gap-1">
        {[
          ["+", () => zoomBy(1.2)],
          ["−", () => zoomBy(1 / 1.2)],
          ["Fit", fit],
        ].map(([txt, fn]) => (
          <button
            key={txt as string}
            type="button"
            onClick={fn as () => void}
            className="rounded-lg border border-[#3f3f46] bg-[#18181b] px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-[#232326]"
          >
            {txt as string}
          </button>
        ))}
        <span className="ml-2 self-center text-[11px] text-zinc-500">
          Geser: drag · Zoom: scroll · Klik kartu leader untuk edit
        </span>
      </div>

      {selected && (
        <aside
          data-ui
          className="absolute right-3 top-3 flex max-h-[calc(100%-24px)] w-72 cursor-default flex-col rounded-xl border border-[#2e2e32] bg-[#18181b] text-zinc-200 shadow-2xl"
        >
          <div className="border-b border-[#2e2e32] p-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">
              {selected.title} · {selected.cabang ?? selected.area}
            </p>
            <p className="mt-0.5 font-semibold text-white">
              {label(selected).name}
            </p>
            {selected.note && (
              <p className="mt-1 text-[11px] text-amber-400">{selected.note}</p>
            )}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(selected)}
                className="rounded-lg bg-[#fac300] px-3 py-1 text-xs font-semibold text-zinc-900 hover:bg-[#e0ad00]"
              >
                Isi / Ubah
              </button>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg border border-[#3f3f46] px-3 py-1 text-xs text-zinc-300"
              >
                Tutup
              </button>
            </div>
          </div>
          <div className="overflow-y-auto p-3">
            <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">
              Bawahan langsung ({selectedReports.length})
            </p>
            {selectedReports.length === 0 && (
              <p className="text-xs text-zinc-500">
                Tidak ada karyawan langsung.
              </p>
            )}
            <ul className="space-y-1">
              {selectedReports.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-[#1f1f22] px-2 py-1 text-xs"
                >
                  <span className="truncate text-zinc-100">{e.name}</span>
                  <span className="shrink-0 text-zinc-500">
                    {roleName(e.roleId)} · {e.position}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}
