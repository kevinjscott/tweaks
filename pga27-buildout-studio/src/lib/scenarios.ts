import type { Scenario, SceneState } from "./types";
import { buildBaselineScene } from "./baseline";

/**
 * Storage adapter. The Studio only talks to this interface, so the localStorage implementation can be swapped for
 * Vercel Blob / Postgres / Edge Config behind a Route Handler without touching UI code (see README "Storage").
 */
export interface ScenarioStore {
  list(): Promise<Scenario[]>;
  put(s: Scenario): Promise<void>;
  remove(id: string): Promise<void>;
}

const KEY = "pga27.scenarios.v1";
const WORKING = "pga27.working.v1";
const ACTIVE = "pga27.active.v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const localScenarioStore: ScenarioStore = {
  async list() {
    return read<Scenario[]>(KEY, []);
  },
  async put(s) {
    const all = read<Scenario[]>(KEY, []);
    const i = all.findIndex((x) => x.id === s.id);
    if (i >= 0) all[i] = s;
    else all.push(s);
    if (!write(KEY, all)) throw new Error("Browser storage is full. Export scenarios as JSON and delete some.");
  },
  async remove(id) {
    write(KEY, read<Scenario[]>(KEY, []).filter((x) => x.id !== id));
  },
};

export function loadWorking(): SceneState | null {
  const s = read<SceneState | null>(WORKING, null);
  return s && Array.isArray(s.structures) ? migrateScene(s) : null;
}
export function saveWorking(scene: SceneState) {
  write(WORKING, scene);
}
export function loadActiveId(): string | null {
  return read<string | null>(ACTIVE, null);
}
export function saveActiveId(id: string | null) {
  write(ACTIVE, id);
}

export function migrateScene(s: Partial<SceneState>): SceneState {
  const base = buildBaselineScene();
  return {
    structures: s.structures ?? base.structures,
    tours: s.tours ?? [],
    bomAdjustments: s.bomAdjustments ?? [],
    measurements: s.measurements ?? [],
    derivedAllowances: s.derivedAllowances ?? true,
  };
}

export function newScenario(name: string, scene: SceneState, note?: string): Scenario {
  const now = new Date().toISOString();
  return {
    id: `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    note,
    createdAt: now,
    updatedAt: now,
    app: "pga27-buildout-studio",
    schema: 1,
    scene,
  };
}

export function parseScenarioJson(text: string): Scenario {
  const data = JSON.parse(text);
  if (data?.app !== "pga27-buildout-studio" || !data.scene?.structures) {
    throw new Error("Not a PGA27 Buildout Studio scenario file.");
  }
  const sc = data as Scenario;
  return { ...sc, scene: migrateScene(sc.scene), id: `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` };
}

export function scenarioToJson(s: Scenario) {
  return JSON.stringify(s, null, 2);
}
