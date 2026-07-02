"use client";

export function Modal({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Tutup"
        onClick={onClose}
      />
      <div
        className={`card relative z-10 max-h-[90vh] w-full overflow-y-auto p-6 ${
          wide ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
