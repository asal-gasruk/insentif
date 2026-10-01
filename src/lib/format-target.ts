export function formatTarget(n: number, unit: string): string {
  if (unit === "Rp") {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(n);
  }
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 4,
  }).format(n);
}
