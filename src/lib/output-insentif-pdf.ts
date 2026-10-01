import type { CellDef, RowInput, Styles } from "jspdf-autotable";
import type { AsmInsentif } from "@/lib/asm-insentif";
import {
  type InsKey,
  type OutputAmounts,
  type OutputInsentif,
  type OutputRow,
  type OutputTotal,
  type PctKey,
} from "@/lib/output-insentif";

const RED: [number, number, number] = [255, 0, 0];
const GREEN: [number, number, number] = [146, 208, 80];
const GRAY: [number, number, number] = [226, 232, 240];
const DARK: [number, number, number] = [40, 40, 40];
const COLS = 33;

/** Lebar kolom (mm) — total ≤ lebar A3 landscape dikurangi margin. */
const COLUMN_STYLES: Record<number, Partial<Styles>> = (() => {
  const P = 11.2; // kolom pencapaian
  const I = 11.5; // kolom insentif
  const widths = [
    17,
    20,
    22,
    12, // cabang, ID, salesman, type
    P,
    I, // sales value
    P,
    P,
    I, // product focus
    P,
    I,
    P,
    I,
    P,
    I,
    P,
    I,
    P,
    I,
    P,
    I,
    P,
    I, // EC..JE
    15, // total
    9,
    11,
    9,
    11, // AR perform
    13,
    13,
    13, // diterima, salesman, driver/helper
  ];
  const out: Record<number, Partial<Styles>> = {};
  widths.forEach((w, i) => {
    out[i] = {
      cellWidth: w,
      halign: i < 3 ? "left" : i === 3 ? "center" : "right",
    };
  });
  return out;
})();

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

const money = (n: number) => (n === 0 ? "-" : nf.format(Math.round(n)));
const daysText = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(1);
const pctText = (v: number | null) => (v === null ? "" : `${v.toFixed(1)}%`);

/** [grup kolom, anak kolom] sesuai header merah P:AV di Excel. */
const PARAM_GROUPS: { title: string; subs: string[] }[] = [
  { title: "SALES VALUE", subs: ["PENCAPAIAN", "INSENTIF"] },
  { title: "PRODUCT FOCUS", subs: ["VOLUME", "RO", "INSENTIF"] },
  { title: "EFFECTIVE CALL", subs: ["PENCAPAIAN", "INSENTIF"] },
  { title: "NEW OPEN OUTLET", subs: ["PENCAPAIAN", "INSENTIF"] },
  { title: "ACTIVE OUTLET", subs: ["PENCAPAIAN", "INSENTIF"] },
  { title: "ITEM PER OUTLET", subs: ["PENCAPAIAN", "INSENTIF"] },
  { title: "PRODUCT DISPLAY", subs: ["PENCAPAIAN", "INSENTIF"] },
  { title: "SALES CONTRACT", subs: ["PENCAPAIAN", "INSENTIF"] },
  { title: "CO-BRANDING", subs: ["PENCAPAIAN", "INSENTIF"] },
  { title: "JOIN EVENT ACTIVITY", subs: ["PENCAPAIAN", "INSENTIF"] },
];

const head = (): RowInput[] => {
  const h = (content: string, extra: Partial<CellDef> = {}): CellDef => ({
    content,
    styles: { halign: "center", valign: "middle" },
    ...extra,
  });
  const fixed = (t: string) => h(t, { rowSpan: 2 });
  const row1: CellDef[] = [
    fixed("NAMA CABANG"),
    fixed("ID"),
    fixed("SALESMAN"),
    fixed("TYPE SALES"),
    ...PARAM_GROUPS.map((g) => h(g.title, { colSpan: g.subs.length })),
    fixed("TOTAL"),
    h("AR PERFORM", { colSpan: 4 }),
    fixed("TOTAL INSENTIF DITERIMA"),
    h("SALESMAN", { rowSpan: 2 }),
    h("DRIVER / HELPER", { rowSpan: 2 }),
  ];
  const row2: CellDef[] = [
    ...PARAM_GROUPS.flatMap((g) => g.subs.map((s) => h(s))),
    h("OVERDUE"),
    h("PENGURANG INSENTIF"),
    h("BAD DEBT"),
    h("PENGURANG INSENTIF"),
  ];
  return [row1, row2];
};

/** Urutan sel pencapaian/insentif per kolom Excel. */
function paramCells(
  pct: Record<PctKey, number | null>,
  ins: Record<InsKey, number>,
): string[] {
  const p = (k: PctKey) => pctText(pct[k]);
  const i = (k: InsKey) => money(ins[k]);
  return [
    p("sv"),
    i("sv"),
    p("pfVol"),
    p("pfRo"),
    i("pf"),
    p("ec"),
    i("ec"),
    p("noo"),
    i("noo"),
    p("ao"),
    i("ao"),
    p("ipo"),
    i("ipo"),
    p("pd"),
    i("pd"),
    p("contract"),
    i("contract"),
    p("cob"),
    i("cob"),
    p("je"),
    i("je"),
  ];
}

