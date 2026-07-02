import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <h2 className="mb-2 text-xl font-bold text-[var(--primary-dark)]">
        Halaman tidak ditemukan
      </h2>
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        URL yang Anda buka tidak ada di aplikasi ini.
      </p>
      <Link href="/" className="btn-primary">
        Kembali ke Dashboard
      </Link>
    </div>
  );
}
