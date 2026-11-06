import bomJson from "@/data/bom.json";
import { BASE_STRUCTURES, SOURCE_INFO } from "./baseline";
import { m2ToFt2, mToFt, round } from "./geo";
import type { BomAdjustment, SceneState, Structure } from "./types";

export interface BomItem {
  id: string;
  item: string;
  category: string | null;
  area: string | null;
  qty: number | null;
  unit: string | null;
  type: string | null;
  dims: string | null;
  color: string | null;
  valance: string | null;
  slider: string | null;
  sizeLf: number | null;
  areaSf: number | null;
  heightRaw: string | null;
  widthRaw: string | null;
  notes: string | null;
  sheet: string;
  row: number;
}

const data = bomJson as unknown as {
  source: string;
  schemaNote: string;
  physicalRows: number;
  kinds: Record<string, number>;
  items: BomItem[];
};

export const BOM_META = {
  source: data.source,
  schemaNote: data.schemaNote,
  physicalRows: data.physicalRows,
  kinds: data.kinds,
};
export const BASE_ITEMS: BomItem[] = data.items;
export const BASE_ITEM_BY_ID = new Map(BASE_ITEMS.map((i) => [i.id, i]));

export type LineStatus = "unchanged" | "changed" | "added" | "removed";
export type LineBasis = "v2.2" | "instance count" | "resized" | "added structure" | "derived estimate" | "adjustment";

export interface BomLine {
  id: string;
  item: string;
  category: string;
  area: string | null;
  qty: number;
  baseQty: number;
  unit: string;
  spec: string;
  color: string | null;
  notes: string | null;
  status: LineStatus;
  basis: LineBasis;
  structureIds: string[];
  sheet: string | null;
  row: number | null;
  reason?: string;
}

export function fmtDimsMetric(w: number | null, l: number | null, h: number | null) {
  const f = (v: number) => `${round(v, 2)}m`;
  if (w == null || l == null) return "dimensions unknown";
  return h != null ? `${f(w)} x ${f(l)} x ${f(h)}` : `${f(w)} x ${f(l)}`;
}

function baseSpec(i: BomItem) {
  const parts: string[] = [];
  if (i.type) parts.push(String(i.type));
  if (i.dims) parts.push(String(i.dims));
  if (i.sizeLf != null && i.unit === "linear_ft") parts.push(`${round(i.sizeLf, 1)} lf`);
  if (i.areaSf != null && i.unit === "sq_ft") parts.push(`${round(i.areaSf, 1)} sf`);
  if (i.widthRaw) parts.push(`W ${i.widthRaw}`);
  if (i.heightRaw) parts.push(`H ${i.heightRaw}`);
  if (i.color) parts.push(String(i.color));
  if (i.valance) parts.push(`valance ${i.valance}`);
  if (i.slider) parts.push(`slider ${i.slider}`);
  return parts.join(" · ");
}

const sigOf = (w: number | null, l: number | null, h: number | null) => `${w == null ? "?" : round(w, 2)}x${l == null ? "?" : round(l, 2)}x${h == null ? "?" : round(h, 2)}`;

function derivedFor(s: { w: number | null; l: number | null; levels: number | null }) {
  const lv = s.levels ?? 0;
  if (lv < 2 || s.w == null || s.l == null) return { deckSf: 0, railLf: 0 };
  return {
    deckSf: m2ToFt2(s.w * s.l * lv),
    railLf: mToFt(2 * (s.w + s.l) * lv),
  };
}

function baseLineFromItem(i: BomItem): BomLine {
  const q = i.qty ?? 0;
  return {
    id: i.id,
    item: i.item,
    category: i.category ?? "UNCATEGORIZED",
    area: i.area,
    qty: q,
    baseQty: q,
    unit: i.unit ?? "each",
    spec: baseSpec(i),
    color: i.color,
    notes: i.notes,
    status: "unchanged",
    basis: "v2.2",
    structureIds: [],
    sheet: i.sheet,
    row: i.row,
  };
}

const lineToBaseStructs = new Map<string, string[]>();
for (const info of Object.values(SOURCE_INFO)) {
  for (const b of info.bomIds) {
    const arr = lineToBaseStructs.get(b) ?? [];
    arr.push(info.id);
    lineToBaseStructs.set(b, arr);
  }
}

export interface BomResult {
  lines: BomLine[];
  byId: Map<string, BomLine>;
}