const amountCells = (a: OutputAmounts) => [money(a.total)];
const tailCells = (a: OutputAmounts) => [
  money(a.diterima),
  money(a.salesman),
  money(a.driverHelper),
];

function teamRow(r: OutputRow): string[] {
  return [
    r.cabang,
    r.code,
    r.salesmanName,
    r.typeSales,
    ...paramCells(r.pct, r.ins),
    ...amountCells(r),
    r.overduePct > 0 ? `${r.overduePct.toFixed(1)}%` : "0%",
    money(r.overduePenalty),
    r.badDebtDays > 0 ? daysText(r.badDebtDays) : "0",
    money(r.badDebtPenalty),
    ...tailCells(r),
  ];
}

function totalRow(
  t: OutputTotal,
  fill: [number, number, number],
  textColor: [number, number, number] = [0, 0, 0],
): CellDef[] {
  const style = { fillColor: fill, textColor, fontStyle: "bold" as const };
  const cells = [
    ...paramCells(t.pct, t.ins),
    ...amountCells(t),
    "",
    money(t.overduePenalty),
    "",
    money(t.badDebtPenalty),
    ...tailCells(t),
  ];
  return [
    { content: t.label, colSpan: 4, styles: { ...style, halign: "left" } },
    ...cells.map((c) => ({ content: c, styles: style })),
  ];
}

function areaHeading(text: string): CellDef[] {
  return [
    {
      content: text,
      colSpan: COLS,
      styles: { fontStyle: "bold", fillColor: [255, 242, 204], halign: "left" },
    },
  ];
}

/** Render Output Insentif ke jsPDF (A3 landscape). */
export async function renderOutputInsentifPdf(
  output: OutputInsentif,
  asm?: AsmInsentif,
) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Output Insentif", 8, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const areaNote =
    output.areas.length === 1 ? ` · ${output.areas[0].area}` : "";
  doc.text(`Periode ${output.period}${areaNote}`, 8, 17);

  const body: RowInput[] = [];
  for (const area of output.areas) {
    body.push(areaHeading(`PENCAPAIAN AREA ${area.area}`));
    for (const cab of area.cabangs) {
      for (const r of cab.rows) body.push(teamRow(r));
      body.push(totalRow(cab.total, GRAY));
    }
    body.push(totalRow(area.total, GREEN));
  }
  if (output.areas.length > 1) {
    body.push(totalRow(output.grand, DARK, [255, 255, 255]));
  }

  autoTable(doc, {
    head: head(),
    body,
    startY: 21,
    margin: { left: 8, right: 8, bottom: 12 },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 5.6,
      cellPadding: 0.9,
      lineColor: [160, 160, 160],
      lineWidth: 0.1,
      halign: "right",
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: RED,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 4.4,
      cellPadding: 0.6,
      lineColor: [255, 255, 255],
    },
    columnStyles: COLUMN_STYLES,
    showHead: "everyPage",
    rowPageBreak: "avoid",
    didDrawPage: () => {
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(
        `Halaman ${doc.getCurrentPageInfo().pageNumber}`,
        pageW - 8,
        doc.internal.pageSize.getHeight() - 5,
        { align: "right" },
      );
      doc.setTextColor(0);
    },
  });

  if (asm && asm.rows.length > 0) {
    drawAsmAppendix(doc, autoTable, asm);
  }

  return doc;
}

const pctOrBlank = (v: number | null) => (v === null ? "" : `${v.toFixed(1)}%`);

