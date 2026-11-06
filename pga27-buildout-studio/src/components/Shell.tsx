"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useStudio } from "@/store/studio";
import { AiPanel } from "./AiPanel";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/site", label: "3D Site" },
  { href: "/flythrough", label: "Flythroughs" },
  { href: "/plan", label: "CAD Plan" },
  { href: "/bom", label: "BOM" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/drawings", label: "Drawings" },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-9 w-9 shrink-0 rounded-full border border-gold bg-navy-900 shadow-[0_0_0_3px_rgba(201,162,74,0.12)]">
        <span className="font-display absolute inset-0 flex items-center justify-center text-[15px] font-bold tracking-tight text-gold-soft">27</span>
      </div>
      <div className="leading-tight">
        <div className="font-display text-[15px] font-semibold tracking-wide text-ink">PGA27 Buildout Studio</div>
        <div className="text-[10.5px] uppercase tracking-[0.12em] text-muted">Fields Ranch East · PGA Frisco · May 17–23, 2027</div>
      </div>
    </div>
  );
}

function Toasts() {
  const notices = useStudio((s) => s.notices);
  const dismiss = useStudio((s) => s.dismissNotice);
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
      {notices.map((n) => (
        <div
          key={n.id}
          onClick={() => dismiss(n.id)}
          className={`pointer-events-auto cursor-pointer rounded-lg border px-4 py-2 text-[12.5px] shadow-xl backdrop-blur ${
            n.kind === "error" ? "border-bad/60 bg-[#2a1018]/95 text-[#ffc4c8]" : n.kind === "success" ? "border-ok/50 bg-[#0c2a20]/95 text-[#bdf0d8]" : "border-line bg-navy-850/95 text-ink"
          }`}
        >
          {n.text}
        </div>
      ))}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hydrate = useStudio((s) => s.hydrate);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const aiOpen = useStudio((s) => s.aiOpen);
  const setUi = useStudio((s) => s.setUi);
  const proposal = useStudio((s) => s.proposal);
  const scenarios = useStudio((s) => s.scenarios);
  const activeId = useStudio((s) => s.activeScenarioId);
  const dirty = useStudio((s) => s.dirty);

  useEffect(() => {
    void hydrate();
    (window as unknown as { __studio: typeof useStudio }).__studio = useStudio;
  }, [hydrate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const active = scenarios.find((s) => s.id === activeId);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-[58px] shrink-0 items-center gap-6 border-b border-line bg-navy-900/95 px-4">
        <Logo />
        <nav className="flex items-center gap-1">
          {NAV.map((n) => {
            const on = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${on ? "bg-gold/15 text-gold-soft shadow-[inset_0_-2px_0_var(--color-gold)]" : "text-muted hover:bg-navy-800 hover:text-ink"}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/scenarios" className="chip hover:border-gold">
            <span className={`h-1.5 w-1.5 rounded-full ${dirty ? "bg-warn" : "bg-ok"}`} />
            {active ? active.name : "Working draft"}
            {dirty ? " · unsaved" : ""}
          </Link>
          <button className="btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)">
            Undo
          </button>
          <button className="btn" onClick={redo} disabled={!canRedo} title="Redo (Shift+Ctrl/Cmd+Z)">
            Redo
          </button>
          <button className={`btn ${aiOpen ? "btn-active" : ""}`} onClick={() => setUi({ aiOpen: !aiOpen })}>
            AI Assistant
            {proposal ? <span className="pulse h-2 w-2 rounded-full bg-gold" /> : null}
          </button>
        </div>
      </header>
      <div className="flex h-[26px] shrink-0 items-center justify-center gap-4 border-b border-line bg-[#0d1b30] text-[11px] text-muted">
        <span className="font-semibold text-gold-soft">PLANNING CONCEPT — NOT FOR CONSTRUCTION</span>
        <span>Positions are approximate label anchors, not surveyed. No CAD, terrain, georeferencing or exact rotations were supplied.</span>
        <span>v2.2 workbook zones ≠ v2.3 drawing sheets. Unknown values are shown as unknown.</span>
      </div>
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 overflow-hidden">{children}</main>
        <AiPanel hidden={!aiOpen} />
      </div>
      <Toasts />
    </div>
  );
}