export function computeBom(scene: SceneState): BomResult {
  const live = new Map(scene.structures.map((s) => [s.id, s]));
  const out: BomLine[] = [];

  for (const item of BASE_ITEMS) {
    const base = baseLineFromItem(item);
    const linked = lineToBaseStructs.get(item.id);
    if (!linked) {
      out.push(base);
      continue;
    }
    base.structureIds = linked.filter((id) => live.has(id));
    const sched0 = SOURCE_INFO[linked[0]].sched;
    if (sched0) base.notes = [base.notes, "Workbook v2.2 dimensions shown; the current v2.3 drawing supersedes them for this structure."].filter(Boolean).join(" ");
    const perInstance = (item.qty ?? linked.length) / linked.length;
    const baseSig = sigOf(SOURCE_INFO[linked[0]].origW, SOURCE_INFO[linked[0]].origL, SOURCE_INFO[linked[0]].origH);
    const groups = new Map<string, Structure[]>();
    for (const id of linked) {
      const s = live.get(id);
      if (!s) continue;
      const sig = sigOf(s.w, s.l, s.h);
      groups.set(sig, [...(groups.get(sig) ?? []), s]);
    }
    const keep = groups.get(baseSig) ?? [];
    if (keep.length === 0 && groups.size === 1) {
      const [[, arr]] = Array.from(groups);
      const s0 = arr[0];
      base.qty = arr.length * perInstance;
      base.structureIds = arr.map((s) => s.id);
      base.spec = [item.type, fmtDimsMetric(s0.w, s0.l, s0.h), item.color].filter(Boolean).join(" · ");
      base.basis = "resized";
      base.notes = `Resized from ${item.dims ?? "v2.2 dimensions"}`;
      out.push(base);
      continue;
    }
    base.qty = keep.length * perInstance;
    base.structureIds = keep.map((s) => s.id);
    if (base.qty !== base.baseQty) base.basis = "instance count";
    out.push(base);
    for (const [sig, arr] of groups) {
      if (sig === baseSig) continue;
      const s0 = arr[0];
      out.push({
        ...base,
        id: `${item.id}~${sig}`,
        qty: arr.length * perInstance,
        baseQty: 0,
        spec: [item.type, fmtDimsMetric(s0.w, s0.l, s0.h), item.color].filter(Boolean).join(" · "),
        basis: "resized",
        structureIds: arr.map((s) => s.id),
        notes: `Resized from ${item.dims ?? "v2.2 dimensions"}`,
      });
    }
  }

  const addedGroups = new Map<string, Structure[]>();
  for (const s of scene.structures) {
    if (SOURCE_INFO[s.id]) continue;
    const key = `${s.name}|${s.layer}|${sigOf(s.w, s.l, s.h)}|${s.levels ?? "?"}|${s.modelId ?? ""}`;
    addedGroups.set(key, [...(addedGroups.get(key) ?? []), s]);
  }
  for (const [, arr] of addedGroups) {
    const s0 = arr[0];
    out.push({
      id: `add-${s0.id}`,
      item: s0.name,
      category: s0.layer === "frame" ? "FRAME TENTS" : s0.modelId ? "IMPORTED MODELS" : "STRUCTURES",
      area: null,
      qty: arr.length,
      baseQty: 0,
      unit: "each",
      spec: `${s0.type} · ${fmtDimsMetric(s0.w, s0.l, s0.h)}${s0.levels ? ` · ${s0.levels} level${s0.levels > 1 ? "s" : ""}` : ""}`,
      color: null,
      notes: "Added in the Studio. Color, valance, slider and vendor are not specified (unknown).",
      status: "added",
      basis: "added structure",
      structureIds: arr.map((s) => s.id),
      sheet: null,
      row: null,
    });
  }

  if (scene.derivedAllowances) {
    const baseIds = new Set(Object.keys(SOURCE_INFO));
    const ids = new Set<string>([...scene.structures.map((s) => s.id), ...Array.from(baseIds)]);
    let deckTotal = 0;
    let railTotal = 0;
    const deckIds: string[] = [];
    for (const id of ids) {
      const cur = live.get(id);
      const info = SOURCE_INFO[id];
      const curD = cur ? derivedFor(cur) : { deckSf: 0, railLf: 0 };
      const baseDerived = info ? derivedFor({ w: info.origW, l: info.origL, levels: BASE_LEVELS.get(id) ?? null }) : { deckSf: 0, railLf: 0 };
      const dd = curD.deckSf - baseDerived.deckSf;
      const dr = curD.railLf - baseDerived.railLf;
      if (Math.abs(dd) > 0.5 || Math.abs(dr) > 0.5) {
        deckTotal += dd;
        railTotal += dr;
        deckIds.push(id);
      }
    }
    if (Math.abs(deckTotal) > 0.5) {
      out.push({
        id: "drv-deck",
        item: "ELEVATED DECK / FLOOR AREA (derived estimate)",
        category: "DECKING - RAMPS - CARPET",
        area: null,
        qty: round(deckTotal, 1),
        baseQty: 0,
        unit: "sq_ft",
        spec: "width x length x levels of multi-level structures changed vs v2.2",
        color: null,
        notes: "Rule-based estimate from footprint x levels. Not in the v2.2 schedule; verify with the vendor.",
        status: "added",
        basis: "derived estimate",
        structureIds: deckIds,
        sheet: null,
        row: null,
      });
    }
    if (Math.abs(railTotal) > 0.5) {
      out.push({
        id: "drv-rail",
        item: "PERIMETER RAILING (derived estimate)",
        category: "FENCE - RAILING",
        area: null,
        qty: round(railTotal, 1),
        baseQty: 0,
        unit: "linear_ft",
        spec: "perimeter x levels of multi-level structures changed vs v2.2",
        color: null,
        notes: "Rule-based estimate. Not in the v2.2 schedule; stairs, back of house and furniture are NOT estimated (unknown).",
        status: "added",
        basis: "derived estimate",
        structureIds: deckIds,
        sheet: null,
        row: null,
      });
    }
  }

  const byId = new Map(out.map((l) => [l.id, l]));
  for (const a of scene.bomAdjustments) applyAdjustment(out, byId, a);

  for (const l of out) {
    if (l.basis === "adjustment" && l.status === "added") continue;
    if (l.qty === l.baseQty && l.basis !== "resized") l.status = "unchanged";
    else if (l.baseQty === 0) l.status = "added";
    else if (l.qty === 0) l.status = "removed";
    else l.status = "changed";
  }
  return { lines: out, byId };
}

