import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { LAYER_BY_ID, renderKind, visualDims, type RenderKind } from "./layers";
import type { Structure } from "./types";

/** Local frame: X = width (east when rot=0), Z = -length (north when rot=0), Y = up. Base of the building sits at y=0. */
class Builder {
  parts: THREE.BufferGeometry[] = [];

  private push(g: THREE.BufferGeometry, color: string) {
    const geo = g.index ? g.toNonIndexed() : g;
    geo.deleteAttribute("uv");
    const c = new THREE.Color(color);
    const n = geo.getAttribute("position").count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    this.parts.push(geo);
  }

  box(w: number, h: number, d: number, x: number, y: number, z: number, color: string) {
    const g = new THREE.BoxGeometry(Math.max(w, 0.02), Math.max(h, 0.02), Math.max(d, 0.02));
    g.translate(x, y, z);
    this.push(g, color);
  }

  /** triangular gable prism, ridge along Z. base at y0 */
  gable(w: number, d: number, eaveY: number, ridgeY: number, x: number, z: number, color: string, overhang = 0.3) {
    const hw = w / 2 + overhang;
    const hd = d / 2 + overhang;
    const rise = Math.max(0.05, ridgeY - eaveY);
    const p = [
      [-hw, eaveY, -hd], [hw, eaveY, -hd], [0, eaveY + rise, -hd],
      [-hw, eaveY, hd], [hw, eaveY, hd], [0, eaveY + rise, hd],
    ];
    const tri = (a: number, b: number, c: number) => [...p[a], ...p[b], ...p[c]];
    const quad = (a: number, b: number, c: number, d2: number) => [...tri(a, b, c), ...tri(a, c, d2)];
    const verts = [
      ...tri(0, 2, 1),
      ...tri(3, 4, 5),
      ...quad(0, 3, 5, 2),
      ...quad(1, 2, 5, 4),
      ...quad(0, 1, 4, 3),
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    g.translate(x, 0, z);
    this.push(g, color);
  }

  build(): THREE.BufferGeometry {
    const m = mergeGeometries(this.parts, false);
    m.computeBoundingBox();
    m.computeBoundingSphere();
    return m;
  }
}

const WHITE = "#f1eee6";
const DARK = "#1a2438";
const GLASS = "#27405f";

function tent(b: Builder, w: number, l: number, h: number, trim: string, roof: string) {
  const eave = h * 0.62;
  b.box(w, eave, l, 0, eave / 2, 0, WHITE);
  b.box(w + 0.1, 0.35, l + 0.1, 0, eave - 0.18, 0, trim);
  b.gable(w, l, eave, h, 0, 0, roof, 0.15);
}

function frameTent(b: Builder, w: number, l: number, h: number, trim: string, roof: string) {
  const eave = h * 0.78;
  const t = 0.14;
  const nz = Math.max(1, Math.round(l / 6));
  for (let i = 0; i <= nz; i++) {
    const z = -l / 2 + (i / nz) * l;
    b.box(t, eave, t, -w / 2 + t / 2, eave / 2, z, "#9aa3b3");
    b.box(t, eave, t, w / 2 - t / 2, eave / 2, z, "#9aa3b3");
  }
  b.gable(w, l, eave, h, 0, 0, roof, 0.1);
  b.box(w + 0.1, 0.18, l + 0.1, 0, eave - 0.05, 0, trim);
  b.box(w, 0.06, l, 0, 0.03, 0, "#c8c2b4");
}

function twoLevel(b: Builder, w: number, l: number, h: number, trim: string, roof: string) {
  const lvl = h * 0.5;
  b.box(w, lvl, l, 0, lvl / 2, 0, "#e9e6dd");
  b.box(w + 0.05, 0.9, l + 0.05, 0, lvl * 0.55, 0, GLASS);
  b.box(w + 0.7, 0.28, l + 0.7, 0, lvl + 0.14, 0, trim);
  const up = h - lvl - 0.28;
  b.box(w - 0.4, up, l - 0.4, 0, lvl + 0.28 + up / 2, 0, "#f3f0e8");
  b.box(w - 0.35, 0.9, l - 0.35, 0, lvl + 0.28 + up * 0.55, 0, GLASS);
  b.box(w + 0.5, 0.3, l + 0.5, 0, h + 0.15, 0, roof);
  const rh = 1.0;
  b.box(w + 0.7, rh, 0.06, 0, lvl + 0.28 + rh / 2, -(l + 0.7) / 2, trim);
  b.box(w + 0.7, rh, 0.06, 0, lvl + 0.28 + rh / 2, (l + 0.7) / 2, trim);
  b.box(0.06, rh, l + 0.7, -(w + 0.7) / 2, lvl + 0.28 + rh / 2, 0, trim);
  b.box(0.06, rh, l + 0.7, (w + 0.7) / 2, lvl + 0.28 + rh / 2, 0, trim);
  const sw = Math.min(3, w * 0.25);
  b.box(sw, lvl + 0.4, Math.min(5, l * 0.3), w / 2 + sw / 2, (lvl + 0.4) / 2, -l * 0.3, "#b6bfce");
}

function grandstand(b: Builder, w: number, l: number, h: number, rows: number, trim: string) {
  const n = Math.max(3, rows);
  const rd = l / n;
  const rise = h / n;
  for (let i = 0; i < n; i++) {
    const hh = (i + 1) * rise;
    b.box(w, hh, rd, 0, hh / 2, l / 2 - rd * i - rd / 2, i % 2 ? "#cfd8d2" : "#e6ece8");
    b.box(w, 0.08, rd * 0.35, 0, hh + 0.04, l / 2 - rd * i - rd * 0.3, trim);
  }
  b.box(0.15, h + 1, 0.15, -w / 2, (h + 1) / 2, -l / 2 + 0.2, "#7a8699");
  b.box(0.15, h + 1, 0.15, w / 2, (h + 1) / 2, -l / 2 + 0.2, "#7a8699");
}

function hall(b: Builder, w: number, l: number, h: number, trim: string, roof: string) {
  b.box(w, h, l, 0, h / 2, 0, "#e4e1d8");
  b.box(w + 0.8, 0.35, l + 0.8, 0, h + 0.17, 0, roof);
  b.box(w + 0.05, 0.28, l + 0.05, 0, h - 0.4, 0, trim);
  const n = Math.max(2, Math.round(l / 12));
  for (let i = 0; i < n; i++) {
    const z = -l / 2 + ((i + 0.5) / n) * l;
    b.box(w + 0.1, h * 0.45, 3.2, 0, h * 0.35, z, DARK);
  }
  b.box(w * 0.5, 0.5, l * 0.4, 0, h + 0.6, 0, "#cfd4de");
}

function gate(b: Builder, w: number, l: number, h: number, trim: string) {
  const t = 0.18;
  b.box(t, h, t, -w / 2, h / 2, -l / 2, "#9aa3b3");
  b.box(t, h, t, w / 2, h / 2, -l / 2, "#9aa3b3");
  b.box(t, h, t, -w / 2, h / 2, l / 2, "#9aa3b3");
  b.box(t, h, t, w / 2, h / 2, l / 2, "#9aa3b3");
  b.box(w + 0.4, 0.22, l + 0.4, 0, h + 0.11, 0, trim);
  b.box(w * 0.8, 1.0, 0.25, 0, 0.5, 0, DARK);
}

function restroom(b: Builder, w: number, l: number, h: number, color: string) {
  const n = 4;
  const cw = w / n - 0.2;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n);
    b.box(cw, h, l, x, h / 2, 0, color);
    b.box(cw * 0.45, h * 0.7, 0.06, x, h * 0.4, l / 2 + 0.02, DARK);
  }
}

