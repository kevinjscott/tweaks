"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildDxf } from "@/lib/dxf";
import { exportGlb, measureGlb } from "@/lib/glb";
import { GROUND_H, GROUND_W, MAP_CROP_PX, M_PER_PX, fmtNum, rotPoint, round } from "@/lib/geo";
import { LAYER_BY_ID, renderKind, visualDims } from "@/lib/layers";
import { putModel } from "@/lib/modelStore";
import { distance, isPlaced, nextId, nextStructureId, polygonArea, polygonPerimeter } from "@/lib/scene";
import type { Measurement, SceneState, Structure } from "@/lib/types";
import { useEffectiveScene, useStudio } from "@/store/studio";
import { LayersPanel } from "../LayersPanel";
import { StructureInspector } from "../StructureInspector";
import { download } from "../ui";

type Tool = "select" | "distance" | "area" | "dimension" | "pan";
type P = { x: number; y: number };
type SnapKind = "end" | "mid" | "center" | "grid";
interface Snap extends P {
  kind: SnapKind;
}
interface View {
  cx: number;
  cy: number;
  mpp: number;
}

const niceStep = (m: number) => {
  const steps = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
  return steps.find((s) => s >= m) ?? 1000;
};

function structurePoints(s: Structure) {
  if (!isPlaced(s) || s.w == null || s.l == null) return [] as Snap[];
  const out: Snap[] = [{ x: s.x, y: s.y, kind: "center" }];
  const c: P[] = [
    [-s.w / 2, -s.l / 2],
    [s.w / 2, -s.l / 2],
    [s.w / 2, s.l / 2],
    [-s.w / 2, s.l / 2],
  ].map(([u, v]) => {
    const r = rotPoint(u, v, s.rot);
    return { x: s.x + r.x, y: s.y + r.y };
  });
  c.forEach((p) => out.push({ ...p, kind: "end" }));
  for (let i = 0; i < 4; i++) {
    const a = c[i];
    const b = c[(i + 1) % 4];
    out.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, kind: "mid" });
  }
  return out;
}

function fmtLen(m: number) {
  return `${fmtNum(m, m < 20 ? 2 : 1)} m (${fmtNum(m / 0.3048, 0)} ft)`;
}

function DimGraphic({ a, b, offset, label, mpp, color = "#7cf0b8", textColor }: { a: P; b: P; offset: number; label: string; mpp: number; color?: string; textColor?: string }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * offset;
  const ny = (dx / len) * offset;
  const a2 = { x: a.x + nx, y: a.y + ny };
  const b2 = { x: b.x + nx, y: b.y + ny };
  const ux = dx / len;
  const uy = dy / len;
  const t = 6 * mpp;
  const ang = (Math.atan2(-dy, dx) * 180) / Math.PI;
  const upright = ang > 90 || ang < -90 ? ang + 180 : ang;
  const mx = (a2.x + b2.x) / 2;
  const my = (a2.y + b2.y) / 2;
  const sgn = offset >= 0 ? 1 : -1;
  const tx = mx + (nx / (Math.abs(offset) || 1)) * 9 * mpp * sgn * 0 + (nx / (Math.abs(offset) || 1)) * 8 * mpp;
  const ty = my + (ny / (Math.abs(offset) || 1)) * 8 * mpp;
  const P2 = (p: P) => `${p.x},${-p.y}`;
  return (
    <g stroke={color} strokeWidth={1.2} fill="none" vectorEffect="non-scaling-stroke">
      <polyline points={`${P2(a)} ${P2(a2)}`} vectorEffect="non-scaling-stroke" strokeOpacity={0.8} />
      <polyline points={`${P2(b)} ${P2(b2)}`} vectorEffect="non-scaling-stroke" strokeOpacity={0.8} />
      <polyline points={`${P2(a2)} ${P2(b2)}`} vectorEffect="non-scaling-stroke" />
      {[a2, b2].map((p, i) => (
        <polyline key={i} vectorEffect="non-scaling-stroke" points={`${p.x - ux * t - uy * t},${-(p.y - uy * t + ux * t)} ${p.x + ux * t + uy * t},${-(p.y + uy * t - ux * t)}`} />
      ))}
      <text x={tx} y={-ty} fontSize={11 * mpp} fill={textColor ?? color} stroke="none" textAnchor="middle" transform={`rotate(${-upright} ${tx} ${-ty})`} style={{ paintOrder: "stroke", stroke: "#050d19", strokeWidth: 3 * mpp }}>
        {label}
      </text>
    </g>
  );
}

