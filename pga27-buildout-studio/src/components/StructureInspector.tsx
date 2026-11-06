"use client";

import { useMemo, useState } from "react";
import { BASE_ITEM_BY_ID, computeBom } from "@/lib/bom";
import { SOURCE_INFO } from "@/lib/baseline";
import { fmtNum, MASTER_W, M_PER_PX, planToPx, round } from "@/lib/geo";
import { LAYERS, LAYER_BY_ID, renderKind, visualDims } from "@/lib/layers";
import { isPlaced, nextStructureId } from "@/lib/scene";
import { frameStructure } from "@/lib/tours";
import type { LayerId, Structure } from "@/lib/types";
import { useEffectiveScene, useStudio } from "@/store/studio";
import { Lightbox } from "./ui";

function NumField({ label, value, unit, onCommit, step = 0.1, min }: { label: string; value: number | null; unit?: string; onCommit: (v: number | null) => void; step?: number; min?: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value == null ? "" : String(round(value, 3)));
  const commit = () => {
    if (draft == null) return;
    const t = draft.trim();
    setDraft(null);
    if (t === "") return onCommit(null);
    const n = parseFloat(t);
    if (!Number.isNaN(n)) onCommit(min != null ? Math.max(min, n) : n);
  };
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="relative mt-0.5">
        <input
          className="input pr-7"
          type="number"
          step={step}
          value={shown}
          placeholder="unknown"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        {unit ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10.5px] text-muted">{unit}</span> : null}
      </div>
    </label>
  );
}

