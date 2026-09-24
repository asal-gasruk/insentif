import * as XLSX from "xlsx";

/** Unduh workbook .xlsx (sheet pertama = Data) */
export function downloadXlsx(
  filename: string,
  headers: string[],
  rows: string[][],
  sheetName = "Data",
) {
  const aoa: (string | number)[][] = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Paksa kolom periode sebagai teks agar Excel tidak ubah jadi tanggal (timezone bug)
  const periodeIdx = headers.findIndex(
    (h) => h.toLowerCase() === "periode" || h.toLowerCase() === "period",
  );
  if (periodeIdx >= 0) {
    for (let r = 1; r <= rows.length; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: periodeIdx });
      const cell = ws[addr];
      if (!cell) continue;
      cell.t = "s";
      cell.v = String(cell.v ?? "");
      cell.z = "@";
      delete cell.w;
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const safeName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, safeName);
}

/** Parse CSV sederhana — dukung koma atau titik-koma */
export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^\uFEFF/, "").trim();
  const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter).map((c) => c.trim());
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

/**
 * Baca nilai sel untuk import:
 * - periode / tanggal: pakai tampilan Excel (`w`) agar `yyyy-mm` tidak geser timezone
 * - angka: pakai nilai mentah (`v`) agar % format tetap pecahan 0.059
 */
function cellToImportString(
  cell: XLSX.CellObject | undefined,
  header: string,
): string {
  if (!cell || cell.v === null || cell.v === undefined) return "";

  const headerKey = header.trim().toLowerCase();
  const preferDisplay =
    headerKey === "periode" ||
    headerKey === "period" ||
    cell.t === "d" ||
    cell.v instanceof Date;

  if (preferDisplay && cell.w != null && String(cell.w).trim() !== "") {
    return String(cell.w).trim();
  }

  if (typeof cell.v === "number") {
    if (!Number.isFinite(cell.v)) return "";
    return String(cell.v);
  }
  if (typeof cell.v === "boolean") return cell.v ? "1" : "0";
  if (cell.v instanceof Date) {
    // Fallback tanpa `w`: pakai UTC y-m agar konsisten dengan serial Excel SheetJS
    const y = cell.v.getUTCFullYear();
    const m = String(cell.v.getUTCMonth() + 1).padStart(2, "0");
    const day = String(cell.v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return String(cell.v).trim();
}

/** Parse sheet pertama workbook → array of row objects (string values) */
export function parseXlsxArrayBuffer(buf: ArrayBuffer): Record<string, string>[] {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const name = wb.SheetNames[0];
  if (!name) return [];
  const sheet = wb.Sheets[name];
  if (!sheet["!ref"]) return [];

  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: range.s.r, c });
    const header = cellToImportString(sheet[addr], "header");
    headers.push(header);
  }

  const rows: Record<string, string>[] = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const row: Record<string, string> = {};
    let hasValue = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const key = headers[c - range.s.c];
      if (!key) continue;
      const addr = XLSX.utils.encode_cell({ r, c });
      const val = cellToImportString(sheet[addr], key);
      row[key] = val;
      if (val !== "") hasValue = true;
    }
    if (hasValue) rows.push(row);
  }
  return rows;
}

/** Deteksi .xlsx / .xls / .csv dari File */
export async function parseImportFile(
  file: File,
): Promise<Record<string, string>[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    return parseXlsxArrayBuffer(buf);
  }
  const text = await file.text();
  return parseCsv(text);
}
