"use client";

import { FormEvent, Suspense, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

/** Prototype: kredensial diisi otomatis (password tetap tersamar). Harus sama dengan src/lib/auth.ts. */
const PREFILL_EMAIL = "insentif@lahans.id";
const PREFILL_PASSWORD = "insentif2026*#";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(PREFILL_EMAIL);
  const [password, setPassword] = useState(PREFILL_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Gagal login.");
        return;
      }
      const next = params.get("next");
      // Hanya path internal; full reload agar middleware membaca cookie baru
      const target =
        next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      window.location.assign(target);
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@lahans.id"
          required
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--bg)] px-4 py-10">
      <div className="card w-full max-w-sm px-8 py-9">
        <div className="mb-7 flex flex-col items-center text-center">
          <Image
            src="/logo-lahans-impact.png"
            alt="Lahans Impact"
            width={900}
            height={384}
            className="h-auto w-52"
            priority
          />
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text)]">
              Insentif
            </span>
            <span className="badge bg-[var(--surface-muted)] text-[var(--text-muted)]">
              Prototype
            </span>
          </div>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
      <p className="text-xs text-[var(--text-muted)]">© Lahans Impact</p>
    </div>
  );
}
