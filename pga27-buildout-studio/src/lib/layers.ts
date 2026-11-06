import type { LayerId, Structure } from "./types";

export interface LayerDef {
  id: LayerId;
  label: string;
  color: string;
  roof: string;
  description: string;
}

export const LAYERS: LayerDef[] = [
  { id: "hospitality", label: "Hospitality & suites", color: "#d4af37", roof: "#f3e6b3", description: "Suites, villages, lounges, clubs, corporate viewing" },
  { id: "fnb", label: "Markets & F&B", color: "#d97b4a", roof: "#f4d3bd", description: "Markets, pouring bars, grills, pantries, kitchens, dining" },
  { id: "ops", label: "Operations & back of house", color: "#7d8aa3", roof: "#d3d9e6", description: "Storage, staff, arena, production, charging, ecology" },
  { id: "media", label: "Media & broadcast", color: "#3f8cff", roof: "#bcd6ff", description: "Media center, interview, studio, scoring" },
  { id: "retail", label: "Retail & shops", color: "#b36bd6", roof: "#e5c9f2", description: "PGA Shops, history, vendor retail" },
  { id: "access", label: "Access & security", color: "#e0525a", roof: "#f6c3c6", description: "Gates, entries, scans, ticketing, terminals" },
  { id: "grandstand", label: "Grandstands", color: "#4fb286", roof: "#c6ead9", description: "Seating structures (seat counts are labels, not procurement)" },
  { id: "restroom", label: "Restrooms", color: "#8fd3e8", roof: "#d7f0f8", description: "Restroom banks (symbolic - dimensions unknown)" },
  { id: "frame", label: "Frame tents & canopies", color: "#e8e4d8", roof: "#fbfaf5", description: "Frame tents, canopies, breaks, grills, storage tents" },
  { id: "activation", label: "Activations & player", color: "#f0a83c", roof: "#fbe1b4", description: "Fan zone, activations, player oases" },
  { id: "building", label: "Existing buildings", color: "#9aa7b8", roof: "#dde3ec", description: "Clubhouse, HQ, hotel, ranch houses (dimensions unknown)" },
  { id: "infra", label: "Compounds & infrastructure", color: "#6c7f5e", roof: "#c8d4bf", description: "Compounds, videoboards, bridges, practice, first aid" },
];

export const LAYER_BY_ID = Object.fromEntries(LAYERS.map((l) => [l.id, l])) as Record<LayerId, LayerDef>;

export function classifyLayer(name: string, type: string, levels: number | null): LayerId {
  const n = name.toUpperCase();
  const t = type.toLowerCase();
  if (t === "grandstand") return "grandstand";
  if (t === "restrooms") return "restroom";
  if (t === "existing building" || t === "existing building hospitality" || t === "existing pavilion") return "building";
  if (t === "access terminal" || t === "access gate") return "access";
  if (t === "operations compound" || t === "broadcast compound") return "infra";
  if (t === "broadcast infrastructure" || t === "bridge" || t === "medical" || t === "practice area") return "infra";
  if (t === "concessions") return "fnb";
  if (t === "player tent" || t === "activation" || n === "FAN ZONE") return "activation";
  if (/MEDIA CENTER|MEDIA KITCHEN|INTERVIEW|STUDIO|SCORING|BROADCAST/.test(n)) return "media";
  if (/PGA SHOPS|PGA HISTORY|VENDOR HOSPITALITY|RON SHOP|SHOP\b/.test(n)) return "retail";
  if (/ENTRY|GATE|SCAN|TICKET|SECURITY|CHECK-IN|INFO\/ACCESS|CHARGE|STARTER|ESPN BET$/.test(n)) return "access";
  if ((levels ?? 0) >= 2 || /SUITES|VILLAGE|PAVILION|LOUNGE|CLUB|HOSPITALITY|VIEWING|SCHWAB|GOSLINGS|HIGH NOON|WILLIAM HILL|CHOCTAW|MICH ULTRA|ESPN BET/.test(n)) return "hospitality";
  if (/MARKET|POURING BAR|BAR\b|GRILL|PANTRY|KITCHEN|DINING|CADDIE|RECOVERY/.test(n)) return "fnb";
  if (/STORAGE|STAFF|ARENA|PRODUCTION|CART CHARGING|ECOLOGY|BALL|PATINA|PGA STORAGE|VOLUNTEER|VOL HQ|TOP TRACER/.test(n)) return "ops";
  if (t === "frame tent") return "frame";
  return "frame";
}

export type RenderKind =
  | "tent"
  | "frame"
  | "twolevel"
  | "grandstand"
  | "hall"
  | "gate"
  | "restroom"
  | "videoboard"
  | "compound"
  | "building"
  | "pin"
  | "imported";

/** Symbolic = drawn from a generic symbol because source dimensions are unknown. */
export function renderKind(s: Structure): { kind: RenderKind; symbolic: boolean } {
  if (s.modelId) return { kind: "imported", symbolic: false };
  const n = s.name.toUpperCase();
  const hasPlan = s.w != null && s.l != null;
  if (s.layer === "grandstand") return { kind: "grandstand", symbolic: s.l == null };
  if (!hasPlan) {
    if (s.layer === "restroom") return { kind: "restroom", symbolic: true };
    if (/VIDEOBOARD/.test(n)) return { kind: "videoboard", symbolic: true };
    if (/COMPOUND/.test(n)) return { kind: "compound", symbolic: true };
    if (s.layer === "building") return { kind: "building", symbolic: true };
    return { kind: "pin", symbolic: true };
  }
  if ((s.levels ?? 0) >= 2) return { kind: "twolevel", symbolic: false };
  const area = (s.w ?? 0) * (s.l ?? 0);
  if (/MEDIA CENTER|PGA SHOPS/.test(n) || area > 1500) return { kind: "hall", symbolic: false };
  if (s.layer === "access" && area <= 30) return { kind: "gate", symbolic: false };
  if (s.type === "Frame tent" || s.layer === "frame") return { kind: "frame", symbolic: false };
  return { kind: "tent", symbolic: false };
}

export interface VisualDims {
  w: number;
  l: number;
  h: number;
  assumed: { w: boolean; l: boolean; h: boolean };
}

/** Dimensions used for drawing only. Unknown values fall back to a flagged visual placeholder. */
export function visualDims(s: Structure): VisualDims {
  const { kind, symbolic } = renderKind(s);
  const assumed = { w: s.w == null, l: s.l == null, h: s.h == null };
  let w = s.w ?? 0;
  let l = s.l ?? 0;
  let h = s.h ?? 0;
  if (kind === "grandstand") {
    if (s.w == null) w = 20;
    if (s.l == null) l = (s.rows ?? 12) * 0.9 + 2;
    if (s.h == null) h = (s.rows ?? 12) * 0.42 + 0.8;
  } else if (symbolic) {
    if (kind === "restroom") [w, l, h] = [12, 3, 3];
    else if (kind === "videoboard") [w, l, h] = [9, 1, 8];
    else if (kind === "compound") [w, l, h] = [40, 30, 2.4];
    else if (kind === "building") [w, l, h] = [36, 24, 10];
    else [w, l, h] = [6, 6, 8];
  } else {
    if (s.h == null) {
      h = kind === "frame" ? 3 : kind === "twolevel" ? 7.4 : 3.2;
    }
  }
  return { w, l, h, assumed };
}

export function footprintM2(s: Structure): number | null {
  return s.w != null && s.l != null ? s.w * s.l : null;
}
