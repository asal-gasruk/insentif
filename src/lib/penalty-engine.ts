import type {
  AchievementRecord,
  PenaltyActionType,
  PenaltyRule,
} from "@/types";

export interface PenaltyEvaluation {
  penaltyPct: number;
  suspended: boolean;
  voided: boolean;
  matchedRules: string[];
}

function getFieldValue(
  record: AchievementRecord,
  field: PenaltyRule["condition"]["field"],
): number {
  return field === "overduePct" ? record.overduePct : record.badDebtDays;
}

function conditionMet(
  record: AchievementRecord,
  rule: PenaltyRule,
): boolean {
  if (!rule.enabled) return false;
  const value = getFieldValue(record, rule.condition.field);
  const threshold = rule.condition.value;
  return rule.condition.operator === "gt"
    ? value > threshold
    : value >= threshold;
}

export function evaluatePenalties(
  rules: PenaltyRule[],
  record: AchievementRecord,
): PenaltyEvaluation {
  let penaltyPct = 0;
  let suspended = false;
  let voided = false;
  const matchedRules: string[] = [];

  for (const rule of rules) {
    if (!conditionMet(record, rule)) continue;
    matchedRules.push(rule.label);

    const action = rule.action.type;
    if (action === "reducePercent") {
      penaltyPct += rule.action.reductionPct ?? 0;
    } else if (action === "suspend") {
      suspended = true;
    } else if (action === "void") {
      voided = true;
    }
  }

  return {
    penaltyPct: Math.min(100, penaltyPct),
    suspended,
    voided,
    matchedRules,
  };
}

export const PENALTY_ACTION_LABELS: Record<PenaltyActionType, string> = {
  reducePercent: "Potongan (%)",
  suspend: "Penangguhan (insentif = 0)",
  void: "Penghapusan (insentif = 0)",
};

export const PENALTY_FIELD_LABELS: Record<
  PenaltyRule["condition"]["field"],
  string
> = {
  overduePct: "Overdue Piutang (%)",
  badDebtDays: "Bad Debt (hari)",
};

export function formatPenaltySummary(rules: PenaltyRule[]): string {
  const active = rules.filter((r) => r.enabled);
  if (active.length === 0) return "Tidak ada aturan penalty aktif";
  return active
    .map((r) => {
      const field = PENALTY_FIELD_LABELS[r.condition.field];
      const op = r.condition.operator === "gt" ? ">" : "≥";
      if (r.action.type === "reducePercent") {
        return `${r.label}: ${field} ${op} ${r.condition.value} → potong ${r.action.reductionPct ?? 0}%`;
      }
      return `${r.label}: ${field} ${op} ${r.condition.value}`;
    })
    .join(" · ");
}
