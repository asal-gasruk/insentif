import type {
  AppData,
  Employee,
  OrgNode,
  ParameterTarget,
  Team,
} from "@/types";

/** Unit yang bukan besaran jumlah (rata-rata per outlet / persen): dirata-rata, tidak dijumlah. */
const AVERAGE_UNITS = new Set(["SKU", "%"]);

export type RollupMode = "sum" | "avg";

export interface RollupCell {
  /** null = tidak ada target di bawah node ini */
  value: number | null;
  mode: RollupMode;
  /** Jumlah target (tim/individu) yang masuk perhitungan */
  count: number;
}

export interface SupervisorChain {
  spv?: OrgNode;
  asm?: OrgNode;
  rsm?: OrgNode;
}

export function rollupModeOf(unit: string): RollupMode {
  return AVERAGE_UNITS.has(unit) ? "avg" : "sum";
}

export function orgNodeName(node: OrgNode, employees: Employee[]): string {
  const emp = node.employeeId
    ? employees.find((e) => e.id === node.employeeId)
    : undefined;
  return emp?.name || node.name || "Vacant";
}

/** Atasan tim = atasan anggota berposisi salesman (fallback: anggota pertama yang punya atasan). */
export function teamSupervisorNodeId(
  team: Team,
  employees: Employee[],
): string | undefined {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const lead = team.members.find((m) => m.position === "salesman");
  const leadSup = lead
    ? byId.get(lead.employeeId)?.supervisorNodeId
    : undefined;
  if (leadSup) return leadSup;
  for (const m of team.members) {
    const sup = byId.get(m.employeeId)?.supervisorNodeId;
    if (sup) return sup;
  }
  return undefined;
}

/** Rantai SPV → ASM → RSM dari sebuah node atasan. */
export function supervisorChain(
  nodeId: string | undefined,
  nodes: OrgNode[],
): SupervisorChain {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chain: SupervisorChain = {};
  let cur = nodeId ? byId.get(nodeId) : undefined;
  while (cur) {
    if (cur.level === "LEADER") chain.spv = cur;
    else if (cur.level === "ASM") chain.asm = cur;
    else chain.rsm = cur;
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain;
}

export interface RollupOptions {
  period: string;
  /** Hanya hitung tim/individu di cabang ini */
  branchId?: string;
}

interface Leaf {
  /** id Team atau Employee */
  subjectId: string;
  kind: "team" | "employee";
  nodeId: string;
}

/**
 * Rollup target: SPV = jumlah tim/individu langsung, ASM = jumlah SPV-nya,
 * RSM = jumlah ASM-nya. Dihitung dari target tim/individu (tidak disimpan).
 */
export function createRollup(data: AppData, opts: RollupOptions) {
  const { period, branchId } = opts;
  const nodesById = new Map(data.orgNodes.map((n) => [n.id, n]));
  const unitOf = new Map(data.parameters.map((p) => [p.id, p.unit]));

  const leaves: Leaf[] = [];
  const unassignedTeams: Team[] = [];

  for (const team of data.teams) {
    if (branchId && team.branchId !== branchId) continue;
    const nodeId = teamSupervisorNodeId(team, data.employees);
    if (nodeId && nodesById.has(nodeId)) {
      leaves.push({ subjectId: team.id, kind: "team", nodeId });
    } else {
      unassignedTeams.push(team);
    }
  }
  const employeesWithTarget = new Set(
    data.parameterTargets
      .filter((t) => t.period === period && t.employeeId)
      .map((t) => t.employeeId as string),
  );
  for (const emp of data.employees) {
    if (!employeesWithTarget.has(emp.id)) continue;
    if (branchId && emp.branchId !== branchId) continue;
    if (emp.supervisorNodeId && nodesById.has(emp.supervisorNodeId)) {
      leaves.push({
        subjectId: emp.id,
        kind: "employee",
        nodeId: emp.supervisorNodeId,
      });
    }
  }

  const targetOf = new Map<string, ParameterTarget>();
  for (const t of data.parameterTargets) {
    if (t.period !== period) continue;
    const subject = t.teamId ?? t.employeeId;
    if (subject) targetOf.set(`${subject}|${t.paramId}`, t);
  }

  const leavesByNode = new Map<string, Leaf[]>();
  for (const leaf of leaves) {
    const list = leavesByNode.get(leaf.nodeId) ?? [];
    list.push(leaf);
    leavesByNode.set(leaf.nodeId, list);
  }
  const childrenByNode = new Map<string, string[]>();
  for (const n of data.orgNodes) {
    if (!n.parentId) continue;
    const list = childrenByNode.get(n.parentId) ?? [];
    list.push(n.id);
    childrenByNode.set(n.parentId, list);
  }

  const descendantLeaves = new Map<string, Leaf[]>();
  const collect = (nodeId: string): Leaf[] => {
    const cached = descendantLeaves.get(nodeId);
    if (cached) return cached;
    const all = [
      ...(leavesByNode.get(nodeId) ?? []),
      ...(childrenByNode.get(nodeId) ?? []).flatMap(collect),
    ];
    descendantLeaves.set(nodeId, all);
    return all;
  };

  const valueOf = (nodeId: string, paramId: string): RollupCell => {
    const mode = rollupModeOf(unitOf.get(paramId) ?? "");
    const values = collect(nodeId)
      .map((l) => targetOf.get(`${l.subjectId}|${paramId}`)?.target)
      .filter((v): v is number => v !== undefined);
    if (values.length === 0) return { value: null, mode, count: 0 };
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      value: mode === "avg" ? sum / values.length : sum,
      mode,
      count: values.length,
    };
  };

  return {
    valueOf,
    /** Tim di bawah node (semua turunan) */
    teamIdsUnder: (nodeId: string): string[] =>
      collect(nodeId)
        .filter((l) => l.kind === "team")
        .map((l) => l.subjectId),
    /** Tim & individu yang langsung di bawah node */
    leavesOf: (nodeId: string): Leaf[] => leavesByNode.get(nodeId) ?? [],
    targetOf: (subjectId: string, paramId: string) =>
      targetOf.get(`${subjectId}|${paramId}`),
    unassignedTeams,
  };
}

export type Rollup = ReturnType<typeof createRollup>;
