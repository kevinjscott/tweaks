import { pxToPlan, round } from "./geo";
import { isPlaced } from "./scene";
import type { SceneState } from "./types";

interface PlaceDef {
  id: string;
  label: string;
  names: string[];
  px?: number;
  py?: number;
  structureId?: string;
  source: string;
}

/** Named landmarks. Pixel anchors come from vector label text on master-plan.jpg (approximate, not surveyed). */
const PLACES: PlaceDef[] = [
  { id: "main-entrance", label: "Main entrance / main terminal", names: ["main entrance", "main gate", "main terminal", "entrance", "front gate"], structureId: "area-011", source: "area-011 (sheets 1.0/1.1/1.2)" },
  { id: "pga-shops", label: "The PGA Shops", names: ["pga shops", "shops", "the pga shops"], structureId: "s-095-1", source: "s-095-1" },
  { id: "media-center", label: "Media Center", names: ["media center", "media centre", "media"], structureId: "s-066-1", source: "s-066-1" },
  { id: "14-green", label: "14 green", names: ["14 green", "14th green", "hole 14 green", "#14 green"], px: 3078, py: 1797, source: "master label '#14 GREEN'" },
  { id: "15-green", label: "15 green", names: ["15 green", "15th green", "hole 15 green", "#15 green"], px: 2830, py: 2032, source: "master label '#15 GREEN'" },
  { id: "16-fairway", label: "16 fairway", names: ["16 fairway", "16th fairway", "#16 fairway"], px: 2786, py: 1516, source: "master label '#16 FAIRWAY'" },
  { id: "16-green", label: "16 green", names: ["16 green", "16th green", "hole 16 green", "#16 green"], px: 2982, py: 1426, source: "master label '16 GREEN'" },
  { id: "17-tee", label: "17 tee", names: ["17 tee", "17th tee", "hole 17 tee", "#17 tee"], px: 2927, py: 1333, source: "master label '17 TEE'" },
  { id: "17-fairway", label: "17 fairway (Partner Pavilion)", names: ["17 fairway", "17th fairway", "partner pavilion", "partner hospitality"], structureId: "s-072-1", source: "s-072-1" },
  { id: "17-green", label: "17 green", names: ["17 green", "17th green", "hole 17 green", "#17 green"], px: 2697, py: 1323, source: "master label '17 GREEN'" },
  { id: "9-green", label: "9 green grandstand", names: ["9 green", "9th green", "hole 9 green"], structureId: "area-018", source: "area-018" },
  { id: "18-green", label: "18 green grandstand", names: ["18 green", "18th green", "hole 18 green"], structureId: "area-019", source: "area-019" },
  { id: "1-tee", label: "1 tee grandstand", names: ["1 tee", "first tee", "1st tee", "hole 1 tee"], structureId: "area-021", source: "area-021" },
  { id: "8-green", label: "8 green / dugout grandstand", names: ["8 green", "8th green", "8 dugout", "dugout"], structureId: "area-022", source: "area-022" },
  { id: "clubhouse", label: "Clubhouse", names: ["clubhouse", "club house"], px: 2199, py: 703, source: "master label 'CLUBHOUSE'" },
  { id: "omni", label: "Omni PGA Frisco resort / hotel", names: ["omni", "hotel", "resort", "omni hotel"], px: 2636, py: 726, source: "master label 'OMNI PGA'" },
  { id: "fan-zone", label: "Fan Zone", names: ["fan zone"], structureId: "area-001", source: "area-001" },
  { id: "teel-1", label: "Teel Compound 1 (vendor)", names: ["teel compound 1", "vendor compound", "teel 1"], px: 415, py: 2229, source: "master label 'TEEL COMPOUND 1'" },
  { id: "teel-2", label: "Teel Compound 2 (broadcast)", names: ["teel compound 2", "broadcast compound", "teel 2"], px: 413, py: 2397, source: "master label 'TEEL COMPOUND 2'" },
  { id: "12-compound", label: "#12 compound", names: ["12 compound", "#12 compound"], px: 3710, py: 1148, source: "master label '#12 COMPOUND'" },
  { id: "first-aid", label: "First aid (practice range / HS area)", names: ["first aid"], px: 1234, py: 622, source: "master label 'FIRST AID'" },
];

export interface Place {
  id: string;
  label: string;
  x: number;
  y: number;
  source: string;
}

function resolve(p: PlaceDef, scene: SceneState): Place | null {
  if (p.structureId) {
    const s = scene.structures.find((x) => x.id === p.structureId);
    if (s && isPlaced(s)) return { id: p.id, label: p.label, x: round(s.x, 1), y: round(s.y, 1), source: p.source };
  }
  if (p.px != null && p.py != null) {
    const c = pxToPlan(p.px, p.py);
    return { id: p.id, label: p.label, x: round(c.x, 1), y: round(c.y, 1), source: p.source };
  }
  return null;
}

const norm = (q: string) =>
  q
    .toLowerCase()
    .replace(/#/g, "")
    .replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1")
    .replace(/\b(hole|the|at|near|by)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function findPlaces(scene: SceneState, query: string): Place[] {
  const q = norm(query);
  if (!q) return [];
  const scored: { p: PlaceDef; score: number }[] = [];
  for (const p of PLACES) {
    let best = 0;
    for (const n of p.names.map(norm)) {
      if (n === q) best = Math.max(best, 100);
      else if (n.includes(q) || q.includes(n)) best = Math.max(best, 60 + Math.min(n.length, q.length));
      else {
        const qt = q.split(" ");
        const nt = n.split(" ");
        const hit = qt.filter((t) => nt.includes(t)).length;
        if (hit && hit === Math.min(qt.length, nt.length)) best = Math.max(best, 30 + hit * 5);
      }
    }
    if (best) scored.push({ p, score: best });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .map((s) => resolve(s.p, scene))
    .filter((p): p is Place => p != null);
}

export function allPlaces(scene: SceneState): Place[] {
  return PLACES.map((p) => resolve(p, scene)).filter((p): p is Place => p != null);
}
