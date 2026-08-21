import type {
  AchievementRecord,
  AppData,
  DeliveryRecord,
  DeliveryResult,
  Employee,
  IncentiveResult,
  IncentiveScheme,
  Team,
} from "@/types";
import { computeFormula } from "@/lib/formula-engine";
import { computeFormulaRules } from "@/lib/formula-rule-engine";
import { evaluatePenalties } from "@/lib/penalty-engine";
import { teamSizeOf } from "@/lib/team-utils";

function getSplitRatio(
  scheme: IncentiveScheme,
  key: string,
  position: string,
): number {
  const split = scheme.teamSplits.find((s) => s.key === key)?.split;
  if (!split) return 1;
  return split[position] ?? 0;
}

function computeGross(
  data: AppData,
  record: AchievementRecord,
  scheme: IncentiveScheme,
  employee: Employee,
  teamSize: number,
) {
  const weightRow = data.schemeWeights.find(
    (w) => w.schemeId === scheme.id && w.segmentId === record.segmentId,
  );
  if (!weightRow) {
    return {
      ok: false as const,
      tierLabel: "Bobot belum dikonfigurasi",
      parameterBreakdown: {} as Record<string, number>,
      grossAmount: 0,
    };
  }

  const activeParams = Object.entries(weightRow.weights)
    .filter(([, w]) => w !== null && w > 0)
    .map(([paramId]) => paramId);

  const formulaCtx = {
    data,
    scheme,
    record,
    employee,
    teamSize,
    weightRow,
    activeParams,
    tiers: data.achievementTiers,
  };

  const formulaResult =
    scheme.formulaMode === "rules" && scheme.formulaRuleConfig
      ? computeFormulaRules(scheme.formulaRuleConfig, formulaCtx)
      : computeFormula(scheme.formulaTemplate ?? "paramIndependent", formulaCtx);

  return {
    ok: true as const,
    tierLabel: formulaResult.tierLabel,
    parameterBreakdown: formulaResult.parameterBreakdown,
    grossAmount: formulaResult.grossAmount,
  };
}

function buildMemberResult(args: {
  record: AchievementRecord;
  scheme: IncentiveScheme;
  segmentName: string;
  employee: Employee;
  teamSize: number;
  grossAmount: number;
  parameterBreakdown: Record<string, number>;
  tierLabel: string;
  team?: Team;
}): IncentiveResult {
  const {
    record,
    scheme,
    segmentName,
    employee,
    teamSize,
    grossAmount,
    parameterBreakdown,
    tierLabel,
    team,
  } = args;

  const splitRatio = getSplitRatio(
    scheme,
    String(teamSize),
    employee.position,
  );
  const penaltyResult = evaluatePenalties(scheme.penalties ?? [], record);

  let finalAmount = Math.round(
    grossAmount * splitRatio * (1 - penaltyResult.penaltyPct / 100),
  );
  if (penaltyResult.suspended || penaltyResult.voided) finalAmount = 0;

  return {
    recordId: record.id,
    employeeId: employee.id,
    employeeName: employee.name,
    position: employee.position,
    period: record.period,
    schemeName: scheme.name,
    segmentName,
    tierLabel,
    parameterBreakdown,
    grossAmount,
    splitRatio,
    penaltyPct: penaltyResult.penaltyPct,
    suspended: penaltyResult.suspended,
    voided: penaltyResult.voided,
    finalAmount,
    teamId: team?.id,
    teamName: team?.name,
  };
}

// ---------------------------------------------------------------------------
// Skema parameter — rumus dari formulaTemplate per skema
// ---------------------------------------------------------------------------

