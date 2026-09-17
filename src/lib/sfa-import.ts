import sfaExcel from "@/data/sfa-excel.json";
import type {
  Branch,
  BranchTypeId,
  Employee,
  EmployeePosition,
  Team,
} from "@/types";

export type SfaExcelDump = typeof sfaExcel;

/** Normalisasi nama cabang Excel → id seed / branch baru */
const CABANG_ALIAS: Record<
  string,
  { id: string; name: string; branchType: BranchTypeId }
> = {
  BANDUNG: { id: "br-mb-1", name: "Bandung", branchType: "MB" },
  GARUT: { id: "br-mb-2", name: "Garut", branchType: "MB" },
  TASIK: { id: "br-sb-1", name: "Tasikmalaya (Ciamis)", branchType: "SB" },
  SUBANG: { id: "br-sb-2", name: "Subang (Purwasuka)", branchType: "SB" },
  TEGAL: { id: "br-sb-3", name: "Tegal (Bregas Kalang)", branchType: "SB" },
  WANGON: { id: "br-sb-4", name: "Wangon (Barlingmascakeb)", branchType: "SB" },
  WONOSOBO: {
    id: "br-sb-5",
    name: "Wonosobo (Purwomannggung / Kedu Raya)",
    branchType: "SB",
  },
  SUKABUMI: { id: "br-nb-2", name: "Sukabumi", branchType: "NB" },
  SOLO: { id: "br-nb-3", name: "Solo", branchType: "NB" },
  SEMARANG: { id: "br-nb-4", name: "Semarang (Kedungsepur)", branchType: "NB" },
  CIREBON: { id: "br-nb-11", name: "Cirebon (Ciayumajakuning)", branchType: "NB" },
  PURWAKARTA: { id: "br-nb-12", name: "Purwakarta", branchType: "NB" },
  BOGOR: { id: "br-nb-18", name: "Bogor", branchType: "NB" },
  KEBUMEN: { id: "br-nb-19", name: "Kebumen", branchType: "NB" },
};

function slugNik(nik: string): string {
  return nik.replace(/[^a-zA-Z0-9_-]/g, "");
}

function mapIndividuRole(jabatan: string): {
  roleId: string;
  position: EmployeePosition;
} {
  const j = jabatan.trim().toUpperCase();
  if (j === "ASM") return { roleId: "asm", position: "manager" };
  if (j.includes("HORECA") && j.includes("SPV")) {
    return { roleId: "spv-horeca", position: "supervisor" };
  }
  if (j.includes("SP-MT") || j === "SPV" || j.startsWith("SP-")) {
    return { roleId: "spv-mt", position: "supervisor" };
  }
  if (j.includes("KEY ACCOUNT")) {
    return { roleId: "ass", position: "supervisor" };
  }
  return { roleId: "ass", position: "supervisor" };
}

export function resolveCabangMeta(cabang: string): {
  id: string;
  name: string;
  branchType: BranchTypeId;
} {
  const key = (cabang ?? "").trim().toUpperCase();
  if (!key) {
    return { id: "br-mb-1", name: "Bandung", branchType: "MB" };
  }
  const found = CABANG_ALIAS[key];
  if (found) return found;
  const id = `br-sfa-${key.toLowerCase().replace(/\s+/g, "-")}`;
  return { id, name: cabang.trim(), branchType: "NB" };
}

export function buildSfaBranches(existing: Branch[]): Branch[] {
  const byId = new Map(existing.map((b) => [b.id, b]));
  for (const c of sfaExcel.cabangs) {
    const meta = resolveCabangMeta(c.cabang);
    if (!byId.has(meta.id)) {
      byId.set(meta.id, {
        id: meta.id,
        name: meta.name,
        branchType: meta.branchType,
      });
    }
  }
  return Array.from(byId.values());
}

export function buildSfaEmployees(): Employee[] {
  const seenNik = new Set<string>();
  const employees: Employee[] = [];

  for (const team of sfaExcel.teams) {
    const branch = resolveCabangMeta(team.cabang);
    for (const m of team.members) {
      if (seenNik.has(m.nik)) continue;
      seenNik.add(m.nik);
      const raw = sfaExcel.employees.find((e) => e.nik === m.nik);
      employees.push({
        id: `sfa-emp-${slugNik(m.nik)}`,
        name: raw?.name ?? m.nik,
        nik: m.nik,
        roleId: team.roleId,
        branchId: branch.id,
        position: m.position as EmployeePosition,
        teamSize: team.members.length,
        workforceMode: "team",
        active: true,
      });
    }
  }

  for (const ind of sfaExcel.individu) {
    if (seenNik.has(ind.nik)) continue;
    seenNik.add(ind.nik);
    const branch = resolveCabangMeta(ind.cabang ?? "");
    const mapped = mapIndividuRole(ind.jabatan);
    employees.push({
      id: `sfa-emp-${slugNik(ind.nik)}`,
      name: ind.name,
      nik: ind.nik,
      roleId: mapped.roleId,
      branchId: branch.id,
      position: mapped.position,
      teamSize: 1,
      workforceMode: "individu",
      active: true,
    });
  }

  return employees;
}

export function buildSfaTeams(): Team[] {
  return sfaExcel.teams.map((t) => {
    const branch = resolveCabangMeta(t.cabang);
    return {
      id: `sfa-team-${t.code}`,
      name: t.name,
      teamType: t.teamType,
      roleId: t.roleId,
      branchId: branch.id,
      members: t.members.map((m) => ({
        employeeId: `sfa-emp-${slugNik(m.nik)}`,
        position: m.position as EmployeePosition,
      })),
      active: true,
    };
  });
}

/** Delivery demo tetap dipakai agar skema volumeTier punya contoh manpower. */
export const DELIVERY_DEMO_EMPLOYEES: Employee[] = [
  {
    id: "emp-6",
    name: "Roni Saputra",
    nik: "DT-001",
    roleId: "delivery",
    branchId: "br-mb-1",
    position: "driver",
    teamSize: 2,
    vehicleType: "ENGKEL",
    workforceMode: "team",
    active: true,
  },
  {
    id: "emp-7",
    name: "Rahman Hakim",
    nik: "DT-004",
    roleId: "delivery",
    branchId: "br-mb-1",
    position: "driver",
    teamSize: 1,
    vehicleType: "PICKUP",
    workforceMode: "individu",
    active: true,
  },
  {
    id: "emp-8",
    name: "Joko Prasetyo",
    nik: "DT-002",
    roleId: "delivery",
    branchId: "br-mb-2",
    position: "driver",
    teamSize: 3,
    vehicleType: "DOUBLE",
    workforceMode: "individu",
    active: true,
  },
  {
    id: "emp-9",
    name: "Slamet Riyadi",
    nik: "DT-003",
    roleId: "delivery",
    branchId: "br-mb-1",
    position: "helper1",
    teamSize: 2,
    vehicleType: "ENGKEL",
    workforceMode: "team",
    active: true,
  },
];

export const DELIVERY_DEMO_TEAMS: Team[] = [
  {
    id: "team-dt-1",
    name: "Delivery Bandung Engkel",
    teamType: "Delivery",
    roleId: "delivery",
    branchId: "br-mb-1",
    members: [
      { employeeId: "emp-6", position: "driver" },
      { employeeId: "emp-9", position: "helper1" },
    ],
    active: true,
  },
];

export function getSfaSplitExamples() {
  return sfaExcel.examples;
}

export function getSfaPoolSplits() {
  return sfaExcel.splits;
}
