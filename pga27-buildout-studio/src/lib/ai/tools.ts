import { tool } from "ai";
import { z } from "zod";
import { SOURCE_INFO } from "@/lib/baseline";
import { BOM_CATEGORIES, bomDiffLines, computeBom, summarizeBom, type BomLine } from "@/lib/bom";
import { compassName, headingOf, round } from "@/lib/geo";
import { LAYERS, LAYER_BY_ID, visualDims } from "@/lib/layers";
import { allPlaces, findPlaces } from "@/lib/places";
import { applyOp, corners, distance, isPlaced, nextId, nextStructureId, polygonArea } from "@/lib/scene";
import { allTours, posePointing, waypointsToKeyframes, type Waypoint } from "@/lib/tours";
import type { LayerId, Measurement, SceneOp, SceneState, Structure, ToolOutput, Tour } from "@/lib/types";

export interface ToolContext {
  scene: SceneState;
}

const layerEnum = z.enum(LAYERS.map((l) => l.id) as [LayerId, ...LayerId[]]);

function fail(message: string, data?: unknown): ToolOutput {
  return { ok: false, message, data };
}

function brief(s: Structure) {
  const v = visualDims(s);
  return {
    id: s.id,
    name: s.name,
    layer: s.layer,
    type: s.type,
    x_m: s.x == null ? null : round(s.x, 1),
    y_m: s.y == null ? null : round(s.y, 1),
    width_m: s.w,
    length_m: s.l,
    height_m: s.h,
    levels: s.levels,
    rotation_deg: s.rot,
    footprint_m2: s.w != null && s.l != null ? round(s.w * s.l, 1) : null,
    dimensions_known: s.w != null && s.l != null,
    ...(v.assumed.l && s.layer === "grandstand" ? { note: "grandstand depth unknown (visual placeholder only)" } : {}),
  };
}

function findStructure(ctx: ToolContext, idOrName: string): Structure | null {
  const q = idOrName.trim().toLowerCase();
  const byId = ctx.scene.structures.find((s) => s.id.toLowerCase() === q);
  if (byId) return byId;
  const exact = ctx.scene.structures.filter((s) => s.name.toLowerCase() === q);
  if (exact.length === 1) return exact[0];
  return null;
}

function resolvePoint(ctx: ToolContext, p: { structure_id?: string; place?: string; x_m?: number; y_m?: number }): { x: number; y: number; label: string; size?: number } | string {
  if (p.structure_id) {
    const s = findStructure(ctx, p.structure_id);
    if (!s) return `Unknown structure '${p.structure_id}'. Use find_structures to look up ids.`;
    if (!isPlaced(s)) return `Structure ${s.id} (${s.name}) has no known position.`;
    const v = visualDims(s);
    return { x: s.x, y: s.y, label: s.name, size: Math.max(v.w, v.l) };
  }
  if (p.place) {
    const pl = findPlaces(ctx.scene, p.place)[0];
    if (!pl) return `No known place matches '${p.place}'. Call locate_place to see candidates or pass x_m/y_m.`;
    return { x: pl.x, y: pl.y, label: pl.label };
  }
  if (p.x_m != null && p.y_m != null) return { x: p.x_m, y: p.y_m, label: `(${p.x_m}, ${p.y_m})` };
  return "Provide structure_id, place, or x_m and y_m.";
}

function overlapsWith(ctx: ToolContext, cand: Structure, ignoreId?: string) {
  if (!isPlaced(cand)) return [];
  const v = visualDims(cand);
  const cs = corners(cand, v.w, v.l);
  const bb = (pts: { x: number; y: number }[]) => ({
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  });
  const a = bb(cs);
  const hits: string[] = [];
  for (const o of ctx.scene.structures) {
    if (o.id === ignoreId || o.id === cand.id || !isPlaced(o) || o.w == null || o.l == null) continue;
    const b = bb(corners(o, o.w, o.l));
    if (a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY) hits.push(`${o.name} (${o.id})`);
  }
  return hits.slice(0, 6);
}

