"use client";

import { useMemo, useState } from "react";
import { Select2 } from "@/components/Select2";
import { formatRupiah } from "@/lib/calculator";
import { outputPeriods } from "@/lib/output-insentif";
import { buildPencairanInsentif } from "@/lib/pencairan-insentif";
import { buildAsmInsentif } from "@/lib/asm-insentif";
import type { AppData } from "@/types";

/** Panel unduh PDF "Pencairan Insentif" (daftar pembayaran per orang, per area). */
export function PencairanInsentifPanel({ data }: { data: AppData }) {
  const periods = useMemo(() => outputPeriods(data), [data]);
  const [period, setPeriod] = useState("");
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePeriod = period || periods[periods.length - 1] || "";
  const full = useMemo(
    () =>
      activePeriod
        ? buildPencairanInsentif(data, { period: activePeriod })
        : null,
    [data, activePeriod],
  );
  const output = useMemo(
    () =>
      activePeriod
        ? buildPencairanInsentif(data, {
            period: activePeriod,
            area: area || undefined,
          })
        : null,
    [data, activePeriod, area],
  );

  const asm = useMemo(
    () =>
      activePeriod
        ? buildAsmInsentif(data, {
            period: activePeriod,
            area: area || undefined,
          })
        : null,
    [data, activePeriod, area],
  );

  const download = async () => {
    if (!output) return;
    setBusy(true);
    setError(null);
    try {
      const { downloadPencairanInsentifPdf } =
        await import("@/lib/pencairan-insentif-pdf");
      const suffix = area ? `-${area.replace(/\s+/g, "-")}` : "";
      await downloadPencairanInsentifPdf(
        output,
        `Pencairan-Insentif-${output.period}${suffix}.pdf`,
        asm ?? undefined,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="pencairan-insentif" className="card mb-6 p-5">
      <div className="mb-3">
        <h3 className="font-bold">Pencairan Insentif (PDF)</h3>
        <p className="text-xs text-[var(--text-muted)]">
          Daftar pembayaran insentif per orang (Salesman, Driver, Helper) per
          cabang, mengikuti sheet Pencairan JABAR-1, JABAR-2, dst. Pilih satu
          area untuk satu PDF, atau semua area (tiap area di halaman sendiri).
          Daftar pencairan ASM ikut ditambahkan di halaman terakhir.
        </p>
      </div>

      {periods.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          Belum ada pencapaian tim. Import pencapaian dulu di halaman Import.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[150px]">
            <label className="label">Periode</label>
            <Select2
              value={activePeriod}
              onChange={(v) => {
                setPeriod(v);
                setArea("");
              }}
              options={periods.map((p) => ({ value: p, label: p }))}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="label">Area</label>
            <Select2
              value={area}
              onChange={setArea}
              options={[
                { value: "", label: "Semua area" },
                ...(full?.areas ?? []).map((a) => ({
                  value: a.area,
                  label: a.area,
                })),
              ]}
            />
          </div>
          <p className="pb-2 text-sm text-[var(--text-muted)]">
            {(output?.lineCount ?? 0) + (asm?.rows.length ?? 0)} penerima ·
            Total dicairkan{" "}
            <b className="text-[var(--text)]">
              {formatRupiah((output?.total ?? 0) + (asm?.totals.diterima ?? 0))}
            </b>
          </p>
          <button
            type="button"
            className="btn-primary ml-auto"
            disabled={busy || !output || output.lineCount === 0}
            onClick={download}
          >
            {busy ? "Membuat PDF…" : "Unduh PDF"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
