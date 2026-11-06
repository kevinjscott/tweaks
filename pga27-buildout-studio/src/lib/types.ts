export type LayerId =
  | "hospitality"
  | "fnb"
  | "ops"
  | "media"
  | "retail"
  | "access"
  | "grandstand"
  | "restroom"
  | "frame"
  | "activation"
  | "building"
  | "infra";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * One structure/area in the scene. Plan coordinates are metres:
 * x = east, y = north, origin = centre of the master-plan image. `null` means unknown (never invented).
 */
export interface Structure {
  id: string;
  name: string;
  type: string;
  layer: LayerId;
  x: number | null;
  y: number | null;
  /** degrees counter-clockwise in plan; source rotations are unknown so baseline is 0 */
  rot: number;
  w: number | null;
  l: number | null;
  h: number | null;
  levels: number | null;
  /** grandstand seating rows (source label), used for massing only */
  rows?: number | null;
  custom?: boolean;
  /** imported GLB model reference (IndexedDB key) */
  modelId?: string;
  note?: string;
}

export interface SourceInfo {
  id: string;
  zone: string | null;
  sheet: string | null;
  hole: number | null;
  px: number | null;
  py: number | null;
  posMethod: string;
  dimSource: string | null;
  raw: string | null;
  bomIds: string[];
  zoneBomIds: string[];
  status: string | null;
  image: string | null;
  revision: string | null;
  notes: string | null;
  sched: { w: number | null; l: number | null; h: number | null } | null;
  seats: number | null;
  rows: number | null;
  srcQty: number | null;
  packed: { dx: number; dy: number; sharedWith: number } | null;
  origW: number | null;
  origL: number | null;
  origH: number | null;
}

export interface TourKeyframe {
  id: string;
  label?: string;
  pos: Vec3;
  target: Vec3;
  /** seconds to travel from the previous keyframe to this one (ignored for the first) */
  seconds: number;
}

export interface Tour {
  id: string;
  name: string;
  keyframes: TourKeyframe[];
  loop?: boolean;
  preset?: boolean;
  description?: string;
}

export interface Measurement {
  id: string;
  kind: "distance" | "area" | "dimension";
  points: { x: number; y: number }[];
  /** perpendicular offset (m) for linear dimension annotations */
  offset?: number;
  label?: string;
}

export type BomAdjustment =
  | { id: string; action: "set_qty"; lineId: string; qty: number; reason?: string }
  | { id: string; action: "remove_line"; lineId: string; reason?: string }
  | {
      id: string;
      action: "add_line";
      item: string;
      category: string;
      qty: number;
      unit: string;
      area?: string;
      spec?: string;
      reason?: string;
    };

export interface SceneState {
  structures: Structure[];
  tours: Tour[];
  bomAdjustments: BomAdjustment[];
  measurements: Measurement[];
  derivedAllowances: boolean;
}

export interface Scenario {
  id: string;
  name: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  app: "pga27-buildout-studio";
  schema: 1;
  scene: SceneState;
}

export type SceneOp =
  | { op: "add_structure"; structure: Structure }
  | { op: "update_structure"; id: string; patch: Partial<Omit<Structure, "id">> }
  | { op: "delete_structure"; id: string }
  | { op: "add_tour"; tour: Tour }
  | { op: "delete_tour"; id: string }
  | { op: "bom_adjust"; adjustment: BomAdjustment }
  | { op: "add_measurement"; measurement: Measurement }
  | { op: "set_derived"; on: boolean };

/** View-only actions requested by the assistant; they never change the scenario. */
export type ViewOp =
  | { op: "set_camera"; pose: { pos: Vec3; target: Vec3 }; mode?: "perspective" | "top"; seconds?: number }
  | { op: "select"; ids: string[] }
  | { op: "play_tour"; tourId: string }
  | { op: "show_measurement"; measurement: Measurement };

export interface ToolOutput {
  ok: boolean;
  message: string;
  data?: unknown;
  sceneOp?: SceneOp;
  viewOp?: ViewOp;
}
