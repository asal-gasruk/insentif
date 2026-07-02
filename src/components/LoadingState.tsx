export function LoadingState() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        <p className="mt-3 text-sm text-[var(--text-muted)]">Memuat data...</p>
      </div>
    </div>
  );
}