function commit(ctx: ToolContext, op: SceneOp) {
  ctx.scene = applyOp(ctx.scene, op);
}

function lineBrief(l: BomLine) {
  return {
    line_id: l.id,
    item: l.item,
    category: l.category,
    area_code_v2_2: l.area,
    qty: round(l.qty, 2),
    v2_2_qty: round(l.baseQty, 2),
    unit: l.unit,
    status: l.status,
    basis: l.basis,
    spec: l.spec,
  };
}

const waypointSchema = z.object({
  structure_id: z.string().optional().describe("Structure id or exact name to fly to"),
  place: z.string().optional().describe("Named place, e.g. 'main entrance', '17 tee'"),
  x_m: z.number().optional(),
  y_m: z.number().optional(),
  distance_m: z.number().optional().describe("Camera standoff distance from the point"),
  altitude_m: z.number().optional().describe("Camera height above ground"),
  label: z.string().optional(),
});

const pointRef = z.object({
  structure_id: z.string().optional(),
  place: z.string().optional(),
  x_m: z.number().optional(),
  y_m: z.number().optional(),
});

export interface ToolDef<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: S;
  run: (args: z.infer<S>, ctx: ToolContext) => ToolOutput | Promise<ToolOutput>;
  readonly?: boolean;
}

function def<S extends z.ZodType>(d: ToolDef<S>): ToolDef<S> {
  return d;
}

