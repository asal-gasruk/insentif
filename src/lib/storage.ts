import { seedData, STORAGE_KEY } from "@/data/seed";
import type {
  AppData,
  CollectionKey,
  IncentiveScheme,
  PenaltyRule,
} from "@/types";

const LEGACY_STORAGE_KEYS = [
  "lahans-insentif-v6",
  "lahans-insentif-v5",
  "lahans-insentif-v4",
  "lahans-insentif-v3",
  "lahans-insentif-v2",
  "lahans-insentif-v1",
];

function cloneSeed(): AppData {
  return JSON.parse(JSON.stringify(seedData)) as AppData;
}

function mergeMissingById<T extends { id: string }>(
  current: T[],
  fromSeed: T[],
): T[] {
  const ids = new Set(current.map((x) => x.id));
  return [...current, ...fromSeed.filter((x) => !ids.has(x.id))];
}

/** ID record contoh dari seed lama — dibersihkan agar data transaksi mulai kosong */
const SEED_DEMO_RECORD_IDS = new Set(["ach-1", "ach-2", "ach-3", "del-1", "del-2"]);

type LegacyPenalty = {
  overdueThresholdPct?: number;
  reductionPct?: number;
  suspendAfterDays?: number;
  voidAfterDays?: number;
};

function migratePenalties(legacy?: LegacyPenalty): PenaltyRule[] {
  const suspend = legacy?.suspendAfterDays ?? 60;
  const voidOffset = legacy?.voidAfterDays ?? 30;
  return [
    {
      id: "pen-overdue",
      label: "Penalty Overdue Piutang",
      enabled: true,
      condition: {
        field: "overduePct",
        operator: "gt",
        value: legacy?.overdueThresholdPct ?? 0.5,
      },
      action: {
        type: "reducePercent",
        reductionPct: legacy?.reductionPct ?? 10,
      },
    },
    {
      id: "pen-suspend",
      label: "Penangguhan Bad Debt",
      enabled: true,
      condition: { field: "badDebtDays", operator: "gt", value: suspend },
      action: { type: "suspend" },
    },
    {
      id: "pen-void",
      label: "Penghapusan Bad Debt",
      enabled: true,
      condition: {
        field: "badDebtDays",
        operator: "gt",
        value: suspend + voidOffset,
      },
      action: { type: "void" },
    },
  ];
}

function migrateScheme(scheme: IncentiveScheme & { penalty?: LegacyPenalty }): IncentiveScheme {
  let migrated: IncentiveScheme;

  if (Array.isArray(scheme.penalties) && scheme.penalties.length > 0) {
    migrated = {
      ...scheme,
      formulaMode: scheme.formulaMode ?? "template",
      formulaTemplate: scheme.formulaTemplate ?? "paramIndependent",
    };
  } else {
    const { penalty, ...rest } = scheme;
    migrated = {
      ...rest,
      penalties: migratePenalties(penalty),
      formulaMode: scheme.formulaMode ?? "template",
      formulaTemplate: scheme.formulaTemplate ?? "paramIndependent",
    };
  }

  return migrated;
}

/**
 * Migrasi ringan: isi notes dari seed jika belum ada, dan tambahkan
 * role/skema/bobot/nominal/tier baru dari seed yang belum ada di data lama.
 */
function enrichNotes(data: AppData): AppData {
  const seed = cloneSeed();
  const seedParams = new Map(seed.parameters.map((p) => [p.id, p.notes]));
  const seedSchemes = new Map(seed.schemes.map((s) => [s.id, s.notes]));

  const parameters = mergeMissingById(
    (data.parameters ?? []).map((p) => ({
      ...p,
      notes: p.notes?.trim() ? p.notes : seedParams.get(p.id),
    })),
    seed.parameters,
  );

  const schemes = mergeMissingById(
    (data.schemes ?? []).map((s) => {
      const migrated = migrateScheme(s as IncentiveScheme & { penalty?: LegacyPenalty });
      const seedNote = seedSchemes.get(migrated.id);
      const legacy = !migrated.notes || migrated.notes.length < 60;
      return {
        ...migrated,
        notes: legacy && seedNote ? seedNote : migrated.notes,
      };
    }),
    seed.schemes,
  );

  return {
    ...data,
    parameters,
    schemes,
    achievementTiers: mergeMissingById(
      data.achievementTiers ?? [],
      seed.achievementTiers,
    ),
    roles: mergeMissingById(data.roles ?? [], seed.roles),
    schemeWeights: mergeMissingById(data.schemeWeights ?? [], seed.schemeWeights),
    schemeNominals: mergeMissingById(
      data.schemeNominals ?? [],
      seed.schemeNominals,
    ),
    volumeTiers: mergeMissingById(data.volumeTiers ?? [], seed.volumeTiers),
    employees: mergeMissingById(data.employees ?? [], seed.employees),
    achievementRecords: (data.achievementRecords ?? []).filter(
      (r) => !SEED_DEMO_RECORD_IDS.has(r.id),
    ),
    deliveryRecords: (data.deliveryRecords ?? []).filter(
      (r) => !SEED_DEMO_RECORD_IDS.has(r.id),
    ),
  };
}

export function loadData(): AppData {
  if (typeof window === "undefined") return cloneSeed();

  let raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    for (const key of LEGACY_STORAGE_KEYS) {
      const legacy = localStorage.getItem(key);
      if (legacy) {
        raw = legacy;
        localStorage.removeItem(key);
        break;
      }
    }
  }

  if (!raw) {
    const initial = cloneSeed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  try {
    const parsed = JSON.parse(raw) as AppData;
    if (!Array.isArray(parsed.schemes)) throw new Error("stale schema");
    const enriched = enrichNotes(parsed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enriched));
    return enriched;
  } catch {
    const initial = cloneSeed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
}

export function saveData(data: AppData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent("lahans-storage-update"));
}

export function resetData(): AppData {
  const initial = cloneSeed();
  saveData(initial);
  return initial;
}

export function createItem<T extends { id: string }>(
  data: AppData,
  key: CollectionKey,
  item: T,
): AppData {
  const next = { ...data, [key]: [...data[key], item] };
  saveData(next);
  return next;
}

export function updateItem<T extends { id: string }>(
  data: AppData,
  key: CollectionKey,
  item: T,
): AppData {
  const collection = data[key].map((row) =>
    row.id === item.id ? item : row,
  ) as AppData[typeof key];
  const next = { ...data, [key]: collection };
  saveData(next);
  return next;
}

export function deleteItem(
  data: AppData,
  key: CollectionKey,
  id: string,
): AppData {
  const next = {
    ...data,
    [key]: data[key].filter((row) => row.id !== id),
  };
  saveData(next);
  return next;
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
