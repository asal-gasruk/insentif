/**
 * Auth prototype: kredensial hardcode di sisi server (bisa di-override via env).
 * Dipakai route /api/login dan middleware — jangan di-import dari komponen client,
 * supaya email/password tidak ikut ke bundle browser.
 */

export const SESSION_COOKIE = "lahans_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 jam

const EMAIL = process.env.AUTH_EMAIL ?? "insentif@lahans.id";
const PASSWORD = process.env.AUTH_PASSWORD ?? "insentif2026*#";
const SECRET = process.env.AUTH_SECRET ?? "lahans-insentif-prototype-secret";

/** Perbandingan string waktu-konstan (cukup untuk prototype). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function credentialsValid(email: string, password: string): boolean {
  const emailOk = safeEqual(email.trim().toLowerCase(), EMAIL.toLowerCase());
  const passOk = safeEqual(password, PASSWORD);
  return emailOk && passOk;
}

/** Token sesi = SHA-256(email:secret) — sama untuk semua sesi, cukup untuk akun tunggal prototype. */
export async function sessionToken(): Promise<string> {
  const data = new TextEncoder().encode(`${EMAIL.toLowerCase()}:${SECRET}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isValidSession(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  return safeEqual(token, await sessionToken());
}

/** Hanya path internal yang boleh jadi tujuan redirect setelah login. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  if (next.startsWith("/login")) return "/";
  return next;
}
