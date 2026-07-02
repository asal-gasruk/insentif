"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#ffffff",
          color: "#1c1917",
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h2 style={{ marginBottom: "0.5rem" }}>Aplikasi bermasalah</h2>
          <p style={{ marginBottom: "1rem", color: "#78716c", maxWidth: "28rem" }}>
            {error.message || "Kesalahan pada layout utama."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#fac300",
              color: "#1c1917",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Muat ulang
          </button>
        </div>
      </body>
    </html>
  );
}
