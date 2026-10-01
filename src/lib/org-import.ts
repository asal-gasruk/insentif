import hierarchy from "@/data/sfa-hierarchy.json";
import {
  mapIndividuRole,
  resolveCabangMeta,
  slugNik,
} from "@/lib/sfa-import";
import type { Employee, EmployeePosition, OrgNode } from "@/types";

export type HierarchyMember = (typeof hierarchy.members)[number];
export type HierarchyLeader = (typeof hierarchy.leaders)[number];

const OPS_DRIVER = new Set(["Delivery Man", "Driver Distributor", "Driver"]);
const OPS_HELPER = new Set(["Helper Delivery", "Helper Gudang", "Helper"]);
const SALES_LEAD = new Set([
  "Salesman",
  "Canvas Motoris",
  "Sales Executive",
  "Horeca Executive",
  "Key Account Executive",
  "Sales TO",
  "Sales Exclusive",
]);

export const rsmNodeId = (regionId: string) => `org-rsm-${regionId}`;
export const asmNodeId = (areaId: string) => `org-asm-${areaId}`;
export const leaderNodeId = (leaderId: string) => `org-${leaderId}`;

/** Normalisasi nama: buang karakter tak terlihat (mis. U+2060), spasi ganda, huruf besar/kecil. */
function normName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/[\u200b-\u200f\u2060\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** NIK = angka depan saja (Excel kadang menulis "20250117-1(karena beda team)"). */
function nikKey(nik: string | null | undefined): string | null {
  const m = /^\s*(\d+)/.exec(nik ?? "");
  return m ? m[1] : null;
}

function nameKey(name: string, branchId: string): string {
  return `${branchId}|${normName(name)}`;
}

/** Cari karyawan existing: NIK, lalu nama + cabang, lalu nama unik di semua cabang. */
export function matchEmployee(
  person: { nik: string | null; name: string | null; cabang: string },
  employees: Employee[],
): Employee | undefined {
  const nik = nikKey(person.nik);
  if (nik) {
    const byNik = employees.find((e) => nikKey(e.nik) === nik);
    if (byNik) return byNik;
  }
  if (!person.name) return undefined;
  const branchId = resolveCabangMeta(person.cabang).id;
  const key = nameKey(person.name, branchId);
  const sameBranch = employees.find((e) => nameKey(e.name, e.branchId) === key);
  if (sameBranch) return sameBranch;
  const sameName = employees.filter(
    (e) => normName(e.name) === normName(person.name as string),
  );
  return sameName.length === 1 ? sameName[0] : undefined;
}

function employeeIdFor(person: {
  nik: string | null;
  name: string | null;
  cabang: string;
}): string {
  if (person.nik) return `sfa-emp-${slugNik(person.nik)}`;
  const branchId = resolveCabangMeta(person.cabang).id;
  return `sfa-emp-${branchId}-${slugNik((person.name ?? "x").toLowerCase())}`;
}

/** Role + posisi untuk karyawan Excel yang belum ada di /karyawan. */
export function memberRoleInfo(jabatan: string): {
  roleId: string;
  position: EmployeePosition;
} {
  if (OPS_DRIVER.has(jabatan)) return { roleId: "delivery", position: "driver" };
  if (OPS_HELPER.has(jabatan)) {
    return {
      roleId: "delivery",
      position: jabatan === "Helper Gudang" ? "other" : "helper1",
    };
  }
  if (SALES_LEAD.has(jabatan)) return { roleId: "canvasser", position: "salesman" };
  return mapIndividuRole(jabatan);
}

type PersonRef = {
  nik: string | null;
  name: string | null;
  jabatan: string | null;
  cabang: string;
};

export function newEmployeeFromMember(m: PersonRef): Employee {
  const branch = resolveCabangMeta(m.cabang);
  const info = memberRoleInfo(m.jabatan ?? "");
  return {
    id: employeeIdFor(m),
    name: m.name ?? "",
    nik: m.nik ?? "",
    roleId: info.roleId,
    branchId: branch.id,
    position: info.position,
    teamSize: 1,
    workforceMode: "individu",
    active: true,
  };
}

/**
 * Bangun orgNodes (RSM → ASM → leader) dan lengkapi employees:
 * karyawan Excel yang belum ada ditambahkan, semua bawahan diberi supervisorNodeId.
 */
export function buildSfaOrg(base: Employee[]): {
  employees: Employee[];
  orgNodes: OrgNode[];
} {
  const employees = [...base];
  const byId = new Map(employees.map((e) => [e.id, e]));

  const ensureEmployee = (person: PersonRef): Employee => {
    const found = matchEmployee(person, employees);
    if (found) return found;
    const created = newEmployeeFromMember(person);
    employees.push(created);
    byId.set(created.id, created);
    return created;
  };

  const nodes: OrgNode[] = [];
  for (const r of hierarchy.regions) {
    nodes.push({
      id: rsmNodeId(r.id),
      level: "RSM",
      title: "RSM",
      name: r.rsm,
      parentId: null,
      area: r.name,
    });
  }
  for (const a of hierarchy.areas) {
    const excelAsm = a.asmLeaderId
      ? hierarchy.leaders.find((l) => l.id === a.asmLeaderId)
      : undefined;
    nodes.push({
      id: asmNodeId(a.id),
      level: "ASM",
      title: "ASM",
      name: a.asm || excelAsm?.name || "",
      parentId: rsmNodeId(a.region),
      area: a.name,
      cabang: excelAsm?.cabang,
    });
  }

  const areaIdByName = new Map(hierarchy.areas.map((a) => [a.name, a.id]));
  const asmIdOfLeader = new Map(
    hierarchy.areas
      .filter((a) => a.asmLeaderId)
      .map((a) => [a.asmLeaderId as string, asmNodeId(a.id)]),
  );

  const nodeIdOfLeader = (leaderId: string) =>
    asmIdOfLeader.get(leaderId) ?? leaderNodeId(leaderId);

  for (const l of hierarchy.leaders) {
    if (asmIdOfLeader.has(l.id)) continue; // sudah jadi node ASM
    const emp = l.name
      ? ensureEmployee({
          nik: l.nik,
          name: l.name,
          jabatan: l.jabatan,
          cabang: l.cabang,
        })
      : undefined;
    nodes.push({
      id: leaderNodeId(l.id),
      level: "LEADER",
      title: l.jabatan ?? "Leader",
      name: l.name ?? "",
      employeeId: emp?.id,
      parentId: asmNodeId(areaIdByName.get(l.area) as string),
      area: l.area,
      cabang: l.cabang,
      needsReview: l.needsReview,
      note: l.reason ?? undefined,
    });
    if (emp) byId.set(emp.id, { ...emp, supervisorNodeId: asmNodeId(areaIdByName.get(l.area) as string) });
  }

  for (const m of hierarchy.members) {
    const emp = ensureEmployee(m);
    if (!m.leaderId) continue;
    byId.set(emp.id, { ...emp, supervisorNodeId: nodeIdOfLeader(m.leaderId) });
  }

  return {
    employees: employees.map((e) => byId.get(e.id) ?? e),
    orgNodes: nodes,
  };
}
