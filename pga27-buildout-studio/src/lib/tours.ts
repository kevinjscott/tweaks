import { compassHeadingToVec, headingOf, round } from "./geo";
import { visualDims } from "./layers";
import { isPlaced } from "./scene";
import type { SceneState, Structure, Tour, TourKeyframe, Vec3 } from "./types";

export interface Pose {
  pos: Vec3;
  target: Vec3;
}

export function tourDuration(t: Tour) {
  return t.keyframes.slice(1).reduce((s, k) => s + Math.max(0.1, k.seconds), 0);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function cr(a: Vec3, b: Vec3, c: Vec3, d: Vec3, t: number): Vec3 {
  return { x: catmull(a.x, b.x, c.x, d.x, t), y: catmull(a.y, b.y, c.y, d.y, t), z: catmull(a.z, b.z, c.z, d.z, t) };
}

/** Sample the camera pose of a tour at time t (seconds). Pure and deterministic, used for playback and video export. */
export function sampleTour(tour: Tour, tSeconds: number): Pose | null {
  const k = tour.keyframes;
  if (!k.length) return null;
  if (k.length === 1) return { pos: k[0].pos, target: k[0].target };
  let acc = 0;
  for (let i = 0; i < k.length - 1; i++) {
    const dur = Math.max(0.1, k[i + 1].seconds);
    if (tSeconds <= acc + dur || i === k.length - 2) {
      const u = ease(Math.min(1, Math.max(0, (tSeconds - acc) / dur)));
      const p0 = k[Math.max(0, i - 1)];
      const p3 = k[Math.min(k.length - 1, i + 2)];
      return {
        pos: cr(p0.pos, k[i].pos, k[i + 1].pos, p3.pos, u),
        target: cr(p0.target, k[i].target, k[i + 1].target, p3.target, u),
      };
    }
    acc += dur;
  }
  return { pos: k[k.length - 1].pos, target: k[k.length - 1].target };
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const e = ease(t);
  return {
    pos: { x: lerp(a.pos.x, b.pos.x, e), y: lerp(a.pos.y, b.pos.y, e), z: lerp(a.pos.z, b.pos.z, e) },
    target: { x: lerp(a.target.x, b.target.x, e), y: lerp(a.target.y, b.target.y, e), z: lerp(a.target.z, b.target.z, e) },
  };
}

export interface FrameOptions {
  heading?: number;
  distance?: number;
  altitude?: number;
}

export function structureCenter(s: Structure): Vec3 | null {
  if (!isPlaced(s)) return null;
  const v = visualDims(s);
  return { x: s.x, y: s.y, z: Math.max(1, v.h * 0.4) };
}

/** Camera pose that looks at `target` from `distance` m behind it along compass `heading`, at `altitude` m. */
export function posePointing(target: Vec3, heading: number, distance: number, altitude: number): Pose {
  const d = compassHeadingToVec(heading);
  return {
    target,
    pos: { x: target.x - d.x * distance, y: target.y - d.y * distance, z: altitude },
  };
}

export function frameStructure(s: Structure, o: FrameOptions = {}): Pose | null {
  const c = structureCenter(s);
  if (!c) return null;
  const v = visualDims(s);
  const size = Math.max(v.w, v.l, 10);
  const dist = o.distance ?? Math.max(55, size * 1.9);
  const alt = o.altitude ?? Math.max(25, dist * 0.55);
  return posePointing(c, o.heading ?? 20, dist, alt);
}

let kfCounter = 0;
export function kfId() {
  kfCounter += 1;
  return `kf-${Date.now().toString(36)}-${kfCounter}`;
}

export interface Waypoint {
  point: { x: number; y: number };
  size?: number;
  altitude?: number;
  distance?: number;
  label?: string;
  heading?: number;
}

/**
 * Turn a list of ground points into a path-following tour: the camera approaches each point along the travel
 * direction. When secondsPerLeg is omitted the leg time follows distance (about 40 m/s, 5-40 s). Legs longer than
 * 250 m get a higher "cruise" keyframe halfway so the camera clears the course.
 */
export function waypointsToKeyframes(wps: Waypoint[], secondsPerLeg?: number): TourKeyframe[] {
  const base: TourKeyframe[] = [];
  wps.forEach((w, i) => {
    const prev = wps[i - 1];
    const next = wps[i + 1];
    let heading = w.heading;
    if (heading == null) {
      if (next) heading = headingOf(next.point.x - w.point.x, next.point.y - w.point.y);
      else if (prev) heading = headingOf(w.point.x - prev.point.x, w.point.y - prev.point.y);
      else heading = 20;
      if (prev && next) {
        const a = headingOf(w.point.x - prev.point.x, w.point.y - prev.point.y);
        const b = headingOf(next.point.x - w.point.x, next.point.y - w.point.y);
        const dx = Math.sin((a * Math.PI) / 180) + Math.sin((b * Math.PI) / 180);
        const dy = Math.cos((a * Math.PI) / 180) + Math.cos((b * Math.PI) / 180);
        heading = headingOf(dx, dy);
      }
    }
    const size = w.size ?? 30;
    const dist = w.distance ?? Math.max(60, size * 1.8);
    const alt = w.altitude ?? Math.max(30, dist * 0.55);
    const pose = posePointing({ x: w.point.x, y: w.point.y, z: Math.max(1, Math.min(10, size * 0.15)) }, heading, dist, alt);
    base.push({ id: kfId(), label: w.label, pos: pose.pos, target: pose.target, seconds: 0 });
  });
  const out: TourKeyframe[] = [];
  base.forEach((k, i) => {
    if (i === 0) {
      out.push(k);
      return;
    }
    const prev = base[i - 1];
    const leg = Math.hypot(k.pos.x - prev.pos.x, k.pos.y - prev.pos.y);
    const secs = secondsPerLeg ?? Math.min(40, Math.max(5, leg / 40));
    if (leg > 250) {
      const cruiseZ = Math.min(320, Math.max(prev.pos.z, k.pos.z, leg * 0.16));
      out.push({
        id: kfId(),
        pos: { x: (prev.pos.x + k.pos.x) / 2, y: (prev.pos.y + k.pos.y) / 2, z: cruiseZ },
        target: { x: prev.target.x * 0.35 + k.target.x * 0.65, y: prev.target.y * 0.35 + k.target.y * 0.65, z: 0 },
        seconds: secs * 0.55,
      });
      out.push({ ...k, seconds: secs * 0.45 });
    } else out.push({ ...k, seconds: secs });
  });
  return out;
}

function pt(scene: SceneState, id: string): Waypoint | null {
  const s = scene.structures.find((x) => x.id === id);
  if (!s || !isPlaced(s)) return null;
  const v = visualDims(s);
  return { point: { x: s.x, y: s.y }, size: Math.max(v.w, v.l), label: s.name };
}

function nonNull<T>(a: (T | null)[]): T[] {
  return a.filter((x): x is T => x != null);
}

/** Preset tours are generated from the CURRENT scene so they follow edited positions. */
export function buildPresetTours(scene: SceneState): Tour[] {
  const tours: Tour[] = [];

  const full: Tour = {
    id: "preset-full-site",
    name: "Full site orbit",
    preset: true,
    description: "Aerial orbit over the whole master plan, then a descent toward the main entrance.",
    keyframes: [],
  };
  const R = 1250;
  const alt = 1050;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI * 0.9;
    full.keyframes.push({
      id: kfId(),
      label: i === 0 ? "Start" : undefined,
      pos: { x: Math.cos(a) * R, y: Math.sin(a) * R * 0.85, z: alt },
      target: { x: 0, y: 0, z: 0 },
      seconds: i === 0 ? 0 : 5,
    });
  }
  full.keyframes.push({ ...full.keyframes[0], id: kfId(), seconds: 5 });
  tours.push(full);

  const entrance = scene.structures.find((s) => s.id === "area-011");
  const entranceWp: Waypoint | null = entrance && isPlaced(entrance) ? { point: { x: entrance.x, y: entrance.y }, size: 80, label: "Main entrance", altitude: 90, distance: 190 } : null;
  const mainRoute = nonNull([entranceWp, pt(scene, "s-089-1"), pt(scene, "s-096-1"), pt(scene, "s-095-1")]);
  if (mainRoute.length >= 2) {
    tours.push({
      id: "preset-entrance-shops",
      name: "Main entrance to PGA Shops",
      preset: true,
      description: "Arrival sequence: entrance anchor, scan gates, ticket office, then the 40 x 120 m PGA Shops.",
      keyframes: waypointsToKeyframes(mainRoute.map((w, i) => ({ ...w, altitude: w.altitude ?? 55, distance: i === mainRoute.length - 1 ? 190 : (w.distance ?? 110) }))),
    });
  }

  const hosp = nonNull(["s-023-1", "s-014-1", "s-027-1", "s-036-1", "s-072-1", "s-034-1"].map((id) => pt(scene, id)));
  if (hosp.length >= 2) {
    tours.push({
      id: "preset-hospitality",
      name: "Hospitality along 14-17",
      preset: true,
      description: "14G suites, #16 fairway suites, 16 green village, 17 tee village, Partner Pavilion, 17 green village.",
      keyframes: waypointsToKeyframes(hosp.map((w) => ({ ...w, distance: 150, altitude: 70 }))),
    });
  }

  const media = scene.structures.find((s) => s.id === "s-066-1");
  if (media && isPlaced(media)) {
    const v = visualDims(media);
    const c = { x: media.x, y: media.y, z: 4 };
    const kfs: TourKeyframe[] = [0, 90, 180, 270, 360].map((h, i) => {
      const p = posePointing(c, h + 30, Math.max(v.w, v.l) * 1.3, 55);
      return { id: kfId(), label: i === 0 ? "Media Center 30 x 60 m" : undefined, pos: p.pos, target: p.target, seconds: i === 0 ? 0 : 4.5 };
    });
    tours.push({ id: "preset-media", name: "Media Center", preset: true, description: "Orbit around the 30 x 60 m Media Center.", keyframes: kfs });
  }
  return tours;
}

export function poseToCameraTuple(p: Pose) {
  return {
    position: [round(p.pos.x, 1), round(p.pos.y, 1), round(p.pos.z, 1)],
    target: [round(p.target.x, 1), round(p.target.y, 1), round(p.target.z, 1)],
  };
}

export function allTours(scene: SceneState): Tour[] {
  return [...buildPresetTours(scene), ...scene.tours];
}
