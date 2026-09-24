import type { AppData } from "@/types";

/** Normalisasi periode import: `2026-08` / `2026-08-01` / tampilan Excel yyyy-mm */
export function normalizeImportPeriod(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  // Sudah YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  // YYYY-MM-DD / ISO
  const iso = s.match(/^(\d{4})-(\d{2})(?:-\d{2})?(?:T.*)?$/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  if (/^\d{4}-Q[1-4]$/i.test(s)) return s.toUpperCase();
  // Excel kadang "2026/08" atau "08-2026"
  const slash = s.match(/^(\d{4})[\/.](\d{1,2})$/);
  if (slash) return `${slash[1]}-${slash[2].padStart(2, "0")}`;
  return s;
}

/**
 * Overdue di Excel sering pecahan (0.059 = 5.9%).
 * Sistem menyimpan persen (5.9) dengan threshold 0.5.
 */
export function normalizeOverduePct(raw: number): number {
  if (raw > 0 && raw <= 1) return raw * 100;
  return raw;
}

/**
 * Jika Target Parameter ada untuk subjek+param+periode → nilai import = ACTUAL,
 * dikonversi ke % = actual/target*100.
 * Tanpa target → anggap sudah % (atau rasio Excel 0–2 → *100).
 */
export function resolveImportedAchievementPct(
  data: AppData,
  opts: {
    teamId?: string;
    employeeId?: string;
    paramId: string;
    period: string;
    raw: number;
  },
): number {
  const { teamId, employeeId, paramId, period, raw } = opts;
  const targetRow = data.parameterTargets.find(
    (t) =>
      t.paramId === paramId &&
      t.period === period &&
      (teamId
        ? t.teamId === teamId
        : Boolean(employeeId) && t.employeeId === employeeId),
  );

  if (targetRow && targetRow.target > 0) {
    return (raw / targetRow.target) * 100;
  }

  if (raw > 0 && raw <= 2) return raw * 100;
  return raw;
}
