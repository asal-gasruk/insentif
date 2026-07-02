"use client";

import { FormEvent, useState } from "react";
import { LoadingState } from "@/components/LoadingState";
import { Modal } from "@/components/Modal";
import { NotesPanel } from "@/components/NotesPanel";
import { PageHeader } from "@/components/PageHeader";
import { FORMULA_TEMPLATES, getFormulaTemplateMeta } from "@/data/formula-templates";
import { formatFormulaRuleSummary } from "@/data/formula-rules";
import { FormulaRuleEditor } from "@/components/FormulaRuleEditor";
import { SchemeSetupGuide } from "@/components/SchemeSetupGuide";
import { Select2 } from "@/components/Select2";
import { useAppData } from "@/hooks/useAppData";
import {
  PENALTY_ACTION_LABELS,
  PENALTY_FIELD_LABELS,
  formatPenaltySummary,
} from "@/lib/penalty-engine";
import { generateId } from "@/lib/storage";
import type {
  FormulaTemplate,
  IncentiveScheme,
  PenaltyActionType,
  PenaltyConditionField,
  PenaltyConditionOp,
  PenaltyRule,
  SchemePeriod,
  SchemeType,
  SegmentDimension,
  TeamSplit,
} from "@/types";

const dimensionLabels: Record<SegmentDimension, string> = {
  branchType: "Kategori Cabang",
  area: "Wilayah",
  distribution: "Model Distribusi",
  vehicle: "Jenis Armada",
  none: "Tanpa Segment",
};

const DEFAULT_SEGMENTS: Record<
  SegmentDimension,
  IncentiveScheme["segments"]
> = {
  branchType: [
    { id: "MB", name: "Cabang Menengah (MB)" },
    { id: "SB", name: "Cabang Kecil (SB)" },
    { id: "NB", name: "Cabang Baru (NB)" },
  ],
  area: [
    { id: "JAWA", name: "Area Jawa" },
    { id: "LUAR", name: "Luar Pulau" },
  ],
  distribution: [
    { id: "DIRECT", name: "Direct Distribution" },
    { id: "INDIRECT", name: "Indirect Distribution" },
  ],
  vehicle: [
    { id: "PICKUP", name: "Pick Up (bak/box)" },
    { id: "ENGKEL", name: "Truk Engkel (4 roda)" },
    { id: "DOUBLE", name: "Truk Double (6 roda)" },
  ],
  none: [{ id: "ALL", name: "Semua" }],
};

function defaultPenalties(): PenaltyRule[] {
  return [
    {
      id: "pen-overdue",
      label: "Penalty Overdue Piutang",
      enabled: true,
      condition: { field: "overduePct", operator: "gt", value: 0.5 },
      action: { type: "reducePercent", reductionPct: 10 },
    },
    {
      id: "pen-suspend",
      label: "Penangguhan Bad Debt",
      enabled: true,
      condition: { field: "badDebtDays", operator: "gt", value: 60 },
      action: { type: "suspend" },
    },
    {
      id: "pen-void",
      label: "Penghapusan Bad Debt",
      enabled: true,
      condition: { field: "badDebtDays", operator: "gt", value: 90 },
      action: { type: "void" },
    },
  ];
}

