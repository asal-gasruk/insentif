export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text)]">{title}</h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
