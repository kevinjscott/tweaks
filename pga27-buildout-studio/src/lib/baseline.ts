import raw from "@/data/structures.json";
import { classifyLayer, visualDims } from "./layers";
import { ftToM, pxToPlan, round } from "./geo";
import type { SceneState, SourceInfo, Structure } from "./types";

interface RawStructure {
  id: string;
  name: string;
  type: string;
  zone: string | null;
  sheet: string | null;
  hole: number | null;
  px: number | null;
  py: number | null;
  posMethod: string;
  wFt: number | null;
  lFt: number | null;
  hFt: number | null;
  footprintSqFt: number | null;
  levels: number | null;
  dimSource: string | null;
  raw: string | null;
  bomIds: string[];
  zoneBom: number | null;
  status: string | null;
  instance: number | null;
  srcQty: number | null;
  image: string | null;
  revision: string | null;
  notes: string | null;
  sched: { wFt: number | null; lFt: number | null; hFt: number | null } | null;
  seats: number | null;
  rows: number | null;
}

const data = raw as unknown as {
  geometryWarning: string;
  structures: RawStructure[];
  zoneBom: string[][];
};

export const GEOMETRY_WARNING = data.geometryWarning;

interface Built {
  structure: Structure;
  info: SourceInfo;
}

function buildAll(): Built[] {
  const built: Built[] = data.structures.map((r) => {
    // width_ft/length_ft/height_ft are the CURRENT dimensions (current drawings supersede the workbook where verified);
    // raw_dimensions can still hold the older workbook text, so it is only displayed, never parsed.
    const w = ftToM(r.wFt);
    const l = ftToM(r.lFt);
    const h = ftToM(r.hFt);
    const placed = r.px != null && r.py != null;
    const p = placed ? pxToPlan(r.px as number, r.py as number) : null;
    const structure: Structure = {
      id: r.id,
      name: r.name,
      type: r.type,
      layer: classifyLayer(r.name, r.type, r.levels),
      x: p ? round(p.x, 2) : null,
      y: p ? round(p.y, 2) : null,
      rot: 0,
      w: w != null ? round(w, 3) : null,
      l: l != null ? round(l, 3) : null,
      h: h != null ? round(h, 3) : null,
      levels: r.levels,
      ...(r.rows != null ? { rows: r.rows } : {}),
    };
    const info: SourceInfo = {
      id: r.id,
      zone: r.zone,
      sheet: r.sheet,
      hole: r.hole,
      px: r.px,
      py: r.py,
      posMethod: r.posMethod,
      dimSource: r.dimSource,
      raw: r.raw,
      bomIds: r.bomIds,
      zoneBomIds: r.zoneBom != null ? data.zoneBom[r.zoneBom] : [],
      status: r.status,
      image: r.image,
      revision: r.revision,
      notes: r.notes,
      sched: r.sched ? { w: ftToM(r.sched.wFt), l: ftToM(r.sched.lFt), h: ftToM(r.sched.hFt) } : null,
      seats: r.seats,
      rows: r.rows,
      srcQty: r.srcQty,
      packed: null,
      origW: structure.w,
      origL: structure.l,
      origH: structure.h,
    };
    return { structure, info };
  });
  return built;
}

/**
 * Many scheduled tents share ONE labelled zone anchor in the source. Drawing them on top of each other is
 * unreadable, so (display aid only) they are shelf-packed in a block centred on the shared anchor. The offset
 * is recorded in SourceInfo.packed and surfaced in the UI. It is NOT a surveyed position.
 */
function packSharedAnchors(built: Built[]) {
  const groups = new Map<string, Built[]>();
  for (const b of built) {
    if (b.info.px == null || b.info.py == null) continue;
    const key = `${b.info.px},${b.info.py}`;
    const g = groups.get(key) ?? [];
    g.push(b);
    groups.set(key, g);
  }
  const GAP = 3;
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const items = g
      .map((b) => {
        const v = visualDims(b.structure);
        return { b, w: Math.max(v.w, 4), l: Math.max(v.l, 4) };
      })
      .sort((a, b) => b.w * b.l - a.w * a.l);
    const total = items.reduce((s, i) => s + i.w * i.l, 0);
    const maxRow = Math.max(items[0].w + GAP, Math.sqrt(total) * 1.5);
    let cx = 0;
    let cy = 0;
    let rowH = 0;
    let maxX = 0;
    const placedRects: { it: (typeof items)[number]; x: number; y: number }[] = [];
    for (const it of items) {
      if (cx > 0 && cx + it.w > maxRow) {
        cx = 0;
        cy += rowH + GAP;
        rowH = 0;
      }
      placedRects.push({ it, x: cx, y: cy });
      cx += it.w + GAP;
      rowH = Math.max(rowH, it.l);
      maxX = Math.max(maxX, cx - GAP);
    }
    const totalH = cy + rowH;
    for (const r of placedRects) {
      const centerX = r.x + r.it.w / 2 - maxX / 2;
      const centerY = -(r.y + r.it.l / 2 - totalH / 2);
      const s = r.it.b.structure;
      const ax = s.x as number;
      const ay = s.y as number;
      s.x = round(ax + centerX, 2);
      s.y = round(ay + centerY, 2);
      r.it.b.info.packed = { dx: round(centerX, 1), dy: round(centerY, 1), sharedWith: g.length };
    }
  }
}

const built = buildAll();
packSharedAnchors(built);

export const BASE_STRUCTURES: Structure[] = built.map((b) => b.structure);
export const SOURCE_INFO: Record<string, SourceInfo> = Object.fromEntries(built.map((b) => [b.info.id, b.info]));

export function buildBaselineScene(): SceneState {
  return {
    structures: BASE_STRUCTURES.map((s) => ({ ...s })),
    tours: [],
    bomAdjustments: [],
    measurements: [],
    derivedAllowances: true,
  };
}

/** Structures with a coordinate that is shared with at least one other structure. */
export function sharedAnchorCount() {
  return built.filter((b) => b.info.packed).length;
}
