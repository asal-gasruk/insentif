export type BranchTypeId = "TB" | "LB" | "MB" | "SB" | "NB";

export interface BranchType {
  id: BranchTypeId;
  name: string;
  nameEn: string;
}

export interface Role {
  id: string;
  name: string;
  sheet: string;
}

export interface Parameter {
  id: string;
  name: string;
  unit: string;
  shortLabel?: string;
  /** Definisi / catatan dari dokumen Excel */
  notes?: string;
}

export interface AchievementTier {
  id: string;
  label: string;
  minPct: number;
  maxPct: number | null;
}

export interface Branch {
  id: string;
  name: string;
  branchType: BranchTypeId;
}

// ---------------------------------------------------------------------------
// Skema Insentif (konfigurasi dinamis per role)
// ---------------------------------------------------------------------------

export type SchemeType = "parameter" | "volumeTier";

export type SegmentDimension =
  | "branchType"
  | "area"
  | "distribution"
  | "vehicle"
  | "none";

export type SchemePeriod = "monthly" | "quarterly";

export interface SchemeSegment {
  id: string;
  name: string;
}

export type PenaltyConditionField = "overduePct" | "badDebtDays";
export type PenaltyConditionOp = "gt" | "gte";
export type PenaltyActionType = "reducePercent" | "suspend" | "void";

export interface PenaltyRule {
  id: string;
  label: string;
  enabled: boolean;
  condition: {
    field: PenaltyConditionField;
    operator: PenaltyConditionOp;
    value: number;
  };
  action: {
    type: PenaltyActionType;
    reductionPct?: number;
  };
}

export type FormulaTemplate =
  | "paramIndependent"
  | "weightedAverageTier"
  | "simpleAverageTier"
  | "maxTier"
  | "minTier";

/** template = preset cepat · rules = rule builder per parameter */
export type FormulaMode = "template" | "rules";

export type FormulaAggregation =
  | "sumPerParam"
  | "weightedAvgTier"
  | "simpleAvgTier"
  | "maxTier"
  | "minTier";

/** Sumber nominal saat pencapaian masuk tier */
export type NominalSource =
  | "breakdownSlice"
  | "weightTimesTotal"
  | "fullTotal";

/** Aturan per parameter — IF pencapaian masuk tier → nominal × multiplier */
export interface ParamFormulaRule {
  id: string;
  paramId: string;
  enabled: boolean;
  label: string;
  /** Pencapaian minimum (%) agar aturan berlaku */
  minAchievementPct: number;
  /** Jika diisi, hanya berlaku saat tier ter-resolve sama persis */
  onlyTierId?: string;
  nominalSource: NominalSource;
  /** Faktor pengali hasil (1 = 100%) */
  multiplier: number;
}

export interface FormulaRuleConfig {
  aggregation: FormulaAggregation;
  paramRules: ParamFormulaRule[];
  /** Untuk mode agregat: sumber nominal setelah tier ditentukan */
  aggregateNominalSource: "fullTotal" | "sumBreakdown";
  aggregateMultiplier: number;
}

/** Pembagian insentif antar anggota tim. key = teamSize (skema parameter) atau vehicleType (delivery) */
export interface TeamSplit {
  key: string;
  split: Record<string, number>;
}

export interface IncentiveScheme {
  id: string;
  roleId: string;
  name: string;
  type: SchemeType;
  segmentDimension: SegmentDimension;
  segments: SchemeSegment[];
  period: SchemePeriod;
  /** Aturan penalty — bisa lebih dari satu, dievaluasi berurutan */
  penalties: PenaltyRule[];
  /** template = pilih preset · rules = rule builder custom */
  formulaMode: FormulaMode;
  /** Template rumus (jika formulaMode = template) */
  formulaTemplate: FormulaTemplate;
  /** Rule builder (jika formulaMode = rules) */
  formulaRuleConfig?: FormulaRuleConfig;
  teamSplits: TeamSplit[];
  notes?: string;
}

export interface SchemeWeight {
  id: string;
  schemeId: string;
  segmentId: string;
  weights: Record<string, number | null>;
}

export interface SchemeNominal {
  id: string;
  schemeId: string;
  segmentId: string;
  teamSize: number;
  achievementTierId: string;
  totalNominal: number;
  /** Nominal per parameter; jika kosong dihitung dari bobot x total */
  breakdown: Record<string, number>;
}

/** Tier insentif Delivery Team (kartonase / drop point per jenis armada) */
export interface VolumeTier {
  id: string;
  schemeId: string;
  vehicleType: string;
  component: "cartonnage" | "dropPoint";
  minQty: number;
  maxQty: number | null;
  nominal: number;
}

// ---------------------------------------------------------------------------
// Data operasional
// ---------------------------------------------------------------------------

export type EmployeePosition =
  | "salesman"
  | "driver"
  | "helper1"
  | "helper2"
  | "supervisor"
  | "manager"
  | "other";

export interface Employee {
  id: string;
  name: string;
  nik: string;
  roleId: string;
  branchId: string;
  position: EmployeePosition;
  teamSize: number;
  vehicleType?: string;
  active: boolean;
}

export interface AchievementRecord {
  id: string;
  employeeId: string;
  period: string;
  schemeId: string;
  segmentId: string;
  /** % pencapaian per parameter (paramId -> pct) */
  achievements: Record<string, number>;
  overduePct: number;
  badDebtDays: number;
  notes: string;
}

export interface DeliveryRecord {
  id: string;
  employeeId: string;
  period: string;
  vehicleType: string;
  cartons: number;
  invoices: number;
  otdPct: number;
  accuracyPct: number;
  notes: string;
}

// ---------------------------------------------------------------------------
// Hasil perhitungan
// ---------------------------------------------------------------------------

export interface IncentiveResult {
  recordId: string;
  employeeId: string;
  employeeName: string;
  position: string;
  period: string;
  schemeName: string;
  segmentName: string;
  tierLabel: string;
  parameterBreakdown: Record<string, number>;
  grossAmount: number;
  splitRatio: number;
  penaltyPct: number;
  suspended: boolean;
  voided: boolean;
  finalAmount: number;
}

export interface DeliveryResult {
  recordId: string;
  employeeId: string;
  employeeName: string;
  position: string;
  period: string;
  vehicleType: string;
  cartonNominal: number;
  dropPointNominal: number;
  grossAmount: number;
  splitRatio: number;
  qualityPassed: boolean;
  finalAmount: number;
}

// ---------------------------------------------------------------------------
// Root state
// ---------------------------------------------------------------------------

export interface AppData {
  branchTypes: BranchType[];
  roles: Role[];
  parameters: Parameter[];
  achievementTiers: AchievementTier[];
  branches: Branch[];
  schemes: IncentiveScheme[];
  schemeWeights: SchemeWeight[];
  schemeNominals: SchemeNominal[];
  volumeTiers: VolumeTier[];
  employees: Employee[];
  achievementRecords: AchievementRecord[];
  deliveryRecords: DeliveryRecord[];
}

export type CollectionKey = keyof Pick<
  AppData,
  | "parameters"
  | "achievementTiers"
  | "branches"
  | "schemes"
  | "schemeWeights"
  | "schemeNominals"
  | "volumeTiers"
  | "employees"
  | "achievementRecords"
  | "deliveryRecords"
>;