export function StructureInspector({ id, onClose, compact }: { id: string; onClose?: () => void; compact?: boolean }) {
  const scene = useEffectiveScene();
  const s = scene.structures.find((x) => x.id === id);
  const info = SOURCE_INFO[id];
  const commit = useStudio((st) => st.commit);
  const committed = useStudio((st) => st.scene);
  const select = useStudio((st) => st.select);
  const flyTo = useStudio((st) => st.flyTo);
  const proposal = useStudio((st) => st.proposal);
  const [lightbox, setLightbox] = useState(false);
  const [showZone, setShowZone] = useState(false);
  const bom = useMemo(() => computeBom(scene), [scene]);
  const linked = useMemo(() => bom.lines.filter((l) => l.structureIds.includes(id)), [bom, id]);

  if (!s) return null;
  const locked = !!proposal;
  const layer = LAYER_BY_ID[s.layer];
  const rk = renderKind(s);
  const vd = visualDims(s);

  const patch = (label: string, p: Partial<Structure>) => {
    if (locked) return;
    commit(`${label} · ${s.name}`, { ...committed, structures: committed.structures.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  };

  const zoneItems = (info?.zoneBomIds ?? []).map((i) => BASE_ITEM_BY_ID.get(i)).filter(Boolean);
  const mismatch = info && info.zone && info.sheet && info.zone !== info.sheet;
  const dimsChanged = info && (info.origW !== s.w || info.origL !== s.l || info.origH !== s.h);
  const px = isPlaced(s) ? planToPx(s.x, s.y) : null;

  return (
    <div className="flex h-full flex-col text-[12.5px]">
      <div className="flex items-start gap-2 border-b border-line px-3 py-2.5">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ background: layer.color }} />
        <div className="min-w-0 flex-1">
          <div className="font-display truncate text-[15px] font-semibold text-ink">{s.name}</div>
          <div className="flex flex-wrap gap-1 pt-1">
            <span className="chip">{s.id}</span>
            <span className="chip">{layer.label}</span>
            <span className="chip">{s.type}</span>
            {s.custom ? <span className="chip border-ok/40 text-ok">added in studio</span> : null}
            {rk.symbolic ? <span className="chip border-warn/40 text-warn">symbolic shape · dimensions unknown</span> : null}
          </div>
        </div>
        {onClose ? <button className="btn btn-ghost px-2" onClick={onClose}>✕</button> : null}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        {locked ? <div className="rounded border border-gold/40 bg-gold/10 px-2 py-1.5 text-[11.5px] text-gold-soft">An AI proposal is pending. Accept or reject it before editing by hand.</div> : null}

        <div className="flex flex-wrap gap-1.5">
          <button
            className="btn"
            disabled={!isPlaced(s)}
            onClick={() => {
              const p = frameStructure(s);
              if (p) flyTo(p, 1.6, "perspective");
            }}
          >
            Fly to
          </button>
          <button
            className="btn"
            disabled={locked}
            onClick={() => {
              const nid = nextStructureId(committed);
              const copy: Structure = { ...s, id: nid, name: `${s.name} (copy)`, x: s.x != null ? s.x + (s.w ?? 10) + 4 : null, custom: true, modelId: s.modelId };
              commit(`Duplicate ${s.name}`, { ...committed, structures: [...committed.structures, copy] });
              select([nid]);
            }}
          >
            Duplicate
          </button>
          <button
            className="btn btn-danger"
            disabled={locked}
            onClick={() => {
              commit(`Delete ${s.name}`, { ...committed, structures: committed.structures.filter((x) => x.id !== id) });
              select([]);
            }}
          >
            Delete
          </button>
        </div>

        <section>
          <div className="label mb-1">Geometry (metres · plan x east, y north)</div>
          <div className="grid grid-cols-2 gap-2">
            <NumField label="East (x)" value={s.x} unit="m" onCommit={(v) => patch("Move", { x: v })} />
            <NumField label="North (y)" value={s.y} unit="m" onCommit={(v) => patch("Move", { y: v })} />
            <NumField label="Width (E–W)" value={s.w} unit="m" min={0.1} onCommit={(v) => patch("Resize", { w: v })} />
            <NumField label="Length (N–S)" value={s.l} unit="m" min={0.1} onCommit={(v) => patch("Resize", { l: v })} />
            <NumField label="Height (nominal)" value={s.h} unit="m" min={0.1} onCommit={(v) => patch("Resize", { h: v })} />
            <NumField label="Levels" value={s.levels} step={1} min={1} onCommit={(v) => patch("Set levels", { levels: v == null ? null : Math.round(v) })} />
            <NumField label="Rotation (CCW)" value={s.rot} unit="°" step={5} onCommit={(v) => patch("Rotate", { rot: v ?? 0 })} />
            <label className="block">
              <span className="label">Layer</span>
              <select className="input mt-0.5" value={s.layer} onChange={(e) => patch("Change layer", { layer: e.target.value as LayerId })}>
                {LAYERS.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-2 space-y-0.5 text-[11.5px] text-muted">
            <div>
              Footprint: {s.w != null && s.l != null ? `${fmtNum(s.w * s.l, 1)} m² (${fmtNum((s.w * s.l) / 0.092903, 0)} ft²)` : "unknown"}
              {s.w != null && s.l != null && s.levels && s.levels > 1 ? ` · ${s.levels} levels` : ""}
            </div>
            {(vd.assumed.w || vd.assumed.l || vd.assumed.h) && isPlaced(s) ? (
              <div className="text-warn">
                Drawn with a visual placeholder for unknown {[vd.assumed.w && "width", vd.assumed.l && "length", vd.assumed.h && "height"].filter(Boolean).join(", ")}; the data stay unknown.
              </div>
            ) : null}
            <div>Rotation is unknown in the source; 0° is an assumption until set.</div>
            {dimsChanged ? <div className="text-warn">Differs from baseline ({fmtNum(info.origW, 2)} × {fmtNum(info.origL, 2)} × {fmtNum(info.origH, 2)} m).</div> : null}
          </div>
        </section>

        {info ? (
          <section className="space-y-1.5">
            <div className="label">Position confidence</div>
            {isPlaced(s) ? (
              <div className="rounded border border-line bg-navy-850 px-2.5 py-2 text-[11.5px] leading-snug text-muted">
                <div className="text-ink">Approximate · {info.posMethod.replace(/_/g, " ")}</div>
                {info.packed ? (
                  <div className="mt-1 text-warn">
                    Shares one labelled zone anchor with {info.packed.sharedWith - 1} other structure(s). Drawn at a display offset of ({info.packed.dx}, {info.packed.dy}) m from that anchor so they do not overlap. NOT a surveyed position.
                  </div>
                ) : (
                  <div className="mt-1">Anchor at master-plan px ({info.px}, {info.py}). Not a surveyed footprint centre.</div>
                )}
                {s.note ? <div className="mt-1 text-gold-soft">{s.note}</div> : null}
                {px ? <MasterCrop px={px.px} py={px.py} /> : null}
              </div>
            ) : (
              <div className="rounded border border-warn/40 bg-warn/10 px-2.5 py-2 text-[11.5px] text-warn">Unplaced: no position in the source. Enter East/North above to place it.</div>
            )}
          </section>
        ) : null}

        {info ? (
          <section className="space-y-1.5">
            <div className="label">Source &amp; revisions</div>
            <div className="rounded border border-line bg-navy-850 px-2.5 py-2 text-[11.5px] leading-snug text-muted">
              <div>
                Workbook v2.2 zone: <span className="text-ink">{info.zone ?? "—"}</span> · current v2.3 sheet: <span className="text-ink">{info.sheet ?? "—"}</span>
                {info.hole != null ? <> · hole <span className="text-ink">{info.hole}</span></> : null}
              </div>
              {mismatch ? <div className="mt-1 text-warn">Zone code and sheet number differ. Do not join the BOM by numeric code alone.</div> : null}
              <div className="mt-1">Dimensions: <span className="text-ink">{info.raw ?? "not given as metric text"}</span> · {info.dimSource ?? "—"}</div>
              {info.sched && (info.sched.w !== s.w || info.sched.l !== s.l) ? (
                <div className="mt-1 text-warn">
                  v2.2 workbook dims: {fmtNum(info.sched.w, 2)} × {fmtNum(info.sched.l, 2)} × {fmtNum(info.sched.h, 2)} m (superseded by the current drawing).
                </div>
              ) : null}
              {info.revision ? <div className="mt-1 text-gold-soft">Revision: {info.revision}</div> : null}
              {info.notes ? <div className="mt-1">{info.notes}</div> : null}
              {info.seats ? <div className="mt-1">Grandstand label: {info.seats} seats{info.rows ? ` · ${info.rows} rows` : ""} (label, not a procurement total). Depth/height unknown.</div> : null}
              {info.status ? <div className="mt-1 text-[#6f89a8]">{info.status}</div> : null}
            </div>
            {info.image ? (
              <button className="group block w-full overflow-hidden rounded border border-line text-left hover:border-gold" onClick={() => setLightbox(true)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/images/${info.image}`} alt={`Source sheet ${info.image}`} className="h-36 w-full bg-white object-cover object-top" loading="lazy" />
                <div className="flex items-center justify-between bg-navy-850 px-2 py-1 text-[11px] text-muted">
                  <span>Source sheet · {info.image}</span>
                  <span className="text-gold group-hover:underline">open full size</span>
                </div>
              </button>
            ) : (
              <div className="text-[11.5px] text-muted">No dedicated source sheet image is linked for this record.</div>
            )}
          </section>
        ) : null}

        <section>
          <div className="label mb-1">Linked BOM (direct, live)</div>
          {linked.length ? (
            <div className="space-y-1">
              {linked.map((l) => (
                <div key={l.id} className="rounded border border-line bg-navy-850 px-2.5 py-1.5 text-[11.5px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{l.item}</span>
                    <span className="text-gold-soft">{round(l.qty, 2)} {l.unit === "each" ? "ea" : l.unit}</span>
                  </div>
                  <div className="text-muted">{l.spec || "—"}</div>
                  <div className="text-[10.5px] text-[#6f89a8]">{l.id} · {l.category} · v2.2 qty {round(l.baseQty, 2)}{l.status !== "unchanged" ? ` · ${l.status}` : ""}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11.5px] text-muted">{info ? "No scheduled BOM line is linked to this record (area/supplemental record)." : "Added structure: see the BOM page (added lines are generated from its dimensions)."}</div>
          )}
          {zoneItems.length ? (
            <div className="mt-2">
              <button className="text-[11.5px] text-gold hover:underline" onClick={() => setShowZone((v) => !v)}>
                {showZone ? "Hide" : "Show"} {zoneItems.length} shared zone-level items (v2.2 zone {info?.zone})
              </button>
              <div className="mt-0.5 text-[10.5px] text-[#6f89a8]">Area-level quantities: not allocated to this structure and not added to totals twice.</div>
              {showZone ? (
                <div className="mt-1 max-h-40 overflow-auto rounded border border-line bg-navy-850 p-1.5 text-[11px]">
                  {zoneItems.map((i) => (
                    <div key={i!.id} className="flex justify-between gap-2 border-b border-line/40 py-0.5 last:border-0">
                      <span className="truncate text-[#c3d1e4]">{i!.item}</span>
                      <span className="shrink-0 text-muted">{i!.qty != null ? round(i!.qty, 1) : "—"} {i!.unit === "each" ? "ea" : i!.unit}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
        {!compact ? <div className="pb-2 text-[10.5px] text-[#58708f]">1 px on the master plan = {round(M_PER_PX, 3)} m (from the 0–1000 ft scale bar; image {MASTER_W}px wide).</div> : null}
      </div>
      {lightbox && info?.image ? <Lightbox src={`/images/${info.image}`} title={`${s.name} · ${info.image}`} onClose={() => setLightbox(false)} /> : null}
    </div>
  );
}

function MasterCrop({ px, py }: { px: number; py: number }) {
  const k = 0.55;
  const W = 280;
  const H = 120;
  return (
    <div className="relative mt-2 overflow-hidden rounded border border-line" style={{ width: W, height: H, backgroundImage: "url(/images/master-plan.jpg)", backgroundSize: `${MASTER_W * k}px auto`, backgroundPosition: `${W / 2 - px * k}px ${H / 2 - py * k}px`, backgroundRepeat: "no-repeat" }}>
      <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gold shadow-[0_0_0_2px_rgba(0,0,0,0.5)]" />
      <div className="absolute bottom-0.5 right-1 rounded bg-black/60 px-1 text-[9.5px] text-white">master plan crop (not to scale)</div>
    </div>
  );
}
