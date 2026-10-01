import type { CellDef, RowInput } from "jspdf-autotable";
import type { AsmInsentif } from "@/lib/asm-insentif";
import type { PencairanInsentif } from "@/lib/pencairan-insentif";

const YELLOW: [number, number, number] = [255, 255, 0];
const GREEN: [number, number, number] = [146, 208, 80];

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const money = (n: number) => (n === 0 ? "-" : nf.format(Math.round(n)));

const HEAD: RowInput[] = [
  [
    "NAMA CABANG",
    "SALESMAN",
    "JABATAN",
    "TYPE SALES",
    "INSENTIF",
    "KETERANGAN",
  ],
];

/** Render Pencairan Insentif ke jsPDF: satu area = satu halaman (atau lebih), A4 portrait. */
export async function renderPencairanInsentifPdf(
  output: PencairanInsentif,
  asm?: AsmInsentif,
) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  output.areas.forEach((area, index) => {
    if (index > 0) doc.addPage();

    // Banner judul (kuning, seperti Excel)
    doc.setFillColor(...YELLOW);
    doc.rect(10, 10, pageW - 20, 13, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("PEMBAYARAN YANG HARUS DILAKUKAN ATAS INSENTIF", 12, 15.5);
    doc.text(`PERIODE : ${output.periodLabel}`, 12, 21);
    doc.setFontSize(11);
    doc.text(area.area, 10, 30);

    const body: RowInput[] = [];
    for (const cab of area.cabangs) {
      cab.teams.forEach((team, ti) => {
        team.lines.forEach((line, li) => {
          const first = ti === 0 && li === 0;
          const row: CellDef[] = [
            {
              content: first ? cab.cabang : "",
              styles: { fontStyle: "bold", halign: "left" },
            },
            { content: line.name, styles: { halign: "left" } },
            { content: line.jabatan, styles: { halign: "left" } },
            { content: line.typeSales, styles: { halign: "center" } },
            { content: money(line.amount), styles: { halign: "right" } },
            {
              content: line.keterangan,
              styles: { halign: "left", fontStyle: "bold" },
            },
          ];
          body.push(row);
        });
      });
      body.push([
        { content: "", styles: { fillColor: YELLOW } },
        {
          content: `TOTAL ${cab.cabang}`,
          styles: { fontStyle: "bold", fillColor: YELLOW, halign: "left" },
        },
        { content: "", styles: { fillColor: YELLOW } },
        { content: "", styles: { fillColor: YELLOW } },
        {
          content: money(cab.total),
          styles: { fontStyle: "bold", fillColor: YELLOW, halign: "right" },
        },
        { content: "", styles: { fillColor: YELLOW } },
      ]);
    }
    body.push([
      { content: "", styles: { fillColor: GREEN } },
      {
        content: `TOTAL AREA ${area.area}`,
        styles: { fontStyle: "bold", fillColor: GREEN, halign: "left" },
      },
      { content: "", styles: { fillColor: GREEN } },
      { content: "", styles: { fillColor: GREEN } },
      {
        content: money(area.total),
        styles: { fontStyle: "bold", fillColor: GREEN, halign: "right" },
      },
      { content: "", styles: { fillColor: GREEN } },
    ]);

    autoTable(doc, {
      head: HEAD,
      body,
      startY: 33,
      margin: { left: 10, right: 10, bottom: 14 },
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 7.5,
        cellPadding: 1.2,
        lineColor: [190, 190, 190],
        lineWidth: 0.1,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fillColor: GREEN,
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 48 },
        2: { cellWidth: 24 },
        3: { cellWidth: 20 },
        4: { cellWidth: 26 },
        5: { cellWidth: 46 },
      },
      showHead: "everyPage",
      rowPageBreak: "avoid",
      didDrawPage: () => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(120);
        doc.text(
          `Halaman ${doc.getCurrentPageInfo().pageNumber}`,
          pageW - 10,
          doc.internal.pageSize.getHeight() - 6,
          { align: "right" },
        );
        doc.setTextColor(0);
      },
    });
  });

  if (asm && asm.rows.length > 0) {
    if (output.areas.length > 0) doc.addPage();
    doc.setFillColor(...YELLOW);
    doc.rect(10, 10, pageW - 20, 13, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("PEMBAYARAN YANG HARUS DILAKUKAN ATAS INSENTIF", 12, 15.5);
    doc.text(`PERIODE : ${output.periodLabel}`, 12, 21);
    doc.setFontSize(11);
    doc.text("ASM", 10, 30);

    const asmBody: RowInput[] = asm.rows.map((r) => [
      { content: r.area, styles: { halign: "left", fontStyle: "bold" } },
      { content: r.name, styles: { halign: "left" } },
      { content: "ASM", styles: { halign: "left" } },
      { content: money(r.diterima), styles: { halign: "right" } },
      { content: r.keterangan, styles: { halign: "left", fontStyle: "bold" } },
    ]);
    asmBody.push([
      {
        content: "TOTAL",
        colSpan: 3,
        styles: { fillColor: YELLOW, fontStyle: "bold", halign: "left" },
      },
      {
        content: money(asm.totals.diterima),
        styles: { fillColor: YELLOW, fontStyle: "bold", halign: "right" },
      },
      { content: "", styles: { fillColor: YELLOW } },
    ]);
    autoTable(doc, {
      head: [["AREA", "NAMA", "JABATAN", "INSENTIF", "KETERANGAN"]],
      body: asmBody,
      startY: 33,
      margin: { left: 10, right: 10, bottom: 14 },
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 7.5,
        cellPadding: 1.4,
        lineColor: [190, 190, 190],
        lineWidth: 0.1,
        valign: "middle",
      },
      headStyles: {
        fillColor: GREEN,
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 44 },
        2: { cellWidth: 20 },
        3: { cellWidth: 28 },
        4: { cellWidth: 70 },
      },
    });
  }

  return doc;
}
