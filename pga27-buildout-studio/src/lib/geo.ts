export const FT = 0.3048;
export const MASTER_W = 4000;
export const MASTER_H = 3112;
/** 0-1000 ft graphic scale bar on master-plan.jpg spans 371 px (ticks at x=2899.5 and 3270.5). */
export const PX_PER_1000FT = 371;
export const M_PER_PX = (1000 * FT) / PX_PER_1000FT;
/** The bottom title strip of the master image starts around this row; the ground texture is cropped there. */
export const MAP_CROP_PX = 2845;

export const GROUND_W = MASTER_W * M_PER_PX;
export const GROUND_H = MASTER_H * M_PER_PX;

export function pxToPlan(px: number, py: number) {
  return { x: (px - MASTER_W / 2) * M_PER_PX, y: -(py - MASTER_H / 2) * M_PER_PX };
}

export function planToPx(x: number, y: number) {
  return { px: x / M_PER_PX + MASTER_W / 2, py: -y / M_PER_PX + MASTER_H / 2 };
}

export const ftToM = (ft: number | null | undefined) => (ft == null ? null : round(ft * FT, 3));
export const m2ToFt2 = (m2: number) => m2 / (FT * FT);
export const mToFt = (m: number) => m / FT;

export function round(v: number, d = 2) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

export function fmtM(v: number | null | undefined, d = 1) {
  return v == null ? "unknown" : `${round(v, d).toLocaleString("en-US")} m`;
}

export function fmtNum(v: number | null | undefined, d = 0) {
  return v == null ? "unknown" : round(v, d).toLocaleString("en-US", { maximumFractionDigits: d });
}

export function degToRad(d: number) {
  return (d * Math.PI) / 180;
}

/** Rotate local (u east, v north) offsets by rot degrees CCW. */
export function rotPoint(u: number, v: number, rotDeg: number) {
  const a = degToRad(rotDeg);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: u * c - v * s, y: u * s + v * c };
}

export function compassHeadingToVec(headingDeg: number) {
  const a = degToRad(headingDeg);
  return { x: Math.sin(a), y: Math.cos(a) };
}

export function headingOf(dx: number, dy: number) {
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

export function compassName(headingDeg: number) {
  const names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return names[Math.round(headingDeg / 45) % 8];
}