export function calculateParameterIncentive(
  data: AppData,
  record: AchievementRecord,
  employee: Employee,
): IncentiveResult {
  const scheme = data.schemes.find((s) => s.id === record.schemeId);
  const segment = scheme?.segments.find((s) => s.id === record.segmentId);

  const base: IncentiveResult = {
    recordId: record.id,
    employeeId: employee.id,
    employeeName: employee.name,
    position: employee.position,
    period: record.period,
    schemeName: scheme?.name ?? record.schemeId,
    segmentName: segment?.name ?? record.segmentId,
    tierLabel: "-",
    parameterBreakdown: {},
    grossAmount: 0,
    splitRatio: 1,
    penaltyPct: 0,
    suspended: false,
    voided: false,
    finalAmount: 0,
  };

  if (!scheme) return { ...base, tierLabel: "Skema tidak ditemukan" };

  const gross = computeGross(
    data,
    record,
    scheme,
    employee,
    employee.teamSize,
  );
  if (!gross.ok) return { ...base, tierLabel: gross.tierLabel };

  return buildMemberResult({
    record,
    scheme,
    segmentName: segment?.name ?? record.segmentId,
    employee,
    teamSize: employee.teamSize,
    grossAmount: gross.grossAmount,
    parameterBreakdown: gross.parameterBreakdown,
    tierLabel: gross.tierLabel,
  });
}

/** Satu pencapaian tim → satu result per anggota (gross sekali, lalu split) */
export function calculateTeamParameterIncentive(
  data: AppData,
  record: AchievementRecord,
  team: Team,
): IncentiveResult[] {
  const scheme = data.schemes.find((s) => s.id === record.schemeId);
  const segment = scheme?.segments.find((s) => s.id === record.segmentId);
  const teamSize = teamSizeOf(team);

  if (!scheme) {
    return team.members.map((m) => {
      const emp = data.employees.find((e) => e.id === m.employeeId);
      return {
        recordId: record.id,
        employeeId: m.employeeId,
        employeeName: emp?.name ?? m.employeeId,
        position: m.position,
        period: record.period,
        schemeName: record.schemeId,
        segmentName: record.segmentId,
        tierLabel: "Skema tidak ditemukan",
        parameterBreakdown: {},
        grossAmount: 0,
        splitRatio: 0,
        penaltyPct: 0,
        suspended: false,
        voided: false,
        finalAmount: 0,
        teamId: team.id,
        teamName: team.name,
      };
    });
  }

  const leadMember =
    team.members.find((m) => m.position === "salesman") ?? team.members[0];
  const leadEmployee = data.employees.find(
    (e) => e.id === leadMember?.employeeId,
  );

  if (!leadEmployee || team.members.length === 0) return [];

  const contextEmployee: Employee = {
    ...leadEmployee,
    position: leadMember.position,
    teamSize,
  };

  const gross = computeGross(data, record, scheme, contextEmployee, teamSize);
  const segmentName = segment?.name ?? record.segmentId;

  if (!gross.ok) {
    return team.members.map((m) => {
      const emp = data.employees.find((e) => e.id === m.employeeId);
      return {
        recordId: record.id,
        employeeId: m.employeeId,
        employeeName: emp?.name ?? m.employeeId,
        position: m.position,
        period: record.period,
        schemeName: scheme.name,
        segmentName,
        tierLabel: gross.tierLabel,
        parameterBreakdown: {},
        grossAmount: 0,
        splitRatio: 0,
        penaltyPct: 0,
        suspended: false,
        voided: false,
        finalAmount: 0,
        teamId: team.id,
        teamName: team.name,
      };
    });
  }

  return team.members.flatMap((m) => {
    const emp = data.employees.find((e) => e.id === m.employeeId);
    if (!emp) return [];
    const memberEmployee: Employee = {
      ...emp,
      position: m.position,
      teamSize,
    };
    return [
      buildMemberResult({
        record,
        scheme,
        segmentName,
        employee: memberEmployee,
        teamSize,
        grossAmount: gross.grossAmount,
        parameterBreakdown: gross.parameterBreakdown,
        tierLabel: gross.tierLabel,
        team,
      }),
    ];
  });
}

// ---------------------------------------------------------------------------
// Skema volume tier (Delivery Team): kartonase + drop point per armada
// ---------------------------------------------------------------------------

function findVolumeNominal(
  data: AppData,
  vehicleType: string,
  component: "cartonnage" | "dropPoint",
  qty: number,
): number {
  const tier = data.volumeTiers.find(
    (t) =>
      t.vehicleType === vehicleType &&
      t.component === component &&
      qty >= t.minQty &&
      (t.maxQty === null || qty <= t.maxQty),
  );
  return tier?.nominal ?? 0;
}

