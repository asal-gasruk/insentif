"use client";

import {
  FORMULA_AGGREGATION_LABELS,
  NOMINAL_SOURCE_LABELS,
  createParamRule,
  defaultFormulaRuleConfig,
  describeParamRule,
  lowestTierMinPct,
  minPctForTier,
  paramIdsFromSchemeWeights,
  syncParamRulesFromWeights,
} from "@/data/formula-rules";
import {
  getAggregationGuide,
} from "@/data/formula-aggregation-guide";
import { generateId } from "@/lib/storage";
import { Select2 } from "@/components/Select2";
import type {
  AppData,
  FormulaAggregation,
  FormulaMode,
  FormulaRuleConfig,
  IncentiveScheme,
  NominalSource,
  ParamFormulaRule,
} from "@/types";

function updateRuleAt(
  rules: ParamFormulaRule[],
  index: number,
  patch: Partial<ParamFormulaRule>,
): ParamFormulaRule[] {
  return rules.map((r, i) => (i === index ? { ...r, ...patch } : r));
}

function ensureConfig(scheme: IncentiveScheme): FormulaRuleConfig {
  return (
    scheme.formulaRuleConfig ??
    defaultFormulaRuleConfig()
  );
}

export function FormulaRuleEditor({
  form,
  setForm,
  data,
  schemeId,
}: {
  form: IncentiveScheme;
  setForm: (scheme: IncentiveScheme) => void;
  data: AppData;
  schemeId: string;
}) {
  const config = ensureConfig(form);
  const isAggregate = config.aggregation !== "sumPerParam";
  const aggGuide = getAggregationGuide(config.aggregation);

  const setMode = (formulaMode: FormulaMode) => {
    const next: IncentiveScheme = { ...form, formulaMode };
    if (formulaMode === "rules" && !form.formulaRuleConfig) {
      const paramIds = paramIdsFromSchemeWeights(data, schemeId || form.id);
      next.formulaRuleConfig = defaultFormulaRuleConfig(
        paramIds,
        data.achievementTiers,
      );
    }
    setForm(next);
  };

  const setConfig = (patch: Partial<FormulaRuleConfig>) => {
    setForm({
      ...form,
      formulaRuleConfig: { ...config, ...patch },
    });
  };

  const syncFromWeights = () => {
    const paramIds = paramIdsFromSchemeWeights(data, schemeId || form.id);
    if (paramIds.length === 0) {
      alert(
        "Belum ada bobot untuk skema ini. Atur bobot di halaman Bobot & Nominal terlebih dahulu.",
      );
      return;
    }
    setConfig({
      paramRules: syncParamRulesFromWeights(
        config.paramRules,
        paramIds,
        data,
      ),
    });
  };

  const addParamRule = () => {
    const unused = data.parameters.find(
      (p) => !config.paramRules.some((r) => r.paramId === p.id),
    );
    if (!unused) {
      alert("Semua parameter sudah punya aturan.");
      return;
    }
    setConfig({
      paramRules: [
        ...config.paramRules,
        createParamRule(
          unused.id,
          unused.shortLabel ?? unused.name,
          generateId("fr"),
          data.achievementTiers,
        ),
      ],
    });
  };

  return (
    <fieldset className="rounded-lg border border-[var(--border)] p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Rumus Perhitungan
      </legend>

      <div className="mb-4 flex flex-wrap gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="formulaMode"
            checked={(form.formulaMode ?? "template") === "template"}
            onChange={() => setMode("template")}
          />
          Template (preset cepat)
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="formulaMode"
            checked={form.formulaMode === "rules"}
            onChange={() => setMode("rules")}
          />
          Rule Builder (custom per parameter)
        </label>
      </div>

      {form.formulaMode === "rules" ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Agregasi</label>
              <Select2
                value={config.aggregation}
                onChange={(v) =>
                  setConfig({ aggregation: v as FormulaAggregation })
                }
                options={(
                  Object.keys(FORMULA_AGGREGATION_LABELS) as FormulaAggregation[]
                ).map((key) => ({
                  value: key,
                  label: FORMULA_AGGREGATION_LABELS[key],
                }))}
              />
              <div className="mt-2 rounded-lg border border-[var(--border)] bg-white p-3 text-xs">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[var(--text)]">
                    {aggGuide.title}
                  </span>
                  {aggGuide.docDefault ? (
                    <span className="badge bg-[var(--success)]/15 text-[var(--success)]">
                      Default dokumen
                    </span>
                  ) : (
                    <span className="badge bg-amber-100 text-amber-800">
                      Alternatif (bukan Excel)
                    </span>
                  )}
                </div>
                <p className="text-[var(--text-muted)]">{aggGuide.summary}</p>
                <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] text-[var(--primary)]">
                  {aggGuide.formula}
                </p>
                <p className="mt-2 text-[var(--text-muted)]">
                  <span className="font-semibold text-[var(--text)]">
                    Contoh:{" "}
                  </span>
                  {aggGuide.example}
                </p>
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                  Ref: {aggGuide.docReference}
                </p>
              </div>
              {!aggGuide.docDefault && (
                <p className="mt-1 text-[10px] text-amber-700">
                  Untuk skema reguler GT/MT/Horeca/Manager, dokumen Excel
                  mensyaratkan parameter mandiri — pilih &quot;Jumlahkan per
                  Parameter&quot;.
                </p>
              )}
            </div>
            {isAggregate && (
              <>
                <div>
                  <label className="label">Sumber Nominal Agregat</label>
                  <Select2
                    value={config.aggregateNominalSource}
                    onChange={(v) =>
                      setConfig({
                        aggregateNominalSource:
                          v as FormulaRuleConfig["aggregateNominalSource"],
                      })
                    }
                    options={[
                      {
                        value: "fullTotal",
                        label: "Total nominal tier (penuh)",
                      },
                      {
                        value: "sumBreakdown",
                        label: "Jumlahkan slice per parameter",
                      },
                    ]}
                  />
                </div>
                <div>
                  <label className="label">Pengali Agregat</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    value={config.aggregateMultiplier}
                    onChange={(e) =>
                      setConfig({
                        aggregateMultiplier: Number(e.target.value) || 1,
                      })
                    }
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[var(--text-muted)]">
              Setiap aturan: IF pencapaian parameter masuk tier → nominal ×
              pengali
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary px-2 py-1 text-xs"
                onClick={syncFromWeights}
              >
                Sync dari Bobot
              </button>
              <button
                type="button"
                className="btn-primary px-2 py-1 text-xs"
                onClick={addParamRule}
              >
                + Tambah Parameter
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {config.paramRules.map((rule, index) => {
              const param = data.parameters.find((p) => p.id === rule.paramId);
              const tierLocked = Boolean(rule.onlyTierId);
              const displayMinPct = tierLocked
                ? minPctForTier(data.achievementTiers, rule.onlyTierId)
                : rule.minAchievementPct;
              return (
                <div
                  key={rule.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) =>
                          setConfig({
                            paramRules: updateRuleAt(config.paramRules, index, {
                              enabled: e.target.checked,
                            }),
                          })
                        }
                      />
                      <input
                        className="input max-w-[140px] py-1 text-sm"
                        value={rule.label}
                        onChange={(e) =>
                          setConfig({
                            paramRules: updateRuleAt(config.paramRules, index, {
                              label: e.target.value,
                            }),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-danger px-2 py-1 text-xs"
                      onClick={() =>
                        setConfig({
                          paramRules: config.paramRules.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                    >
                      Hapus
                    </button>
                  </div>

                  <p className="mb-2 font-[family-name:var(--font-mono)] text-[10px] text-[var(--primary)]">
                    {describeParamRule(rule, data.achievementTiers)}
                  </p>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="label">Parameter</label>
                      <Select2
                        size="compact"
                        value={rule.paramId}
                        onChange={(v) => {
                          const p = data.parameters.find((x) => x.id === v);
                          setConfig({
                            paramRules: updateRuleAt(config.paramRules, index, {
                              paramId: v,
                              label: p?.shortLabel ?? p?.name ?? v,
                            }),
                          });
                        }}
                        options={data.parameters.map((p) => ({
                          value: p.id,
                          label: `${p.shortLabel ?? p.name} (${p.id})`,
                        }))}
                      />
                    </div>
                    <div>
                      <label className="label">Tier Pencapaian</label>
                      <Select2
                        size="compact"
                        value={rule.onlyTierId ?? ""}
                        onChange={(v) => {
                          const onlyTierId = v || undefined;
                          setConfig({
                            paramRules: updateRuleAt(config.paramRules, index, {
                              onlyTierId,
                              minAchievementPct: onlyTierId
                                ? minPctForTier(
                                    data.achievementTiers,
                                    onlyTierId,
                                  )
                                : lowestTierMinPct(data.achievementTiers),
                            }),
                          });
                        }}
                        isClearable
                        placeholder="Semua tier (otomatis dari %)"
                        options={data.achievementTiers.map((t) => ({
                          value: t.id,
                          label: t.label,
                        }))}
                      />
                    </div>
                    <div>
                      <label className="label">Min. Pencapaian (%)</label>
                      <input
                        type="number"
                        min="0"
                        className={`input py-1 text-sm ${
                          tierLocked ? "bg-[var(--surface-muted)]" : ""
                        }`}
                        value={displayMinPct}
                        readOnly={tierLocked}
                        title={
                          tierLocked
                            ? "Mengikuti batas minimum tier terpilih"
                            : undefined
                        }
                        onChange={(e) =>
                          setConfig({
                            paramRules: updateRuleAt(config.paramRules, index, {
                              minAchievementPct: Number(e.target.value),
                            }),
                          })
                        }
                      />
                      {tierLocked && (
                        <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                          Otomatis dari tier terpilih
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="label">Sumber Nominal</label>
                      <Select2
                        size="compact"
                        value={rule.nominalSource}
                        onChange={(v) =>
                          setConfig({
                            paramRules: updateRuleAt(config.paramRules, index, {
                              nominalSource: v as NominalSource,
                            }),
                          })
                        }
                        options={(
                          Object.keys(NOMINAL_SOURCE_LABELS) as NominalSource[]
                        ).map((key) => ({
                          value: key,
                          label: NOMINAL_SOURCE_LABELS[key],
                        }))}
                      />
                    </div>
                    <div>
                      <label className="label">Pengali (×)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input py-1 text-sm"
                        value={rule.multiplier}
                        onChange={(e) =>
                          setConfig({
                            paramRules: updateRuleAt(config.paramRules, index, {
                              multiplier: Number(e.target.value) || 0,
                            }),
                          })
                        }
                      />
                    </div>
                    <div className="flex items-end">
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {param?.name ?? rule.paramId}
                        {param?.unit ? ` · unit ${param.unit}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {config.paramRules.length === 0 && (
              <p className="text-center text-xs text-[var(--text-muted)]">
                Belum ada aturan. Klik &quot;Sync dari Bobot&quot; atau
                &quot;+ Tambah Parameter&quot;.
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">
          Mode template — pilih preset di bawah. Untuk kustomisasi per
          parameter (mis. All Product × tier → nominal), gunakan Rule Builder.
        </p>
      )}
    </fieldset>
  );
}
