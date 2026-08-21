"use client";

import { Select2 } from "@/components/Select2";
import type { IncentiveScheme, SchemeType, TeamSplit } from "@/types";

const PARAMETER_POSITIONS = [
  { value: "salesman", label: "Salesman" },
  { value: "driver", label: "Driver" },
  { value: "helper1", label: "Helper 1" },
  { value: "helper2", label: "Helper 2" },
  { value: "supervisor", label: "Supervisor" },
  { value: "manager", label: "Manager" },
  { value: "other", label: "Lainnya" },
] as const;

const DELIVERY_POSITIONS = [
  { value: "driver", label: "Driver" },
  { value: "helper1", label: "Helper 1" },
  { value: "helper2", label: "Helper 2" },
] as const;

const PARAMETER_KEY_PRESETS = ["1", "2", "3"];
const DELIVERY_KEY_PRESETS = ["PICKUP", "ENGKEL", "DOUBLE"];

function positionsFor(type: SchemeType) {
  return type === "volumeTier" ? DELIVERY_POSITIONS : PARAMETER_POSITIONS;
}

function keyPresetsFor(type: SchemeType) {
  return type === "volumeTier" ? DELIVERY_KEY_PRESETS : PARAMETER_KEY_PRESETS;
}

function keyHint(type: SchemeType): string {
  return type === "volumeTier"
    ? "Key = jenis armada (PICKUP / ENGKEL / DOUBLE)"
    : "Key = ukuran tim (1 / 2 / 3) — mengikuti jumlah anggota Master Tim";
}

function sumSplit(split: Record<string, number>): number {
  return Object.values(split).reduce((s, v) => s + (Number(v) || 0), 0);
}

