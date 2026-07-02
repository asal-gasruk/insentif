import type { AppData, Employee, IncentiveScheme } from "@/types";

export function schemeForEmployee(
  data: AppData,
  employee: Employee | undefined,
): IncentiveScheme | undefined {
  if (!employee) return undefined;
  return data.schemes.find(
    (s) => s.roleId === employee.roleId && s.type === "parameter",
  );
}

export function defaultSegment(
  data: AppData,
  employee: Employee | undefined,
): string {
  const scheme = schemeForEmployee(data, employee);
  if (!scheme || !employee) return "ALL";
  if (scheme.segmentDimension === "branchType") {
    const branch = data.branches.find((b) => b.id === employee.branchId);
    if (branch && scheme.segments.some((s) => s.id === branch.branchType)) {
      return branch.branchType;
    }
  }
  return scheme.segments[0]?.id ?? "ALL";
}

/** Parameter aktif = punya bobot > 0 pada segment terpilih */
export function activeParams(
  data: AppData,
  schemeId: string,
  segmentId: string,
): string[] {
  const weightRow = data.schemeWeights.find(
    (w) => w.schemeId === schemeId && w.segmentId === segmentId,
  );
  if (!weightRow) return [];
  return Object.entries(weightRow.weights)
    .filter(([, w]) => w !== null && w > 0)
    .map(([paramId]) => paramId);
}
