import type {
  AppData,
  Employee,
  EmployeePosition,
  IncentiveScheme,
  Role,
  SubjectPolicy,
  Team,
  TeamSplit,
  TeamTypeId,
  WorkforceMode,
} from "@/types";

/** Role yang di-seed sebagai capable Tim (optional) — untuk migrasi data lama */
export const DEFAULT_TEAM_CAPABLE_ROLE_IDS = [
  "canvasser",
  "sales-mt",
  "sales-horeca",
  "delivery",
] as const;

/** @deprecated gunakan isTeamCapableRole / resolveSubjectMode */
export const TEAM_ROLE_IDS = [
  "canvasser",
  "sales-mt",
  "sales-horeca",
] as const;

export type TeamRoleId = (typeof TEAM_ROLE_IDS)[number];

export const TEAM_TYPE_OPTIONS: {
  value: TeamTypeId;
  label: string;
  roleId: string;
}[] = [
  { value: "GT", label: "GT · Canvass Team", roleId: "canvasser" },
  { value: "MT", label: "MT · Sales Team", roleId: "sales-mt" },
  { value: "Horeca", label: "Horeca · Sales Team", roleId: "sales-horeca" },
  { value: "Delivery", label: "Delivery Team", roleId: "delivery" },
];

export const TEAM_MEMBER_POSITIONS: {
  value: EmployeePosition;
  label: string;
}[] = [
  { value: "salesman", label: "Salesman" },
  { value: "driver", label: "Driver" },
  { value: "helper1", label: "Helper 1" },
  { value: "helper2", label: "Helper 2" },
];

/** Split default Canvass / Sales team by teamSize */
export const SALES_TEAM_SPLITS: TeamSplit[] = [
  { key: "3", split: { salesman: 0.55, driver: 0.225, helper1: 0.225 } },
  { key: "2", split: { salesman: 0.7, driver: 0.3 } },
  { key: "1", split: { salesman: 1 } },
];

export function defaultSubjectPolicy(roleId: string): SubjectPolicy {
  return (DEFAULT_TEAM_CAPABLE_ROLE_IDS as readonly string[]).includes(roleId)
    ? "optional"
    : "individu";
}

export function getRole(data: AppData, roleId: string): Role | undefined {
  return data.roles.find((r) => r.id === roleId);
}

export function subjectPolicyOf(
  data: AppData,
  roleId: string,
): SubjectPolicy {
  return getRole(data, roleId)?.subjectPolicy ?? defaultSubjectPolicy(roleId);
}

/** Role boleh memakai Master Tim */
export function isTeamCapableRole(
  data: AppData,
  roleId: string,
): boolean {
  const policy = subjectPolicyOf(data, roleId);
  return policy === "team" || policy === "optional";
}

/** @deprecated prefer isTeamCapableRole(data, roleId) */
export function isTeamRoleId(roleId: string): boolean {
  return (DEFAULT_TEAM_CAPABLE_ROLE_IDS as readonly string[]).includes(roleId);
}

export function defaultWorkforceMode(
  data: AppData,
  roleId: string,
): WorkforceMode {
  const policy = subjectPolicyOf(data, roleId);
  if (policy === "team") return "team";
  if (policy === "individu") return "individu";
  return "individu";
}

/**
 * Mode aktual untuk karyawan: gabungan Role.subjectPolicy + Employee.workforceMode
 */
export function resolveSubjectMode(
  data: AppData,
  employee: Employee,
): WorkforceMode {
  const policy = subjectPolicyOf(data, employee.roleId);
  if (policy === "individu") return "individu";
  if (policy === "team") return "team";
  return employee.workforceMode ?? "individu";
}

/** Apakah skema boleh diimpor/diinput sebagai Tim */
export function isTeamScheme(data: AppData, scheme: IncentiveScheme): boolean {
  return isTeamCapableRole(data, scheme.roleId);
}

export function roleIdForTeamType(teamType: TeamTypeId): string {
  const found = TEAM_TYPE_OPTIONS.find((o) => o.value === teamType);
  return found?.roleId ?? "canvasser";
}

