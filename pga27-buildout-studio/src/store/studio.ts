"use client";

import { create } from "zustand";
import { useMemo } from "react";
import { buildBaselineScene } from "@/lib/baseline";
import { LAYERS } from "@/lib/layers";
import { applyOps } from "@/lib/scene";
import { loadActiveId, loadWorking, localScenarioStore, newScenario, saveActiveId, saveWorking } from "@/lib/scenarios";
import type { LayerId, Scenario, SceneOp, SceneState, Structure, Tour, ViewOp } from "@/lib/types";
import type { Pose } from "@/lib/tours";

export interface HistoryEntry {
  label: string;
  scene: SceneState;
}

export interface Proposal {
  id: string;
  ops: SceneOp[];
  opIds: string[];
  labels: string[];
}

export interface CameraCommand {
  id: number;
  pose: Pose;
  seconds: number;
  mode?: "perspective" | "top";
}

export interface Playback {
  tourId: string | null;
  state: "idle" | "playing" | "paused";
  t: number;
  speed: number;
  loop: boolean;
  recording: boolean;
  /** bumped to request a seek */
  seek: { id: number; t: number } | null;
}

export interface Notice {
  id: number;
  kind: "info" | "error" | "success";
  text: string;
}

interface StudioState {
  hydrated: boolean;
  scene: SceneState;
  past: HistoryEntry[];
  future: HistoryEntry[];
  dragBase: SceneState | null;
  proposal: Proposal | null;
  selection: string[];
  hoverId: string | null;
  layerVisible: Record<LayerId, boolean>;
  showLabels: boolean;
  showGround: boolean;
  showGrid: boolean;
  showBeacons: boolean;
  groundOpacity: number;
  cameraMode: "perspective" | "top";
  cameraCommand: CameraCommand | null;
  playback: Playback;
  scenarios: Scenario[];
  activeScenarioId: string | null;
  dirty: boolean;
  notices: Notice[];
  aiOpen: boolean;
  appliedViewOps: Record<string, true>;
  planHighlight: { id: string; points: { x: number; y: number }[]; kind: "distance" | "area"; label?: string } | null;

  hydrate: () => Promise<void>;
  commit: (label: string, next: SceneState) => void;
  apply: (label: string, ops: SceneOp[]) => void;
  beginDrag: () => void;
  dragTo: (next: SceneState) => void;
  endDrag: (label: string) => void;
  undo: () => void;
  redo: () => void;
  resetToBaseline: () => void;
  replaceScene: (scene: SceneState, label?: string) => void;

  select: (ids: string[], additive?: boolean) => void;
  setHover: (id: string | null) => void;
  toggleLayer: (id: LayerId) => void;
  setAllLayers: (on: boolean) => void;
  setUi: (patch: Partial<Pick<StudioState, "showLabels" | "showGround" | "showGrid" | "showBeacons" | "groundOpacity" | "aiOpen" | "cameraMode">>) => void;
  flyTo: (pose: Pose, seconds?: number, mode?: "perspective" | "top") => void;

  addProposalOps: (callId: string, ops: SceneOp[], labels: string[]) => void;
  acceptProposal: (label?: string) => void;
  rejectProposal: () => void;
  markViewOpApplied: (id: string) => void;

  playTour: (id: string) => void;
  setPlayback: (patch: Partial<Playback>) => void;
  saveTour: (tour: Tour) => void;
  deleteTour: (id: string) => void;

  notify: (kind: Notice["kind"], text: string) => void;
  dismissNotice: (id: number) => void;

  saveScenario: (name?: string, note?: string) => Promise<void>;
  saveAsScenario: (name: string, note?: string) => Promise<Scenario>;
  loadScenario: (id: string) => void;
  deleteScenario: (id: string) => Promise<void>;
  renameScenario: (id: string, name: string) => Promise<void>;
  importScenario: (s: Scenario) => Promise<void>;
  setPlanHighlight: (h: StudioState["planHighlight"]) => void;
}

let noticeSeq = 1;
let camSeq = 1;
let seekSeq = 1;

