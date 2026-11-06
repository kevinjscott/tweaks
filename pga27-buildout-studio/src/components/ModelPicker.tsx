"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GatewayModel, ModelsPayload, RankedModel } from "@/lib/ai/models";

function Badge({ on, label, title }: { on: boolean | null; label: string; title: string }) {
  const cls = on === null ? "border-line text-muted" : on ? "border-ok/50 text-ok" : "border-bad/40 text-bad/80 line-through";
  return (
    <span title={title} className={`rounded border px-1 text-[10px] leading-4 ${cls}`}>
      {label}
    </span>
  );
}

function price(m: GatewayModel) {
  if (m.inPerM == null || m.outPerM == null) return "";
  const f = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(2).replace(/\.?0+$/, ""));
  return `$${f(m.inPerM)} / $${f(m.outPerM)} per 1M tok`;
}

export function ModelPicker({ payload, value, onChange }: { payload: ModelsPayload | null; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current: GatewayModel | undefined = useMemo(() => payload?.all.find((m) => m.id === value) ?? payload?.curated.find((m) => m.id === value), [payload, value]);
  const others = useMemo(() => {
    if (!payload || !q.trim()) return [];
    const t = q.toLowerCase();
    return payload.all.filter((m) => `${m.id} ${m.name}`.toLowerCase().includes(t)).slice(0, 12);
  }, [payload, q]);

  const row = (m: GatewayModel | RankedModel, rank?: number) => (
    <button
      key={m.id}
      onClick={() => {
        onChange(m.id);
        setOpen(false);
      }}
      className={`block w-full border-b border-line/60 px-3 py-2 text-left hover:bg-navy-700/60 ${m.id === value ? "bg-gold/10" : ""}`}
    >
      <div className="flex items-center gap-2">
        {rank ? <span className="font-display w-4 text-right text-[13px] font-bold text-gold">{rank}</span> : <span className="w-4" />}
        <span className="truncate text-[12.5px] font-semibold text-ink">{m.name}</span>
        <span className="truncate text-[10.5px] text-muted">{m.id}</span>
        <span className="ml-auto flex shrink-0 gap-1">
          <Badge on={m.vision} label="vision" title="Accepts image input (viewport screenshot)" />
          <Badge on={m.tools} label="tools" title="Native tool calling" />
          {m.reasoning ? <Badge on label="reason" title="Reasoning model" /> : null}
        </span>
      </div>
      {"note" in m ? <div className="mt-0.5 pl-6 text-[11px] leading-snug text-muted">{(m as RankedModel).note}</div> : null}
      <div className="pl-6 text-[10.5px] text-[#5f7896]">
        {price(m)} {m.contextWindow ? `· ${Math.round(m.contextWindow / 1000)}k ctx` : ""}
      </div>
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button className="btn w-full justify-between" onClick={() => setOpen((o) => !o)}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="label">Model</span>
          <span className="truncate font-semibold">{current?.name ?? value}</span>
        </span>
        <span className="flex items-center gap-1">
          {current ? (
            <>
              <Badge on={current.vision} label="vision" title="Accepts image input" />
              <Badge on={current.tools} label="tools" title="Native tool calling" />
            </>
          ) : null}
          <span className="text-muted">▾</span>
        </span>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-40 mt-1 max-h-[70vh] w-[420px] max-w-[92vw] overflow-auto rounded-lg border border-line bg-navy-900 shadow-2xl">
          <div className="sticky top-0 z-10 border-b border-line bg-navy-850 px-3 py-2">
            <div className="text-[11px] text-muted">
              Top 10 from the live Vercel AI Gateway list, ranked for tool calling + vision + spatial reasoning.
              {payload ? ` Source: ${payload.source}, ${payload.all.length} language models.` : ""}
            </div>
            {payload?.warning ? <div className="mt-1 text-[11px] text-warn">{payload.warning}</div> : null}
          </div>
          {payload?.curated.map((m) => row(m, m.rank))}
          <div className="border-t border-line bg-navy-850 px-3 py-2">
            <input className="input" placeholder="Search all gateway models (e.g. qwen, mistral)…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {others.map((m) => row(m))}
          {q && !others.length ? <div className="px-3 py-2 text-[12px] text-muted">No match.</div> : null}
        </div>
      ) : null}
    </div>
  );
}
