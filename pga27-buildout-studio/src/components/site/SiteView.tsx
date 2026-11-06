"use client";

import dynamic from "next/dynamic";
import { useEffectiveScene, useStudio } from "@/store/studio";
import { StructureInspector } from "../StructureInspector";
import { LayersPanel } from "../LayersPanel";
import { ToursPanel, PlaybackBar } from "./ToursPanel";

const SiteCanvas = dynamic(() => import("./SiteCanvas"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-muted">Loading 3D site…</div>,
});

const SITE_POSE = { pos: { x: 0, y: -1900, z: 1500 }, target: { x: 0, y: 0, z: 0 } };

function ViewToolbar() {
  const showLabels = useStudio((s) => s.showLabels);
  const showGround = useStudio((s) => s.showGround);
  const showGrid = useStudio((s) => s.showGrid);
  const showBeacons = useStudio((s) => s.showBeacons);
  const groundOpacity = useStudio((s) => s.groundOpacity);
  const setUi = useStudio((s) => s.setUi);
  const flyTo = useStudio((s) => s.flyTo);
  const proposal = useStudio((s) => s.proposal);
  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-line bg-navy-900/90 px-2 py-1.5 shadow-xl backdrop-blur">
      <button className="btn" onClick={() => flyTo(SITE_POSE, 1.8, "perspective")}>Whole site</button>
      <button className="btn" onClick={() => flyTo({ pos: { x: 0, y: -1, z: 2600 }, target: { x: 0, y: 0, z: 0 } }, 1.4, "top")}>Top view</button>
      <span className="mx-1 h-5 w-px bg-line" />
      <button className={`btn ${showLabels ? "btn-active" : ""}`} onClick={() => setUi({ showLabels: !showLabels })}>Labels</button>
      <button className={`btn ${showBeacons ? "btn-active" : ""}`} onClick={() => setUi({ showBeacons: !showBeacons })}>Markers</button>
      <button className={`btn ${showGrid ? "btn-active" : ""}`} onClick={() => setUi({ showGrid: !showGrid })}>Grid</button>
      <label className="flex items-center gap-1.5 pl-1 text-[11px] text-muted">
        Map
        <input type="range" min={0.15} max={1} step={0.05} value={groundOpacity} onChange={(e) => setUi({ groundOpacity: parseFloat(e.target.value) })} className="w-20" disabled={!showGround} />
      </label>
      {proposal ? <span className="chip border-gold/60 text-gold-soft">previewing AI proposal</span> : null}
    </div>
  );
}

function Legend() {
  const proposal = useStudio((s) => s.proposal);
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg border border-line bg-navy-900/85 px-3 py-2 text-[11px] text-muted backdrop-blur">
      <div>Drag: orbit · Right-drag: pan · Wheel: zoom · Click: select (Shift = add)</div>
      <div className="mt-0.5">Dashed translucent shapes are symbolic (source dimensions unknown).</div>
      {proposal ? (
        <div className="mt-1 flex gap-3">
          <span className="text-[#4fe0a0]">■ added</span>
          <span className="text-[#f0a83c]">■ changed</span>
          <span className="text-[#e0525a]">■ removed</span>
        </div>
      ) : null}
    </div>
  );
}

export function SiteView({ mode }: { mode: "site" | "tours" }) {
  const selection = useStudio((s) => s.selection);
  const select = useStudio((s) => s.select);
  const hydrated = useStudio((s) => s.hydrated);

  return (
    <div className="relative h-full w-full">
      {hydrated ? <SiteCanvas /> : null}
      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute bottom-3 left-3 top-3 z-10 w-[290px] overflow-hidden rounded-lg border border-line bg-navy-900/92 shadow-xl backdrop-blur" style={mode === "site" ? undefined : { width: 330 }}>
          {mode === "site" ? <LayersPanel /> : <ToursPanel />}
        </div>
        <ViewToolbar />
        {selection.length === 1 ? (
          <div className="pointer-events-auto absolute bottom-3 right-3 top-14 z-10 w-[360px] overflow-hidden rounded-lg border border-line bg-navy-900/94 shadow-xl backdrop-blur">
            <StructureInspector id={selection[0]} onClose={() => select([])} />
          </div>
        ) : null}
        {selection.length > 1 ? (
          <div className="pointer-events-auto absolute right-3 top-14 z-10 w-[300px] rounded-lg border border-line bg-navy-900/94 p-3 text-[12.5px] shadow-xl backdrop-blur">
            <div className="font-display text-[14px] text-gold-soft">{selection.length} structures selected</div>
            <button className="btn mt-2" onClick={() => select([])}>Clear selection</button>
          </div>
        ) : null}
        {mode === "tours" ? <PlaybackBar /> : <Legend />}
      </div>
    </div>
  );
}
