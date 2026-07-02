import type { FormulaTemplate } from "@/types";

export interface FormulaTemplateMeta {
  id: FormulaTemplate;
  name: string;
  description: string;
  formula: string;
}

export const FORMULA_TEMPLATES: FormulaTemplateMeta[] = [
  {
    id: "paramIndependent",
    name: "Parameter Mandiri (default dokumen)",
    description:
      "Setiap parameter dihitung sendiri: tier pencapaian per parameter, nominal = breakdown bobot × total tier.",
    formula: "Gross = Σ breakdown[paramᵢ pada tier pencapaian paramᵢ]",
  },
  {
    id: "weightedAverageTier",
    name: "Tier Rata-rata Tertimbang",
    description:
      "Satu tier dari rata-rata tertimbang pencapaian (bobot). Gross = total nominal tier tersebut.",
    formula: "Tier = f(Σ pencapaianᵢ × bobotᵢ) → Gross = total nominal tier",
  },
  {
    id: "simpleAverageTier",
    name: "Tier Rata-rata Sederhana",
    description:
      "Satu tier dari rata-rata sederhana semua parameter aktif. Gross = total nominal tier tersebut.",
    formula: "Tier = f(Σ pencapaianᵢ / n) → Gross = total nominal tier",
  },
  {
    id: "maxTier",
    name: "Tier Tertinggi",
    description:
      "Tier ditentukan dari pencapaian parameter tertinggi. Gross = total nominal tier tersebut.",
    formula: "Tier = f(max pencapaianᵢ) → Gross = total nominal tier",
  },
  {
    id: "minTier",
    name: "Tier Terendah",
    description:
      "Tier ditentukan dari pencapaian parameter terendah. Gross = total nominal tier tersebut.",
    formula: "Tier = f(min pencapaianᵢ) → Gross = total nominal tier",
  },
];

export function getFormulaTemplateMeta(
  id: FormulaTemplate,
): FormulaTemplateMeta {
  return (
    FORMULA_TEMPLATES.find((t) => t.id === id) ?? FORMULA_TEMPLATES[0]
  );
}
