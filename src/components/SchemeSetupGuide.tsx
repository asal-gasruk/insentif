"use client";

import Link from "next/link";
import { useState } from "react";
import {
  DOC_INDEPENDENT_PARAMS,
  RULE_BUILDER_INSERT_GUIDE,
  SCHEME_SETUP_STEPS,
} from "@/data/formula-aggregation-guide";

export function SchemeSetupGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="card mb-6 overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-[var(--surface-muted)]/50"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
            Panduan Setup (dari dokumen Plan 2026)
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            Urutan insert data & konfigurasi skema insentif
          </p>
        </div>
        <span className="text-[var(--text-muted)]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] px-5 py-4">
          <p className="mb-4 rounded-lg bg-[var(--primary)]/5 px-3 py-2 text-xs text-[var(--text-muted)]">
            {DOC_INDEPENDENT_PARAMS}
          </p>

          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Urutan konfigurasi (7 langkah)
          </h4>
          <ol className="mb-6 space-y-2">
            {SCHEME_SETUP_STEPS.map((s) => (
              <li key={s.step} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-xs font-bold text-[var(--primary)]">
                  {s.step}
                </span>
                <div>
                  <Link
                    href={s.path}
                    className="font-semibold text-[var(--primary)] hover:underline"
                  >
                    {s.menu}
                  </Link>
                  <p className="text-xs text-[var(--text-muted)]">{s.action}</p>
                </div>
              </li>
            ))}
          </ol>

          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Insert Rule Builder di Skema Insentif
          </h4>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-[var(--text-muted)]">
            {RULE_BUILDER_INSERT_GUIDE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
