import type {
  AchievementRecord,
  AchievementTier,
  AppData,
  Employee,
  FormulaTemplate,
  IncentiveScheme,
  SchemeNominal,
  SchemeWeight,
} from "@/types";

export interface FormulaContext {
  data: AppData;
  scheme: IncentiveScheme;
  record: AchievementRecord;
  employee: Employee;
  weightRow: SchemeWeight;
  activeParams: string[];
  tiers: AchievementTier[];
}

export interface FormulaResult {
  parameterBreakdown: Record<string, number>;
  grossAmount: number;
  tierLabel: string;
  aggregatePct: number;
}

function resolveTier(
  tiers: AchievementTier[],
  pct: number,
): AchievementTier | undefined {
  return tiers.find((t) => {
    if (t.maxPct === null) return pct >= t.minPct;
    return pct >= t.minPct && pct < t.maxPct;
  });
}

function findNominalRow(
  data: AppData,
  schemeId: string,
  segmentId: string,
  teamSize: number,
  tierId: string,
): SchemeNominal | undefined {
  return data.schemeNominals.find(
    (n) =>
      n.schemeId === schemeId &&
      n.segmentId === segmentId &&
      n.teamSize === teamSize &&
      n.achievementTierId === tierId,
  );
}

function breakdownFromNominal(
  nominalRow: SchemeNominal,
  weightRow: SchemeWeight,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [paramId, w] of Object.entries(weightRow.weights)) {
    if (w === null || w <= 0) continue;
    result[paramId] =
      nominalRow.breakdown[paramId] ??
      Math.round(nominalRow.totalNominal * w);
  }
  return result;
}

function aggregatePct(
  template: FormulaTemplate,
  ctx: FormulaContext,
): number {
  const { activeParams, record, weightRow } = ctx;
  if (activeParams.length === 0) return 0;

  const values = activeParams.map((p) => record.achievements[p] ?? 0);

  switch (template) {
    case "weightedAverageTier": {
      let weighted = 0;
      let totalWeight = 0;
      for (const p of activeParams) {
        const w = weightRow.weights[p] ?? 0;
        if (w <= 0) continue;
        weighted += (record.achievements[p] ?? 0) * w;
        totalWeight += w;
      }
      return totalWeight > 0 ? weighted / totalWeight : 0;
    }
    case "simpleAverageTier":
      return values.reduce((s, v) => s + v, 0) / values.length;
    case "maxTier":
      return Math.max(...values);
    case "minTier":
      return Math.min(...values);
    default:
      return 0;
  }
}

function tierLabel(
  tiers: AchievementTier[],
  pct: number,
): string {
  return resolveTier(tiers, pct)?.label ?? "Di bawah tier minimum";
}

/** Skema parameter mandiri — setiap param punya tier & slice sendiri */
export function computeParamIndependent(ctx: FormulaContext): FormulaResult {
  const { data, scheme, record, employee, weightRow, activeParams, tiers } =
    ctx;

  const parameterBreakdown: Record<string, number> = {};
  let gross = 0;

  for (const paramId of activeParams) {
    const pct = record.achievements[paramId] ?? 0;
    const tier = resolveTier(tiers, pct);
    if (!tier) continue;

    const nominalRow = findNominalRow(
      data,
      scheme.id,
      record.segmentId,
      employee.teamSize,
      tier.id,
    );
    if (!nominalRow) continue;

    const slice =
      nominalRow.breakdown[paramId] ??
      Math.round(
        nominalRow.totalNominal * (weightRow.weights[paramId] ?? 0),
      );
    if (slice <= 0) continue;

    parameterBreakdown[paramId] = slice;
    gross += slice;
  }

  const avgPct =
    activeParams.length > 0
      ? activeParams.reduce((s, p) => s + (record.achievements[p] ?? 0), 0) /
        activeParams.length
      : 0;

  return {
    parameterBreakdown,
    grossAmount: gross,
    tierLabel: tierLabel(tiers, avgPct),
    aggregatePct: avgPct,
  };
}

/** Skema agregat — satu tier, gross = total nominal tier */
export function computeAggregateTier(
  ctx: FormulaContext,
  template: Exclude<FormulaTemplate, "paramIndependent">,
): FormulaResult {
  const { data, scheme, record, employee, weightRow, tiers } = ctx;

  const pct = aggregatePct(template, ctx);
  const tier = resolveTier(tiers, pct);

  if (!tier) {
    return {
      parameterBreakdown: {},
      grossAmount: 0,
      tierLabel: tierLabel(tiers, pct),
      aggregatePct: pct,
    };
  }

  const nominalRow = findNominalRow(
    data,
    scheme.id,
    record.segmentId,
    employee.teamSize,
    tier.id,
  );

  if (!nominalRow) {
    return {
      parameterBreakdown: {},
      grossAmount: 0,
      tierLabel: tier.label,
      aggregatePct: pct,
    };
  }

  const parameterBreakdown = breakdownFromNominal(nominalRow, weightRow);
  const gross = nominalRow.totalNominal;

  return {
    parameterBreakdown,
    grossAmount: gross,
    tierLabel: tier.label,
    aggregatePct: pct,
  };
}

export function computeFormula(
  template: FormulaTemplate,
  ctx: FormulaContext,
): FormulaResult {
  if (template === "paramIndependent") {
    return computeParamIndependent(ctx);
  }
  return computeAggregateTier(ctx, template);
}
