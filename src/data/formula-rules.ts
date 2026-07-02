import type {
  AchievementTier,
  AppData,
  FormulaAggregation,
  FormulaRuleConfig,
  NominalSource,
  ParamFormulaRule,
} from "@/types";

export const FORMULA_AGGREGATION_LABELS: Record<FormulaAggregation, string> = {
  sumPerParam: "Jumlahkan per Parameter (mandiri)",
  weightedAvgTier: "Satu Tier — Rata-rata Tertimbang",
  simpleAvgTier: "Satu Tier — Rata-rata Sederhana",
  maxTier: "Satu Tier — Pencapaian Tertinggi",
  minTier: "Satu Tier — Pencapaian Terendah",
};

export const NOMINAL_SOURCE_LABELS: Record<NominalSource, string> = {
  breakdownSlice: "Slice breakdown (bobot × total tier)",
  weightTimesTotal: "Bobot × total nominal tier",
  fullTotal: "Total nominal tier (penuh)",
};

export function lowestTierMinPct(tiers: AchievementTier[]): number {
  if (tiers.length === 0) return 70;
  return Math.min(...tiers.map((t) => t.minPct));
}

export function minPctForTier(
  tiers: AchievementTier[],
  tierId?: string,
): number {
  if (!tierId) return lowestTierMinPct(tiers);
  return tiers.find((t) => t.id === tierId)?.minPct ?? 70;
}

export function tierLabelById(
  tiers: AchievementTier[],
  tierId?: string,
): string | undefined {
  return tiers.find((t) => t.id === tierId)?.label;
}

export function createParamRule(
  paramId: string,
  label?: string,
  id?: string,
  tiers: AchievementTier[] = [],
): ParamFormulaRule {
  return {
    id: id ?? `fr-${paramId}-${Date.now()}`,
    paramId,
    enabled: true,
    label: label ?? paramId,
    minAchievementPct: lowestTierMinPct(tiers),
    nominalSource: "breakdownSlice",
    multiplier: 1,
  };
}

export function defaultFormulaRuleConfig(
  paramIds: string[] = [],
  tiers: AchievementTier[] = [],
): FormulaRuleConfig {
  return {
    aggregation: "sumPerParam",
    paramRules: paramIds.map((p) => createParamRule(p, undefined, undefined, tiers)),
    aggregateNominalSource: "fullTotal",
    aggregateMultiplier: 1,
  };
}

/** Parameter dengan bobot > 0 pada skema (gabungan semua segment) */
export function paramIdsFromSchemeWeights(
  data: AppData,
  schemeId: string,
): string[] {
  const ids = new Set<string>();
  data.schemeWeights
    .filter((w) => w.schemeId === schemeId)
    .forEach((w) => {
      Object.entries(w.weights).forEach(([paramId, weight]) => {
        if (weight !== null && weight > 0) ids.add(paramId);
      });
    });
  return [...ids].sort();
}

/** Sinkronkan aturan dengan daftar parameter dari bobot — pertahankan aturan yang sudah ada */
export function syncParamRulesFromWeights(
  existing: ParamFormulaRule[],
  paramIds: string[],
  data: AppData,
): ParamFormulaRule[] {
  const byParam = new Map(existing.map((r) => [r.paramId, r]));
  return paramIds.map((paramId) => {
    const prev = byParam.get(paramId);
    if (prev) return prev;
    const param = data.parameters.find((p) => p.id === paramId);
    return createParamRule(
      paramId,
      param?.shortLabel ?? param?.name ?? paramId,
      undefined,
      data.achievementTiers,
    );
  });
}

export function formatFormulaRuleSummary(
  config: FormulaRuleConfig | undefined,
): string {
  if (!config) return "Rule builder belum dikonfigurasi";
  const active = config.paramRules.filter((r) => r.enabled);
  const agg = FORMULA_AGGREGATION_LABELS[config.aggregation];
  if (active.length === 0) return `${agg} · belum ada parameter aktif`;
  const params = active.map((r) => r.label || r.paramId).join(", ");
  return `${agg} · ${active.length} aturan: ${params}`;
}

export function describeParamRule(
  rule: ParamFormulaRule,
  tiers: AchievementTier[] = [],
): string {
  const src = NOMINAL_SOURCE_LABELS[rule.nominalSource];
  const tierLabel = tierLabelById(tiers, rule.onlyTierId);
  const tierPart = tierLabel
    ? ` · tier ${tierLabel}`
    : rule.onlyTierId
      ? ` · tier ${rule.onlyTierId}`
      : "";
  const minPct = minPctForTier(tiers, rule.onlyTierId);
  const mult = rule.multiplier !== 1 ? ` × ${rule.multiplier}` : "";
  return `IF pencapaian ≥ ${minPct}%${tierPart} → ${src}${mult}`;
}
