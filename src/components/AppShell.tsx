"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppData } from "@/hooks/useAppData";

const navGroups = [
  {
    label: null,
    items: [{ href: "/", label: "Dashboard", icon: "◉" }],
  },
  {
    label: "1 · Master Organisasi",
    items: [
      { href: "/cabang", label: "Master Cabang", icon: "⌂" },
      { href: "/karyawan", label: "Karyawan", icon: "☺" },
      { href: "/organisasi", label: "Struktur Organisasi", icon: "⌗" },
      { href: "/tim", label: "Master Tim", icon: "☷" },
    ],
  },
  {
    label: "2 · Master Parameter",
    items: [
      { href: "/parameter", label: "Master Parameter", icon: "◈" },
      { href: "/tier", label: "Master Tier", icon: "▤" },
      { href: "/target", label: "Target Parameter", icon: "◎" },
    ],
  },
  {
    label: "3 · Konfigurasi Skema",
    items: [
      { href: "/skema", label: "Skema Insentif", icon: "❖" },
      { href: "/bobot", label: "Bobot & Nominal", icon: "⚖" },
    ],
  },
  {
    label: "4 · Hasil",
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
  const router = useRouter();

  // Halaman login tampil tanpa sidebar
  if (pathname === "/login") return <>{children}</>;

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-white">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-5">
          <Image
            src="/logo-mark.png"
            alt="Lahans Impact"
            width={40}
            height={40}
            className="h-10 w-10 shrink-0"
            priority
          />
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold leading-tight text-[var(--text)]">
              Lahans Impact - Insentif
            </h1>
          </div>
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
          <button
            type="button"
            onClick={logout}
            className="btn-secondary mt-2 w-full px-3 py-2 text-xs"
          >
            Keluar
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-[var(--bg)]">
        <div className="w-full px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
