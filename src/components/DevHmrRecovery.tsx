"use client";

import { useEffect } from "react";

const RELOAD_KEY = "lahans-hmr-reload";
const COOLDOWN_MS = 15_000;

/** Dev-only: pulihkan otomatis saat chunk HMR stale (sekali per cooldown). */
export function DevHmrRecovery() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const shouldRecover = (message: string) =>
      message.includes("module factory is not available") ||
      message.includes("Loading chunk") ||
      message.includes("Failed to fetch dynamically imported module") ||
      message.includes("ChunkLoadError");

    const tryReload = (message: string) => {
      if (!shouldRecover(message)) return;

      const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? "0");
      const now = Date.now();
      if (now - last < COOLDOWN_MS) return;

      sessionStorage.setItem(RELOAD_KEY, String(now));
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      tryReload(event.message ?? "");
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "";
      tryReload(message);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
