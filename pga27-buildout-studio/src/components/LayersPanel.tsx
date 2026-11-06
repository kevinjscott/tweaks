"use client";

import { useMemo, useState } from "react";
import { LAYERS } from "@/lib/layers";
import { isPlaced } from "@/lib/scene";
import { frameStructure } from "@/lib/tours";
import { getCameraPose } from "@/lib/viewport";
import { round } from "@/lib/geo";
import type { Structure } from "@/lib/types";
import { useEffectiveScene, useStudio } from "@/store/studio";

export function LayersPanel({ onPick, placeAt }: { onPick?: (s: Structure) => void; placeAt?: () => { x: number; y: number } | null }) {
  const scene = useEffectiveScene();
  const layerVisible = useStudio((s) => s.layerVisible);
  const toggleLayer = useStudio((s) => s.toggleLayer);
  const setAllLayers = useStudio((s) => s.setAllLayers);
  const select = useStudio((s) => s.select);
  const flyTo = useStudio((s) => s.flyTo);
  const selection = useStudio((s) => s.selection);
  const [q, setQ] = useState("");
  const commit = useStudio((s) => s.commit);
  const committed = useStudio((s) => s.scene);
  const proposal = useStudio((s) => s.proposal);
  const notify = useStudio((s) => s.notify);
  const place = (s: Structure) => {
    if (proposal) return notify("info", "Accept or reject the pending AI proposal first.");
    const at = placeAt ? placeAt() : (() => { const p = getCameraPose(); return p ? { x: p.target.x, y: p.target.y } : null; })();
    if (!at) return notify("error", "No view available to place at.");
    commit(`Place ${s.name} (manual, no source position)`, {
      ...committed,
      structures: committed.structures.map((x) => (x.id === s.id ? { ...x, x: round(at.x, 1), y: round(at.y, 1), note: "Placed manually: the source gives no position for this record." } : x)),
    });
    select([s.id]);
  };
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of scene.structures) c[s.layer] = (c[s.layer] ?? 0) + 1;
    return c;
  }, [scene]);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = scene.structures.filter((s) => !t || s.name.toLowerCase().includes(t) || s.id.toLowerCase().includes(t) || s.type.toLowerCase().includes(t));
    return list.slice(0, 60);
  }, [scene, q]);
  const unplaced = scene.structures.filter((s) => !isPlaced(s));
  const placedCount = scene.structures.length - unplaced.length;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-3 py-2">
        <div className="font-display text-[14px] font-semibold text-gold-soft">Layers by structure type</div>
        <div className="mt-0.5 text-[11px] text-muted">
          {placedCount} placed · {unplaced.length} unplaced · {scene.structures.length} total
        </div>
      </div>
      <div className="max-h-[300px] overflow-auto border-b border-line px-2 py-1.5">
        <div className="mb-1 flex gap-1 px-1">
          <button className="btn px-2 py-0.5 text-[11px]" onClick={() => setAllLayers(true)}>All</button>
          <button className="btn px-2 py-0.5 text-[11px]" onClick={() => setAllLayers(false)}>None</button>
        </div>
        {LAYERS.map((l) => (
          <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-navy-800" title={l.description}>
            <input type="checkbox" checked={layerVisible[l.id]} onChange={() => toggleLayer(l.id)} />
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
            <span className="flex-1 truncate text-[12px]">{l.label}</span>
            <span className="text-[11px] text-muted">{counts[l.id] ?? 0}</span>
          </label>
        ))}
      </div>
      <div className="px-3 pt-2">
        <input className="input" placeholder="Find structure… (name, id, type)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 py-1.5">
        {results.map((s) => {
          const layer = LAYERS.find((l) => l.id === s.layer)!;
          return (
            <button
              key={s.id}
              className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-navy-800 ${selection.includes(s.id) ? "bg-gold/10" : ""}`}
              onClick={() => {
                select([s.id]);
                if (onPick) return onPick(s);
                const p = frameStructure(s);
                if (p) flyTo(p, 1.4, "perspective");
              }}
            >
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: layer.color }} />
              <span className="min-w-0 flex-1 truncate text-[12px]">{s.name}</span>
              {!isPlaced(s) ? (
                <span
                  role="button"
                  className="chip cursor-pointer border-warn/50 text-warn hover:bg-warn/15"
                  title="No position in the source. Place it at the centre of the current view."
                  onClick={(e) => {
                    e.stopPropagation();
                    place(s);
                  }}
                >
                  place…
                </span>
              ) : <span className="text-[10.5px] text-muted">{s.w != null && s.l != null ? `${Math.round(s.w)}×${Math.round(s.l)}` : "dims?"}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

