import { round } from "./geo";
import { LAYERS, renderKind } from "./layers";
import { corners, distance, isPlaced, polygonArea } from "./scene";
import type { LayerId, SceneState } from "./types";

const ACI: Record<LayerId, number> = {
  hospitality: 2,
  fnb: 30,
  ops: 8,
  media: 5,
  retail: 6,
  access: 1,
  grandstand: 3,
  restroom: 4,
  frame: 7,
  activation: 40,
  building: 9,
  infra: 94,
};

class Dxf {
  out: string[] = [];
  g(code: number, value: string | number) {
    this.out.push(String(code), String(value));
  }
  line(layer: string, a: [number, number], b: [number, number], color = 256) {
    this.g(0, "LINE");
    this.g(8, layer);
    this.g(62, color);
    this.g(10, a[0].toFixed(3));
    this.g(20, a[1].toFixed(3));
    this.g(30, "0.0");
    this.g(11, b[0].toFixed(3));
    this.g(21, b[1].toFixed(3));
    this.g(31, "0.0");
  }
  poly(layer: string, pts: [number, number][], closed: boolean, color = 256) {
    this.g(0, "POLYLINE");
    this.g(8, layer);
    this.g(62, color);
    this.g(66, 1);
    this.g(70, closed ? 1 : 0);
    for (const p of pts) {
      this.g(0, "VERTEX");
      this.g(8, layer);
      this.g(10, p[0].toFixed(3));
      this.g(20, p[1].toFixed(3));
      this.g(30, "0.0");
    }
    this.g(0, "SEQEND");
    this.g(8, layer);
  }
  text(layer: string, at: [number, number], height: number, value: string, rotation = 0, color = 256) {
    this.g(0, "TEXT");
    this.g(8, layer);
    this.g(62, color);
    this.g(10, at[0].toFixed(3));
    this.g(20, at[1].toFixed(3));
    this.g(30, "0.0");
    this.g(40, height.toFixed(3));
    this.g(1, value.replace(/[\r\n]+/g, " "));
    this.g(50, rotation.toFixed(2));
    this.g(72, 1);
    this.g(11, at[0].toFixed(3));
    this.g(21, at[1].toFixed(3));
    this.g(31, "0.0");
  }
  point(layer: string, at: [number, number], color = 256) {
    this.g(0, "POINT");
    this.g(8, layer);
    this.g(62, color);
    this.g(10, at[0].toFixed(3));
    this.g(20, at[1].toFixed(3));
    this.g(30, "0.0");
  }
}

export interface DxfOptions {
  visibleLayers?: Partial<Record<LayerId, boolean>>;
  includeNames?: boolean;
  includeDimensions?: boolean;
  includeMeasurements?: boolean;
  scenarioName?: string;
}

const ascii = (s: string) => s.replace(/[^\x20-\x7e]/g, "?");

function dimLine(d: Dxf, layer: string, a: { x: number; y: number }, b: { x: number; y: number }, offset: number, label?: string) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * offset;
  const ny = (dx / len) * offset;
  const a2: [number, number] = [a.x + nx, a.y + ny];
  const b2: [number, number] = [b.x + nx, b.y + ny];
  d.line(layer, [a.x, a.y], a2, 256);
  d.line(layer, [b.x, b.y], b2, 256);
  d.line(layer, a2, b2, 256);
  const tick = Math.max(0.6, len * 0.015);
  const ux = dx / len;
  const uy = dy / len;
  for (const p of [a2, b2]) d.line(layer, [p[0] - ux * tick - uy * tick, p[1] - uy * tick + ux * tick], [p[0] + ux * tick + uy * tick, p[1] + uy * tick - ux * tick]);
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const upright = ang > 90 || ang < -90 ? ang + 180 : ang;
  d.text(layer, [(a2[0] + b2[0]) / 2 + (nx / (Math.abs(offset) || 1)) * 0.9, (a2[1] + b2[1]) / 2 + (ny / (Math.abs(offset) || 1)) * 0.9], Math.max(1.2, Math.min(4, len * 0.05)), label ?? `${round(len, 2)} m`, upright);
}

/**
 * ASCII DXF (R12 / AC1009) in metres, plan x = east, y = north, origin = master-plan centre. R12 is used because
 * it needs no handles/objects and opens in every CAD package. Layers follow the structure-type layers of the Studio.
 */