/** Halaman "LAMPIRAN INSENTIF ASM": ringkasan per ASM + akumulasi per SPV di bawahnya. */
function drawAsmAppendix(
  doc: import("jspdf").jsPDF,
  autoTable: typeof import("jspdf-autotable").default,
  asm: AsmInsentif,
) {
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Lampiran Insentif ASM", 8, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Periode ${asm.period} · pencapaian ASM = akumulasi seluruh tim (SPV) di area`,
    8,
    17,
  );

  const h = (content: string, extra: Partial<CellDef> = {}): CellDef => ({
    content,
    styles: { halign: "center", valign: "middle" },
    ...extra,
  });
  const fixed = (t: string) => h(t, { rowSpan: 2 });

  const body: RowInput[] = asm.rows.map((r) => [
    { content: r.area, styles: { halign: "left" } },
    { content: r.name, styles: { halign: "left" } },
    { content: r.typeSales, styles: { halign: "center" } },
    r.sv.actual === null ? "" : money(r.sv.actual),
    r.sv.target === null ? "" : money(r.sv.target),
    pctOrBlank(r.sv.pct),
    money(r.svIncentive),
    pctOrBlank(r.ao.pct),
    money(r.aoIncentive),
    money(r.total),
    `${r.overduePct.toFixed(1)}%`,
    money(r.overduePenalty),
    daysText(r.badDebtDays),
    money(r.badDebtPenalty),
    money(r.diterima),
  ]);
  const totalStyle = { fillColor: GRAY, fontStyle: "bold" as const };
  body.push([
    {
      content: "TOTAL PENCAPAIAN ASM",
      colSpan: 6,
      styles: { ...totalStyle, halign: "left" },
    },
    { content: money(asm.totals.svIncentive), styles: totalStyle },
    { content: "", styles: totalStyle },
    { content: money(asm.totals.aoIncentive), styles: totalStyle },
    { content: money(asm.totals.total), styles: totalStyle },
    { content: "", styles: totalStyle },
    { content: money(asm.totals.overduePenalty), styles: totalStyle },
    { content: "", styles: totalStyle },
    { content: money(asm.totals.badDebtPenalty), styles: totalStyle },
    { content: money(asm.totals.diterima), styles: totalStyle },
  ]);

  autoTable(doc, {
    head: [
      [
        fixed("AREA"),
        fixed("NAMA ASM"),
        fixed("TYPE SALES"),
        h("SALES VALUE", { colSpan: 4 }),
        h("ACTIVE OUTLET", { colSpan: 2 }),
        fixed("TOTAL"),
        h("AR PERFORM", { colSpan: 4 }),
        fixed("TOTAL INSENTIF DITERIMA"),
      ],
      [
        h("ACTUAL"),
        h("TARGET"),
        h("PENCAPAIAN"),
        h("INSENTIF"),
        h("PENCAPAIAN"),
        h("INSENTIF"),
        h("OVERDUE"),
        h("PENGURANG INSENTIF"),
        h("BAD DEBT"),
        h("PENGURANG INSENTIF"),
      ],
    ],
    body,
    startY: 21,
    margin: { left: 8, right: 8 },
    theme: "grid",
    styles: {
      fontSize: 7,
      cellPadding: 1.4,
      halign: "right",
      valign: "middle",
      lineColor: [160, 160, 160],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: RED,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 6.5,
      lineColor: [255, 255, 255],
    },
  });

  // Akumulasi per SPV di bawah tiap ASM
  const spvBody: RowInput[] = [];
  for (const r of asm.rows) {
    if (r.spvs.length === 0) continue;
    spvBody.push([
      {
        content: `${r.area} · ASM ${r.name}`,
        colSpan: 9,
        styles: {
          fontStyle: "bold",
          fillColor: [255, 242, 204],
          halign: "left",
        },
      },
    ]);
    for (const spv of r.spvs) {
      spvBody.push([
        { content: spv.name, styles: { halign: "left" } },
        { content: spv.title, styles: { halign: "left" } },
        { content: spv.cabang, styles: { halign: "left" } },
        String(spv.teamCount),
        spv.sv.actual === null ? "" : money(spv.sv.actual),
        spv.sv.target === null ? "" : money(spv.sv.target),
        pctOrBlank(spv.sv.pct),
        pctOrBlank(spv.ao.pct),
        money(spv.teamIncentive),
      ]);
    }
  }
  if (spvBody.length > 0) {
    // jarak setelah tabel pertama
    const lastY =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? 60;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Akumulasi per SPV / Leader di bawah ASM", 8, lastY + 8);
    autoTable(doc, {
      head: [
        [
          h("SPV / LEADER"),
          h("JABATAN"),
          h("CABANG"),
          h("JUMLAH TIM"),
          h("SALES VALUE ACTUAL"),
          h("SALES VALUE TARGET"),
          h("SV PENCAPAIAN"),
          h("AO PENCAPAIAN"),
          h("INSENTIF TIM (DITERIMA)"),
        ],
      ],
      body: spvBody,
      startY: lastY + 11,
      margin: { left: 8, right: 8 },
      theme: "grid",
      styles: {
        fontSize: 7,
        cellPadding: 1.2,
        halign: "right",
        valign: "middle",
        lineColor: [160, 160, 160],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: RED,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 6.5,
        lineColor: [255, 255, 255],
      },
    });
  }

  const note =
    "*Overdue ASM = rata-rata overdue tim di area; Bad debt = hari terbesar di antara tim (diturunkan dari tim, bukan dari nilai piutang area).";
  const endY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 100;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.text(note, 8, endY + 6);
}
