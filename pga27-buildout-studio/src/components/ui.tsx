"use client";

import { useEffect, useState } from "react";

export function Lightbox({ src, title, onClose }: { src: string; title?: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center gap-3 border-b border-line bg-navy-900 px-4 py-2" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-[14px] text-gold-soft">{title}</div>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn" onClick={() => setZoom((z) => Math.max(0.4, z - 0.25))}>−</button>
          <span className="w-12 text-center text-[12px] text-muted">{Math.round(zoom * 100)}%</span>
          <button className="btn" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>+</button>
          <a className="btn" href={src} target="_blank" rel="noreferrer">Open original</a>
          <button className="btn btn-gold" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={title ?? "drawing"} style={{ width: `${zoom * 100}%`, maxWidth: "none" }} className="mx-auto rounded border border-line bg-white" />
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="panel px-4 py-3">
      <div className="label">{label}</div>
      <div className={`font-display mt-1 text-[28px] font-semibold leading-none ${accent ? "text-gold-soft" : "text-ink"}`}>{value}</div>
      {sub ? <div className="mt-1.5 text-[11.5px] leading-snug text-muted">{sub}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-end justify-between">
      <h2 className="font-display text-[17px] font-semibold text-ink">{children}</h2>
      {right}
    </div>
  );
}

export function download(filename: string, data: BlobPart, type = "application/octet-stream") {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
