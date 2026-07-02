export function NotesPanel({
  text,
  title = "Catatan",
  className = "",
}: {
  text?: string;
  title?: string;
  className?: string;
}) {
  if (!text?.trim()) return null;

  return (
    <div
      className={`rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 ${className}`}
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {title}
      </p>
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text)]">
        {text}
      </p>
    </div>
  );
}

export function truncateNotes(text: string | undefined, max = 80): string {
  if (!text?.trim()) return "—";
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max)}…`;
}