function newPenaltyRule(): PenaltyRule {
  return {
    id: generateId("pen"),
    label: "Aturan Penalty Baru",
    enabled: true,
    condition: { field: "overduePct", operator: "gt", value: 0 },
    action: { type: "reducePercent", reductionPct: 5 },
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

function defaultTeamSplits(
  type: SchemeType,
  dimension: SegmentDimension,
): TeamSplit[] {
  if (type === "volumeTier") {
    return [
      { key: "PICKUP", split: { driver: 1 } },
      { key: "ENGKEL", split: { driver: 0.55, helper1: 0.45 } },
      { key: "DOUBLE", split: { driver: 0.4, helper1: 0.3, helper2: 0.3 } },
    ];
  }
  if (dimension === "branchType") {
    return [
      { key: "3", split: { salesman: 0.55, driver: 0.225, helper1: 0.225 } },
      { key: "2", split: { salesman: 0.7, driver: 0.3 } },
      { key: "1", split: { salesman: 1 } },
    ];
  }
  return [{ key: "1", split: { salesman: 1 } }];
}

function emptyScheme(roleId: string): IncentiveScheme {
  return {
    id: "",
    roleId,
    name: "",
    type: "parameter",
    segmentDimension: "branchType",
    segments: DEFAULT_SEGMENTS.branchType,
    period: "monthly",
    penalties: defaultPenalties(),
    formulaMode: "template",
    formulaTemplate: "paramIndependent",
    teamSplits: defaultTeamSplits("parameter", "branchType"),
    notes: "",
  };
}

function updatePenaltyAt(
  penalties: PenaltyRule[],
  index: number,
  patch: Partial<PenaltyRule>,
): PenaltyRule[] {
  return penalties.map((r, i) => (i === index ? { ...r, ...patch } : r));
}

export default function SkemaPage() {
  const { data, ready, create, update } = useAppData();
  const [editing, setEditing] = useState<IncentiveScheme | null>(null);
  const [form, setForm] = useState<IncentiveScheme | null>(null);
  const [customId, setCustomId] = useState("");

  if (!ready || !data) return <LoadingState />;

  const isCreate = editing === null && form !== null;

  const openCreate = () => {
    const roleId = data.roles[0]?.id ?? "";
    setEditing(null);
    setCustomId("");
    setForm(emptyScheme(roleId));
  };

  const openEdit = (scheme: IncentiveScheme) => {
    setEditing(scheme);
    setCustomId(scheme.id);
    const cloned = JSON.parse(JSON.stringify(scheme)) as IncentiveScheme;
    if (!cloned.penalties?.length) cloned.penalties = defaultPenalties();
    if (!cloned.formulaMode) cloned.formulaMode = "template";
    if (!cloned.formulaTemplate) cloned.formulaTemplate = "paramIndependent";
    setForm(cloned);
  };

  const close = () => {
    setEditing(null);
    setForm(null);
    setCustomId("");
  };

  const setType = (type: SchemeType) => {
    if (!form) return;
    const dimension =
      type === "volumeTier" ? "vehicle" : form.segmentDimension;
    setForm({
      ...form,
      type,
      segmentDimension: dimension,
      segments: DEFAULT_SEGMENTS[dimension],
      teamSplits: defaultTeamSplits(type, dimension),
    });
  };

  const setDimension = (segmentDimension: SegmentDimension) => {
    if (!form) return;
    setForm({
      ...form,
      segmentDimension,
      segments: DEFAULT_SEGMENTS[segmentDimension],
      teamSplits: defaultTeamSplits(form.type, segmentDimension),
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form || !form.name.trim()) return;

    if (isCreate) {
      const id = customId.trim() || `sch-${slugify(form.name)}`;
      if (!id) return;
      if (data.schemes.some((s) => s.id === id)) {
        alert(`ID skema "${id}" sudah ada. Gunakan ID lain.`);
        return;
      }
      create("schemes", { ...form, id });
    } else {
      update("schemes", form);
    }
    close();
  };

  const selectedFormula = form
    ? getFormulaTemplateMeta(form.formulaTemplate ?? "paramIndependent")
    : null;

  return (
    <>
      <PageHeader
        title="Skema Insentif"
        description="Konfigurasi per role: segment, template rumus, dan aturan penalty (multi-aturan). Bobot & nominal di halaman Bobot & Nominal."
        action={
          <button type="button" className="btn-primary" onClick={openCreate}>
            + Tambah Skema
          </button>
        }
      />

      <SchemeSetupGuide />

      <div className="grid gap-4 lg:grid-cols-2">
        {data.schemes.map((scheme) => {
          const role = data.roles.find((r) => r.id === scheme.roleId);
          const weightCount = data.schemeWeights.filter(
            (w) => w.schemeId === scheme.id,
          ).length;
          const nominalCount = data.schemeNominals.filter(
            (n) => n.schemeId === scheme.id,
          ).length;
          const formulaMeta = getFormulaTemplateMeta(
            scheme.formulaTemplate ?? "paramIndependent",
          );
          const formulaBadge =
            scheme.formulaMode === "rules"
              ? `Rule Builder · ${formatFormulaRuleSummary(scheme.formulaRuleConfig)}`
              : formulaMeta.name;
          const penaltyCount = (scheme.penalties ?? []).filter(
            (p) => p.enabled,
          ).length;
          return (
            <article key={scheme.id} className="card p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{scheme.name}</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Role: {role?.name ?? scheme.roleId}
                  </p>
                  <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-muted)]">
                    {scheme.id}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary px-3 py-1 text-xs"
                  onClick={() => openEdit(scheme)}
                >
                  Edit
                </button>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="badge bg-[var(--primary)]/10 text-[var(--primary)]">
                  {scheme.type === "parameter" ? "Parameter" : "Volume Tier"}
                </span>
                <span className="badge bg-[var(--surface-muted)]">
                  {dimensionLabels[scheme.segmentDimension]}:{" "}
                  {scheme.segments.map((s) => s.id).join(", ")}
                </span>
                <span className="badge bg-[var(--surface-muted)]">
                  {scheme.period === "monthly" ? "Bulanan" : "Kuartalan"}
                </span>
                {scheme.type === "parameter" && (
                  <span className="badge bg-indigo-100 text-indigo-700">
                    {formulaBadge}
                  </span>
                )}
                <span className="badge bg-[var(--accent)]/15 text-[var(--accent)]">
                  {penaltyCount} aturan penalty
                </span>
              </div>

              {scheme.type === "parameter" && (
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  {weightCount} konfigurasi bobot · {nominalCount} baris nominal
                </p>
              )}

              <p className="mt-2 text-[10px] text-[var(--text-muted)]">
                {formatPenaltySummary(scheme.penalties ?? [])}
              </p>

              <NotesPanel
                text={scheme.notes}
                title="Catatan Skema"
                className="mt-3"
              />
            </article>
          );
        })}
      </div>

      <Modal
        open={form !== null}
        title={isCreate ? "Tambah Skema Insentif" : `Edit Skema: ${editing?.name ?? ""}`}
        onClose={close}
        wide
      >
        {form && (
          <form onSubmit={submit} className="space-y-4">
            {isCreate && (
              <div>
                <label className="label">ID Skema</label>
                <input
                  className="input font-[family-name:var(--font-mono)]"
                  placeholder="Auto dari nama jika dikosongkan, contoh: sch-custom-role"
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="label">Nama Skema</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Role</label>
                <Select2
                  value={form.roleId}
                  onChange={(v) => setForm({ ...form, roleId: v })}
                  isDisabled={!isCreate}
                  options={data.roles.map((r) => ({
                    value: r.id,
                    label: r.name,
                  }))}
                />
              </div>
              <div>
                <label className="label">Tipe Skema</label>
                <Select2
                  value={form.type}
                  onChange={(v) => setType(v as SchemeType)}
                  isDisabled={!isCreate}
                  options={[
                    {
                      value: "parameter",
                      label: "Parameter (GT/MT/Horeca/Manager)",
                    },
                    {
                      value: "volumeTier",
                      label: "Volume Tier (Delivery)",
                    },
                  ]}
                />
              </div>
              <div>
                <label className="label">Periode</label>
                <Select2
                  value={form.period}
                  onChange={(v) =>
                    setForm({ ...form, period: v as SchemePeriod })
                  }
                  options={[
                    { value: "monthly", label: "Bulanan" },
                    { value: "quarterly", label: "Kuartalan" },
                  ]}
                />
              </div>
              <div>
                <label className="label">Dimensi Segment</label>
                {isCreate ? (
                  <Select2
                    value={form.segmentDimension}
                    onChange={(v) => setDimension(v as SegmentDimension)}
                    isDisabled={form.type === "volumeTier"}
                    options={(
                      Object.keys(dimensionLabels) as SegmentDimension[]
                    ).map((d) => ({
                      value: d,
                      label: dimensionLabels[d],
                    }))}
                  />
                ) : (
                  <input
                    className="input bg-[var(--surface-muted)]"
                    value={dimensionLabels[form.segmentDimension]}
                    readOnly
                  />
                )}
              </div>
            </div>

            {form.type === "parameter" && (
              <>
                <FormulaRuleEditor
                  form={form}
                  setForm={setForm}
                  data={data}
                  schemeId={form.id || customId}
                />

                {(form.formulaMode ?? "template") === "template" && (
                  <div>
                    <label className="label">Template Rumus (preset)</label>
                    <Select2
                      value={form.formulaTemplate ?? "paramIndependent"}
                      onChange={(v) =>
                        setForm({
                          ...form,
                          formulaTemplate: v as FormulaTemplate,
                        })
                      }
                      options={FORMULA_TEMPLATES.map((t) => ({
                        value: t.id,
                        label: t.name,
                      }))}
                    />
                    {selectedFormula && (
                      <div className="mt-2 rounded-lg bg-[var(--surface-muted)] p-3 text-xs">
                        <p className="text-[var(--text-muted)]">
                          {selectedFormula.description}
                        </p>
                        <p className="mt-1 font-[family-name:var(--font-mono)] text-[var(--primary)]">
                          {selectedFormula.formula}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div>
              <label className="label">Segment</label>
              <div className="flex flex-wrap gap-2">
                {form.segments.map((s) => (
                  <span
                    key={s.id}
                    className="badge border border-[var(--border)] bg-white"
                    title={s.name}
                  >
                    {s.id}: {s.name}
                  </span>
                ))}
              </div>
              {isCreate && (
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Segment otomatis mengikuti tipe & dimensi. Setelah disimpan,
                  atur bobot/nominal di halaman terkait.
                </p>
              )}
            </div>

            <fieldset className="rounded-lg border border-[var(--border)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Aturan Penalty (multi-aturan)
                </legend>
                <button
                  type="button"
                  className="btn-secondary px-2 py-1 text-xs"
                  onClick={() =>
                    setForm({
                      ...form,
                      penalties: [...(form.penalties ?? []), newPenaltyRule()],
                    })
                  }
                >
                  + Tambah Aturan
                </button>
              </div>

              <div className="space-y-3">
                {(form.penalties ?? []).map((rule, index) => (
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
                            setForm({
                              ...form,
                              penalties: updatePenaltyAt(form.penalties, index, {
                                enabled: e.target.checked,
                              }),
                            })
                          }
                        />
                        <input
                          className="input max-w-xs py-1 text-sm"
                          value={rule.label}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              penalties: updatePenaltyAt(form.penalties, index, {
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
                          setForm({
                            ...form,
                            penalties: form.penalties.filter((_, i) => i !== index),
                          })
                        }
                      >
                        Hapus
                      </button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <label className="label">Kondisi (field)</label>
                        <Select2
                          size="compact"
                          value={rule.condition.field}
                          onChange={(v) =>
                            setForm({
                              ...form,
                              penalties: updatePenaltyAt(form.penalties, index, {
                                condition: {
                                  ...rule.condition,
                                  field: v as PenaltyConditionField,
                                },
                              }),
                            })
                          }
                          options={(
                            Object.keys(
                              PENALTY_FIELD_LABELS,
                            ) as PenaltyConditionField[]
                          ).map((f) => ({
                            value: f,
                            label: PENALTY_FIELD_LABELS[f],
                          }))}
                        />
                      </div>
                      <div>
                        <label className="label">Operator</label>
                        <Select2
                          size="compact"
                          value={rule.condition.operator}
                          onChange={(v) =>
                            setForm({
                              ...form,
                              penalties: updatePenaltyAt(form.penalties, index, {
                                condition: {
                                  ...rule.condition,
                                  operator: v as PenaltyConditionOp,
                                },
                              }),
                            })
                          }
                          options={[
                            { value: "gt", label: "> (lebih dari)" },
                            { value: "gte", label: "≥ (lebih dari/sama dengan)" },
                          ]}
                        />
                      </div>
                      <div>
                        <label className="label">Nilai ambang</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input py-1 text-sm"
                          value={rule.condition.value}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              penalties: updatePenaltyAt(form.penalties, index, {
                                condition: {
                                  ...rule.condition,
                                  value: Number(e.target.value),
                                },
                              }),
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="label">Aksi</label>
                        <Select2
                          size="compact"
                          value={rule.action.type}
                          onChange={(v) => {
                            const type = v as PenaltyActionType;
                            setForm({
                              ...form,
                              penalties: updatePenaltyAt(form.penalties, index, {
                                action: {
                                  type,
                                  reductionPct:
                                    type === "reducePercent"
                                      ? (rule.action.reductionPct ?? 10)
                                      : undefined,
                                },
                              }),
                            });
                          }}
                          options={(
                            Object.keys(
                              PENALTY_ACTION_LABELS,
                            ) as PenaltyActionType[]
                          ).map((a) => ({
                            value: a,
                            label: PENALTY_ACTION_LABELS[a],
                          }))}
                        />
                      </div>
                    </div>

                    {rule.action.type === "reducePercent" && (
                      <div className="mt-2 max-w-xs">
                        <label className="label">Potongan (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="input py-1 text-sm"
                          value={rule.action.reductionPct ?? 0}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              penalties: updatePenaltyAt(form.penalties, index, {
                                action: {
                                  ...rule.action,
                                  reductionPct: Number(e.target.value),
                                },
                              }),
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                ))}

                {(form.penalties ?? []).length === 0 && (
                  <p className="text-center text-xs text-[var(--text-muted)]">
                    Belum ada aturan penalty. Klik &quot;+ Tambah Aturan&quot; atau
                    gunakan preset default.
                  </p>
                )}
              </div>
            </fieldset>

            <div>
              <label className="label">Catatan Skema (dari dokumen)</label>
              <textarea
                className="input min-h-[120px]"
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Catatan per lampiran: aturan khusus, segment, penalty, pembagian tim..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={close}>
                Batal
              </button>
              <button type="submit" className="btn-primary">
                Simpan
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