function videoboard(b: Builder, w: number, l: number, h: number) {
  b.box(0.35, h * 0.62, 0.35, -w * 0.3, h * 0.31, 0, "#7a8699");
  b.box(0.35, h * 0.62, 0.35, w * 0.3, h * 0.31, 0, "#7a8699");
  b.box(w, h * 0.45, l * 0.6, 0, h * 0.62 + h * 0.2, 0, "#0b1424");
  b.box(w * 0.92, h * 0.36, 0.08, 0, h * 0.62 + h * 0.2, l * 0.31, "#3f8cff");
}

function compound(b: Builder, w: number, l: number, h: number, color: string) {
  b.box(w, 0.08, l, 0, 0.04, 0, "#8d8f7a");
  const t = 0.1;
  b.box(w, h * 0.7, t, 0, h * 0.35, -l / 2, "#b8bfcc");
  b.box(w, h * 0.7, t, 0, h * 0.35, l / 2, "#b8bfcc");
  b.box(t, h * 0.7, l, -w / 2, h * 0.35, 0, "#b8bfcc");
  b.box(t, h * 0.7, l, w / 2, h * 0.35, 0, "#b8bfcc");
  for (let i = 0; i < 4; i++) b.box(6, 2.6, 2.4, -w / 2 + 6 + i * 8, 1.3, -l / 2 + 3, i % 2 ? color : "#e8e8e8");
}

