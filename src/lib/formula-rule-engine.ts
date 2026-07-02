import type {
  AchievementTier,
  FormulaAggregation,
  FormulaRuleConfig,
  NominalSource,
  ParamFormulaRule,
  SchemeNominal,
  SchemeWeight,
} from "@/types";
import {
  minPctForTier,
} from "@/data/formula-rules";
import type { FormulaContext, FormulaResult } from "@/lib/formula-engine";

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
  ctx: FormulaContext,
  tierId: string,
): SchemeNominal | undefined {
  const { data, scheme, record, employee } = ctx;
  return data.schemeNominals.find(
    (n) =>
      n.schemeId === scheme.id &&
      n.segmentId === record.segmentId &&
      n.teamSize === employee.teamSize &&
      n.achievementTierId === tierId,
  );
}

function amountFromSource(
  nominalRow: SchemeNominal,
  weightRow: SchemeWeight,
  paramId: string,
  source: NominalSource,
): number {
  switch (source) {
    case "fullTotal":
      return nominalRow.totalNominal;
    case "weightTimesTotal":
      return Math.round(
        nominalRow.totalNominal * (weightRow.weights[paramId] ?? 0),
      );
    case "breakdownSlice":
    default:
      return (
        nominalRow.breakdown[paramId] ??
        Math.round(
          nominalRow.totalNominal * (weightRow.weights[paramId] ?? 0),
        )
      );
  }
}

function tierLabel(tiers: AchievementTier[], pct: number): string {
  return resolveTier(tiers, pct)?.label ?? "Di bawah tier minimum";
}

function aggregatePct(
  aggregation: FormulaAggregation,
  ctx: FormulaContext,
  paramIds: string[],
): number {
  const { record, weightRow } = ctx;
  if (paramIds.length === 0) return 0;

  const values = paramIds.map((p) => record.achievements[p] ?? 0);

  switch (aggregation) {
    case "weightedAvgTier": {
      let weighted = 0;
      let totalWeight = 0;
      for (const p of paramIds) {
        const w = weightRow.weights[p] ?? 0;
        if (w <= 0) continue;
        weighted += (record.achievements[p] ?? 0) * w;
        totalWeight += w;
      }
      return totalWeight > 0 ? weighted / totalWeight : 0;
    }
    case "simpleAvgTier":
      return values.reduce((s, v) => s + v, 0) / values.length;
    case "maxTier":
      return Math.max(...values);
    case "minTier":
      return Math.min(...values);
    default:
      return 0;
  }
}

function effectiveMinPct(
  rule: ParamFormulaRule,
  tiers: AchievementTier[],
): number {
  if (rule.onlyTierId) {
    return minPctForTier(tiers, rule.onlyTierId);
  }
  return rule.minAchievementPct;
}

function applyParamRule(
  rule: ParamFormulaRule,
  ctx: FormulaContext,
): number {
  const { record, weightRow, tiers } = ctx;
  const pct = record.achievements[rule.paramId] ?? 0;
  const minPct = effectiveMinPct(rule, tiers);

  if (pct < minPct) return 0;

  const tier = resolveTier(tiers, pct);
  if (!tier) return 0;
  if (rule.onlyTierId && tier.id !== rule.onlyTierId) return 0;

  const nominalRow = findNominalRow(ctx, tier.id);
  if (!nominalRow) return 0;

  const base = amountFromSource(
    nominalRow,
    weightRow,
    rule.paramId,
    rule.nominalSource,
  );
  return Math.round(base * rule.multiplier);
}

function computeSumPerParam(
  config: FormulaRuleConfig,
  ctx: FormulaContext,
  rules: ParamFormulaRule[],
): FormulaResult {
  const parameterBreakdown: Record<string, number> = {};
  let gross = 0;
  const pcts: number[] = [];

  for (const rule of rules) {
    const amount = applyParamRule(rule, ctx);
    if (amount <= 0) continue;
    parameterBreakdown[rule.paramId] = amount;
    gross += amount;
    pcts.push(ctx.record.achievements[rule.paramId] ?? 0);
  }

  const avgPct =
    pcts.length > 0 ? pcts.reduce((s, v) => s + v, 0) / pcts.length : 0;

  return {
    parameterBreakdown,
    grossAmount: gross,
    tierLabel: tierLabel(ctx.tiers, avgPct),
    aggregatePct: avgPct,
  };
}

function computeAggregate(
  config: FormulaRuleConfig,
  ctx: FormulaContext,
  rules: ParamFormulaRule[],
): FormulaResult {
  const paramIds = rules.map((r) => r.paramId);
  const pct = aggregatePct(config.aggregation, ctx, paramIds);
  const tier = resolveTier(ctx.tiers, pct);

  if (!tier) {
    return {
      parameterBreakdown: {},
      grossAmount: 0,
      tierLabel: tierLabel(ctx.tiers, pct),
      aggregatePct: pct,
    };
  }

  const nominalRow = findNominalRow(ctx, tier.id);
  if (!nominalRow) {
    return {
      parameterBreakdown: {},
      grossAmount: 0,
      tierLabel: tier.label,
      aggregatePct: pct,
    };
  }

  const parameterBreakdown: Record<string, number> = {};

  if (config.aggregateNominalSource === "fullTotal") {
    const gross = Math.round(
      nominalRow.totalNominal * config.aggregateMultiplier,
    );
    for (const rule of rules) {
      const slice = amountFromSource(
        nominalRow,
        ctx.weightRow,
        rule.paramId,
        "breakdownSlice",
      );
      parameterBreakdown[rule.paramId] = Math.round(slice * rule.multiplier);
    }
    return {
      parameterBreakdown,
      grossAmount: gross,
      tierLabel: tier.label,
      aggregatePct: pct,
    };
  }

  let gross = 0;
  for (const rule of rules) {
    const slice = amountFromSource(
      nominalRow,
      ctx.weightRow,
      rule.paramId,
      rule.nominalSource,
    );
    const amount = Math.round(
      slice * rule.multiplier * config.aggregateMultiplier,
    );
    if (amount > 0) {
      parameterBreakdown[rule.paramId] = amount;
      gross += amount;
    }
  }

  return {
    parameterBreakdown,
    grossAmount: gross,
    tierLabel: tier.label,
    aggregatePct: pct,
  };
}

export function computeFormulaRules(
  config: FormulaRuleConfig,
  ctx: FormulaContext,
): FormulaResult {
  const enabledRules = config.paramRules.filter((r) => r.enabled);

  if (enabledRules.length === 0) {
    return {
      parameterBreakdown: {},
      grossAmount: 0,
      tierLabel: "Tidak ada aturan aktif",
      aggregatePct: 0,
    };
  }

  if (config.aggregation === "sumPerParam") {
    return computeSumPerParam(config, ctx, enabledRules);
  }

  return computeAggregate(config, ctx, enabledRules);
}