export function buildDxf(scene: SceneState, opts: DxfOptions = {}): string {
  const d = new Dxf();
  const vis = (l: LayerId) => opts.visibleLayers?.[l] !== false;
  const placed = scene.structures.filter((s) => isPlaced(s) && vis(s.layer));

  d.g(0, "SECTION");
  d.g(2, "HEADER");
  d.g(9, "$ACADVER");
  d.g(1, "AC1009");
  d.g(9, "$INSUNITS");
  d.g(70, 6);
  d.g(9, "$MEASUREMENT");
  d.g(70, 1);
  d.g(0, "ENDSEC");

  const layerNames = [
    ...LAYERS.map((l) => ({ name: `STR-${l.id.toUpperCase()}`, color: ACI[l.id] })),
    { name: "TXT-NAMES", color: 7 },
    { name: "DIMS", color: 3 },
    { name: "MEASURE", color: 2 },
    { name: "UNKNOWN-DIMS", color: 1 },
    { name: "TITLE", color: 7 },
  ];
  d.g(0, "SECTION");
  d.g(2, "TABLES");
  d.g(0, "TABLE");
  d.g(2, "LTYPE");
  d.g(70, 1);
  d.g(0, "LTYPE");
  d.g(2, "CONTINUOUS");
  d.g(70, 0);
  d.g(3, "Solid line");
  d.g(72, 65);
  d.g(73, 0);
  d.g(40, "0.0");
  d.g(0, "ENDTAB");
  d.g(0, "TABLE");
  d.g(2, "LAYER");
  d.g(70, layerNames.length + 1);
  for (const l of [{ name: "0", color: 7 }, ...layerNames]) {
    d.g(0, "LAYER");
    d.g(2, l.name);
    d.g(70, 0);
    d.g(62, l.color);
    d.g(6, "CONTINUOUS");
  }
  d.g(0, "ENDTAB");
  d.g(0, "ENDSEC");

  d.g(0, "SECTION");
  d.g(2, "ENTITIES");

  d.text("TITLE", [-1600, 1500], 18, "2027 PGA CHAMPIONSHIP - FIELDS RANCH EAST, PGA FRISCO, FRISCO TX");
  d.text("TITLE", [-1600, 1470], 12, "PLANNING CONCEPT - NOT FOR CONSTRUCTION");
  d.text("TITLE", [-1600, 1448], 8, ascii(`Scenario: ${opts.scenarioName ?? "working draft"} | Units: metres | Origin: centre of master-plan image | x east, y north | positions approximate, not surveyed | rotations unknown (0 deg assumed)`));

  for (const s of placed) {
    const layer = `STR-${s.layer.toUpperCase()}`;
    const color = ACI[s.layer];
    const known = s.w != null && s.l != null;
    if (known) {
      const pts = corners(s, s.w as number, s.l as number).map((p) => [p.x, p.y] as [number, number]);
      d.poly(layer, pts, true, color);
      if ((s.levels ?? 0) >= 2) {
        const inner = corners({ ...s }, (s.w as number) * 0.88, (s.l as number) * 0.88).map((p) => [p.x, p.y] as [number, number]);
        d.poly(layer, inner, true, color);
      }
      if (opts.includeNames !== false) {
        const h = Math.max(1.5, Math.min(6, Math.min(s.w as number, s.l as number) * 0.18));
        d.text("TXT-NAMES", [s.x as number, s.y as number], h, ascii(`${s.name}${(s.levels ?? 0) > 1 ? ` (${s.levels} LVL)` : ""}`), s.rot);
      }
      if (opts.includeDimensions !== false) {
        const off = Math.max(2, Math.min((s.w as number), (s.l as number)) * 0.12) + 0.5;
        const c = corners(s, s.w as number, s.l as number);
        dimLine(d, "DIMS", c[0], c[1], -off, `${round(s.w as number, 2)} m`);
        dimLine(d, "DIMS", c[1], c[2], -off, `${round(s.l as number, 2)} m`);
      }
    } else {
      const k = renderKind(s);
      d.point("UNKNOWN-DIMS", [s.x as number, s.y as number], 1);
      d.poly("UNKNOWN-DIMS", [[(s.x as number) - 3, s.y as number], [s.x as number, (s.y as number) + 3], [(s.x as number) + 3, s.y as number], [s.x as number, (s.y as number) - 3]], true, 1);
      d.text("UNKNOWN-DIMS", [(s.x as number), (s.y as number) - 6], 2.2, ascii(`${s.name} (dimensions unknown${k.symbolic ? ", symbol only" : ""})`));
    }
  }

  if (opts.includeMeasurements !== false) {
    for (const m of scene.measurements) {
      if (m.kind === "distance" && m.points.length >= 2) {
        const [a, b] = m.points;
        d.line("MEASURE", [a.x, a.y], [b.x, b.y], 2);
        d.text("MEASURE", [(a.x + b.x) / 2, (a.y + b.y) / 2 + 2], 3, `${round(distance(a, b), 2)} m ${m.label ? ascii(m.label) : ""}`);
      } else if (m.kind === "area" && m.points.length >= 3) {
        d.poly("MEASURE", m.points.map((p) => [p.x, p.y] as [number, number]), true, 2);
        const cx = m.points.reduce((t, p) => t + p.x, 0) / m.points.length;
        const cy = m.points.reduce((t, p) => t + p.y, 0) / m.points.length;
        d.text("MEASURE", [cx, cy], 3, `${round(polygonArea(m.points), 1)} m2`);
      } else if (m.kind === "dimension" && m.points.length >= 2) {
        dimLine(d, "DIMS", m.points[0], m.points[1], m.offset ?? 4, m.label);
      }
    }
  }

  d.g(0, "ENDSEC");
  d.g(0, "EOF");
  return d.out.join("\n") + "\n";
}