export function calculateDeliveryIncentive(
  data: AppData,
  record: DeliveryRecord,
  employee: Employee,
): DeliveryResult {
  const scheme = data.schemes.find(
    (s) => s.type === "volumeTier" && s.roleId === employee.roleId,
  ) ?? data.schemes.find((s) => s.type === "volumeTier");

  const cartonNominal = findVolumeNominal(
    data,
    record.vehicleType,
    "cartonnage",
    record.cartons,
  );
  const dropPointNominal = findVolumeNominal(
    data,
    record.vehicleType,
    "dropPoint",
    record.invoices,
  );
  const gross = cartonNominal + dropPointNominal;

  const splitRatio = scheme
    ? getSplitRatio(scheme, record.vehicleType, employee.position)
    : 1;

  const qualityPassed = record.otdPct >= 95 && record.accuracyPct >= 97;

  return {
    recordId: record.id,
    employeeId: employee.id,
    employeeName: employee.name,
    position: employee.position,
    period: record.period,
    vehicleType: record.vehicleType,
    cartonNominal,
    dropPointNominal,
    grossAmount: gross,
    splitRatio,
    qualityPassed,
    finalAmount: Math.round(gross * splitRatio),
  };
}

/** Satu pengiriman tim → satu result per anggota (gross sekali, lalu split by vehicle) */
export function calculateTeamDeliveryIncentive(
  data: AppData,
  record: DeliveryRecord,
  team: Team,
): DeliveryResult[] {
  const scheme = data.schemes.find(
    (s) => s.type === "volumeTier" && s.roleId === team.roleId,
  ) ?? data.schemes.find((s) => s.type === "volumeTier");

  const cartonNominal = findVolumeNominal(
    data,
    record.vehicleType,
    "cartonnage",
    record.cartons,
  );
  const dropPointNominal = findVolumeNominal(
    data,
    record.vehicleType,
    "dropPoint",
    record.invoices,
  );
  const gross = cartonNominal + dropPointNominal;
  const qualityPassed = record.otdPct >= 95 && record.accuracyPct >= 97;

  return team.members.flatMap((m) => {
    const emp = data.employees.find((e) => e.id === m.employeeId);
    if (!emp) return [];
    const splitRatio = scheme
      ? getSplitRatio(scheme, record.vehicleType, m.position)
      : team.members.length === 1
        ? 1
        : 0;
    return [
      {
        recordId: record.id,
        employeeId: emp.id,
        employeeName: emp.name,
        position: m.position,
        period: record.period,
        vehicleType: record.vehicleType,
        cartonNominal,
        dropPointNominal,
        grossAmount: gross,
        splitRatio,
        qualityPassed,
        finalAmount: Math.round(gross * splitRatio),
        teamId: team.id,
        teamName: team.name,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Agregasi
// ---------------------------------------------------------------------------

export function calculateAllParameter(data: AppData): IncentiveResult[] {
  const results: IncentiveResult[] = [];

  for (const record of data.achievementRecords) {
    if (record.teamId) {
      const team = data.teams.find((t) => t.id === record.teamId);
      if (!team) continue;
      results.push(...calculateTeamParameterIncentive(data, record, team));
      continue;
    }

    if (!record.employeeId) continue;
    const employee = data.employees.find((e) => e.id === record.employeeId);
    if (!employee) continue;
    results.push(calculateParameterIncentive(data, record, employee));
  }

  return results;
}

export function calculateAllDelivery(data: AppData): DeliveryResult[] {
  const results: DeliveryResult[] = [];

  for (const record of data.deliveryRecords) {
    if (record.teamId) {
      const team = data.teams.find((t) => t.id === record.teamId);
      if (!team) continue;
      results.push(...calculateTeamDeliveryIncentive(data, record, team));
      continue;
    }

    if (!record.employeeId) continue;
    const employee = data.employees.find((e) => e.id === record.employeeId);
    if (!employee) continue;
    results.push(calculateDeliveryIncentive(data, record, employee));
  }

  return results;
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