export const TOOL_DEFS = [
  def({
    name: "find_structures",
    readonly: true,
    description:
      "Search structures in the current scene by name text, layer or proximity. Returns ids, positions (plan metres: x east, y north from the master-plan centre) and known dimensions. Unknown values are null.",
    schema: z.object({
      query: z.string().optional().describe("Case-insensitive text in the structure name or type"),
      layer: layerEnum.optional(),
      near_x_m: z.number().optional(),
      near_y_m: z.number().optional(),
      radius_m: z.number().optional().describe("With near_x_m/near_y_m; default 150"),
      limit: z.number().int().min(1).max(60).optional(),
    }),
    run: (a, ctx) => {
      let list = ctx.scene.structures;
      if (a.query) {
        const q = a.query.toLowerCase();
        list = list.filter((s) => s.name.toLowerCase().includes(q) || s.type.toLowerCase().includes(q) || s.id.toLowerCase() === q);
      }
      if (a.layer) list = list.filter((s) => s.layer === a.layer);
      if (a.near_x_m != null && a.near_y_m != null) {
        const c = { x: a.near_x_m, y: a.near_y_m };
        const r = a.radius_m ?? 150;
        list = list.filter((s) => isPlaced(s) && distance(s as { x: number; y: number }, c) <= r).sort((p, q) => distance(p as { x: number; y: number }, c) - distance(q as { x: number; y: number }, c));
      }
      const limit = a.limit ?? 15;
      return { ok: true, message: `${list.length} match(es)${list.length > limit ? `, showing ${limit}` : ""}.`, data: { total: list.length, structures: list.slice(0, limit).map(brief) } };
    },
  }),
  def({
    name: "locate_place",
    readonly: true,
    description:
      "Resolve a landmark name (e.g. '16 green', '17 tee', 'main entrance', 'media center', 'PGA Shops', 'clubhouse', 'Teel compound 1') to plan coordinates in metres (x east, y north). Positions are approximate label anchors, not surveyed.",
    schema: z.object({ query: z.string() }),
    run: (a, ctx) => {
      const found = findPlaces(ctx.scene, a.query);
      if (!found.length) return fail(`No landmark matches '${a.query}'.`, { known_places: allPlaces(ctx.scene).map((p) => p.label) });
      return { ok: true, message: `${found.length} place(s) found. Coordinates are approximate anchors.`, data: { places: found.slice(0, 5) } };
    },
  }),
  def({
    name: "get_structure",
    readonly: true,
    description: "Full details for one structure: position, dimensions, source sheet, revision notes, linked BOM lines.",
    schema: z.object({ id: z.string().describe("Structure id or exact name") }),
    run: (a, ctx) => {
      const s = findStructure(ctx, a.id);
      if (!s) return fail(`No structure '${a.id}'.`);
      const info = SOURCE_INFO[s.id];
      const bom = computeBom(ctx.scene);
      const linked = bom.lines.filter((l) => l.structureIds.includes(s.id)).map(lineBrief);
      return {
        ok: true,
        message: `Details for ${s.name}.`,
        data: {
          ...brief(s),
          source: info
            ? { v2_2_zone: info.zone, v2_3_sheet: info.sheet, dimension_source: info.dimSource, raw_dimensions: info.raw, revision_note: info.revision, notes: info.notes, position_method: info.posMethod, packed_offset_m: info.packed, v2_2_dimensions_m: info.sched }
            : { origin: "added in this scenario" },
          linked_bom_lines: linked,
        },
      };
    },
  }),
  def({
    name: "add_structure",
    description:
      "Add a new structure. Give width_m (east-west at rotation 0) and length_m (north-south at rotation 0). Choose a position with x_m/y_m, or near_structure_id / near_place plus optional offsets. If height is omitted: two-level structures default to 7.4 m (the v2.2 two-level suite nominal), single-level tents to 3.4 m (A-frame nominal), frame tents stay unknown. The result reports overlaps with existing structures so you can adjust.",
    schema: z.object({
      name: z.string(),
      layer: layerEnum.describe("hospitality for suites/villages, fnb for markets/bars, grandstand, frame for frame tents, media, retail, access, ops, activation, infra"),
      width_m: z.number().positive(),
      length_m: z.number().positive(),
      height_m: z.number().positive().optional(),
      levels: z.number().int().min(1).max(4).optional(),
      x_m: z.number().optional(),
      y_m: z.number().optional(),
      near_structure_id: z.string().optional(),
      near_place: z.string().optional(),
      offset_east_m: z.number().optional(),
      offset_north_m: z.number().optional(),
      rotation_deg: z.number().optional().describe("Degrees counter-clockwise in plan"),
      rows: z.number().int().min(3).max(40).optional().describe("Grandstand seating rows (massing only)"),
    }),
    run: (a, ctx) => {
      let x = a.x_m;
      let y = a.y_m;
      const ref = a.near_structure_id ? { structure_id: a.near_structure_id } : a.near_place ? { place: a.near_place } : null;
      if ((x == null || y == null) && ref) {
        const p = resolvePoint(ctx, ref);
        if (typeof p === "string") return fail(p);
        const defaultEast = a.offset_east_m == null && a.offset_north_m == null && p.size ? p.size / 2 + a.width_m / 2 + 6 : 0;
        x = p.x + (a.offset_east_m ?? defaultEast);
        y = p.y + (a.offset_north_m ?? 0);
      }
      if (x == null || y == null) return fail("Position required: pass x_m and y_m, near_structure_id or near_place.");
      const levels = a.levels ?? 1;
      let h: number | null = a.height_m ?? null;
      let defaulted = "";
      if (h == null) {
        if (levels >= 2) {
          h = 7.4;
          defaulted = "height defaulted to 7.4 m (v2.2 two-level suite nominal)";
        } else if (a.layer !== "frame") {
          h = 3.4;
          defaulted = "height defaulted to 3.4 m (A-frame nominal)";
        }
      }
      const s: Structure = {
        id: nextStructureId(ctx.scene),
        name: a.name,
        type: a.layer === "frame" ? "Frame tent" : levels >= 2 ? "Two-level structure" : a.layer === "grandstand" ? "grandstand" : "A-Frame",
        layer: a.layer,
        x: round(x, 2),
        y: round(y, 2),
        rot: a.rotation_deg ?? 0,
        w: a.width_m,
        l: a.length_m,
        h,
        levels,
        ...(a.rows ? { rows: a.rows } : {}),
        custom: true,
        note: "Added in the Studio",
      };
      const overlaps = overlapsWith(ctx, s);
      commit(ctx, { op: "add_structure", structure: s });
      return {
        ok: true,
        message: `Added ${s.name} (${s.id}) ${a.width_m} x ${a.length_m} m, ${levels} level(s) at (${s.x}, ${s.y}).${defaulted ? ` Note: ${defaulted}.` : ""}${overlaps.length ? ` WARNING: overlaps ${overlaps.join(", ")}.` : ""}`,
        data: { id: s.id, overlaps, ...(defaulted ? { defaulted } : {}) },
        sceneOp: { op: "add_structure", structure: s },
      };
    },
  }),
  def({
    name: "move_structure",
    description: "Move a structure by a relative offset (east_m / north_m, negative for west / south) or to an absolute position (to_x_m, to_y_m). '30 m north' = north_m 30.",
    schema: z.object({
      id: z.string(),
      east_m: z.number().optional(),
      north_m: z.number().optional(),
      to_x_m: z.number().optional(),
      to_y_m: z.number().optional(),
    }),
    run: (a, ctx) => {
      const s = findStructure(ctx, a.id);
      if (!s) return fail(`No structure '${a.id}'.`);
      if (!isPlaced(s) && (a.to_x_m == null || a.to_y_m == null)) return fail(`${s.name} has no known position; pass to_x_m and to_y_m to place it.`);
      const nx = a.to_x_m ?? (s.x ?? 0) + (a.east_m ?? 0);
      const ny = a.to_y_m ?? (s.y ?? 0) + (a.north_m ?? 0);
      const patch = { x: round(nx, 2), y: round(ny, 2) };
      const overlaps = overlapsWith(ctx, { ...s, ...patch });
      const op: SceneOp = { op: "update_structure", id: s.id, patch };
      commit(ctx, op);
      return {
        ok: true,
        message: `Moved ${s.name} (${s.id}) to (${patch.x}, ${patch.y}).${overlaps.length ? ` WARNING: overlaps ${overlaps.join(", ")}.` : ""}`,
        data: { id: s.id, from: { x_m: s.x, y_m: s.y }, to: { x_m: patch.x, y_m: patch.y }, overlaps },
        sceneOp: op,
      };
    },
  }),
  def({
    name: "resize_structure",
    description: "Change width (east-west at rotation 0), length (north-south), height or number of levels. Omit fields to keep them.",
    schema: z.object({
      id: z.string(),
      width_m: z.number().positive().optional(),
      length_m: z.number().positive().optional(),
      height_m: z.number().positive().optional(),
      levels: z.number().int().min(1).max(4).optional(),
    }),
    run: (a, ctx) => {
      const s = findStructure(ctx, a.id);
      if (!s) return fail(`No structure '${a.id}'.`);
      const patch: Partial<Structure> = {};
      if (a.width_m != null) patch.w = a.width_m;
      if (a.length_m != null) patch.l = a.length_m;
      if (a.height_m != null) patch.h = a.height_m;
      if (a.levels != null) patch.levels = a.levels;
      if (!Object.keys(patch).length) return fail("Nothing to change.");
      const op: SceneOp = { op: "update_structure", id: s.id, patch };
      commit(ctx, op);
      return { ok: true, message: `Resized ${s.name} (${s.id}): ${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(", ")}.`, data: { id: s.id, patch }, sceneOp: op };
    },
  }),
  def({
    name: "rotate_structure",
    description: "Rotate a structure. rotation_deg sets the absolute angle (degrees counter-clockwise in plan; 0 = width along east-west). delta_deg adds to the current angle.",
    schema: z.object({ id: z.string(), rotation_deg: z.number().optional(), delta_deg: z.number().optional() }),
    run: (a, ctx) => {
      const s = findStructure(ctx, a.id);
      if (!s) return fail(`No structure '${a.id}'.`);
      const rot = a.rotation_deg ?? s.rot + (a.delta_deg ?? 0);
      const patch = { rot: round(((rot % 360) + 360) % 360, 1) };
      const op: SceneOp = { op: "update_structure", id: s.id, patch };
      commit(ctx, op);
      return { ok: true, message: `Rotated ${s.name} (${s.id}) to ${patch.rot} deg.`, data: { id: s.id, ...patch }, sceneOp: op };
    },
  }),
  def({
    name: "delete_structure",
    description: "Delete a structure from the scene (removes its linked v2.2 BOM quantity).",
    schema: z.object({ id: z.string() }),
    run: (a, ctx) => {
      const s = findStructure(ctx, a.id);
      if (!s) return fail(`No structure '${a.id}'.`);
      const op: SceneOp = { op: "delete_structure", id: s.id };
      commit(ctx, op);
      return { ok: true, message: `Deleted ${s.name} (${s.id}).`, data: { id: s.id }, sceneOp: op };
    },
  }),
  def({
    name: "select_structures",
    description: "Select structures in the viewport so the user sees them highlighted.",
    schema: z.object({ ids: z.array(z.string()).min(1).max(40) }),
    run: (a, ctx) => {
      const ids = a.ids.map((i) => findStructure(ctx, i)?.id).filter((x): x is string => !!x);
      if (!ids.length) return fail("None of those ids exist.");
      return { ok: true, message: `Selected ${ids.length} structure(s).`, data: { ids }, viewOp: { op: "select", ids } };
    },
  }),
  def({
    name: "set_camera",
    description:
      "Move the 3D camera. Either focus a structure (focus_structure_id) or a ground point (x_m,y_m) or a named place, optionally with heading_deg (compass direction the camera looks toward; 0 = north, 90 = east), distance_m and altitude_m. view='top' gives a plan view; view='site' frames the entire site.",
    schema: z.object({
      focus_structure_id: z.string().optional(),
      place: z.string().optional(),
      x_m: z.number().optional(),
      y_m: z.number().optional(),
      heading_deg: z.number().optional(),
      distance_m: z.number().optional(),
      altitude_m: z.number().optional(),
      view: z.enum(["perspective", "top", "site"]).optional(),
    }),
    run: (a, ctx) => {
      if (a.view === "site") {
        const pose = { pos: { x: 0, y: -1900, z: 1500 }, target: { x: 0, y: 0, z: 0 } };
        return { ok: true, message: "Camera set to whole-site view.", viewOp: { op: "set_camera", pose, mode: "perspective", seconds: 2 } };
      }
      const p = a.focus_structure_id ? resolvePoint(ctx, { structure_id: a.focus_structure_id }) : a.place ? resolvePoint(ctx, { place: a.place }) : a.x_m != null && a.y_m != null ? resolvePoint(ctx, { x_m: a.x_m, y_m: a.y_m }) : "Provide focus_structure_id, place, x_m/y_m or view.";
      if (typeof p === "string") return fail(p);
      if (a.view === "top") {
        const h = Math.max(120, (a.altitude_m ?? 200));
        return { ok: true, message: `Top view over ${p.label}.`, viewOp: { op: "set_camera", pose: { pos: { x: p.x, y: p.y, z: h }, target: { x: p.x, y: p.y, z: 0 } }, mode: "top", seconds: 1.5 } };
      }
      const size = p.size ?? 30;
      const dist = a.distance_m ?? Math.max(70, size * 1.9);
      const pose = posePointing({ x: p.x, y: p.y, z: 3 }, a.heading_deg ?? 20, dist, a.altitude_m ?? Math.max(30, dist * 0.55));
      return { ok: true, message: `Camera moved to look at ${p.label}.`, viewOp: { op: "set_camera", pose, mode: "perspective", seconds: 2 } };
    },
  }),
  def({
    name: "create_flythrough",
    description:
      "Create a keyframe camera tour through an ordered list of waypoints (structures, named places or coordinates). The camera follows the path, approaching each waypoint along the direction of travel. Set play=true to start it. Example: from the main gate to the 17th tee = waypoints [{place:'main entrance'}, {place:'17 tee'}].",
    schema: z.object({
      name: z.string(),
      waypoints: z.array(waypointSchema).min(2).max(14),
      seconds_per_leg: z.number().min(2).max(60).optional().describe("Optional; default scales with distance (about 40 m/s)"),
      play: z.boolean().optional(),
    }),
    run: (a, ctx) => {
      const wps: Waypoint[] = [];
      for (const w of a.waypoints) {
        const p = resolvePoint(ctx, w);
        if (typeof p === "string") return fail(p);
        wps.push({ point: { x: p.x, y: p.y }, size: p.size, altitude: w.altitude_m, distance: w.distance_m, label: w.label ?? p.label });
      }
      const tour: Tour = {
        id: nextId("tour", ctx.scene.tours.map((t) => t.id)),
        name: a.name,
        keyframes: waypointsToKeyframes(wps, a.seconds_per_leg),
        description: `Created by assistant: ${wps.map((w) => w.label).join(" -> ")}`,
      };
      const op: SceneOp = { op: "add_tour", tour };
      commit(ctx, op);
      const legM = wps.slice(1).reduce((t, w, i) => t + distance(w.point, wps[i].point), 0);
      return {
        ok: true,
        message: `Created flythrough '${tour.name}' (${tour.id}) with ${tour.keyframes.length} keyframes covering ~${Math.round(legM)} m.`,
        data: { id: tour.id, keyframes: tour.keyframes.length, path_length_m: Math.round(legM) },
        sceneOp: op,
        viewOp: a.play === false ? undefined : { op: "play_tour", tourId: tour.id },
      };
    },
  }),
  def({
    name: "play_flythrough",
    description: "Play an existing flythrough (preset or user-created) by id or name. Presets: preset-full-site, preset-entrance-shops, preset-hospitality, preset-media.",
    schema: z.object({ tour: z.string() }),
    run: (a, ctx) => {
      const q = a.tour.toLowerCase();
      const t = allTours(ctx.scene).find((x) => x.id.toLowerCase() === q || x.name.toLowerCase() === q) ?? allTours(ctx.scene).find((x) => x.name.toLowerCase().includes(q));
      if (!t) return fail(`No flythrough '${a.tour}'.`, { available: allTours(ctx.scene).map((x) => ({ id: x.id, name: x.name })) });
      return { ok: true, message: `Playing '${t.name}'.`, viewOp: { op: "play_tour", tourId: t.id } };
    },
  }),
  def({
    name: "query_bom",
    readonly: true,
    description: `Search the live bill of materials (v2.2 schedule + current scene changes). Filters: search text (item/spec), category (${BOM_CATEGORIES.join(", ")}), area (v2.2 zone code such as '10.2'; codes do NOT match v2.3 sheet numbers), structure_id, changed_only. Returns lines and totals.`,
    schema: z.object({
      search: z.string().optional(),
      category: z.string().optional(),
      area: z.string().optional(),
      structure_id: z.string().optional(),
      changed_only: z.boolean().optional(),
      limit: z.number().int().min(1).max(60).optional(),
    }),
    run: (a, ctx) => {
      const res = computeBom(ctx.scene);
      let lines = res.lines;
      if (a.search) {
        const q = a.search.toLowerCase();
        lines = lines.filter((l) => l.item.toLowerCase().includes(q) || l.spec.toLowerCase().includes(q));
      }
      if (a.category) lines = lines.filter((l) => l.category.toLowerCase() === a.category!.toLowerCase());
      if (a.area) lines = lines.filter((l) => l.area === a.area);
      if (a.structure_id) lines = lines.filter((l) => l.structureIds.includes(a.structure_id!));
      if (a.changed_only) lines = lines.filter((l) => l.status !== "unchanged");
      const limit = a.limit ?? 25;
      const unitTotals = { each: 0, linear_ft: 0, sq_ft: 0 } as Record<string, number>;
      for (const l of lines) unitTotals[l.unit] = (unitTotals[l.unit] ?? 0) + l.qty;
      return { ok: true, message: `${lines.length} BOM line(s).`, data: { total_lines: lines.length, totals_by_unit: unitTotals, lines: lines.slice(0, limit).map(lineBrief) } };
    },
  }),
  def({
    name: "bom_diff",
    readonly: true,
    description: "Summarise how the current scene's BOM differs from the original v2.2 schedule: counts of added/removed/changed lines, net quantity by unit, and the changed lines.",
    schema: z.object({ limit: z.number().int().min(1).max(60).optional() }),
    run: (a, ctx) => {
      const res = computeBom(ctx.scene);
      const sum = summarizeBom(res);
      const changed = bomDiffLines(res);
      return {
        ok: true,
        message: `BOM vs v2.2: ${sum.added} added, ${sum.removed} removed, ${sum.changed} changed line(s).`,
        data: {
          v2_2_item_lines: sum.baseLineCount,
          current_lines_with_qty: sum.lineCount,
          totals_v2_2: sum.base,
          totals_now: sum.totals,
          net_change: { each: round(sum.totals.each - sum.base.each, 2), linear_ft: round(sum.totals.linear_ft - sum.base.linear_ft, 1), sq_ft: round(sum.totals.sq_ft - sum.base.sq_ft, 1) },
          changed_lines: changed.slice(0, a.limit ?? 30).map(lineBrief),
          caveats: "Zone-level quantities (fence, decking, stairs, BOH, furniture) are shared area quantities and are not auto-scaled; derived estimates are rule-based and flagged.",
        },
      };
    },
  }),
  def({
    name: "modify_bom",
    description:
      "Adjust the BOM. set_quantity changes a line quantity (line_id from query_bom); remove_line zeroes a line; add_line adds a manual line (item, category, quantity, unit). Always give a short reason.",
    schema: z.object({
      action: z.enum(["set_quantity", "remove_line", "add_line"]),
      line_id: z.string().optional(),
      quantity: z.number().min(0).optional(),
      item: z.string().optional(),
      category: z.string().optional(),
      unit: z.enum(["each", "linear_ft", "sq_ft"]).optional(),
      area: z.string().optional(),
      spec: z.string().optional(),
      reason: z.string().optional(),
    }),
    run: (a, ctx) => {
      const id = nextId("adj", ctx.scene.bomAdjustments.map((x) => x.id));
      let adjustment;
      if (a.action === "add_line") {
        if (!a.item || a.quantity == null || !a.unit) return fail("add_line needs item, quantity and unit.");
        adjustment = { id, action: "add_line" as const, item: a.item, category: a.category ?? "ADDED", qty: a.quantity, unit: a.unit, area: a.area, spec: a.spec, reason: a.reason };
      } else {
        if (!a.line_id) return fail("line_id required.");
        const line = computeBom(ctx.scene).byId.get(a.line_id);
        if (!line) return fail(`Unknown line_id '${a.line_id}'. Use query_bom.`);
        if (a.action === "set_quantity") {
          if (a.quantity == null) return fail("quantity required.");
          adjustment = { id, action: "set_qty" as const, lineId: a.line_id, qty: a.quantity, reason: a.reason };
        } else adjustment = { id, action: "remove_line" as const, lineId: a.line_id, reason: a.reason };
      }
      const op: SceneOp = { op: "bom_adjust", adjustment };
      commit(ctx, op);
      return { ok: true, message: `BOM adjustment recorded (${a.action}).`, data: { id }, sceneOp: op };
    },
  }),
  def({
    name: "measure",
    readonly: true,
    description: "Measure the straight-line distance between two points (structure ids, places or coordinates) with bearing, or the footprint area/perimeter of one structure (pass only 'from' as a structure).",
    schema: z.object({ from: pointRef, to: pointRef.optional() }),
    run: (a, ctx) => {
      const p1 = resolvePoint(ctx, a.from);
      if (typeof p1 === "string") return fail(p1);
      if (!a.to) {
        const s = a.from.structure_id ? findStructure(ctx, a.from.structure_id) : null;
        if (!s || s.w == null || s.l == null) return fail("Area needs a structure with known width and length.");
        const m: Measurement = { id: `m-${Date.now()}`, kind: "area", points: corners(s, s.w, s.l), label: s.name };
        return {
          ok: true,
          message: `${s.name}: ${s.w} x ${s.l} m = ${round(s.w * s.l, 1)} m2 (${round(s.w * s.l * 10.7639, 0)} ft2); perimeter ${round(2 * (s.w + s.l), 1)} m.`,
          data: { area_m2: round(polygonArea(m.points), 1), perimeter_m: round(2 * (s.w + s.l), 1) },
          viewOp: { op: "show_measurement", measurement: m },
        };
      }
      const p2 = resolvePoint(ctx, a.to);
      if (typeof p2 === "string") return fail(p2);
      const d = distance(p1, p2);
      const hd = headingOf(p2.x - p1.x, p2.y - p1.y);
      const m: Measurement = { id: `m-${Date.now()}`, kind: "distance", points: [p1, p2], label: `${p1.label} to ${p2.label}` };
      return {
        ok: true,
        message: `${p1.label} to ${p2.label}: ${round(d, 1)} m (${round(d / 0.3048, 0)} ft), bearing ${round(hd, 0)} deg (${compassName(hd)}). Straight-line between approximate anchors.`,
        data: { distance_m: round(d, 1), distance_ft: round(d / 0.3048, 0), bearing_deg: round(hd, 0) },
        viewOp: { op: "show_measurement", measurement: m },
      };
    },
  }),
] as ToolDef<any>[];