function formatPct(ratio: number): string {
  const pct = ratio * 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

/** Ringkasan singkat untuk kartu daftar skema */
export function formatTeamSplitsSummary(splits: TeamSplit[]): string {
  if (!splits.length) return "Belum ada pembagian tim";
  return splits
    .map((row) => {
      const parts = Object.entries(row.split)
        .map(([pos, r]) => `${pos} ${formatPct(r)}`)
        .join(" / ");
      return `${row.key}: ${parts}`;
    })
    .join(" · ");
}

function updateSplitAt(
  splits: TeamSplit[],
  index: number,
  patch: Partial<TeamSplit>,
): TeamSplit[] {
  return splits.map((s, i) => (i === index ? { ...s, ...patch } : s));
}

function emptySplit(type: SchemeType, existingKeys: string[]): TeamSplit {
  const presets = keyPresetsFor(type);
  const key =
    presets.find((k) => !existingKeys.includes(k)) ??
    (type === "volumeTier" ? "CUSTOM" : String(existingKeys.length + 1));

  if (type === "volumeTier") {
    if (key === "PICKUP") return { key, split: { driver: 1 } };
    if (key === "ENGKEL") return { key, split: { driver: 0.55, helper1: 0.45 } };
    if (key === "DOUBLE") {
      return { key, split: { driver: 0.4, helper1: 0.3, helper2: 0.3 } };
    }
    return { key, split: { driver: 1 } };
  }

  if (key === "3") {
    return { key, split: { salesman: 0.55, driver: 0.225, helper1: 0.225 } };
  }
  if (key === "2") return { key, split: { salesman: 0.7, driver: 0.3 } };
  return { key, split: { salesman: 1 } };
}

export function TeamSplitEditor({
  form,
  setForm,
}: {
  form: IncentiveScheme;
  setForm: (next: IncentiveScheme) => void;
}) {
  const splits = form.teamSplits ?? [];
  const positions = positionsFor(form.type);
  const keyPresets = keyPresetsFor(form.type);

  const setSplits = (teamSplits: TeamSplit[]) =>
    setForm({ ...form, teamSplits });

  const addRow = () => {
    setSplits([...splits, emptySplit(form.type, splits.map((s) => s.key))]);
  };

  const removeRow = (index: number) => {
    setSplits(splits.filter((_, i) => i !== index));
  };

  const setKey = (index: number, key: string) => {
    const next = key.trim();
    if (!next) return;
    setSplits(updateSplitAt(splits, index, { key: next }));
  };

  const setRatio = (index: number, position: string, pctInput: number) => {
    const row = splits[index];
    const ratio = Math.max(0, Math.min(100, pctInput)) / 100;
    setSplits(
      updateSplitAt(splits, index, {
        split: { ...row.split, [position]: ratio },
      }),
    );
  };

  const addPosition = (index: number, position: string) => {
    const row = splits[index];
    if (!position || position in row.split) return;
    setSplits(
      updateSplitAt(splits, index, {
        split: { ...row.split, [position]: 0 },
      }),
    );
  };

  const removePosition = (index: number, position: string) => {
    const row = splits[index];
    const next = { ...row.split };
    delete next[position];
    setSplits(updateSplitAt(splits, index, { split: next }));
  };

  return (
    <fieldset className="rounded-lg border border-[var(--border)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Pembagian Tim
          </legend>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{keyHint(form.type)}</p>
        </div>
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          onClick={addRow}
        >
          + Tambah Aturan
        </button>
      </div>

      <div className="space-y-3">
        {splits.map((row, index) => {
          const total = sumSplit(row.split);
          const totalOk = Math.abs(total - 1) < 0.001;
          const usedPositions = Object.keys(row.split);
          const availablePositions = positions.filter(
            (p) => !usedPositions.includes(p.value),
          );

          return (
            <div
              key={`split-${index}`}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3"
            >
              <div className="mb-3 flex flex-wrap items-end gap-2">
                <div className="min-w-[160px] flex-1">
                  <label className="label">
                    {form.type === "volumeTier"
                      ? "Armada (key)"
                      : "Ukuran Tim (key)"}
                  </label>
                  <Select2
                    size="compact"
                    value={row.key}
                    onChange={(v) => setKey(index, v)}
                    options={[
                      ...keyPresets.map((k) => ({ value: k, label: k })),
                      ...(!keyPresets.includes(row.key)
                        ? [{ value: row.key, label: row.key }]
                        : []),
                    ]}
                  />
                  {form.type !== "volumeTier" && (
                    <input
                      className="input mt-1 py-1 font-[family-name:var(--font-mono)] text-sm"
                      value={row.key}
                      onChange={(e) => setKey(index, e.target.value)}
                      placeholder="Atau ketik key custom, mis. 4"
                    />
                  )}
                </div>
                <div className="pb-2 text-xs">
                  <span
                    className={
                      totalOk
                        ? "font-medium text-[var(--success)]"
                        : "font-medium text-amber-700"
                    }
                  >
                    Total {formatPct(total)}
                    {!totalOk && " · harus 100%"}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-danger px-2 py-1 text-xs"
                  onClick={() => removeRow(index)}
                >
                  Hapus
                </button>
              </div>

              <div className="space-y-2">
                {usedPositions.map((pos) => (
                  <div
                    key={pos}
                    className="grid grid-cols-[1fr_110px_auto] items-center gap-2"
                  >
                    <span className="text-sm">
                      {positions.find((p) => p.value === pos)?.label ?? pos}
                    </span>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        className="input py-1 pr-7 text-sm"
                        value={Math.round((row.split[pos] ?? 0) * 1000) / 10}
                        onChange={(e) =>
                          setRatio(index, pos, Number(e.target.value))
                        }
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">
                        %
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary px-2 py-1 text-xs"
                      onClick={() => removePosition(index, pos)}
                      disabled={usedPositions.length <= 1}
                      title="Hapus posisi"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {availablePositions.length > 0 && (
                <div className="mt-3 max-w-xs">
                  <label className="label">Tambah posisi</label>
                  <select
                    className="input py-1 text-sm"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) addPosition(index, e.target.value);
                      e.target.value = "";
                    }}
                  >
                    <option value="">Pilih posisi…</option>
                    {availablePositions.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          );
        })}

        {splits.length === 0 && (
          <p className="text-center text-xs text-[var(--text-muted)]">
            Belum ada aturan pembagian. Klik &quot;+ Tambah Aturan&quot; — rasio
            dipakai saat hitung insentif per anggota.
          </p>
        )}
      </div>
    </fieldset>
  );
}
