"use client";

import { useEffect } from "react";

/** Preview PDF (blob URL) dalam dialog, dengan tombol unduh tanpa membuat ulang file. */
export function PdfPreviewModal({
  url,
  filename,
  title,
  onClose,
}: {
  url: string | null;
  filename: string;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Tutup preview"
        onClick={onClose}
      />
      <div className="card relative z-10 flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div>
            <h3 className="font-bold">{title}</h3>
            <p className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-muted)]">
              {filename}
            </p>
          </div>
          <div className="flex gap-2">
            <a href={url} download={filename} className="btn-primary">
              Unduh PDF
            </a>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Tutup
            </button>
          </div>
        </div>
        <iframe
          title={title}
          src={url}
          className="h-full w-full flex-1 bg-[var(--surface-muted)]"
        />
      </div>
    </div>
  );
}