export function toAiTools(ctx: ToolContext) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {};
  for (const d of TOOL_DEFS) {
    out[d.name] = tool({
      description: d.description,
      inputSchema: d.schema as z.ZodType<Record<string, unknown>>,
      execute: async (args: Record<string, unknown>) => {
        try {
          return await d.run(args, ctx);
        } catch (e) {
          return fail(`Tool error: ${(e as Error).message}`);
        }
      },
    });
  }
  return out;
}

export function runToolByName(name: string, args: unknown, ctx: ToolContext): ToolOutput | Promise<ToolOutput> {
  const d = TOOL_DEFS.find((t) => t.name === name);
  if (!d) return fail(`Unknown tool '${name}'.`);
  const parsed = d.schema.safeParse(args);
  if (!parsed.success) return fail(`Invalid arguments for ${name}: ${parsed.error.message}`);
  return d.run(parsed.data, ctx);
}

export function sceneSummary(scene: SceneState): string {
  const placed = scene.structures.filter(isPlaced);
  const unplaced = scene.structures.filter((s) => !isPlaced(s));
  const lines = placed.map((s) => {
    const d = s.w != null && s.l != null ? `${s.w}x${s.l}${s.h != null ? `x${s.h}` : ""}` : "dims?";
    return `${s.id}|${s.name}|${s.layer}|${round(s.x as number, 0)},${round(s.y as number, 0)}|${d}|r${s.rot}|L${s.levels ?? "?"}`;
  });
  const bom = summarizeBom(computeBom(scene));
  return [
    `Structures: ${scene.structures.length} (${placed.length} placed, ${unplaced.length} without a known position). Tours: ${scene.tours.length}. BOM lines with qty: ${bom.lineCount} (v2.2 had ${bom.baseLineCount}); BOM changes vs v2.2: +${bom.added} added, ${bom.removed} removed, ${bom.changed} changed.`,
    `Format: id|name|layer|x_m,y_m|WxLxH m (unknown parts omitted)|rotation deg CCW|levels`,
    ...lines,
    unplaced.length ? `Unplaced (no position): ${unplaced.map((s) => `${s.id} ${s.name}`).join("; ")}` : "",
  ].join("\n");
}

export const LAYER_HELP = LAYERS.map((l) => `${l.id}=${LAYER_BY_ID[l.id].label}`).join("; ");
