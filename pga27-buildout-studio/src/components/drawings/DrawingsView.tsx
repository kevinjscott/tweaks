"use client";

import { useMemo, useState } from "react";
import { DRAWINGS } from "@/data/drawings";
import { Lightbox } from "../ui";

export function DrawingsView() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "overlay" | "concept" | "master">("all");
  const [open, setOpen] = useState<{ src: string; title: string } | null>(null);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return DRAWINGS.filter((d) => (kind === "all" || d.kind === kind) && (!t || `${d.title} ${d.file} ${d.page ?? ""}`.toLowerCase().includes(t)));
  }, [q, kind]);
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-[1320px] px-6 py-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[24px] font-semibold text-ink">Source drawings</h1>
            <div className="text-[12.5px] text-muted">Master plan, Overlay Docs v2.3 sheets and 2024 concept drawings from the source package ({DRAWINGS.length} images). Sheet numbers are the v2.3 PDF page; workbook v2.2 zone codes do not match them.</div>
          </div>
          <div className="flex gap-2">
            <input className="input w-64" placeholder="Search sheets (e.g. 16, media, restroom)…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input w-40" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="all">All</option>
              <option value="master">Master plan</option>
              <option value="overlay">Overlay v2.3</option>
              <option value="concept">2024 concepts</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {list.map((d) => (
            <button key={d.file} className="panel group overflow-hidden text-left transition-colors hover:border-gold" onClick={() => setOpen({ src: `/images/${d.file}`, title: d.title })}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/images/${d.file}`} alt={d.title} loading="lazy" className="h-40 w-full bg-white object-cover object-top" />
              <div className="p-2.5">
                <div className="flex items-center gap-2">
                  <span className={`chip ${d.kind === "concept" ? "border-warn/40 text-warn" : d.kind === "master" ? "border-gold/50 text-gold-soft" : ""}`}>{d.page ? `p${d.page}` : d.kind}</span>
                  <span className="truncate text-[10.5px] text-[#5f7896]">{d.file}</span>
                </div>
                <div className="mt-1 line-clamp-2 text-[12px] leading-snug text-[#c3d1e4]">{d.title}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
      {open ? <Lightbox src={open.src} title={open.title} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
