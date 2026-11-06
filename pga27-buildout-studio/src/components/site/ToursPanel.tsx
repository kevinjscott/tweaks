"use client";

import { useMemo, useState } from "react";
import { round } from "@/lib/geo";
import { recordingSupported, recordTour } from "@/lib/recording";
import { nextId } from "@/lib/scene";
import { allTours, kfId, tourDuration } from "@/lib/tours";
import { getCameraPose } from "@/lib/viewport";
import type { Tour } from "@/lib/types";
import { useEffectiveScene, useStudio } from "@/store/studio";
import { download } from "../ui";

function fmtTime(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

export function ToursPanel() {
  const scene = useEffectiveScene();
  const committed = useStudio((s) => s.scene);
  const proposal = useStudio((s) => s.proposal);
  const playback = useStudio((s) => s.playback);
  const setPlayback = useStudio((s) => s.setPlayback);
  const playTour = useStudio((s) => s.playTour);
  const saveTour = useStudio((s) => s.saveTour);
  const deleteTour = useStudio((s) => s.deleteTour);
  const flyTo = useStudio((s) => s.flyTo);
  const notify = useStudio((s) => s.notify);
  const selection = useStudio((s) => s.selection);
  const tours = useMemo(() => allTours(scene), [scene]);
  const [name, setName] = useState("");

  const selected = tours.find((t) => t.id === playback.tourId) ?? null;
  const editable = !!selected && !selected.preset && !proposal && committed.tours.some((t) => t.id === selected.id);

  const pick = (t: Tour) => {
    setPlayback({ tourId: t.id, state: "paused", t: 0, seek: { id: Date.now(), t: 0 } });
    const k = t.keyframes[0];
    if (k) flyTo({ pos: k.pos, target: k.target }, 1.2, "perspective");
  };

  const camKeyframe = (label?: string, seconds = 5) => {
    const pose = getCameraPose();
    if (!pose) {
      notify("error", "3D viewport not ready.");
      return null;
    }
    return { id: kfId(), label, pos: pose.pos, target: pose.target, seconds };
  };

  const create = () => {
    const kf = camKeyframe("Start", 0);
    if (!kf) return;
    const t: Tour = { id: nextId("tour", committed.tours.map((x) => x.id)), name: name.trim() || `My tour ${committed.tours.length + 1}`, keyframes: [kf] };
    saveTour(t);
    setName("");
    setPlayback({ tourId: t.id, state: "paused", t: 0 });
  };

  const duplicate = (t: Tour) => {
    const copy: Tour = { ...t, preset: false, id: nextId("tour", committed.tours.map((x) => x.id)), name: `${t.name} (copy)`, keyframes: t.keyframes.map((k) => ({ ...k, id: kfId() })) };
    saveTour(copy);
    setPlayback({ tourId: copy.id, state: "paused", t: 0 });
  };

  const update = (t: Tour, patch: Partial<Tour>) => saveTour({ ...t, ...patch });

  const selectedStructures = scene.structures.filter((s) => selection.includes(s.id));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-3 py-2">
        <div className="font-display text-[14px] font-semibold text-gold-soft">Flythroughs</div>
        <div className="text-[11px] text-muted">Preset tours follow the current positions in the scene. Author your own with camera keyframes.</div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <div className="space-y-1.5">
          {tours.map((t) => {
            const on = playback.tourId === t.id;
            const isProposed = proposal && !committed.tours.some((x) => x.id === t.id) && !t.preset;
            return (
              <div key={t.id} className={`rounded-lg border px-2.5 py-2 ${on ? "border-gold bg-gold/10" : "border-line bg-navy-850"}`}>
                <div className="flex items-center gap-2">
                  <button className="min-w-0 flex-1 text-left" onClick={() => pick(t)}>
                    <div className="truncate text-[12.5px] font-semibold text-ink">{t.name}</div>
                    <div className="text-[11px] text-muted">
                      {t.keyframes.length} keyframes · {fmtTime(tourDuration(t))} {t.preset ? "· preset" : isProposed ? "· proposed" : "· yours"}
                    </div>
                  </button>
                  <button className="btn btn-gold px-2.5" onClick={() => playTour(t.id)} title="Play from start">▶</button>
                </div>
                {t.description ? <div className="mt-1 text-[11px] leading-snug text-muted">{t.description}</div> : null}
              </div>
            );
          })}
        </div>

        <div className="mt-3 rounded-lg border border-line bg-navy-850 p-2.5">
          <div className="label mb-1.5">Author a new tour</div>
          <div className="flex gap-1.5">
            <input className="input" placeholder="Tour name" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-gold" onClick={create} disabled={!!proposal}>Create</button>
          </div>
          <div className="mt-1 text-[11px] text-muted">Starts with a keyframe at your current camera. Orbit to a new view, then add keyframes.</div>
          {selectedStructures.length >= 2 ? (
            <button
              className="btn mt-2 w-full"
              disabled={!!proposal}
              onClick={() => {
                const pts = selectedStructures.filter((s) => s.x != null && s.y != null);
                import("@/lib/tours").then(({ waypointsToKeyframes }) => {
                  const kfs = waypointsToKeyframes(pts.map((s) => ({ point: { x: s.x as number, y: s.y as number }, size: Math.max(s.w ?? 20, s.l ?? 20), label: s.name })));
                  saveTour({ id: nextId("tour", committed.tours.map((x) => x.id)), name: `Tour of ${pts.length} selected`, keyframes: kfs });
                });
              }}
            >
              Tour through {selectedStructures.length} selected structures
            </button>
          ) : null}
        </div>

        {selected ? (
          <div className="mt-3 rounded-lg border border-line bg-navy-850 p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="label">Keyframes · {selected.name}</div>
              {selected.preset || !editable ? (
                <button className="btn px-2 py-0.5 text-[11px]" onClick={() => duplicate(selected)} disabled={!!proposal}>Duplicate to edit</button>
              ) : (
                <button className="btn btn-danger px-2 py-0.5 text-[11px]" onClick={() => deleteTour(selected.id)}>Delete tour</button>
              )}
            </div>
            {editable ? (
              <input className="input mb-2" value={selected.name} onChange={(e) => update(selected, { name: e.target.value })} />
            ) : null}
            <div className="space-y-1">
              {selected.keyframes.map((k, i) => (
                <div key={k.id} className="flex items-center gap-1.5 rounded border border-line/70 bg-navy-900 px-1.5 py-1 text-[11.5px]">
                  <span className="w-4 text-center text-muted">{i + 1}</span>
                  <button className="min-w-0 flex-1 truncate text-left hover:text-gold-soft" onClick={() => flyTo({ pos: k.pos, target: k.target }, 1, "perspective")} title="Go to this keyframe">
                    {k.label ?? `(${round(k.pos.x, 0)}, ${round(k.pos.y, 0)}) @ ${round(k.pos.z, 0)} m`}
                  </button>
                  {i > 0 ? (
                    <input
                      type="number"
                      className="input w-14 px-1 py-0.5 text-right"
                      min={0.5}
                      step={0.5}
                      value={k.seconds}
                      disabled={!editable}
                      onChange={(e) => update(selected, { keyframes: selected.keyframes.map((x) => (x.id === k.id ? { ...x, seconds: Math.max(0.5, parseFloat(e.target.value) || 1) } : x)) })}
                      title="Seconds from previous keyframe"
                    />
                  ) : (
                    <span className="w-14 text-right text-muted">start</span>
                  )}
                  {editable ? (
                    <>
                      <button
                        className="btn btn-ghost px-1 py-0 text-[11px]"
                        title="Set this keyframe to the current camera"
                        onClick={() => {
                          const kf = camKeyframe(k.label, k.seconds);
                          if (kf) update(selected, { keyframes: selected.keyframes.map((x) => (x.id === k.id ? { ...kf, id: k.id } : x)) });
                        }}
                      >
                        ⌖
                      </button>
                      <button className="btn btn-ghost px-1 py-0 text-[11px]" disabled={selected.keyframes.length <= 1} onClick={() => update(selected, { keyframes: selected.keyframes.filter((x) => x.id !== k.id) })}>✕</button>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
            {editable ? (
              <button
                className="btn mt-2 w-full"
                onClick={() => {
                  const kf = camKeyframe(undefined, 5);
                  if (kf) update(selected, { keyframes: [...selected.keyframes, kf] });
                }}
              >
                + Add keyframe at current camera
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PlaybackBar() {
  const scene = useEffectiveScene();
  const playback = useStudio((s) => s.playback);
  const setPlayback = useStudio((s) => s.setPlayback);
  const notify = useStudio((s) => s.notify);
  const tours = useMemo(() => allTours(scene), [scene]);
  const tour = tours.find((t) => t.id === playback.tourId) ?? null;
  const dur = tour ? tourDuration(tour) : 0;
  const [exporting, setExporting] = useState(false);
  const playing = playback.state === "playing";

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-10 w-[min(720px,60%)] -translate-x-1/2 rounded-lg border border-line bg-navy-900/92 px-3 py-2 shadow-xl backdrop-blur" style={{ marginLeft: 150 }}>
      {tour ? (
        <>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-gold w-16"
              onClick={() => {
                if (playing) setPlayback({ state: "paused" });
                else if (playback.t >= dur - 0.05) setPlayback({ state: "playing", t: 0, seek: { id: Date.now(), t: 0 } });
                else setPlayback({ state: "playing" });
              }}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button className="btn" onClick={() => setPlayback({ state: "paused", t: 0, seek: { id: Date.now(), t: 0 } })}>Stop</button>
            <div className="min-w-0 flex-1 px-1">
              <input
                type="range"
                className="w-full"
                min={0}
                max={Math.max(0.1, dur)}
                step={0.05}
                value={Math.min(playback.t, dur)}
                onChange={(e) => setPlayback({ t: parseFloat(e.target.value), seek: { id: Date.now(), t: parseFloat(e.target.value) } })}
              />
            </div>
            <span className="w-24 text-right font-mono text-[11.5px] text-muted">{fmtTime(playback.t)} / {fmtTime(dur)}</span>
            <select className="input w-[68px] px-1" value={playback.speed} onChange={(e) => setPlayback({ speed: parseFloat(e.target.value) })}>
              {[0.5, 1, 1.5, 2, 4].map((v) => (
                <option key={v} value={v}>{v}×</option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-[11.5px] text-muted">
              <input type="checkbox" checked={playback.loop} onChange={(e) => setPlayback({ loop: e.target.checked })} />
              loop
            </label>
            <button
              className="btn"
              disabled={!recordingSupported() || exporting}
              title={recordingSupported() ? "Record the tour from the start to a WebM video" : "MediaRecorder not supported in this browser"}
              onClick={async () => {
                try {
                  setExporting(true);
                  notify("info", `Recording “${tour.name}” (${Math.round(dur)} s)…`);
                  const blob = await recordTour(tour.id);
                  download(`pga27-${tour.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.webm`, blob, "video/webm");
                  notify("success", `Exported ${(blob.size / 1e6).toFixed(1)} MB WebM.`);
                } catch (e) {
                  notify("error", (e as Error).message);
                } finally {
                  setExporting(false);
                }
              }}
            >
              {exporting ? <><span className="pulse h-2 w-2 rounded-full bg-bad" />Recording…</> : "Export WebM"}
            </button>
          </div>
          <div className="mt-1 text-[11px] text-muted">{tour.name}: during playback the viewport follows the keyframe path. Exports capture the live 3D canvas at its current size.</div>
        </>
      ) : (
        <div className="text-center text-[12.5px] text-muted">Select a flythrough on the left, or press ▶ on a preset.</div>
      )}
    </div>
  );
}
