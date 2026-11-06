import { BOM_EXPORT_HEADERS, BOM_META, bomRows, bomToCsv, bomDiffLines, summarizeBom, type BomResult } from "./bom";

export function exportCsv(res: BomResult, onlyChanged = false) {
  const lines = onlyChanged ? bomDiffLines(res) : res.lines.filter((l) => l.qty !== 0 || l.baseQty !== 0);
  return bomToCsv(lines);
}

export async function exportXlsx(res: BomResult, scenarioName: string): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "PGA27 Buildout Studio";
  wb.created = new Date();

  const sum = summarizeBom(res);
  const s0 = wb.addWorksheet("Summary");
  s0.addRows([
    ["2027 PGA Championship · Fields Ranch East · PGA Frisco"],
    ["PLANNING CONCEPT - NOT FOR CONSTRUCTION"],
    [`Scenario: ${scenarioName}`],
    [`Baseline: ${BOM_META.source} (${BOM_META.physicalRows} physical rows)`],
    [],
    ["", "Each", "Linear ft", "Sq ft"],
    ["v2.2 schedule", sum.base.each, Math.round(sum.base.linear_ft), Math.round(sum.base.sq_ft)],
    ["Current scenario", sum.totals.each, Math.round(sum.totals.linear_ft), Math.round(sum.totals.sq_ft)],
    ["Delta", sum.totals.each - sum.base.each, Math.round(sum.totals.linear_ft - sum.base.linear_ft), Math.round(sum.totals.sq_ft - sum.base.sq_ft)],
    [],
    ["Lines added", sum.added],
    ["Lines removed", sum.removed],
    ["Lines changed", sum.changed],
    [],
    ["Notes"],
    ["Zone-level quantities (fence, decking, stairs, back of house, furniture) are shared area quantities and are not auto-scaled."],
    ["'derived estimate' lines are rule-based (footprint x levels, perimeter x levels) and are not part of v2.2."],
    ["Workbook v2.2 zone codes do not match v2.3 drawing sheet numbers; never join by numeric code alone."],
  ]);
  s0.getRow(1).font = { bold: true, size: 14 };
  s0.getRow(2).font = { bold: true, color: { argb: "FFB88F35" } };
  s0.getColumn(1).width = 28;

  const add = (name: string, lines: BomResult["lines"]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.addRow(BOM_EXPORT_HEADERS);
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2540" } };
    for (const r of bomRows(lines)) ws.addRow(r);
    const widths = [14, 36, 22, 12, 11, 10, 12, 10, 11, 16, 44, 12, 40, 16, 10];
    widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: BOM_EXPORT_HEADERS.length } };
  };
  add("BOM (live)", res.lines.filter((l) => l.qty !== 0 || l.baseQty !== 0));
  add("Diff vs v2.2", bomDiffLines(res));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