export function PlanView() {
  const scene = useEffectiveScene();
  const committed = useStudio((s) => s.scene);
  const proposal = useStudio((s) => s.proposal);
  const layerVisible = useStudio((s) => s.layerVisible);
  const selection = useStudio((s) => s.selection);
  const hoverId = useStudio((s) => s.hoverId);
  const select = useStudio((s) => s.select);
  const setHover = useStudio((s) => s.setHover);
  const beginDrag = useStudio((s) => s.beginDrag);
  const dragTo = useStudio((s) => s.dragTo);
  const endDrag = useStudio((s) => s.endDrag);
  const commit = useStudio((s) => s.commit);
  const notify = useStudio((s) => s.notify);
  const highlight = useStudio((s) => s.planHighlight);
  const setHighlight = useStudio((s) => s.setPlanHighlight);
  const scenarios = useStudio((s) => s.scenarios);
  const activeId = useStudio((s) => s.activeScenarioId);
  const hydrated = useStudio((s) => s.hydrated);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 700 });
  const [view, setView] = useState<View>({ cx: 0, cy: 120, mpp: 3.6 });
  const [tool, setTool] = useState<Tool>("select");
  const [snapObj, setSnapObj] = useState(true);
  const [snapGrid, setSnapGrid] = useState(true);
  const [showMap, setShowMap] = useState(true);
  const [mapOpacity, setMapOpacity] = useState(0.85);
  const [showGrid, setShowGrid] = useState(true);
  const [showDims, setShowDims] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [cursor, setCursor] = useState<Snap | null>(null);
  const [draft, setDraft] = useState<P[]>([]);
  const [dimOffsetPending, setDimOffsetPending] = useState<{ a: P; b: P } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [includeGround, setIncludeGround] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const locked = !!proposal;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const toPlan = useCallback(
    (clientX: number, clientY: number): P => {
      const r = svgRef.current!.getBoundingClientRect();
      const v = viewRef.current;
      return { x: v.cx + (clientX - r.left - r.width / 2) * v.mpp, y: v.cy - (clientY - r.top - r.height / 2) * v.mpp };
    },
    [],
  );

  const visible = useMemo(() => scene.structures.filter((s) => isPlaced(s) && layerVisible[s.layer]), [scene, layerVisible]);
  const snapTargets = useMemo(() => visible.flatMap((s) => structurePoints(s).map((p) => ({ ...p, id: s.id }))), [visible]);

  const marks = useMemo(() => {
    const m = new Map<string, "added" | "changed">();
    if (!proposal) return m;
    const before = new Map(committed.structures.map((x) => [x.id, x]));
    for (const s of scene.structures) {
      const o = before.get(s.id);
      if (!o) m.set(s.id, "added");
      else if (o !== s) m.set(s.id, "changed");
    }
    return m;
  }, [scene, committed, proposal]);
  const removed = useMemo(() => {
    if (!proposal) return [];
    const now = new Set(scene.structures.map((s) => s.id));
    return committed.structures.filter((s) => !now.has(s.id) && isPlaced(s));
  }, [scene, committed, proposal]);

  const gridStep = niceStep(view.mpp * 70);

  const snapAt = useCallback(
    (p: P, excludeId?: string): Snap => {
      const tol = 14 * viewRef.current.mpp;
      if (snapObj) {
        let best: (Snap & { d: number }) | null = null;
        for (const t of snapTargets) {
          if (t.id === excludeId) continue;
          const d = Math.hypot(t.x - p.x, t.y - p.y);
          if (d < tol && (!best || d < best.d)) best = { x: t.x, y: t.y, kind: t.kind, d };
        }
        if (best) return best;
      }
      if (snapGrid) {
        const g = niceStep(viewRef.current.mpp * 70);
        const gx = Math.round(p.x / g) * g;
        const gy = Math.round(p.y / g) * g;
        if (Math.hypot(gx - p.x, gy - p.y) < 10 * viewRef.current.mpp) return { x: gx, y: gy, kind: "grid" };
      }
      return { ...p, kind: "grid" };
    },
    [snapObj, snapGrid, snapTargets],
  );

  const centerOn = useCallback((s: Structure) => {
    if (!isPlaced(s)) return;
    const v = visualDims(s);
    setView({ cx: s.x, cy: s.y, mpp: Math.max(0.15, Math.max(v.w, v.l, 20) / 260) });
  }, []);

  useEffect(() => {
    if (highlight && highlight.points.length) {
      const xs = highlight.points.map((p) => p.x);
      const ys = highlight.points.map((p) => p.y);
      const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 30);
      setView({ cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: (Math.max(...ys) + Math.min(...ys)) / 2, mpp: (span * 1.8) / Math.min(size.w, size.h) });
    }
    // only on a new highlight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (e.key === "Escape") {
        setDraft([]);
        setDimOffsetPending(null);
        setTool("select");
        setHighlight(null);
      } else if (e.key === "Enter" && tool === "area" && draft.length >= 3) finishArea();
      else if ((e.key === "Delete" || e.key === "Backspace") && selection.length && !locked) {
        e.preventDefault();
        commit(`Delete ${selection.length} structure(s)`, { ...committed, structures: committed.structures.filter((s) => !selection.includes(s.id)) });
        select([]);
      } else if (e.key.toLowerCase() === "v") setTool("select");
      else if (e.key.toLowerCase() === "d") setTool("distance");
      else if (e.key.toLowerCase() === "a") setTool("area");
      else if (e.key.toLowerCase() === "n") setTool("dimension");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, draft, selection, locked, committed]);

  const addMeasurement = (m: Omit<Measurement, "id">) => {
    if (locked) return notify("info", "Accept or reject the pending AI proposal first.");
    const id = nextId("m", committed.measurements.map((x) => x.id));
    commit(`Add ${m.kind} measurement`, { ...committed, measurements: [...committed.measurements, { ...m, id }] });
  };

  const finishArea = () => {
    if (draft.length >= 3) addMeasurement({ kind: "area", points: draft });
    setDraft([]);
  };

  const updateStructure = (id: string, patch: Partial<Structure>): SceneState => ({ ...committed, structures: committed.structures.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  // ---- pointer interaction ----
  const drag = useRef<null | { kind: "pan" | "move" | "resize" | "rotate"; id?: string; handle?: string; startPlan: P; startView: View; startPx: P; orig?: Structure; moved?: boolean }>(null);

  const onPointerDownBackground = (e: React.PointerEvent) => {
    if (e.button === 1 || tool === "pan" || (tool === "select" && e.button === 0)) {
      drag.current = { kind: "pan", startPlan: toPlan(e.clientX, e.clientY), startView: view, startPx: { x: e.clientX, y: e.clientY } };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const sp = snapAt(toPlan(e.clientX, e.clientY));
    if (tool === "distance") {
      if (draft.length === 0) setDraft([sp]);
      else {
        addMeasurement({ kind: "distance", points: [draft[0], sp] });
        setDraft([]);
      }
    } else if (tool === "area") {
      if (draft.length >= 3 && Math.hypot(sp.x - draft[0].x, sp.y - draft[0].y) < 10 * view.mpp) finishArea();
      else setDraft([...draft, sp]);
    } else if (tool === "dimension") {
      if (!dimOffsetPending) {
        if (draft.length === 0) setDraft([sp]);
        else {
          setDimOffsetPending({ a: draft[0], b: sp });
          setDraft([]);
        }
      } else {
        const { a, b } = dimOffsetPending;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const off = ((sp.x - a.x) * -dy + (sp.y - a.y) * dx) / len;
        addMeasurement({ kind: "dimension", points: [a, b], offset: round(off, 2) });
        setDimOffsetPending(null);
      }
    }
  };

  const onPointerDownStructure = (e: React.PointerEvent, s: Structure) => {
    if (tool !== "select" || e.button !== 0) return;
    e.stopPropagation();
    select([s.id], e.shiftKey);
    if (locked || !isPlaced(s)) return;
    const c = committed.structures.find((x) => x.id === s.id);
    if (!c) return;
    beginDrag();
    drag.current = { kind: "move", id: s.id, startPlan: toPlan(e.clientX, e.clientY), startView: view, startPx: { x: e.clientX, y: e.clientY }, orig: c };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onHandleDown = (e: React.PointerEvent, s: Structure, handle: string) => {
    e.stopPropagation();
    if (locked) return;
    beginDrag();
    drag.current = { kind: handle === "rot" ? "rotate" : "resize", id: s.id, handle, startPlan: toPlan(e.clientX, e.clientY), startView: view, startPx: { x: e.clientX, y: e.clientY }, orig: committed.structures.find((x) => x.id === s.id) };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = toPlan(e.clientX, e.clientY);
    const d = drag.current;
    if (!d) {
      setCursor(["distance", "area", "dimension"].includes(tool) ? snapAt(p) : { ...p, kind: "grid" });
      return;
    }
    if (d.kind === "pan") {
      const dxPx = e.clientX - d.startPx.x;
      const dyPx = e.clientY - d.startPx.y;
      if (Math.hypot(dxPx, dyPx) > 3) d.moved = true;
      setView({ ...d.startView, cx: d.startView.cx - dxPx * d.startView.mpp, cy: d.startView.cy + dyPx * d.startView.mpp });
      return;
    }
    const o = d.orig;
    if (!o || o.x == null || o.y == null) return;
    if (d.kind === "move") {
      let nx = o.x + (p.x - d.startPlan.x);
      let ny = o.y + (p.y - d.startPlan.y);
      const tol = 14 * viewRef.current.mpp;
      let snapped: Snap | null = null;
      if (snapObj || snapGrid) {
        const probe: Structure = { ...o, x: nx, y: ny };
        const keys = structurePoints(probe);
        let best: { dx: number; dy: number; d: number; at: Snap } | null = null;
        if (snapObj && keys.length) {
          for (const k of keys) {
            for (const t of snapTargets) {
              if (t.id === o.id) continue;
              const dd = Math.hypot(t.x - k.x, t.y - k.y);
              if (dd < tol && (!best || dd < best.d)) best = { dx: t.x - k.x, dy: t.y - k.y, d: dd, at: t };
            }
          }
        }
        if (best) {
          nx += best.dx;
          ny += best.dy;
          snapped = best.at;
        } else if (snapGrid) {
          const g = niceStep(viewRef.current.mpp * 70);
          nx = Math.round(nx / g) * g;
          ny = Math.round(ny / g) * g;
        }
      }
      setCursor(snapped ?? { x: nx, y: ny, kind: "grid" });
      dragTo(updateStructure(o.id, { x: round(nx, 2), y: round(ny, 2) }));
      d.moved = true;
    } else if (d.kind === "rotate") {
      const ang = (Math.atan2(p.y - o.y, p.x - o.x) * 180) / Math.PI - 90;
      let rot = ((ang % 360) + 360) % 360;
      if (!e.altKey) rot = Math.round(rot / 5) * 5;
      dragTo(updateStructure(o.id, { rot: round(rot % 360, 1) }));
    } else if (d.kind === "resize" && o.w != null && o.l != null) {
      const rel = rotPoint(p.x - o.x, p.y - o.y, -o.rot);
      const step = snapGrid ? Math.max(0.5, niceStep(viewRef.current.mpp * 10)) : 0.01;
      const q = (v: number) => Math.max(0.5, Math.round(v / step) * step);
      let w = o.w;
      let l = o.l;
      let su = 0;
      let sv = 0;
      if (d.handle === "E") {
        w = q(rel.x + o.w / 2);
        su = (w - o.w) / 2;
      } else if (d.handle === "W") {
        w = q(o.w / 2 - rel.x);
        su = -(w - o.w) / 2;
      } else if (d.handle === "N") {
        l = q(rel.y + o.l / 2);
        sv = (l - o.l) / 2;
      } else if (d.handle === "S") {
        l = q(o.l / 2 - rel.y);
        sv = -(l - o.l) / 2;
      }
      const shift = rotPoint(su, sv, o.rot);
      dragTo(updateStructure(o.id, { w: round(w, 2), l: round(l, 2), x: round(o.x + shift.x, 2), y: round(o.y + shift.y, 2) }));
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "move") endDrag(d.moved ? "Move (plan drag)" : "Select");
    else if (d.kind === "resize") endDrag("Resize (plan handle)");
    else if (d.kind === "rotate") endDrag("Rotate (plan handle)");
    else if (d.kind === "pan" && !d.moved && tool === "select") select([]);
  };

  const onWheel = (e: React.WheelEvent) => {
    const p = toPlan(e.clientX, e.clientY);
    const k = Math.exp(e.deltaY * 0.0012);
    setView((v) => {
      const mpp = Math.min(8, Math.max(0.05, v.mpp * k));
      const r = mpp / v.mpp;
      return { mpp, cx: p.x - (p.x - v.cx) * r, cy: p.y - (p.y - v.cy) * r };
    });
  };

  const onDoubleClick = () => {
    if (tool === "area" && draft.length >= 3) finishArea();
  };

  // ---- exports ----
  const scenarioName = scenarios.find((s) => s.id === activeId)?.name ?? "working draft";
  const exportDxf = () => {
    const text = buildDxf(scene, { visibleLayers: layerVisible, scenarioName });
    download("pga27-buildout-plan.dxf", text, "application/dxf");
    notify("success", "DXF exported (R12 ASCII, metres, layers by structure type).");
    setMenuOpen(false);
  };
  const doExportGlb = async () => {
    try {
      setBusy(true);
      const buf = await exportGlb(scene, { visibleLayers: layerVisible, includeGround });
      download("pga27-buildout.glb", buf, "model/gltf-binary");
      notify("success", `GLB exported (${(buf.byteLength / 1e6).toFixed(2)} MB).`);
    } catch (e) {
      notify("error", `GLB export failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  };
  const onImport = async (file: File) => {
    try {
      setBusy(true);
      const buf = await file.arrayBuffer();
      const m = await measureGlb(buf);
      const modelId = `glb-${Date.now().toString(36)}`;
      await putModel(modelId, buf);
      const id = nextStructureId(committed);
      const st: Structure = {
        id,
        name: file.name.replace(/\.(glb|gltf)$/i, ""),
        type: "Imported GLB",
        layer: "infra",
        x: round(view.cx, 1),
        y: round(view.cy, 1),
        rot: 0,
        w: round(Math.max(0.1, m.w), 2),
        l: round(Math.max(0.1, m.l), 2),
        h: round(Math.max(0.1, m.h), 2),
        levels: null,
        custom: true,
        modelId,
        note: `Imported from ${file.name} (${m.meshes} meshes). GLB units assumed metres.`,
      };
      commit(`Import ${file.name}`, { ...committed, structures: [...committed.structures, st] });
      select([id]);
      notify("success", `Imported ${file.name}: ${round(m.w, 1)} × ${round(m.l, 1)} × ${round(m.h, 1)} m placed at the view centre.`);
    } catch (e) {
      notify("error", `GLB import failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  };

  // ---- render helpers ----
  const mpp = view.mpp;
  const vbW = size.w * mpp;
  const vbH = size.h * mpp;
  const viewBox = `${view.cx - vbW / 2} ${-(view.cy + vbH / 2)} ${vbW} ${vbH}`;
  const sel = selection.length === 1 ? scene.structures.find((s) => s.id === selection[0]) : undefined;
  const px = (n: number) => n * mpp;

  const gridLines = useMemo(() => {
    if (!showGrid) return null;
    const g = gridStep;
    const x0 = Math.floor((view.cx - vbW / 2) / g) * g;
    const x1 = view.cx + vbW / 2;
    const y0 = Math.floor((view.cy - vbH / 2) / g) * g;
    const y1 = view.cy + vbH / 2;
    const lines: React.ReactNode[] = [];
    let n = 0;
    for (let x = x0; x <= x1 && n < 400; x += g, n++) lines.push(<line key={`x${x}`} x1={x} x2={x} y1={-y0} y2={-y1} />);
    for (let y = y0; y <= y1 && n < 800; y += g, n++) lines.push(<line key={`y${y}`} x1={x0} x2={x1} y1={-y} y2={-y} />);
    return lines;
  }, [showGrid, gridStep, view.cx, view.cy, vbW, vbH]);

  const scaleBar = niceStep(mpp * 120);

  const snapMarker = (s: Snap) => {
    const r = 7 * mpp;
    if (s.kind === "end") return <rect x={s.x - r} y={-s.y - r} width={2 * r} height={2 * r} fill="none" stroke="#ffd75e" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />;
    if (s.kind === "mid") return <polygon points={`${s.x},${-s.y - r} ${s.x + r},${-s.y + r} ${s.x - r},${-s.y + r}`} fill="none" stroke="#ffd75e" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />;
    if (s.kind === "center") return <circle cx={s.x} cy={-s.y} r={r} fill="none" stroke="#ffd75e" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />;
    return (
      <g stroke="#ffd75e" strokeWidth={1.2} vectorEffect="non-scaling-stroke">
        <line x1={s.x - r} x2={s.x + r} y1={-s.y} y2={-s.y} vectorEffect="non-scaling-stroke" />
        <line x1={s.x} x2={s.x} y1={-s.y - r} y2={-s.y + r} vectorEffect="non-scaling-stroke" />
      </g>
    );
  };

  const liveDist = draft.length === 1 && tool === "distance" && cursor ? { a: draft[0], b: cursor } : null;

  const toolBtn = (t: Tool, label: string, key: string) => (
    <button className={`btn ${tool === t ? "btn-active" : ""}`} onClick={() => { setTool(t); setDraft([]); setDimOffsetPending(null); }} title={`${label} (${key})`}>
      {label} <span className="kbd">{key}</span>
    </button>
  );

  if (!hydrated) return <div className="flex h-full items-center justify-center text-muted">Loading plan…</div>;

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-navy-950">
      <div ref={wrapRef} className="absolute inset-0">
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          viewBox={viewBox}
          preserveAspectRatio="none"
          className="block h-full w-full"
          style={{ cursor: tool === "pan" ? "grab" : tool === "select" ? "default" : "crosshair", touchAction: "none" }}
          onPointerDown={onPointerDownBackground}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => !drag.current && setCursor(null)}
          onWheel={onWheel}
          onDoubleClick={onDoubleClick}
        >
          <defs>
            <clipPath id="mapclip">
              <rect x={-GROUND_W / 2} y={-GROUND_H / 2} width={GROUND_W} height={MAP_CROP_PX * M_PER_PX} />
            </clipPath>
          </defs>
          <rect x={view.cx - vbW} y={-(view.cy + vbH)} width={vbW * 2} height={vbH * 2} fill="#07111f" />
          {showMap ? <image href="/images/master-plan.jpg" x={-GROUND_W / 2} y={-GROUND_H / 2} width={GROUND_W} height={GROUND_H} opacity={mapOpacity} clipPath="url(#mapclip)" preserveAspectRatio="none" /> : null}
          <g stroke="#3c5a80" strokeWidth={0.6} vectorEffect="non-scaling-stroke" opacity={0.55}>
            {gridLines}
          </g>
          <g stroke="#c9a24a" strokeWidth={1} opacity={0.6}>
            <line x1={-px(10)} x2={px(10)} y1={0} y2={0} vectorEffect="non-scaling-stroke" />
            <line x1={0} x2={0} y1={-px(10)} y2={px(10)} vectorEffect="non-scaling-stroke" />
          </g>

          {removed.map((s) => {
            const v = visualDims(s);
            return (
              <g key={`rm-${s.id}`} transform={`translate(${s.x} ${-(s.y as number)}) rotate(${-s.rot})`}>
                <rect x={-v.w / 2} y={-v.l / 2} width={v.w} height={v.l} fill="rgba(224,82,90,0.25)" stroke="#e0525a" strokeDasharray="6 4" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}

          {visible.map((s) => {
            const layer = LAYER_BY_ID[s.layer];
            const known = s.w != null && s.l != null;
            const isSel = selection.includes(s.id);
            const isHover = hoverId === s.id;
            const mark = marks.get(s.id);
            const stroke = isSel ? "#ffd75e" : mark === "added" ? "#4fe0a0" : mark === "changed" ? "#f0a83c" : isHover ? "#ffffff" : layer.color;
            const v = visualDims(s);
            const screenSize = Math.max(v.w, v.l) / mpp;
            const common = {
              onPointerDown: (e: React.PointerEvent) => onPointerDownStructure(e, s),
              onPointerEnter: () => setHover(s.id),
              onPointerLeave: () => setHover(null),
              style: { cursor: tool === "select" ? "move" : undefined } as React.CSSProperties,
            };
            if (!known) {
              const r = 7 * mpp;
              return (
                <g key={s.id} transform={`translate(${s.x} ${-(s.y as number)})`} {...common}>
                  <polygon points={`0,${-r} ${r},0 0,${r} ${-r},0`} fill="rgba(0,0,0,0.35)" stroke={stroke} strokeDasharray="3 2" strokeWidth={isSel ? 2.4 : 1.3} vectorEffect="non-scaling-stroke" />
                  {showLabels && (isSel || isHover || mpp < 0.8) ? <text y={-r - 3 * mpp} fontSize={10 * mpp} textAnchor="middle" fill="#cdd9ea" style={{ paintOrder: "stroke", stroke: "#050d19", strokeWidth: 3 * mpp }}>{s.name} (dims unknown)</text> : null}
                </g>
              );
            }
            if (screenSize < 3) {
              return (
                <g key={s.id} transform={`translate(${s.x} ${-(s.y as number)})`} {...common}>
                  <circle r={3.2 * mpp} fill={layer.color} stroke={isSel ? "#ffd75e" : "none"} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                </g>
              );
            }
            return (
              <g key={s.id} transform={`translate(${s.x} ${-(s.y as number)}) rotate(${-s.rot})`} {...common}>
                <rect x={-v.w / 2} y={-v.l / 2} width={v.w} height={v.l} fill={layer.color} fillOpacity={isSel ? 0.5 : 0.32} stroke={stroke} strokeWidth={isSel ? 2.6 : mark ? 2.2 : 1.3} vectorEffect="non-scaling-stroke" />
                {(s.levels ?? 0) >= 2 ? <rect x={-v.w * 0.44} y={-v.l * 0.44} width={v.w * 0.88} height={v.l * 0.88} fill="none" stroke={layer.color} strokeOpacity={0.8} strokeWidth={1} vectorEffect="non-scaling-stroke" /> : null}
                {v.assumed.l && s.layer === "grandstand" ? <rect x={-v.w / 2} y={-v.l / 2} width={v.w} height={v.l} fill="none" stroke="#fff" strokeDasharray="3 3" strokeWidth={1} vectorEffect="non-scaling-stroke" /> : null}
              </g>
            );
          })}

          {showLabels
            ? visible
                .filter((s) => s.w != null && s.l != null && (selection.includes(s.id) || hoverId === s.id || Math.min(s.w as number, s.l as number) / mpp > 22))
                .map((s) => {
                  const v = visualDims(s);
                  const fs = Math.min(11, Math.max(8, Math.min(v.w, v.l) / mpp / (s.name.length * 0.55))) * mpp;
                  return (
                    <text key={`t-${s.id}`} x={s.x as number} y={-(s.y as number)} fontSize={fs} textAnchor="middle" dominantBaseline="middle" fill="#fff" style={{ pointerEvents: "none", paintOrder: "stroke", stroke: "#050d19", strokeWidth: 2.5 * mpp }}>
                      {s.name}
                    </text>
                  );
                })
            : null}

          {showDims
            ? visible
                .filter((s) => (selection.includes(s.id) || hoverId === s.id) && s.w != null && s.l != null)
                .map((s) => {
                  const c = structurePoints(s);
                  const w = s.w as number;
                  const l = s.l as number;
                  const off = Math.max(px(16), 0);
                  return (
                    <g key={`d-${s.id}`}>
                      <DimGraphic a={c[1]} b={c[2]} offset={-off} label={`${round(w, 2)} m`} mpp={mpp} />
                      <DimGraphic a={c[2]} b={c[3]} offset={-off} label={`${round(l, 2)} m`} mpp={mpp} />
                    </g>
                  );
                })
            : null}

          {scene.measurements.map((m) => {
            if (m.kind === "distance" && m.points.length >= 2) {
              const [a, b] = m.points;
              const d = distance(a, b);
              return (
                <g key={m.id} stroke="#ffd75e" strokeWidth={1.8} vectorEffect="non-scaling-stroke">
                  <line x1={a.x} y1={-a.y} x2={b.x} y2={-b.y} vectorEffect="non-scaling-stroke" strokeDasharray="8 4" />
                  <circle cx={a.x} cy={-a.y} r={3.5 * mpp} fill="#ffd75e" stroke="none" />
                  <circle cx={b.x} cy={-b.y} r={3.5 * mpp} fill="#ffd75e" stroke="none" />
                  <text x={(a.x + b.x) / 2} y={-(a.y + b.y) / 2 - 6 * mpp} fontSize={11.5 * mpp} textAnchor="middle" fill="#ffe9a3" stroke="none" style={{ paintOrder: "stroke", stroke: "#050d19", strokeWidth: 3 * mpp }}>
                    {fmtLen(d)}
                  </text>
                </g>
              );
            }
            if (m.kind === "area" && m.points.length >= 3) {
              const cx = m.points.reduce((t, p) => t + p.x, 0) / m.points.length;
              const cy = m.points.reduce((t, p) => t + p.y, 0) / m.points.length;
              const a = polygonArea(m.points);
              return (
                <g key={m.id}>
                  <polygon points={m.points.map((p) => `${p.x},${-p.y}`).join(" ")} fill="rgba(255,215,94,0.16)" stroke="#ffd75e" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
                  <text x={cx} y={-cy} fontSize={11.5 * mpp} textAnchor="middle" fill="#ffe9a3" style={{ paintOrder: "stroke", stroke: "#050d19", strokeWidth: 3 * mpp }}>
                    {fmtNum(a, 1)} m² ({fmtNum(a / 0.092903, 0)} ft²)
                  </text>
                  <text x={cx} y={-cy + 13 * mpp} fontSize={10 * mpp} textAnchor="middle" fill="#cbb36a" style={{ paintOrder: "stroke", stroke: "#050d19", strokeWidth: 3 * mpp }}>
                    perimeter {fmtLen(polygonPerimeter(m.points))}
                  </text>
                </g>
              );
            }
            if (m.kind === "dimension" && m.points.length >= 2) {
              return <DimGraphic key={m.id} a={m.points[0]} b={m.points[1]} offset={m.offset ?? 4} label={m.label ?? fmtLen(distance(m.points[0], m.points[1]))} mpp={mpp} color="#7cf0b8" />;
            }
            return null;
          })}

          {highlight ? (
            highlight.kind === "area" ? (
              <polygon points={highlight.points.map((p) => `${p.x},${-p.y}`).join(" ")} fill="rgba(74,147,255,0.18)" stroke="#4a93ff" strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
            ) : highlight.points.length >= 2 ? (
              <g>
                <line x1={highlight.points[0].x} y1={-highlight.points[0].y} x2={highlight.points[1].x} y2={-highlight.points[1].y} stroke="#4a93ff" strokeWidth={2.5} strokeDasharray="8 5" vectorEffect="non-scaling-stroke" />
                {highlight.points.map((p, i) => <circle key={i} cx={p.x} cy={-p.y} r={5 * mpp} fill="#4a93ff" />)}
                <text x={(highlight.points[0].x + highlight.points[1].x) / 2} y={-(highlight.points[0].y + highlight.points[1].y) / 2 - 9 * mpp} fontSize={12 * mpp} textAnchor="middle" fill="#bcd6ff" style={{ paintOrder: "stroke", stroke: "#050d19", strokeWidth: 3 * mpp }}>
                  {fmtLen(distance(highlight.points[0], highlight.points[1]))}
                </text>
              </g>
            ) : null
          ) : null}

          {draft.length > 0 && tool === "area" ? (
            <g>
              <polyline points={[...draft, ...(cursor ? [cursor] : [])].map((p) => `${p.x},${-p.y}`).join(" ")} fill="rgba(255,215,94,0.1)" stroke="#ffd75e" strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
              {draft.map((p, i) => <circle key={i} cx={p.x} cy={-p.y} r={3.5 * mpp} fill="#ffd75e" />)}
              {draft.length >= 3 ? <circle cx={draft[0].x} cy={-draft[0].y} r={9 * mpp} fill="none" stroke="#ffd75e" vectorEffect="non-scaling-stroke" /> : null}
            </g>
          ) : null}
          {liveDist ? (
            <g>
              <line x1={liveDist.a.x} y1={-liveDist.a.y} x2={liveDist.b.x} y2={-liveDist.b.y} stroke="#ffd75e" strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
              <text x={(liveDist.a.x + liveDist.b.x) / 2} y={-(liveDist.a.y + liveDist.b.y) / 2 - 8 * mpp} fontSize={11.5 * mpp} textAnchor="middle" fill="#ffe9a3" style={{ paintOrder: "stroke", stroke: "#050d19", strokeWidth: 3 * mpp }}>{fmtLen(distance(liveDist.a, liveDist.b))}</text>
            </g>
          ) : null}
          {tool === "dimension" && draft.length === 1 && cursor ? <line x1={draft[0].x} y1={-draft[0].y} x2={cursor.x} y2={-cursor.y} stroke="#7cf0b8" strokeWidth={1.4} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" /> : null}
          {dimOffsetPending && cursor ? (() => {
            const { a, b } = dimOffsetPending;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            const off = ((cursor.x - a.x) * -dy + (cursor.y - a.y) * dx) / len;
            return <DimGraphic a={a} b={b} offset={off} label={fmtLen(len)} mpp={mpp} />;
          })() : null}

          {sel && isPlaced(sel) && sel.w != null && sel.l != null && !locked && tool === "select" ? (
            <g transform={`translate(${sel.x} ${-sel.y}) rotate(${-sel.rot})`}>
              <line x1={0} y1={-sel.l / 2} x2={0} y2={-sel.l / 2 - px(26)} stroke="#ffd75e" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              {(
                [
                  ["E", sel.w / 2, 0],
                  ["W", -sel.w / 2, 0],
                  ["N", 0, -sel.l / 2],
                  ["S", 0, sel.l / 2],
                ] as [string, number, number][]
              ).map(([h, hx, hy]) => (
                <rect key={h} x={hx - px(5)} y={hy - px(5)} width={px(10)} height={px(10)} fill="#ffd75e" stroke="#1b1405" strokeWidth={1} vectorEffect="non-scaling-stroke" style={{ cursor: h === "E" || h === "W" ? "ew-resize" : "ns-resize" }} onPointerDown={(e) => onHandleDown(e, sel, h)} />
              ))}
              <circle cx={0} cy={-sel.l / 2 - px(26)} r={px(6)} fill="#4a93ff" stroke="#fff" strokeWidth={1.2} vectorEffect="non-scaling-stroke" style={{ cursor: "alias" }} onPointerDown={(e) => onHandleDown(e, sel, "rot")} />
            </g>
          ) : null}

          {cursor && (tool !== "select" || drag.current) ? snapMarker(cursor) : null}
        </svg>
      </div>

      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute bottom-3 left-3 top-3 z-10 w-[270px] overflow-hidden rounded-lg border border-line bg-navy-900/92 shadow-xl backdrop-blur">
          <LayersPanel onPick={(s) => centerOn(s)} />
        </div>

        <div className="pointer-events-auto absolute left-[290px] right-3 top-3 z-20 flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-navy-900/92 px-2 py-1.5 shadow-xl backdrop-blur">
          {toolBtn("select", "Select / edit", "V")}
          {toolBtn("distance", "Distance", "D")}
          {toolBtn("area", "Area", "A")}
          {toolBtn("dimension", "Dimension", "N")}
          {toolBtn("pan", "Pan", "")}
          <span className="mx-1 h-5 w-px bg-line" />
          <button className={`btn ${snapObj ? "btn-active" : ""}`} onClick={() => setSnapObj((v) => !v)} title="Snap to corners, mid-points and centres">Snap: points</button>
          <button className={`btn ${snapGrid ? "btn-active" : ""}`} onClick={() => setSnapGrid((v) => !v)} title={`Snap to grid (${gridStep} m at this zoom)`}>Snap: grid {gridStep}m</button>
          <span className="mx-1 h-5 w-px bg-line" />
          <button className={`btn ${showMap ? "btn-active" : ""}`} onClick={() => setShowMap((v) => !v)}>Map</button>
          {showMap ? <input type="range" className="w-16" min={0.15} max={1} step={0.05} value={mapOpacity} onChange={(e) => setMapOpacity(parseFloat(e.target.value))} /> : null}
          <button className={`btn ${showGrid ? "btn-active" : ""}`} onClick={() => setShowGrid((v) => !v)}>Grid</button>
          <button className={`btn ${showDims ? "btn-active" : ""}`} onClick={() => setShowDims((v) => !v)}>Dims</button>
          <button className={`btn ${showLabels ? "btn-active" : ""}`} onClick={() => setShowLabels((v) => !v)}>Names</button>
          <div className="relative ml-auto">
            <button className="btn btn-gold" onClick={() => setMenuOpen((v) => !v)} disabled={busy}>Export / import ▾</button>
            {menuOpen ? (
              <div className="absolute right-0 top-full z-30 mt-1 w-[290px] rounded-lg border border-line bg-navy-900 p-2 shadow-2xl">
                <button className="btn mb-1.5 w-full justify-start" onClick={exportDxf}>Export DXF (R12, metres, layered)</button>
                <button className="btn mb-1 w-full justify-start" onClick={doExportGlb}>Export GLB (glTF binary)</button>
                <label className="mb-2 flex items-center gap-2 px-1 text-[11.5px] text-muted"><input type="checkbox" checked={includeGround} onChange={(e) => setIncludeGround(e.target.checked)} /> include master-plan ground (larger file)</label>
                <button className="btn w-full justify-start" onClick={() => fileRef.current?.click()}>Import GLB as a structure…</button>
                <input ref={fileRef} type="file" accept=".glb,.gltf,model/gltf-binary" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImport(f); e.target.value = ""; }} />
                <div className="mt-2 px-1 text-[10.5px] leading-snug text-muted">Generated CAD is a planning concept, not for construction. DXF carries footprints by layer, names, width/length dimensions and your measurements. Imported GLB units are assumed metres and are placed at the view centre.</div>
              </div>
            ) : null}
          </div>
        </div>

        {sel || selection.length > 1 ? (
          <div className="pointer-events-auto absolute bottom-3 right-3 top-[108px] z-10 w-[360px] overflow-hidden rounded-lg border border-line bg-navy-900/94 shadow-xl backdrop-blur">
            {sel ? <StructureInspector id={sel.id} onClose={() => select([])} compact /> : <div className="p-3 text-[12.5px]"><div className="font-display text-[14px] text-gold-soft">{selection.length} selected</div><button className="btn mt-2" onClick={() => select([])}>Clear</button></div>}
          </div>
        ) : (
          <div className="pointer-events-auto absolute right-3 top-[108px] z-10 max-h-[calc(100%-160px)] w-[320px] overflow-auto rounded-lg border border-line bg-navy-900/92 p-3 text-[12px] shadow-xl backdrop-blur">
            <div className="font-display text-[14px] font-semibold text-gold-soft">Measurements &amp; annotations</div>
            <div className="mt-1 text-[11px] leading-snug text-muted">
              {tool === "distance" ? "Click two points (snaps to corners, mid-points, centres, grid)." : tool === "area" ? "Click polygon corners; double-click, Enter or click the first point to close." : tool === "dimension" ? "Click two points, then click to place the dimension line." : "Pick a tool above. Drag structures to move; use handles to resize/rotate; Delete removes."}
            </div>
            <div className="mt-2 space-y-1">
              {scene.measurements.length === 0 ? <div className="text-muted">None yet.</div> : null}
              {scene.measurements.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded border border-line bg-navy-850 px-2 py-1">
                  <span className="chip">{m.kind}</span>
                  <span className="flex-1 truncate text-[#c3d1e4]">
                    {m.kind === "area" ? `${fmtNum(polygonArea(m.points), 1)} m²` : fmtLen(distance(m.points[0], m.points[1]))}
                  </span>
                  <button className="text-muted hover:text-bad" onClick={() => !locked && commit("Delete measurement", { ...committed, measurements: committed.measurements.filter((x) => x.id !== m.id) })}>✕</button>
                </div>
              ))}
            </div>
            {scene.measurements.length ? <button className="btn mt-2 w-full" onClick={() => !locked && commit("Clear measurements", { ...committed, measurements: [] })}>Clear all</button> : null}
            {highlight ? <button className="btn mt-2 w-full" onClick={() => setHighlight(null)}>Clear assistant highlight{highlight.label ? ` (${highlight.label})` : ""}</button> : null}
          </div>
        )}

        <div className="pointer-events-none absolute bottom-3 left-[290px] z-10 rounded-lg border border-line bg-navy-900/88 px-3 py-1.5 font-mono text-[11px] text-muted backdrop-blur">
          {cursor ? `E ${fmtNum(cursor.x, 1)} m · N ${fmtNum(cursor.y, 1)} m${cursor.kind !== "grid" ? ` · snap ${cursor.kind}` : ""}` : "E — · N —"} · {fmtNum(1 / mpp, 2)} px/m · 1 px = {round(mpp, 2)} m
        </div>
        <div className="pointer-events-none absolute bottom-3 right-[390px] z-10 flex items-end gap-2" style={sel ? undefined : { right: 346 }}>
          <div className="rounded-lg border border-line bg-navy-900/88 px-3 py-1.5 text-[11px] text-muted backdrop-blur">
            <div className="mb-1 h-1.5 border-x border-b border-ink" style={{ width: scaleBar / mpp }} />
            {scaleBar} m
          </div>
        </div>
        {locked ? <div className="pointer-events-none absolute left-1/2 top-[108px] z-10 -translate-x-1/2 rounded-lg border border-gold/60 bg-gold/15 px-3 py-1 text-[12px] text-gold-soft">Previewing an AI proposal · plan editing is paused until you accept or reject</div> : null}
      </div>
    </div>
  );
}