function building(b: Builder, w: number, l: number, h: number) {
  b.box(w, h, l, 0, h / 2, 0, "#d9dde4");
  b.box(w + 0.8, 0.5, l + 0.8, 0, h + 0.25, 0, "#8d99ab");
  b.box(w + 0.05, h * 0.25, l + 0.05, 0, h * 0.55, 0, GLASS);
}

function pin(b: Builder, color: string) {
  b.box(0.3, 8, 0.3, 0, 4, 0, "#ffffff");
  b.box(2.4, 2.4, 2.4, 0, 8.6, 0, color);
}

const cache = new Map<string, { geometry: THREE.BufferGeometry; kind: RenderKind; symbolic: boolean }>();

export function massingFor(s: Structure) {
  const { kind, symbolic } = renderKind(s);
  const v = visualDims(s);
  const layer = LAYER_BY_ID[s.layer];
  const key = [kind, v.w, v.l, v.h, s.levels, s.layer, s.rows ?? ""].join("|");
  const hit = cache.get(key);
  if (hit) return hit;
  const b = new Builder();
  switch (kind) {
    case "tent":
      tent(b, v.w, v.l, v.h, layer.color, layer.roof);
      break;
    case "frame":
      frameTent(b, v.w, v.l, v.h, layer.color, layer.roof);
      break;
    case "twolevel":
      twoLevel(b, v.w, v.l, v.h, layer.color, layer.roof);
      break;
    case "grandstand":
      grandstand(b, v.w, v.l, v.h, s.rows ?? 12, layer.color);
      break;
    case "hall":
      hall(b, v.w, v.l, v.h, layer.color, layer.roof);
      break;
    case "gate":
      gate(b, v.w, v.l, Math.max(v.h, 2.8), layer.color);
      break;
    case "restroom":
      restroom(b, v.w, v.l, v.h, layer.color);
      break;
    case "videoboard":
      videoboard(b, v.w, v.l, v.h);
      break;
    case "compound":
      compound(b, v.w, v.l, v.h, layer.color);
      break;
    case "building":
      building(b, v.w, v.l, v.h);
      break;
    default:
      pin(b, layer.color);
  }
  const entry = { geometry: b.build(), kind, symbolic };
  cache.set(key, entry);
  return entry;
}

export function footprintBox(s: Structure) {
  const v = visualDims(s);
  const kind = renderKind(s).kind;
  if (kind === "pin") return { w: 2.4, l: 2.4, h: 10 };
  return { w: v.w, l: v.l, h: Math.max(v.h, 0.5) };
}