function applyAdjustment(out: BomLine[], byId: Map<string, BomLine>, a: BomAdjustment) {
  if (a.action === "add_line") {
    const line: BomLine = {
      id: a.id,
      item: a.item,
      category: a.category,
      area: a.area ?? null,
      qty: a.qty,
      baseQty: 0,
      unit: a.unit,
      spec: a.spec ?? "",
      color: null,
      notes: a.reason ?? "Manual line",
      status: "added",
      basis: "adjustment",
      structureIds: [],
      sheet: null,
      row: null,
      reason: a.reason,
    };
    out.push(line);
    byId.set(line.id, line);
    return;
  }
  const l = byId.get(a.lineId);
  if (!l) return;
  l.reason = a.reason;
  if (a.action === "set_qty") {
    l.qty = a.qty;
    l.basis = l.basis === "v2.2" || l.basis === "instance count" ? "adjustment" : l.basis;
  } else {
    l.qty = 0;
    l.basis = l.basis === "v2.2" || l.basis === "instance count" ? "adjustment" : l.basis;
  }
}

const BASE_LEVELS = new Map<string, number | null>(BASE_STRUCTURES.map((s) => [s.id, s.levels]));

export interface UnitTotals {
  each: number;
  linear_ft: number;
  sq_ft: number;
}

export function totalsByUnit(lines: BomLine[]): UnitTotals {
  const t: UnitTotals = { each: 0, linear_ft: 0, sq_ft: 0 };
  for (const l of lines) {
    if (l.unit === "linear_ft") t.linear_ft += l.qty;
    else if (l.unit === "sq_ft") t.sq_ft += l.qty;
    else t.each += l.qty;
  }
  return t;
}

export function baseTotals(): UnitTotals {
  const t: UnitTotals = { each: 0, linear_ft: 0, sq_ft: 0 };
  for (const i of BASE_ITEMS) {
    const q = i.qty ?? 0;
    if (i.unit === "linear_ft") t.linear_ft += q;
    else if (i.unit === "sq_ft") t.sq_ft += q;
    else t.each += q;
  }
  return t;
}

export interface BomSummary {
  lineCount: number;
  baseLineCount: number;
  added: number;
  removed: number;
  changed: number;
  totals: UnitTotals;
  base: UnitTotals;
}

export function summarizeBom(res: BomResult): BomSummary {
  const lines = res.lines.filter((l) => l.qty !== 0 || l.baseQty !== 0);
  return {
    lineCount: res.lines.filter((l) => l.qty > 0).length,
    baseLineCount: BASE_ITEMS.length,
    added: lines.filter((l) => l.status === "added").length,
    removed: lines.filter((l) => l.status === "removed").length,
    changed: lines.filter((l) => l.status === "changed").length,
    totals: totalsByUnit(res.lines),
    base: baseTotals(),
  };
}

export function bomDiffLines(res: BomResult) {
  return res.lines.filter((l) => l.status !== "unchanged");
}

export const BOM_CATEGORIES = Array.from(new Set(BASE_ITEMS.map((i) => i.category).filter(Boolean))) as string[];

const areaNameCache = new Map<string, string[]>();

export function areaStructureNames(area: string | null): string[] {
  if (!area) return [];
  const hit = areaNameCache.get(area);
  if (hit) return hit;
  const names: string[] = [];
  for (const s of BASE_STRUCTURES) {
    const info = SOURCE_INFO[s.id];
    if (info?.zone === area && s.id.startsWith("s-")) names.push(s.name);
  }
  const uniq = Array.from(new Set(names));
  areaNameCache.set(area, uniq);
  return uniq;
}

export function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const BOM_EXPORT_HEADERS = ["Line ID", "Item", "Category", "Area (v2.2 zone code)", "Quantity", "Unit", "v2.2 quantity", "Delta", "Status", "Basis", "Spec", "Color", "Notes", "Source sheet", "Source row"];

export function bomRows(lines: BomLine[]) {
  return lines.map((l) => [l.id, l.item, l.category, l.area ?? "", round(l.qty, 3), l.unit, round(l.baseQty, 3), round(l.qty - l.baseQty, 3), l.status, l.basis, l.spec, l.color ?? "", l.notes ?? "", l.sheet ?? "", l.row ?? ""]);
}

export function bomToCsv(lines: BomLine[]) {
  return [BOM_EXPORT_HEADERS, ...bomRows(lines)].map((r) => r.map(csvEscape).join(",")).join("\n");
}
