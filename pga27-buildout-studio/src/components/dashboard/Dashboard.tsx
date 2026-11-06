"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SOURCE_INFO, sharedAnchorCount } from "@/lib/baseline";
import { BASE_ITEMS, BOM_META, computeBom, summarizeBom } from "@/lib/bom";
import { fmtNum, m2ToFt2, round } from "@/lib/geo";
import { LAYERS } from "@/lib/layers";
import { isPlaced } from "@/lib/scene";
import { DATA_GAPS, DIMENSION_CONFLICTS, NUMBERING_CONFLICTS, VENUE } from "@/data/conflicts";
import { useEffectiveScene, useStudio } from "@/store/studio";
import { Lightbox, SectionTitle, Stat } from "../ui";

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function Bars({ rows, unit = "", color }: { rows: { label: string; value: number; color?: string; sub?: string }[]; unit?: string; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[170px_1fr_auto] items-center gap-2 text-[12px]">
          <div className="truncate text-[#c3d1e4]" title={r.label}>{r.label}</div>
          <div className="h-3.5 overflow-hidden rounded bg-navy-800">
            <div className="h-full rounded" style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? color ?? "var(--color-gold)" }} />
          </div>
          <div className="w-[90px] text-right tabular-nums text-muted">{fmtNum(r.value, 0)}{unit} {r.sub ? <span className="text-[10.5px]">{r.sub}</span> : null}</div>
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const scene = useEffectiveScene();
  const selectStore = useStudio((s) => s.select);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [showAllConflicts, setShowAllConflicts] = useState(false);

  const stats = useMemo(() => {
    const scheduled = scene.structures.filter((s) => /^s-/.test(s.id));
    const areas = scene.structures.filter((s) => /^area-/.test(s.id));
    const added = scene.structures.filter((s) => s.custom);
    const placed = scene.structures.filter(isPlaced);
    const footprint = (list: typeof scene.structures) => list.reduce((t, s) => t + (s.w != null && s.l != null ? s.w * s.l : 0), 0);
    const byType = new Map<string, number>();
    for (const s of scene.structures) byType.set(s.type, (byType.get(s.type) ?? 0) + 1);
    const byLayer = LAYERS.map((l) => {
      const list = scene.structures.filter((s) => s.layer === l.id);
      return { id: l.id, label: l.label, color: l.color, count: list.length, footprint: footprint(list.filter((s) => /^s-|^u-/.test(s.id))) };
    }).filter((l) => l.count);
    const twoLevel = scene.structures.filter((s) => (s.levels ?? 0) >= 2);
    const seats = areas.reduce((t, s) => t + (SOURCE_INFO[s.id]?.seats ?? 0), 0);
    const unknownDims = scene.structures.filter((s) => s.w == null || s.l == null).length;
    return { scheduled, areas, added, placed, schedFootprint: footprint(scheduled), allFootprint: footprint(scene.structures), byType: Array.from(byType.entries()).sort((a, b) => b[1] - a[1]), byLayer, twoLevel, seats, unknownDims };
  }, [scene]);

  const bom = useMemo(() => computeBom(scene), [scene]);
  const bomSum = useMemo(() => summarizeBom(bom), [bom]);
  const byCategory = useMemo(() => {
    const m = new Map<string, { lines: number; qty: number }>();
    for (const l of BASE_ITEMS) {
      const k = l.category ?? "UNCATEGORIZED";
      const e = m.get(k) ?? { lines: 0, qty: 0 };
      e.lines += 1;
      e.qty += l.qty ?? 0;
      m.set(k, e);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].lines - a[1].lines);
  }, []);

  const revisionNotes = useMemo(
    () => Object.values(SOURCE_INFO).filter((i) => i.revision).map((i) => ({ id: i.id, note: i.revision as string, name: scene.structures.find((s) => s.id === i.id)?.name ?? i.id })),
    [scene],
  );
  const zoneMismatch = useMemo(() => Object.values(SOURCE_INFO).filter((i) => i.zone && i.sheet && i.zone !== i.sheet).length, []);
  const days = daysUntil("2027-05-17T00:00:00-05:00");

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-[1320px] space-y-6 px-6 py-6">
        <section className="relative overflow-hidden rounded-xl border border-line bg-[radial-gradient(1200px_300px_at_85%_-20%,rgba(201,162,74,0.22),transparent),linear-gradient(135deg,#0c2142,#07142a)] p-6">
          <div className="gold-rule absolute left-0 top-0 w-full" />
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="label text-gold">Buildout dashboard · Kevin Scott</div>
              <h1 className="font-display mt-1 text-[34px] font-semibold leading-tight text-ink">2027 PGA Championship</h1>
              <div className="font-display text-[19px] text-gold-soft">{VENUE.name} · {VENUE.city}</div>
              <div className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-[#b7c7dc]">
                Event week {VENUE.eventWeek}; championship rounds {VENUE.championshipRounds} ({VENUE.timezone}). This Studio turns the Sep 15, 2026 master plan, the v2.3 overlay drawings and the v2.2 materials schedule into a 3D site, CAD plan and live BOM you can edit, compare as scenarios and drive with an AI assistant.
              </div>
            </div>
            <div className="flex gap-3">
              <div className="panel px-5 py-3 text-center">
                <div className="font-display text-[34px] font-semibold leading-none text-gold-soft">{days > 0 ? days : 0}</div>
                <div className="label mt-1">days to event week</div>
              </div>
              <div className="panel px-5 py-3 text-center">
                <div className="font-display text-[34px] font-semibold leading-none text-ink">4</div>
                <div className="label mt-1">championship rounds</div>
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/site" className="btn btn-gold">Open 3D site</Link>
            <Link href="/flythrough" className="btn">Flythroughs</Link>
            <Link href="/plan" className="btn">CAD plan</Link>
            <Link href="/bom" className="btn">Bill of materials</Link>
            <Link href="/scenarios" className="btn">Scenarios</Link>
          </div>
        </section>

        <section className="grid grid-cols-6 gap-3">
          <Stat label="Scheduled structures" value={stats.scheduled.length} sub={`${stats.scheduled.filter((s) => s.type === "A-Frame").length} A-frame + ${stats.scheduled.filter((s) => s.type === "Frame tent").length} frame-tent instances`} accent />
          <Stat label="Supplemental areas" value={stats.areas.length} sub="current-plan records; not extra procurement" />
          <Stat label="On the master plan" value={stats.placed.length} sub={`${scene.structures.length - stats.placed.length} unplaced (no position in source) · ${sharedAnchorCount()} packed around shared anchors`} />
          <Stat label="BOM item lines" value={bomSum.lineCount} sub={`${BASE_ITEMS.length} v2.2 item rows of ${BOM_META.physicalRows} physical rows (20 subtotal rows excluded)`} />
          <Stat label="Nominal footprint" value={<>{fmtNum(m2ToFt2(stats.schedFootprint), 0)}<span className="text-[14px] text-muted"> ft²</span></>} sub={`${fmtNum(stats.schedFootprint, 0)} m² · scheduled tents/structures, rectangular nominal`} />
          <Stat label="Two-level structures" value={stats.twoLevel.length} sub={`${stats.seats ? `${fmtNum(stats.seats, 0)} grandstand seats on plan labels (not additive)` : ""}`} />
        </section>

        <section className="grid grid-cols-[1.1fr_1fr] gap-4">
          <div className="panel p-4">
            <SectionTitle right={<span className="text-[11px] text-muted">{scene.structures.length} records · current scene{stats.added.length ? ` · ${stats.added.length} added` : ""}</span>}>Structures by type (layer)</SectionTitle>
            <Bars rows={stats.byLayer.map((l) => ({ label: l.label, value: l.count, color: l.color, sub: l.footprint ? `${fmtNum(l.footprint, 0)} m²` : "" }))} />
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
              {stats.byType.map(([t, n]) => (
                <span key={t} className="chip">{t}: <b className="text-ink">{n}</b></span>
              ))}
            </div>
            <div className="mt-2 text-[11.5px] text-muted">
              {stats.unknownDims} records have unknown dimensions (shown with symbolic shapes in 3D, never given invented footprints). Footprints are nominal width × length, not surveyed polygons.
            </div>
          </div>
          <div className="panel p-4">
            <SectionTitle right={<Link href="/bom" className="text-[12px] text-gold hover:underline">Open BOM →</Link>}>BOM line items by category</SectionTitle>
            <Bars color="#4a93ff" rows={byCategory.map(([k, v]) => ({ label: k, value: v.lines, sub: "lines" }))} />
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center text-[12px]">
              <div><div className="font-display text-[19px] text-ink">{fmtNum(bomSum.totals.each, 0)}</div><div className="text-muted">each</div></div>
              <div><div className="font-display text-[19px] text-ink">{fmtNum(bomSum.totals.linear_ft, 0)}</div><div className="text-muted">linear ft</div></div>
              <div><div className="font-display text-[19px] text-ink">{fmtNum(bomSum.totals.sq_ft, 0)}</div><div className="text-muted">square ft</div></div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-[1fr_1.35fr] gap-4">
          <div className="panel space-y-3 p-4">
            <SectionTitle>Venue &amp; sources</SectionTitle>
            <div className="grid grid-cols-[110px_1fr] gap-y-1.5 text-[12.5px]">
              <div className="text-muted">Venue</div><div>{VENUE.name}<div className="text-[11.5px] text-muted">{VENUE.resort}</div></div>
              <div className="text-muted">Location</div><div>{VENUE.city}</div>
              <div className="text-muted">Event week</div><div>{VENUE.eventWeek}</div>
              <div className="text-muted">Championship</div><div>{VENUE.championshipRounds}</div>
              <div className="text-muted">Roads</div><div className="text-[11.5px]">{VENUE.roads.join(" · ")}</div>
              <div className="text-muted">Scale</div><div className="text-[11.5px]">1 px = {round(0.3048 * 1000 / 371, 3)} m (0–1000 ft bar = 371 px) · north up · not georeferenced</div>
              <div className="text-muted">Install / strike</div><div className="text-warn">unknown · not supplied</div>
            </div>
            <div className="border-t border-line pt-3">
              <div className="label mb-1.5">Source package</div>
              {VENUE.sources.map((s) => (
                <div key={s.label} className="flex justify-between gap-3 border-b border-line/50 py-1 text-[12px] last:border-0">
                  <span className="text-[#c3d1e4]">{s.label}</span>
                  <span className="text-right text-muted">{s.detail}</span>
                </div>
              ))}
            </div>
            <button className="block w-full overflow-hidden rounded border border-line hover:border-gold" onClick={() => setLightbox("/images/master-plan.jpg")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/master-plan.jpg" alt="2027 PGA Championship master plan" className="h-40 w-full object-cover" />
              <div className="bg-navy-850 px-2 py-1 text-left text-[11px] text-muted">Master plan · 4000 × 3112 px · click to open</div>
            </button>
          </div>

          <div id="caveats" className="panel space-y-3 p-4">
            <SectionTitle right={<span className="chip border-warn/50 text-warn">{DIMENSION_CONFLICTS.length} dimension conflicts · {zoneMismatch} zone/sheet mismatches</span>}>Data conflicts &amp; caveats</SectionTitle>
            <div className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-[12px] leading-relaxed text-[#f6dca8]">
              {NUMBERING_CONFLICTS.map((t) => (
                <div key={t} className="mb-1 last:mb-0">• {t}</div>
              ))}
            </div>
            <div className="overflow-hidden rounded-lg border border-line">
              <table className="tbl">
                <thead>
                  <tr><th>Facility</th><th>Workbook v2.2 / older</th><th>Current drawing</th><th>Sheet</th></tr>
                </thead>
                <tbody>
                  {(showAllConflicts ? DIMENSION_CONFLICTS : DIMENSION_CONFLICTS.slice(0, 6)).map((c) => (
                    <tr key={c.facility}>
                      <td className="font-medium text-ink">
                        {c.structureIds?.[0] ? (
                          <Link href="/site" className="hover:text-gold-soft" onClick={() => selectStore([c.structureIds![0]])}>{c.facility}</Link>
                        ) : c.facility}
                        {c.note ? <div className="mt-0.5 text-[10.5px] font-normal leading-snug text-muted">{c.note}</div> : null}
                      </td>
                      <td className="text-muted">{c.workbook}</td>
                      <td className="text-gold-soft">{c.current}</td>
                      <td className="text-[11.5px] text-muted">{c.sheet}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="w-full border-t border-line bg-navy-850 py-1.5 text-[12px] text-gold hover:underline" onClick={() => setShowAllConflicts((v) => !v)}>
                {showAllConflicts ? "Show fewer" : `Show all ${DIMENSION_CONFLICTS.length}`}
              </button>
            </div>
            <div>
              <div className="label mb-1">Known gaps (shown as unknown, never invented)</div>
              <ul className="list-disc space-y-0.5 pl-5 text-[12px] leading-snug text-muted">
                {DATA_GAPS.map((g) => <li key={g}>{g}</li>)}
              </ul>
            </div>
            <div className="text-[11.5px] text-muted">{revisionNotes.length} structure records carry a revision note ({revisionNotes.slice(0, 4).map((r) => r.name).join(", ")}…). Open any structure in the 3D view to see it with its source sheet.</div>
          </div>
        </section>
      </div>
      {lightbox ? <Lightbox src={lightbox} title="Master plan" onClose={() => setLightbox(null)} /> : null}
    </div>
  );
}