export function teamTypeForRoleId(roleId: string): TeamTypeId {
  return (
    TEAM_TYPE_OPTIONS.find((o) => o.roleId === roleId)?.value ?? roleId
  );
}

export function schemeForTeam(
  data: AppData,
  team: Team | undefined,
): IncentiveScheme | undefined {
  if (!team) return undefined;
  return data.schemes.find(
    (s) =>
      s.roleId === team.roleId &&
      (s.type === "parameter" || s.type === "volumeTier"),
  );
}

export function defaultSegmentForTeam(
  data: AppData,
  team: Team | undefined,
): string {
  const scheme = schemeForTeam(data, team);
  if (!scheme || !team) return "ALL";
  if (scheme.segmentDimension === "branchType") {
    const branch = data.branches.find((b) => b.id === team.branchId);
    if (branch && scheme.segments.some((s) => s.id === branch.branchType)) {
      return branch.branchType;
    }
  }
  if (scheme.segmentDimension === "vehicle") {
    return scheme.segments[0]?.id ?? "PICKUP";
  }
  return scheme.segments[0]?.id ?? "ALL";
}

export function teamSizeOf(team: Team): number {
  return team.members.length;
}

/** Employee aktif yang sudah menjadi anggota tim aktif lain (kecuali excludeTeamId) */
export function employeeAssignedTeamId(
  data: AppData,
  employeeId: string,
  excludeTeamId?: string,
): string | undefined {
  const team = data.teams.find(
    (t) =>
      t.active &&
      t.id !== excludeTeamId &&
      t.members.some((m) => m.employeeId === employeeId),
  );
  return team?.id;
}

export function validateWorkforceMode(
  data: AppData,
  employee: Pick<Employee, "roleId" | "workforceMode" | "id">,
): string | null {
  const policy = subjectPolicyOf(data, employee.roleId);
  const mode = employee.workforceMode ?? "individu";

  if (policy === "individu" && mode === "team") {
    return "Role ini hanya mendukung mode Individu";
  }
  if (policy === "team" && mode === "individu") {
    return "Role ini wajib mode Tim — set Manpower ke Tim dan masukkan ke Master Tim";
  }
  if (mode === "team") {
    const assigned = employeeAssignedTeamId(data, employee.id);
    if (!assigned) {
      return "Mode Tim membutuhkan keanggotaan di Master Tim aktif";
    }
  }
  return null;
}

export function validateTeamMembers(
  data: AppData,
  members: Team["members"],
  excludeTeamId?: string,
  roleId?: string,
): string | null {
  if (members.length < 1) return "Tim minimal 1 anggota";

  if (roleId && !isTeamCapableRole(data, roleId)) {
    return "Role ini tidak mendukung Master Tim (subjectPolicy = individu)";
  }

  const positions = members.map((m) => m.position);
  const uniquePos = new Set(positions);
  if (uniquePos.size !== positions.length) {
    return "Setiap posisi hanya boleh satu orang per tim";
  }

  const employeeIds = members.map((m) => m.employeeId);
  if (new Set(employeeIds).size !== employeeIds.length) {
    return "Karyawan tidak boleh dobel dalam satu tim";
  }

  for (const m of members) {
    const emp = data.employees.find((e) => e.id === m.employeeId);
    if (!emp) return `Karyawan ${m.employeeId} tidak ditemukan`;
    if (!emp.active) return `${emp.name} tidak aktif`;
    if (roleId && emp.roleId !== roleId) {
      return `${emp.name} role-nya tidak cocok dengan role tim`;
    }
    const other = employeeAssignedTeamId(data, m.employeeId, excludeTeamId);
    if (other) {
      const otherTeam = data.teams.find((t) => t.id === other);
      return `${emp.name} sudah di tim aktif "${otherTeam?.name ?? other}"`;
    }
  }

  return null;
}

/** Roles yang boleh dipilih di Master Tim */
export function teamCapableRoles(data: AppData): Role[] {
  return data.roles.filter((r) => isTeamCapableRole(data, r.id));
}
