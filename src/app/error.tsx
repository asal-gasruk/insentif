"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <h2 className="mb-2 text-xl font-bold text-[var(--primary-dark)]">
        Terjadi kesalahan
      </h2>
      <p className="mb-4 max-w-md text-sm text-[var(--text-muted)]">
        {error.message ||
          "Gagal memuat halaman. Coba muat ulang atau reset data lokal."}
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn-primary" onClick={() => reset()}>
          Coba lagi
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => window.location.assign("/")}
        >
          Ke Dashboard
        </button>
      </div>
    </div>
  );
}
