"use client";

import { FormEvent, useMemo, useState } from "react";
import { LoadingState } from "@/components/LoadingState";
import { Modal } from "@/components/Modal";
import { NotesPanel } from "@/components/NotesPanel";
import { PageHeader } from "@/components/PageHeader";
import { Select2 } from "@/components/Select2";
import { formatRupiah } from "@/lib/calculator";
import { generateId } from "@/lib/storage";
import { useAppData } from "@/hooks/useAppData";
import type { SchemeNominal, SchemeWeight } from "@/types";

/** Konversi pecahan (0.5) ke angka persen (50), aman dari error floating point */
function toPctNumber(w: number): number {
  return Math.round(w * 10000) / 100;
}

function formatPct(w: number | null | undefined): string {
  if (w === null || w === undefined) return "—";
  return `${toPctNumber(w)}%`;
}

function computeBreakdown(
  weights: Record<string, number | null> | undefined,
  total: number,
): Record<string, number> {
  if (!weights) return {};
  return Object.fromEntries(
    Object.entries(weights)
      .filter(([, w]) => w !== null && w > 0)
      .map(([p, w]) => [p, Math.round(total * (w ?? 0))]),
  );
}

export default function BobotNominalPage() {
  const { data, ready, create, update, remove } = useAppData();
  const [schemeId, setSchemeId] = useState("sch-canvasser");

  const [editingWeight, setEditingWeight] = useState<SchemeWeight | null>(null);
  const [weightForm, setWeightForm] = useState<SchemeWeight | null>(null);

  const [editingNominal, setEditingNominal] = useState<SchemeNominal | null>(
    null,
  );
  const [nominalForm, setNominalForm] = useState<SchemeNominal | null>(null);

  const scheme = data?.schemes.find((s) => s.id === schemeId);

  const weightRows = useMemo(
    () =>
      data ? data.schemeWeights.filter((w) => w.schemeId === schemeId) : [],
    [data, schemeId],
  );

  const nominalRows = useMemo(() => {
    if (!data) return [];
    const tierOrder = new Map(
      data.achievementTiers.map((t, i) => [t.id, i] as const),
    );
    return data.schemeNominals
      .filter((n) => n.schemeId === schemeId)
      .sort(
        (a, b) =>
          a.segmentId.localeCompare(b.segmentId) ||
          a.teamSize - b.teamSize ||
          (tierOrder.get(a.achievementTierId) ?? 0) -
            (tierOrder.get(b.achievementTierId) ?? 0),
      );
  }, [data, schemeId]);

  const usedParamIds = useMemo(() => {
    const ids = new Set<string>();
    weightRows.forEach((r) =>
      Object.entries(r.weights).forEach(([p, w]) => {
        if (w !== null && w > 0) ids.add(p);
      }),
    );
    return ids;
  }, [weightRows]);

  if (!ready || !data || !scheme) return <LoadingState />;

  const parameterSchemes = data.schemes.filter((s) => s.type === "parameter");
  const columns = data.parameters.filter((p) => usedParamIds.has(p.id));

  const weightsOf = (segmentId: string) =>
    weightRows.find((w) => w.segmentId === segmentId)?.weights;

  /** Urutkan entries breakdown mengikuti urutan kolom Bobot (master parameter) */
  const paramOrder = new Map(data.parameters.map((p, i) => [p.id, i] as const));
  const orderedBreakdown = (breakdown: Record<string, number>) =>
    Object.entries(breakdown).sort(
      ([a], [b]) => (paramOrder.get(a) ?? 99) - (paramOrder.get(b) ?? 99),
    );

  // -------------------------------------------------------------------------
  // Bobot
  // -------------------------------------------------------------------------

  const weightSum = weightForm
    ? Object.values(weightForm.weights).reduce<number>(
        (s, v) => s + (v ?? 0),
        0,
      )
    : 0;

  const openCreateWeight = () => {
    const segment =
      scheme.segments.find(
        (sg) => !weightRows.some((r) => r.segmentId === sg.id),
      ) ?? scheme.segments[0];
    setEditingWeight(null);
    setWeightForm({
      id: generateId("w"),
      schemeId: scheme.id,
      segmentId: segment.id,
      weights: {},
    });
  };

  const openEditWeight = (row: SchemeWeight) => {
    setEditingWeight(row);
    setWeightForm(JSON.parse(JSON.stringify(row)) as SchemeWeight);
  };

  const closeWeight = () => {
    setEditingWeight(null);
    setWeightForm(null);
  };

  const setWeightPct = (paramId: string, raw: string) => {
    if (!weightForm) return;
    const weights = { ...weightForm.weights };
    if (raw === "") {
      delete weights[paramId];
    } else {
      const n = parseFloat(raw);
      if (!Number.isNaN(n)) weights[paramId] = n / 100;
    }
    setWeightForm({ ...weightForm, weights });
  };

  const submitWeight = (e: FormEvent) => {
    e.preventDefault();
    if (!weightForm) return;

    if (editingWeight) {
      update("schemeWeights", weightForm);
    } else {
      create("schemeWeights", weightForm);
    }

    // Sinkronkan breakdown nominal segment ini dengan bobot terbaru
    data.schemeNominals
      .filter(
        (n) =>
          n.schemeId === weightForm.schemeId &&
          n.segmentId === weightForm.segmentId,
      )
      .forEach((n) => {
        update("schemeNominals", {
          ...n,
          breakdown: computeBreakdown(weightForm.weights, n.totalNominal),
        });
      });

    closeWeight();
  };

  // -------------------------------------------------------------------------
  // Nominal
  // -------------------------------------------------------------------------

  const openCreateNominal = () => {
    setEditingNominal(null);
    setNominalForm({
      id: generateId("n"),
      schemeId,
      segmentId: scheme.segments[0].id,
      teamSize: 1,
      achievementTierId: "t1",
      totalNominal: 0,
      breakdown: {},
    });
  };

  const openEditNominal = (row: SchemeNominal) => {
    setEditingNominal(row);
    setNominalForm(JSON.parse(JSON.stringify(row)) as SchemeNominal);
  };

  const closeNominal = () => {
    setEditingNominal(null);
    setNominalForm(null);
  };

  const submitNominal = (e: FormEvent) => {
    e.preventDefault();
    if (!nominalForm) return;
    const payload: SchemeNominal = {
      ...nominalForm,
      breakdown: computeBreakdown(
        weightsOf(nominalForm.segmentId),
        nominalForm.totalNominal,
      ),
    };
    if (editingNominal) {
      update("schemeNominals", payload);
    } else {
      create("schemeNominals", payload);
    }
    closeNominal();
  };

  return (
    <>
      <PageHeader
        title="Bobot & Nominal Insentif"
        description="Satu halaman untuk bobot dan nominal. Breakdown nominal selalu dihitung live dari bobot terkini — ubah bobot, hasilnya langsung terlihat di tabel nominal."
      />

      <div className="card mb-4 p-4">
        <label className="label">Skema Insentif</label>
        <Select2
          className="max-w-md"
          value={schemeId}
          onChange={setSchemeId}
          options={parameterSchemes.map((s) => ({
            value: s.id,
            label: `${s.name} (${s.period === "monthly" ? "Bulanan" : "Kuartalan"})`,
          }))}
        />
        {scheme.notes && (
          <NotesPanel text={scheme.notes} title="Catatan Skema" className="mt-3" />
        )}
      </div>

      {/* ---------------- Bobot ---------------- */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-bold">1 · Bobot Parameter</h3>
        <button type="button" className="btn-primary" onClick={openCreateWeight}>
          + Tambah Bobot
        </button>
      </div>

      <div className="card mb-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-3 py-3 text-left">Segment</th>
              {columns.map((p) => (
                <th
                  key={p.id}
                  className="px-2 py-3 text-center text-xs"
                  title={p.name}
                >
                  {p.shortLabel ?? p.id}
                </th>
              ))}
              <th className="px-3 py-3 text-center">Total</th>
              <th className="px-3 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {weightRows.map((row) => {
              const segment = scheme.segments.find(
                (s) => s.id === row.segmentId,
              );
              const total = Object.values(row.weights).reduce<number>(
                (s, v) => s + (v ?? 0),
                0,
              );
              return (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-medium">
                    {segment?.name ?? row.segmentId}
                  </td>
                  {columns.map((p) => (
                    <td
                      key={p.id}
                      className="px-2 py-2 text-center font-[family-name:var(--font-mono)] text-xs"
                    >
                      {formatPct(row.weights[p.id])}
                    </td>
                  ))}
                  <td
                    className={`px-3 py-2 text-center font-semibold ${
                      Math.abs(total - 1) < 0.01
                        ? "text-[var(--success)]"
                        : "text-[var(--accent)]"
                    }`}
                  >
                    {toPctNumber(total)}%
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="btn-secondary mr-1 px-2 py-1 text-xs"
                      onClick={() => openEditWeight(row)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger px-2 py-1 text-xs"
                      onClick={() => {
                        if (confirm("Hapus bobot segment ini?"))
                          remove("schemeWeights", row.id);
                      }}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              );
            })}
            {weightRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 3}
                  className="px-4 py-8 text-center text-[var(--text-muted)]"
                >
                  Belum ada bobot untuk skema ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------------- Nominal ---------------- */}
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="font-bold">2 · Nominal Insentif per Tier</h3>
          <p className="text-xs text-[var(--text-muted)]">
            Breakdown = bobot × total nominal (mengikuti bobot di atas secara
            live)
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreateNominal}>
          + Tambah Nominal
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-3 py-3 text-left">Segment</th>
              <th className="px-3 py-3 text-center">Tim</th>
              <th className="px-3 py-3 text-left">Tier</th>
              <th className="px-3 py-3 text-right">Total Nominal</th>
              <th className="px-3 py-3 text-left">Breakdown (live)</th>
              <th className="px-3 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {nominalRows.map((row) => {
              const segment = scheme.segments.find(
                (s) => s.id === row.segmentId,
              );
              const tier = data.achievementTiers.find(
                (t) => t.id === row.achievementTierId,
              );
              const liveBreakdown = computeBreakdown(
                weightsOf(row.segmentId),
                row.totalNominal,
              );
              const breakdown =
                Object.keys(liveBreakdown).length > 0
                  ? liveBreakdown
                  : row.breakdown;
              return (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">{segment?.name ?? row.segmentId}</td>
                  <td className="px-3 py-2 text-center">{row.teamSize}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{tier?.label}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {formatRupiah(row.totalNominal)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {orderedBreakdown(breakdown).map(([p, v]) => {
                        const param = data.parameters.find((x) => x.id === p);
                        return (
                          <span
                            key={p}
                            className="badge border border-[var(--border)] bg-white text-[10px]"
                          >
                            {param?.shortLabel ?? p}:{" "}
                            {new Intl.NumberFormat("id-ID").format(v)}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="btn-secondary mr-1 px-2 py-1 text-xs"
                      onClick={() => openEditNominal(row)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger px-2 py-1 text-xs"
                      onClick={() => {
                        if (confirm("Hapus nominal ini?"))
                          remove("schemeNominals", row.id);
                      }}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              );
            })}
            {nominalRows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-[var(--text-muted)]"
                >
                  Belum ada nominal untuk skema ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------------- Modal Bobot ---------------- */}
      <Modal
        open={weightForm !== null}
        title={editingWeight ? "Edit Bobot" : "Tambah Bobot"}
        onClose={closeWeight}
      >
        {weightForm && (
          <form onSubmit={submitWeight} className="space-y-4">
            <div>
              <label className="label">Segment ({scheme.name})</label>
              <Select2
                value={weightForm.segmentId}
                onChange={(v) =>
                  setWeightForm({ ...weightForm, segmentId: v })
                }
                options={scheme.segments.map((s) => ({
                  value: s.id,
                  label: s.name,
                }))}
              />
            </div>

            <div>
              <p className="label mb-2">
                Bobot per Parameter dalam % (kosongkan jika tidak dipakai)
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.parameters.map((p) => (
                  <div key={p.id}>
                    <label className="label" title={p.name}>
                      {p.shortLabel ?? p.id}
                    </label>
                    {p.notes && (
                      <p className="mb-1 line-clamp-2 text-[10px] leading-snug text-[var(--text-muted)]">
                        {p.notes}
                      </p>
                    )}
                    <div className="relative">
                      <input
                        type="number"
                        step="5"
                        min="0"
                        max="100"
                        className="input pr-7"
                        placeholder="0"
                        value={
                          weightForm.weights[p.id] !== null &&
                          weightForm.weights[p.id] !== undefined
                            ? toPctNumber(weightForm.weights[p.id]!)
                            : ""
                        }
                        onChange={(e) => setWeightPct(p.id, e.target.value)}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">
                        %
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-4 py-3">
              <span className="text-sm text-[var(--text-muted)]">
                Total bobot
              </span>
              <span
                className={`text-lg font-bold ${
                  Math.abs(weightSum - 1) < 0.01
                    ? "text-[var(--success)]"
                    : "text-[var(--accent)]"
                }`}
              >
                {toPctNumber(weightSum)}%
              </span>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              Saat disimpan, breakdown semua baris nominal segment ini akan
              dihitung ulang otomatis.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeWeight}
              >
                Batal
              </button>
              <button type="submit" className="btn-primary">
                Simpan
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ---------------- Modal Nominal ---------------- */}
      <Modal
        open={nominalForm !== null}
        title={editingNominal ? "Edit Nominal" : "Tambah Nominal"}
        onClose={closeNominal}
      >
        {nominalForm && (
          <form onSubmit={submitNominal} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Segment</label>
                <Select2
                  value={nominalForm.segmentId}
                  onChange={(v) =>
                    setNominalForm({
                      ...nominalForm,
                      segmentId: v,
                    })
                  }
                  options={scheme.segments.map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                />
              </div>
              <div>
                <label className="label">Ukuran Tim</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={nominalForm.teamSize}
                  onChange={(e) =>
                    setNominalForm({
                      ...nominalForm,
                      teamSize: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="label">Tier Pencapaian</label>
                <Select2
                  value={nominalForm.achievementTierId}
                  onChange={(v) =>
                    setNominalForm({
                      ...nominalForm,
                      achievementTierId: v,
                    })
                  }
                  options={data.achievementTiers.map((t) => ({
                    value: t.id,
                    label: t.label,
                  }))}
                />
              </div>
              <div>
                <label className="label">Total Nominal (Rp)</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={nominalForm.totalNominal}
                  onChange={(e) =>
                    setNominalForm({
                      ...nominalForm,
                      totalNominal: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="rounded-lg bg-[var(--surface-muted)] p-3">
              <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">
                Preview breakdown (bobot × total)
              </p>
              <div className="flex flex-wrap gap-1">
                {orderedBreakdown(
                  computeBreakdown(
                    weightsOf(nominalForm.segmentId),
                    nominalForm.totalNominal,
                  ),
                ).map(([p, v]) => {
                  const param = data.parameters.find((x) => x.id === p);
                  return (
                    <span
                      key={p}
                      className="badge border border-[var(--border)] bg-white text-[10px]"
                    >
                      {param?.shortLabel ?? p}:{" "}
                      {new Intl.NumberFormat("id-ID").format(v)}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeNominal}
              >
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
