import { getFormulaTemplateMeta } from "@/data/formula-templates";
import { activeParams, defaultSegment } from "@/lib/scheme-utils";
import type { AppData, Employee, IncentiveScheme } from "@/types";

const VEHICLE_TYPES = ["PICKUP", "ENGKEL", "DOUBLE"] as const;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function defaultPeriod(scheme: IncentiveScheme): string {
  return scheme.period === "quarterly" ? "2026-Q1" : "2026-02";
}

/** Union parameter yang punya bobot > 0 di salah satu segment skema */
export function schemeParamIds(data: AppData, schemeId: string): string[] {
  const scheme = data.schemes.find((s) => s.id === schemeId);
  if (!scheme) return [];

  const ids = new Set<string>();
  for (const seg of scheme.segments) {
    for (const paramId of activeParams(data, schemeId, seg.id)) {
      ids.add(paramId);
    }
  }
  return [...ids];
}

export function paramLabel(data: AppData, paramId: string): string {
  const p = data.parameters.find((x) => x.id === paramId);
  return p?.shortLabel ?? p?.name ?? paramId;
}

export function employeesForScheme(
  data: AppData,
  scheme: IncentiveScheme,
): Employee[] {
  return data.employees.filter(
    (e) => e.active && e.roleId === scheme.roleId,
  );
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(values: string[]): string {
  return values.map(csvEscape).join(",");
}

export type ImportTemplateMeta = {
  scheme: IncentiveScheme;
  kind: "achievement" | "delivery";
  periodLabel: string;
  segmentLabels: string;
  paramColumns: { id: string; label: string }[];
  formulaLabel: string;
  employeeCount: number;
};

export function getImportTemplateMeta(
  data: AppData,
  schemeId: string,
): ImportTemplateMeta | null {
  const scheme = data.schemes.find((s) => s.id === schemeId);
  if (!scheme) return null;

  const paramIds = schemeParamIds(data, scheme.id);
  const formulaLabel =
    scheme.formulaMode === "rules"
      ? `Rule Builder · ${scheme.formulaRuleConfig?.aggregation ?? "sumPerParam"}`
      : getFormulaTemplateMeta(scheme.formulaTemplate ?? "paramIndependent")
          .name;

  return {
    scheme,
    kind: scheme.type === "volumeTier" ? "delivery" : "achievement",
    periodLabel: scheme.period === "quarterly" ? "YYYY-Qn" : "YYYY-MM",
    segmentLabels: scheme.segments.map((s) => s.name).join(" · "),
    paramColumns: paramIds.map((id) => ({
      id,
      label: paramLabel(data, id),
    })),
    formulaLabel,
    employeeCount: employeesForScheme(data, scheme).length,
  };
}

function buildAchievementSamples(
  data: AppData,
  scheme: IncentiveScheme,
  headers: string[],
): string[][] {
  const paramCols = schemeParamIds(data, scheme.id);
  const period = defaultPeriod(scheme);
  const employees = employeesForScheme(data, scheme);

  const scenarios = [
    { overduePct: "0.3", badDebtDays: "0", suffix: "insentif penuh" },
    { overduePct: "1.2", badDebtDays: "0", suffix: "penalty overdue" },
    { overduePct: "0.4", badDebtDays: "75", suffix: "ditangguhkan (bad debt)" },
    { overduePct: "2", badDebtDays: "120", suffix: "hangus (bad debt)" },
  ];

  const rows: string[][] = [];

  if (employees.length > 0) {
    employees.forEach((emp, index) => {
      const segment = defaultSegment(data, emp);
      const active = activeParams(data, scheme.id, segment);
      const scenario = scenarios[index % scenarios.length];
      const pct = String(95 + (index % 5) * 3);

      rows.push(
        headers.map((h) => {
          if (h === "nik") return emp.nik;
          if (h === "periode") return period;
          if (h === "overduePct") return scenario.overduePct;
          if (h === "badDebtDays") return scenario.badDebtDays;
          if (h === "catatan") {
            return `contoh: ${emp.name} · segment ${segment} · ${scenario.suffix}`;
          }
          if (paramCols.includes(h)) {
            return active.includes(h) ? pct : "";
          }
          return "";
        }),
      );
    });
  } else {
    const seg = scheme.segments[0]?.id ?? "ALL";
    const active = activeParams(data, scheme.id, seg);
    rows.push(
      headers.map((h) => {
        if (h === "nik") return "NIK-KARYAWAN";
        if (h === "periode") return period;
        if (h === "overduePct") return "0.3";
        if (h === "badDebtDays") return "0";
        if (h === "catatan") {
          return `Ganti NIK dengan karyawan role ${scheme.roleId}`;
        }
        if (paramCols.includes(h)) {
          return active.includes(h) ? "100" : "";
        }
        return "";
      }),
    );
  }

  return rows;
}

function buildDeliverySamples(
  data: AppData,
  scheme: IncentiveScheme,
  headers: string[],
): string[][] {
  const period = defaultPeriod(scheme);
  const employees = employeesForScheme(data, scheme);

  const scenarios: Array<{
    karton: string;
    faktur: string;
    otdPct: string;
    akurasiPct: string;
    catatan: string;
    vehicleType?: string;
  }> = [
    {
      karton: "7800",
      faktur: "350",
      otdPct: "96",
      akurasiPct: "98",
      catatan: "contoh: quality OK · tier kartonase menengah",
    },
    {
      karton: "12500",
      faktur: "700",
      otdPct: "98",
      akurasiPct: "99",
      catatan: "contoh: quality OK · tier tertinggi",
    },
    {
      karton: "6200",
      faktur: "420",
      otdPct: "93",
      akurasiPct: "98",
      catatan: "contoh: OTD < 95% · quality gagal",
    },
    {
      karton: "2900",
      faktur: "500",
      otdPct: "97",
      akurasiPct: "96",
      catatan: "contoh: akurasi < 97% · quality gagal",
    },
  ];

  const rows: string[][] = [];

  if (employees.length > 0) {
    employees.forEach((emp, index) => {
      const scenario = scenarios[index % scenarios.length];
      const armada = (emp.vehicleType ?? "ENGKEL").toUpperCase();
      rows.push(
        headers.map((h) => {
          if (h === "nik") return emp.nik;
          if (h === "periode") return period;
          if (h === "armada") return armada;
          if (h === "karton") return scenario.karton;
          if (h === "faktur") return scenario.faktur;
          if (h === "otdPct") return scenario.otdPct;
          if (h === "akurasiPct") return scenario.akurasiPct;
          if (h === "catatan") {
            return `${scenario.catatan} · ${emp.name}`;
          }
          return "";
        }),
      );
    });
  } else {
    VEHICLE_TYPES.forEach((vehicle, index) => {
      const scenario = scenarios[index % scenarios.length];
      rows.push(
        headers.map((h) => {
          if (h === "nik") return "NIK-DELIVERY";
          if (h === "periode") return period;
          if (h === "armada") return vehicle;
          if (h === "karton") return scenario.karton;
          if (h === "faktur") return scenario.faktur;
          if (h === "otdPct") return scenario.otdPct;
          if (h === "akurasiPct") return scenario.akurasiPct;
          if (h === "catatan") {
            return `Ganti NIK · armada ${vehicle} · ${scenario.catatan}`;
          }
          return "";
        }),
      );
    });
  }

  return rows;
}

export function buildSchemeImportTemplate(
  data: AppData,
  schemeId: string,
): { filename: string; content: string } | null {
  const scheme = data.schemes.find((s) => s.id === schemeId);
  if (!scheme) return null;

  const slug = slugify(scheme.name);

  if (scheme.type === "volumeTier") {
    const headers = [
      "nik",
      "periode",
      "armada",
      "karton",
      "faktur",
      "otdPct",
      "akurasiPct",
      "catatan",
    ];
    const rows = buildDeliverySamples(data, scheme, headers);
    return {
      filename: `template-${slug}-pengiriman.csv`,
      content: [csvRow(headers), ...rows.map(csvRow)].join("\n"),
    };
  }

  const paramCols = schemeParamIds(data, scheme.id);
  const headers = [
    "nik",
    "periode",
    ...paramCols,
    "overduePct",
    "badDebtDays",
    "catatan",
  ];
  const rows = buildAchievementSamples(data, scheme, headers);

  return {
    filename: `template-${slug}-pencapaian.csv`,
    content: [csvRow(headers), ...rows.map(csvRow)].join("\n"),
  };
}
