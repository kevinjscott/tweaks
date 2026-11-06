"use client";

import { useMemo, useRef, useState } from "react";
import { buildBaselineScene } from "@/lib/baseline";
import { computeBom, summarizeBom } from "@/lib/bom";
import { fmtNum } from "@/lib/geo";
import { diffScenes } from "@/lib/scene";
import { newScenario, parseScenarioJson, scenarioToJson } from "@/lib/scenarios";
import type { Scenario, SceneState } from "@/lib/types";
import { useStudio } from "@/store/studio";
import { download, SectionTitle } from "../ui";

const BASELINE = buildBaselineScene();

function summarize(scene: SceneState) {
  const d = diffScenes(BASELINE, scene);
  const b = summarizeBom(computeBom(scene));
  return { added: d.added.length, removed: d.removed.length, changed: d.changed.length, tours: scene.tours.length, bomChanges: b.added + b.removed + b.changed, structures: scene.structures.length, bom: b };
}

export function ScenariosView() {
  const scenarios = useStudio((s) => s.scenarios);
  const activeId = useStudio((s) => s.activeScenarioId);
  const scene = useStudio((s) => s.scene);
  const dirty = useStudio((s) => s.dirty);
  const saveScenario = useStudio((s) => s.saveScenario);
  const saveAs = useStudio((s) => s.saveAsScenario);
  const load = useStudio((s) => s.loadScenario);
  const del = useStudio((s) => s.deleteScenario);
  const rename = useStudio((s) => s.renameScenario);
  const importScenario = useStudio((s) => s.importScenario);
  const resetToBaseline = useStudio((s) => s.resetToBaseline);
  const notify = useStudio((s) => s.notify);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cur = useMemo(() => summarize(scene), [scene]);
  const active = scenarios.find((s) => s.id === activeId);

  const exportJson = (sc: Scenario) => {
    download(`${sc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "scenario"}.pga27.json`, scenarioToJson(sc), "application/json");
  };
  const copyJson = async (sc: Scenario) => {
    try {
      await navigator.clipboard.writeText(scenarioToJson(sc));
      notify("success", "Scenario JSON copied to the clipboard.");
    } catch {
      notify("error", "Clipboard unavailable; use Export JSON.");
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-[1180px] space-y-5 px-6 py-6">
        <div>
          <h1 className="font-display text-[24px] font-semibold text-ink">Scenarios</h1>
          <div className="text-[12.5px] text-muted">Named versions of the layout (structures, tours, BOM adjustments, measurements). Saved in this browser; share by exporting JSON.</div>
        </div>

        <section className="panel p-4">
          <SectionTitle right={<span className={`chip ${dirty ? "border-warn/50 text-warn" : "border-ok/50 text-ok"}`}>{dirty ? "unsaved changes" : "saved"}</span>}>
            Working draft{active ? ` · based on “${active.name}”` : ""}
          </SectionTitle>
          <div className="grid grid-cols-5 gap-3 text-center">
            {[
              ["Structures", cur.structures],
              ["Added vs v2.2/v2.3", cur.added],
              ["Removed", cur.removed],
              ["Edited", cur.changed],
              ["BOM lines changed", cur.bomChanges],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-lg border border-line bg-navy-850 py-2">
                <div className="font-display text-[22px] text-gold-soft">{v}</div>
                <div className="text-[11px] text-muted">{k}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block w-72"><span className="label">Scenario name</span><input className="input mt-0.5" placeholder="e.g. Add suites at 16 green" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="block min-w-[220px] flex-1"><span className="label">Note (optional)</span><input className="input mt-0.5" value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <button
              className="btn btn-gold"
              disabled={!name.trim()}
              onClick={async () => {
                try {
                  await saveAs(name.trim(), note.trim() || undefined);
                  setName("");
                  setNote("");
                  notify("success", "Scenario saved.");
                } catch (e) {
                  notify("error", (e as Error).message);
                }
              }}
            >
              Save as new scenario
            </button>
            <button className="btn" disabled={!active} onClick={() => saveScenario().then(() => notify("success", `Updated “${active?.name}”.`)).catch((e) => notify("error", e.message))}>Update “{active?.name ?? "—"}”</button>
            <button className="btn" onClick={() => fileRef.current?.click()}>Import JSON…</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  const sc = parseScenarioJson(await f.text());
                  await importScenario(sc);
                  notify("success", `Imported “${sc.name}”.`);
                } catch (err) {
                  notify("error", (err as Error).message);
                }
              }}
            />
            <button className="btn btn-danger" onClick={() => { if (window.confirm("Reset the working layout to the original v2.2/v2.3 baseline? You can undo this.")) resetToBaseline(); }}>Reset to baseline</button>
          </div>
        </section>

        <section>
          <SectionTitle right={<span className="text-[11px] text-muted">{scenarios.length} saved</span>}>Saved scenarios</SectionTitle>
          {scenarios.length === 0 ? (
            <div className="panel p-8 text-center text-muted">No saved scenarios yet. Make changes in the 3D site, CAD plan or with the assistant, then save a named version above.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {scenarios
                .slice()
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .map((sc) => {
                  const sm = summarize(sc.scene);
                  const isActive = sc.id === activeId;
                  return (
                    <div key={sc.id} className={`panel p-4 ${isActive ? "!border-gold" : ""}`}>
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          {renaming === sc.id ? (
                            <div className="flex gap-1.5">
                              <input className="input" value={renameVal} onChange={(e) => setRenameVal(e.target.value)} autoFocus />
                              <button className="btn btn-gold" onClick={() => { void rename(sc.id, renameVal.trim() || sc.name); setRenaming(null); }}>OK</button>
                            </div>
                          ) : (
                            <div className="font-display truncate text-[16px] font-semibold text-ink">{sc.name}</div>
                          )}
                          <div className="text-[11px] text-muted">Updated {new Date(sc.updatedAt).toLocaleString()}{isActive ? " · active" : ""}</div>
                          {sc.note ? <div className="mt-1 text-[12px] text-[#b7c7dc]">{sc.note}</div> : null}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px]">
                        <div className="rounded border border-line bg-navy-850 py-1.5"><div className="text-[15px] text-ink">{sm.structures}</div>structures</div>
                        <div className="rounded border border-line bg-navy-850 py-1.5"><div className="text-[15px] text-ok">+{sm.added}</div>added</div>
                        <div className="rounded border border-line bg-navy-850 py-1.5"><div className="text-[15px] text-warn">{sm.changed}</div>edited</div>
                        <div className="rounded border border-line bg-navy-850 py-1.5"><div className="text-[15px] text-bad">−{sm.removed}</div>removed</div>
                      </div>
                      <div className="mt-2 text-[11.5px] text-muted">
                        BOM: {sm.bomChanges} line change(s) vs v2.2 · {fmtNum(sm.bom.totals.each, 0)} ea · {fmtNum(sm.bom.totals.linear_ft, 0)} lf · {fmtNum(sm.bom.totals.sq_ft, 0)} sf · {sm.tours} tour(s)
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <button className="btn btn-gold" onClick={() => { load(sc.id); notify("success", `Loaded “${sc.name}”.`); }}>Load</button>
                        <button className="btn" onClick={() => exportJson(sc)}>Export JSON</button>
                        <button className="btn" onClick={() => copyJson(sc)}>Copy JSON</button>
                        <button className="btn" onClick={() => { setRenaming(sc.id); setRenameVal(sc.name); }}>Rename</button>
                        <button className="btn" onClick={async () => { const copy = newScenario(`${sc.name} (copy)`, sc.scene, sc.note); await importScenario(copy); }}>Duplicate</button>
                        <button className="btn btn-danger" onClick={() => { if (window.confirm(`Delete “${sc.name}”?`)) void del(sc.id); }}>Delete</button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        <section className="panel p-4 text-[12.5px] leading-relaxed text-[#b7c7dc]">
          <SectionTitle>Storage</SectionTitle>
          Scenarios live in this browser&apos;s <code className="rounded bg-navy-800 px-1">localStorage</code> (keys <code className="rounded bg-navy-800 px-1">pga27.scenarios.v1</code>, <code className="rounded bg-navy-800 px-1">pga27.working.v1</code>); imported GLB models live in IndexedDB. Everything goes through the <code className="rounded bg-navy-800 px-1">ScenarioStore</code> interface in <code className="rounded bg-navy-800 px-1">src/lib/scenarios.ts</code>, so Vercel Blob, Postgres (Neon) or Edge Config can be added later behind a Route Handler without touching the UI. See the README for the migration path. JSON exports are self-contained and can be imported on another machine.
        </section>
      </div>
    </div>
  );
}