const allLayers = (on: boolean) => Object.fromEntries(LAYERS.map((l) => [l.id, on])) as Record<LayerId, boolean>;

const initialPlayback: Playback = { tourId: null, state: "idle", t: 0, speed: 1, loop: false, recording: false, seek: null };

export const useStudio = create<StudioState>((set, get) => ({
  hydrated: false,
  scene: buildBaselineScene(),
  past: [],
  future: [],
  dragBase: null,
  proposal: null,
  selection: [],
  hoverId: null,
  layerVisible: allLayers(true),
  showLabels: false,
  showGround: true,
  showGrid: false,
  showBeacons: true,
  groundOpacity: 1,
  cameraMode: "perspective",
  cameraCommand: null,
  playback: initialPlayback,
  scenarios: [],
  activeScenarioId: null,
  dirty: false,
  notices: [],
  aiOpen: true,
  appliedViewOps: {},
  planHighlight: null,

  hydrate: async () => {
    if (get().hydrated) return;
    const working = loadWorking();
    const scenarios = await localScenarioStore.list();
    set({ hydrated: true, scenarios, activeScenarioId: loadActiveId(), ...(working ? { scene: working } : {}) });
  },

  commit: (label, next) => {
    const { scene, past } = get();
    if (next === scene) return;
    set({ past: [...past.slice(-199), { label, scene }], future: [], scene: next, dirty: true });
    saveWorking(next);
  },

  apply: (label, ops) => {
    if (!ops.length) return;
    get().commit(label, applyOps(get().scene, ops));
  },

  beginDrag: () => set({ dragBase: get().scene }),
  dragTo: (next) => set({ scene: next }),
  endDrag: (label) => {
    const { dragBase, scene, past } = get();
    if (!dragBase) return;
    if (dragBase !== scene) {
      set({ past: [...past.slice(-199), { label, scene: dragBase }], future: [], dragBase: null, dirty: true });
      saveWorking(scene);
    } else set({ dragBase: null });
  },

  undo: () => {
    const { past, future, scene } = get();
    const e = past[past.length - 1];
    if (!e) return;
    set({ past: past.slice(0, -1), future: [{ label: e.label, scene }, ...future], scene: e.scene, dirty: true });
    saveWorking(e.scene);
  },
  redo: () => {
    const { past, future, scene } = get();
    const e = future[0];
    if (!e) return;
    set({ future: future.slice(1), past: [...past, { label: e.label, scene }], scene: e.scene, dirty: true });
    saveWorking(e.scene);
  },
  resetToBaseline: () => get().commit("Reset to v2.2/v2.3 baseline layout", buildBaselineScene()),
  replaceScene: (scene, label = "Replace scene") => get().commit(label, scene),

  select: (ids, additive) =>
    set((st) => ({ selection: additive ? Array.from(new Set([...st.selection, ...ids])) : ids })),
  setHover: (id) => set({ hoverId: id }),
  toggleLayer: (id) => set((st) => ({ layerVisible: { ...st.layerVisible, [id]: !st.layerVisible[id] } })),
  setAllLayers: (on) => set({ layerVisible: allLayers(on) }),
  setUi: (patch) => set(patch),
  flyTo: (pose, seconds = 1.6, mode) => set({ cameraCommand: { id: camSeq++, pose, seconds, mode }, ...(mode ? { cameraMode: mode } : {}) }),

  addProposalOps: (callId, ops, labels) => {
    const p = get().proposal;
    if (p && p.opIds.includes(callId)) return;
    set({
      proposal: {
        id: p?.id ?? `prop-${Date.now()}`,
        ops: [...(p?.ops ?? []), ...ops],
        opIds: [...(p?.opIds ?? []), callId],
        labels: [...(p?.labels ?? []), ...labels],
      },
    });
  },
  acceptProposal: (label) => {
    const p = get().proposal;
    if (!p) return;
    const next = applyOps(get().scene, p.ops);
    set({ proposal: null });
    get().commit(label ?? `AI: ${p.labels.slice(0, 2).join("; ")}${p.labels.length > 2 ? ` +${p.labels.length - 2} more` : ""}`, next);
  },
  rejectProposal: () => set({ proposal: null }),
  markViewOpApplied: (id) => set((st) => ({ appliedViewOps: { ...st.appliedViewOps, [id]: true } })),

  playTour: (id) =>
    set((st) => ({
      playback: { ...st.playback, tourId: id, state: "playing", t: 0, seek: { id: seekSeq++, t: 0 } },
    })),
  setPlayback: (patch) => set((st) => ({ playback: { ...st.playback, ...patch } })),
  saveTour: (tour) => {
    const { scene } = get();
    const exists = scene.tours.some((t) => t.id === tour.id);
    get().commit(exists ? `Edit tour "${tour.name}"` : `Create tour "${tour.name}"`, {
      ...scene,
      tours: exists ? scene.tours.map((t) => (t.id === tour.id ? tour : t)) : [...scene.tours, tour],
    });
  },
  deleteTour: (id) => {
    const { scene } = get();
    get().commit("Delete tour", { ...scene, tours: scene.tours.filter((t) => t.id !== id) });
  },

  notify: (kind, text) => {
    const id = noticeSeq++;
    set((st) => ({ notices: [...st.notices, { id, kind, text }].slice(-4) }));
    setTimeout(() => get().dismissNotice(id), kind === "error" ? 9000 : 4500);
  },
  dismissNotice: (id) => set((st) => ({ notices: st.notices.filter((n) => n.id !== id) })),

  saveScenario: async (name, note) => {
    const { activeScenarioId, scenarios, scene } = get();
    const cur = scenarios.find((s) => s.id === activeScenarioId);
    if (!cur) {
      await get().saveAsScenario(name ?? "Untitled scenario", note);
      return;
    }
    const updated: Scenario = { ...cur, name: name ?? cur.name, note: note ?? cur.note, updatedAt: new Date().toISOString(), scene };
    await localScenarioStore.put(updated);
    set({ scenarios: scenarios.map((s) => (s.id === cur.id ? updated : s)), dirty: false });
  },
  saveAsScenario: async (name, note) => {
    const sc = newScenario(name, get().scene, note);
    await localScenarioStore.put(sc);
    saveActiveId(sc.id);
    set({ scenarios: [...get().scenarios, sc], activeScenarioId: sc.id, dirty: false });
    return sc;
  },
  loadScenario: (id) => {
    const sc = get().scenarios.find((s) => s.id === id);
    if (!sc) return;
    saveActiveId(id);
    set({ activeScenarioId: id, past: [], future: [], proposal: null, selection: [], scene: sc.scene, dirty: false });
    saveWorking(sc.scene);
  },
  deleteScenario: async (id) => {
    await localScenarioStore.remove(id);
    const active = get().activeScenarioId === id ? null : get().activeScenarioId;
    saveActiveId(active);
    set({ scenarios: get().scenarios.filter((s) => s.id !== id), activeScenarioId: active });
  },
  renameScenario: async (id, name) => {
    const sc = get().scenarios.find((s) => s.id === id);
    if (!sc) return;
    const updated = { ...sc, name, updatedAt: new Date().toISOString() };
    await localScenarioStore.put(updated);
    set({ scenarios: get().scenarios.map((s) => (s.id === id ? updated : s)) });
  },
  importScenario: async (s) => {
    await localScenarioStore.put(s);
    set({ scenarios: [...get().scenarios, s] });
  },
  setPlanHighlight: (h) => set({ planHighlight: h }),
}));

/** Scene shown everywhere: the committed scene plus any pending AI proposal (preview). */
export function useEffectiveScene() {
  const scene = useStudio((s) => s.scene);
  const proposal = useStudio((s) => s.proposal);
  return useMemo(() => (proposal ? applyOps(scene, proposal.ops) : scene), [scene, proposal]);
}

export function useSelectedStructures(): Structure[] {
  const scene = useEffectiveScene();
  const selection = useStudio((s) => s.selection);
  return useMemo(() => scene.structures.filter((x) => selection.includes(x.id)), [scene, selection]);
}

export type { ViewOp };
