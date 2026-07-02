"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppData } from "@/hooks/useAppData";

const navGroups = [
  {
    label: null,
    items: [{ href: "/", label: "Dashboard", icon: "◉" }],
  },
  {
    label: "1 · Master Data",
    items: [
      { href: "/parameter", label: "Master Parameter", icon: "◈" },
      { href: "/tier", label: "Master Tier", icon: "▤" },
      { href: "/cabang", label: "Master Cabang", icon: "⌂" },
      { href: "/karyawan", label: "Karyawan", icon: "☺" },
    ],
  },
  {
    label: "2 · Konfigurasi Skema",
    items: [
      { href: "/skema", label: "Skema Insentif", icon: "❖" },
      { href: "/bobot", label: "Bobot & Nominal", icon: "⚖" },
    ],
  },
  {
    label: "3 · Hasil",
    items: [
      { href: "/import", label: "Import", icon: "⇪" },
      { href: "/pencapaian", label: "Pencapaian", icon: "▲" },
      { href: "/pengiriman", label: "Pengiriman", icon: "⛟" },
      { href: "/perhitungan", label: "Perhitungan", icon: "∑" },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { reset } = useAppData();

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-5 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Lahans
          </p>
          <h1 className="mt-1 text-lg font-bold leading-tight text-[var(--text)]">
            Insentif Reguler
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Plan 2026 · Prototype</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((group, gi) => (
            <div key={group.label ?? gi} className={gi > 0 ? "mt-4" : ""}>
              {group.label && (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "bg-[var(--action)] font-semibold text-[var(--on-action)]"
                          : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      <span className="w-5 text-center opacity-80">
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--border)] p-4">
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  "Reset semua data ke seed default? Perubahan lokal akan hilang.",
                )
              ) {
                reset();
              }
            }}
            className="btn-secondary w-full px-3 py-2 text-xs"
          >
            Reset Data Lokal
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-[var(--bg)]">
        <div className="w-full px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
