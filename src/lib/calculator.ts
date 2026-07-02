import type {
  AchievementRecord,
  AppData,
  DeliveryRecord,
  DeliveryResult,
  Employee,
  IncentiveResult,
  IncentiveScheme,
} from "@/types";
import { computeFormula } from "@/lib/formula-engine";
import { computeFormulaRules } from "@/lib/formula-rule-engine";
import { evaluatePenalties } from "@/lib/penalty-engine";

function getSplitRatio(
  scheme: IncentiveScheme,
  key: string,
  position: string,
): number {
  const split = scheme.teamSplits.find((s) => s.key === key)?.split;
  if (!split) return 1;
  return split[position] ?? 0;
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

  const weightRow = data.schemeWeights.find(
    (w) => w.schemeId === scheme.id && w.segmentId === record.segmentId,
  );
  if (!weightRow) return { ...base, tierLabel: "Bobot belum dikonfigurasi" };

  const activeParams = Object.entries(weightRow.weights)
    .filter(([, w]) => w !== null && w > 0)
    .map(([paramId]) => paramId);

  const formulaCtx = {
    data,
    scheme,
    record,
    employee,
    weightRow,
    activeParams,
    tiers: data.achievementTiers,
  };

  const formulaResult =
    scheme.formulaMode === "rules" && scheme.formulaRuleConfig
      ? computeFormulaRules(scheme.formulaRuleConfig, formulaCtx)
      : computeFormula(scheme.formulaTemplate ?? "paramIndependent", formulaCtx);

  const splitRatio = getSplitRatio(
    scheme,
    String(employee.teamSize),
    employee.position,
  );

  const penaltyResult = evaluatePenalties(scheme.penalties ?? [], record);

  let finalAmount = Math.round(
    formulaResult.grossAmount * splitRatio * (1 - penaltyResult.penaltyPct / 100),
  );
  if (penaltyResult.suspended || penaltyResult.voided) finalAmount = 0;

  return {
    ...base,
    tierLabel: formulaResult.tierLabel,
    parameterBreakdown: formulaResult.parameterBreakdown,
    grossAmount: formulaResult.grossAmount,
    splitRatio,
    penaltyPct: penaltyResult.penaltyPct,
    suspended: penaltyResult.suspended,
    voided: penaltyResult.voided,
    finalAmount,
  };
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
  const scheme = data.schemes.find((s) => s.type === "volumeTier");

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

// ---------------------------------------------------------------------------
// Agregasi
// ---------------------------------------------------------------------------

export function calculateAllParameter(data: AppData): IncentiveResult[] {
  return data.achievementRecords
    .map((record) => {
      const employee = data.employees.find((e) => e.id === record.employeeId);
      if (!employee) return null;
      return calculateParameterIncentive(data, record, employee);
    })
    .filter((r): r is IncentiveResult => r !== null);
}

export function calculateAllDelivery(data: AppData): DeliveryResult[] {
  return data.deliveryRecords
    .map((record) => {
      const employee = data.employees.find((e) => e.id === record.employeeId);
      if (!employee) return null;
      return calculateDeliveryIncentive(data, record, employee);
    })
    .filter((r): r is DeliveryResult => r !== null);
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
