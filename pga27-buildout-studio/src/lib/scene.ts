import { BASE_STRUCTURES } from "./baseline";
import { LAYER_BY_ID } from "./layers";
import { round, rotPoint } from "./geo";
import type { SceneOp, SceneState, Structure } from "./types";

export function nextStructureId(scene: SceneState): string {
  let max = 0;
  for (const s of scene.structures) {
    const m = s.id.match(/^u-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `u-${max + 1}`;
}

export function nextId(prefix: string, existing: string[]): string {
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const id of existing) {
    const m = id.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${max + 1}`;
}

export function applyOp(scene: SceneState, op: SceneOp): SceneState {
  switch (op.op) {
    case "add_structure": {
      if (scene.structures.some((s) => s.id === op.structure.id)) return scene;
      return { ...scene, structures: [...scene.structures, op.structure] };
    }
    case "update_structure": {
      return {
        ...scene,
        structures: scene.structures.map((s) => (s.id === op.id ? ({ ...s, ...op.patch } as Structure) : s)),
      };
    }
    case "delete_structure":
      return { ...scene, structures: scene.structures.filter((s) => s.id !== op.id) };
    case "add_tour":
      return { ...scene, tours: [...scene.tours.filter((t) => t.id !== op.tour.id), op.tour] };
    case "delete_tour":
      return { ...scene, tours: scene.tours.filter((t) => t.id !== op.id) };
    case "bom_adjust":
      return { ...scene, bomAdjustments: [...scene.bomAdjustments.filter((a) => a.id !== op.adjustment.id), op.adjustment] };
    case "add_measurement":
      return { ...scene, measurements: [...scene.measurements, op.measurement] };
    case "set_derived":
      return { ...scene, derivedAllowances: op.on };
  }
}

export function applyOps(scene: SceneState, ops: SceneOp[]): SceneState {
  return ops.reduce(applyOp, scene);
}

export function sceneStructure(scene: SceneState, id: string) {
  return scene.structures.find((s) => s.id === id);
}

export function isPlaced(s: Structure): s is Structure & { x: number; y: number } {
  return s.x != null && s.y != null;
}

export function corners(s: Structure, w: number, l: number) {
  if (s.x == null || s.y == null) return [];
  const pts = [
    [-w / 2, -l / 2],
    [w / 2, -l / 2],
    [w / 2, l / 2],
    [-w / 2, l / 2],
  ];
  return pts.map(([u, v]) => {
    const r = rotPoint(u, v, s.rot);
    return { x: s.x! + r.x, y: s.y! + r.y };
  });
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function polygonArea(pts: { x: number; y: number }[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

export function polygonPerimeter(pts: { x: number; y: number }[], closed = true) {
  let d = 0;
  for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) d += distance(pts[i], pts[(i + 1) % pts.length]);
  return d;
}

export type FieldChange = { field: string; from: unknown; to: unknown };

export interface SceneDiff {
  added: Structure[];
  removed: Structure[];
  changed: { before: Structure; after: Structure; changes: FieldChange[] }[];
  toursAdded: string[];
  bomAdjustmentsAdded: number;
}

const DIFF_FIELDS: (keyof Structure)[] = ["name", "layer", "x", "y", "rot", "w", "l", "h", "levels"];

export function diffScenes(before: SceneState, after: SceneState): SceneDiff {
  const b = new Map(before.structures.map((s) => [s.id, s]));
  const a = new Map(after.structures.map((s) => [s.id, s]));
  const added = after.structures.filter((s) => !b.has(s.id));
  const removed = before.structures.filter((s) => !a.has(s.id));
  const changed: SceneDiff["changed"] = [];
  for (const s of after.structures) {
    const o = b.get(s.id);
    if (!o) continue;
    const changes: FieldChange[] = [];
    for (const f of DIFF_FIELDS) {
      if (o[f] !== s[f]) changes.push({ field: f, from: o[f], to: s[f] });
    }
    if (changes.length) changed.push({ before: o, after: s, changes });
  }
  const bt = new Set(before.tours.map((t) => t.id));
  return {
    added,
    removed,
    changed,
    toursAdded: after.tours.filter((t) => !bt.has(t.id)).map((t) => t.name),
    bomAdjustmentsAdded: after.bomAdjustments.length - before.bomAdjustments.length,
  };
}

export function diffIsEmpty(d: SceneDiff) {
  return !d.added.length && !d.removed.length && !d.changed.length && !d.toursAdded.length && d.bomAdjustmentsAdded <= 0;
}

export function describeChange(c: FieldChange) {
  const f = c.field;
  const fmt = (v: unknown) => (typeof v === "number" ? String(round(v, 2)) : v == null ? "unknown" : String(v));
  const unit = f === "rot" ? "°" : ["x", "y", "w", "l", "h"].includes(f) ? " m" : "";
  const label = { x: "east", y: "north", rot: "rotation", w: "width", l: "length", h: "height", levels: "levels", name: "name", layer: "layer" }[f] ?? f;
  return `${label}: ${fmt(c.from)}${unit} → ${fmt(c.to)}${unit}`;
}

export function structureLabel(s: Structure) {
  return `${s.name} (${s.id})`;
}

export function layerLabel(s: Structure) {
  return LAYER_BY_ID[s.layer]?.label ?? s.layer;
}

export function isBaseline(id: string) {
  return BASE_STRUCTURES.some((s) => s.id === id);
}

export function sceneBounds(scene: SceneState) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of scene.structures) {
    if (!isPlaced(s)) continue;
    minX = Math.min(minX, s.x);
    maxX = Math.max(maxX, s.x);
    minY = Math.min(minY, s.y);
    maxY = Math.max(maxY, s.y);
  }
  return { minX, maxX, minY, maxY };
}
