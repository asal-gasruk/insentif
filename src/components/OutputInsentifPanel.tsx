"use client";

import { useMemo, useState } from "react";
import { PdfPreviewModal } from "@/components/PdfPreviewModal";
import { Select2 } from "@/components/Select2";
import { formatRupiah } from "@/lib/calculator";
import { buildOutputInsentif, outputPeriods } from "@/lib/output-insentif";
import { buildAsmInsentif } from "@/lib/asm-insentif";
import type { AppData } from "@/types";

/** Panel unduh PDF "Output Insentif" (format tabel merah P:AV Excel Rekap Insentif Sales). */
export function OutputInsentifPanel({ data }: { data: AppData }) {
  const periods = useMemo(() => outputPeriods(data), [data]);
  const [period, setPeriod] = useState("");
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePeriod = period || periods[periods.length - 1] || "";
  const full = useMemo(
    () =>
      activePeriod ? buildOutputInsentif(data, { period: activePeriod }) : null,
    [data, activePeriod],
  );
  const output = useMemo(
    () =>
      activePeriod
        ? buildOutputInsentif(data, {
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

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const suffix = area ? `-${area.replace(/\s+/g, "-")}` : "";
  const filename = `Output-Insentif-${activePeriod}${suffix}.pdf`;

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const preview = async () => {
    if (!output) return;
    setBusy(true);
    setError(null);
    try {
      const { renderOutputInsentifPdf } =
        await import("@/lib/output-insentif-pdf");
      const doc = await renderOutputInsentifPdf(output, asm ?? undefined);
      setPreviewUrl(URL.createObjectURL(doc.output("blob")));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="output-insentif" className="card mb-6 p-5">
      <div className="mb-3">
        <h3 className="font-bold">Output Insentif (PDF)</h3>
        <p className="text-xs text-[var(--text-muted)]">
          Tabel insentif per tim sales + total cabang &amp; area, format sama
          dengan sheet Rekap Insentif Sales. Hanya tim yang punya pencapaian di
          periode terpilih (hasil Import). Lampiran ASM (akumulasi tim per SPV)
          ikut ditambahkan di halaman terakhir.
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
            {output?.rowCount ?? 0} tim · Total diterima{" "}
            <b className="text-[var(--text)]">
              {formatRupiah(output?.grand.diterima ?? 0)}
            </b>
          </p>
          <button
            type="button"
            className="btn-primary ml-auto"
            disabled={busy || !output || output.rowCount === 0}
            onClick={preview}
          >
            {busy ? "Membuat preview…" : "Preview PDF"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <PdfPreviewModal
        url={previewUrl}
        filename={filename}
        title="Preview Output Insentif"
        onClose={closePreview}
      />
    </section>
  );
}
