"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { areaStructureNames, BOM_CATEGORIES, BOM_META, bomDiffLines, computeBom, summarizeBom, totalsByUnit, type BomLine } from "@/lib/bom";
import { exportCsv, exportXlsx } from "@/lib/bomExport";
import { fmtNum, round } from "@/lib/geo";
import { nextId } from "@/lib/scene";
import { useEffectiveScene, useStudio } from "@/store/studio";
import { download, Stat } from "../ui";

type GroupBy = "none" | "category" | "area" | "structure";
type Tab = "schedule" | "diff";

const UNIT_LABEL: Record<string, string> = { each: "ea", linear_ft: "lf", sq_ft: "sf" };

function fmtQty(q: number, unit: string) {
  return unit === "each" ? fmtNum(q, q % 1 ? 2 : 0) : fmtNum(q, 1);
}

function Delta({ d, unit }: { d: number; unit: string }) {
  if (Math.abs(d) < 0.0005) return <span className="text-[#4a6585]">—</span>;
  return <span className={d > 0 ? "text-ok" : "text-bad"}>{d > 0 ? "+" : "−"}{fmtQty(Math.abs(d), unit)}</span>;
}

function StatusChip({ l }: { l: BomLine }) {
  if (l.status === "unchanged") return null;
  const cls = l.status === "added" ? "border-ok/50 text-ok" : l.status === "removed" ? "border-bad/50 text-bad" : "border-warn/50 text-warn";
  return <span className={`chip ${cls}`}>{l.status}</span>;
}

function QtyCell({ l, onSet }: { l: BomLine; onSet: (q: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      className="input w-24 px-1.5 py-0.5 text-right"
      value={draft ?? String(round(l.qty, 3))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft == null) return;
        const n = parseFloat(draft);
        setDraft(null);
        if (!Number.isNaN(n) && n >= 0 && n !== l.qty) onSet(n);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      title="Edit quantity (recorded as a BOM adjustment)"
    />
  );
}

export function BomView() {
  const router = useRouter();
  const scene = useEffectiveScene();
  const committed = useStudio((s) => s.scene);
  const commit = useStudio((s) => s.commit);
  const proposal = useStudio((s) => s.proposal);
  const select = useStudio((s) => s.select);
  const notify = useStudio((s) => s.notify);
  const scenarios = useStudio((s) => s.scenarios);
  const activeId = useStudio((s) => s.activeScenarioId);
  const res = useMemo(() => computeBom(scene), [scene]);
  const summary = useMemo(() => summarizeBom(res), [res]);

  const [tab, setTab] = useState<Tab>("schedule");
  const [q, setQ] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [unit, setUnit] = useState("all");
  const [changedOnly, setChangedOnly] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("category");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ item: "", category: BOM_CATEGORIES[0] ?? "ADDED", qty: "1", unit: "each", reason: "" });
  const structName = useMemo(() => new Map(scene.structures.map((s) => [s.id, s.name])), [scene]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return res.lines.filter((l) => {
      if (l.qty === 0 && l.baseQty === 0) return false;
      if (tab === "diff" && l.status === "unchanged") return false;
      if (changedOnly && l.status === "unchanged") return false;
      if (cats.length && !cats.includes(l.category)) return false;
      if (unit !== "all" && l.unit !== unit) return false;
      if (t && !`${l.item} ${l.spec} ${l.category} ${l.area ?? ""} ${l.notes ?? ""} ${l.id}`.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [res, q, cats, unit, changedOnly, tab]);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: React.ReactNode; lines: BomLine[] }>();
    const push = (key: string, label: React.ReactNode, l: BomLine) => {
      const g = map.get(key) ?? { key, label, lines: [] };
      g.lines.push(l);
      map.set(key, g);
    };
    for (const l of filtered) {
      if (groupBy === "none") push("all", "All lines", l);
      else if (groupBy === "category") push(l.category, l.category, l);
      else if (groupBy === "area") {
        const names = areaStructureNames(l.area);
        const key = l.area ?? "(no zone code · added or derived)";
        push(
          key,
          <span>
            <span className="text-gold-soft">{l.area ? `v2.2 zone ${l.area}` : "Added / derived lines (no v2.2 zone code)"}</span>
            {names.length ? <span className="ml-2 text-[11.5px] font-normal text-muted">{names.slice(0, 5).join(", ")}{names.length > 5 ? ` +${names.length - 5} more` : ""}</span> : null}
          </span>,
          l,
        );
      } else {
        if (l.structureIds.length === 0) push("(area-level / not linked to one structure)", "Area-level / not linked to a single structure", l);
        else for (const id of l.structureIds) push(id, `${structName.get(id) ?? id} · ${id}`, l);
      }
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => (groupBy === "area" ? parseFloat(a.key) - parseFloat(b.key) || a.key.localeCompare(b.key) : a.key.localeCompare(b.key)));
    return arr;
  }, [filtered, groupBy, structName]);

  const setQty = (l: BomLine, qty: number) => {
    if (proposal) return notify("info", "Accept or reject the pending AI proposal first.");
    const id = nextId("adj", committed.bomAdjustments.map((a) => a.id));
    commit(`BOM: set ${l.item} to ${qty}`, { ...committed, bomAdjustments: [...committed.bomAdjustments, { id, action: "set_qty", lineId: l.id, qty }] });
  };

  const scenarioName = scenarios.find((s) => s.id === activeId)?.name ?? "Working draft";
  const totals = summary.totals;
  const base = summary.base;
  const changed = bomDiffLines(res);

  const doCsv = (onlyChanged: boolean) => download(`pga27-bom-${onlyChanged ? "diff-vs-v2.2" : "live"}.csv`, exportCsv(res, onlyChanged), "text/csv");
  const doXlsx = async () => {
    try {
      const buf = await exportXlsx(res, scenarioName);
      download("pga27-bom.xlsx", buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch (e) {
      notify("error", `XLSX export failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-3 border-b border-line bg-navy-900/60 px-5 py-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[22px] font-semibold text-ink">Bill of materials</h1>
            <div className="text-[12px] text-muted">
              {BOM_META.source} · {BOM_META.physicalRows} physical rows, {summary.baseLineCount} item rows (subtotal rows excluded). Live-recomputed from the scene{proposal ? " (including the pending AI proposal)" : ""}.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn" onClick={() => doCsv(false)}>Export CSV</button>
            <button className="btn" onClick={() => doCsv(true)}>CSV (diff only)</button>
            <button className="btn btn-gold" onClick={doXlsx}>Export XLSX</button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          <Stat label="Lines with quantity" value={summary.lineCount} sub={`v2.2: ${summary.baseLineCount} item lines`} />
          <Stat label="Each (count)" value={fmtNum(totals.each, 0)} sub={<Delta d={totals.each - base.each} unit="each" />} />
          <Stat label="Linear ft" value={fmtNum(totals.linear_ft, 0)} sub={<Delta d={totals.linear_ft - base.linear_ft} unit="linear_ft" />} />
          <Stat label="Square ft" value={fmtNum(totals.sq_ft, 0)} sub={<Delta d={totals.sq_ft - base.sq_ft} unit="sq_ft" />} />
          <Stat label="Changes vs v2.2" value={<span className={changed.length ? "text-gold-soft" : ""}>{summary.added + summary.removed + summary.changed}</span>} sub={`${summary.added} added · ${summary.changed} changed · ${summary.removed} removed`} accent={changed.length > 0} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-line">
            {(["schedule", "diff"] as Tab[]).map((t) => (
              <button key={t} className={`px-3 py-1.5 text-[12.5px] ${tab === t ? "bg-gold/20 text-gold-soft" : "bg-navy-850 text-muted hover:text-ink"}`} onClick={() => setTab(t)}>
                {t === "schedule" ? "Schedule" : `Diff vs v2.2 (${changed.length})`}
              </button>
            ))}
          </div>
          <input className="input w-64" placeholder="Search item, spec, zone, notes…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input w-44" value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
            <option value="category">Group: category</option>
            <option value="area">Group: structure / area (v2.2 zone)</option>
            <option value="structure">Group: linked structure</option>
            <option value="none">No grouping</option>
          </select>
          <select className="input w-32" value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="all">All units</option>
            <option value="each">Each</option>
            <option value="linear_ft">Linear ft</option>
            <option value="sq_ft">Square ft</option>
          </select>
          <label className="flex items-center gap-1.5 text-[12px] text-muted">
            <input type="checkbox" checked={changedOnly} onChange={(e) => setChangedOnly(e.target.checked)} /> changed only
          </label>
          <label className="flex items-center gap-1.5 text-[12px] text-muted" title="Rule-based estimate of deck area and railing for multi-level structures that changed vs v2.2">
            <input type="checkbox" checked={scene.derivedAllowances} disabled={!!proposal} onChange={(e) => commit(`Derived estimates ${e.target.checked ? "on" : "off"}`, { ...committed, derivedAllowances: e.target.checked })} /> derived estimates
          </label>
          <button className="btn ml-auto" onClick={() => setShowAdd((v) => !v)}>+ Manual line</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {BOM_CATEGORIES.map((c) => (
            <button key={c} className={`chip ${cats.includes(c) ? "border-gold text-gold-soft" : ""}`} onClick={() => setCats((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))}>
              {c}
            </button>
          ))}
          {cats.length ? <button className="chip border-line text-muted" onClick={() => setCats([])}>clear</button> : null}
        </div>
        {showAdd ? (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-navy-850 p-3">
            <label className="block w-64"><span className="label">Item</span><input className="input mt-0.5" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} /></label>
            <label className="block w-52"><span className="label">Category</span>
              <select className="input mt-0.5" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {BOM_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="block w-24"><span className="label">Qty</span><input className="input mt-0.5" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></label>
            <label className="block w-28"><span className="label">Unit</span>
              <select className="input mt-0.5" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                <option value="each">each</option><option value="linear_ft">linear_ft</option><option value="sq_ft">sq_ft</option>
              </select>
            </label>
            <label className="block flex-1"><span className="label">Reason</span><input className="input mt-0.5" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
            <button
              className="btn btn-gold"
              disabled={!form.item.trim() || Number.isNaN(parseFloat(form.qty)) || !!proposal}
              onClick={() => {
                const id = nextId("adj", committed.bomAdjustments.map((a) => a.id));
                commit(`BOM: add line ${form.item}`, { ...committed, bomAdjustments: [...committed.bomAdjustments, { id, action: "add_line", item: form.item.trim(), category: form.category, qty: parseFloat(form.qty), unit: form.unit, reason: form.reason || undefined }] });
                setForm({ ...form, item: "", reason: "" });
                setShowAdd(false);
              }}
            >
              Add
            </button>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th className="w-[26%]">Item</th>
              <th>Category</th>
              <th title="Workbook v2.2 drawing/zone code - NOT the v2.3 sheet number and NOT a hole number">v2.2 zone</th>
              <th className="text-right">Qty</th>
              <th>Unit</th>
              <th className="text-right">v2.2 qty</th>
              <th className="text-right">Δ</th>
              <th className="w-[26%]">Spec</th>
              <th>Linked structures</th>
              <th>Basis</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const t = totalsByUnit(g.lines);
              const open = !collapsed[g.key];
              return (
                <Fragment key={g.key}>
                  {groupBy !== "none" ? (
                    <tr className="cursor-pointer" onClick={() => setCollapsed((c) => ({ ...c, [g.key]: open }))}>
                      <td colSpan={10} className="!bg-navy-800/90 !py-2">
                        <div className="flex items-center gap-3">
                          <span className="w-3 text-muted">{open ? "▾" : "▸"}</span>
                          <span className="font-semibold text-ink">{g.label}</span>
                          <span className="chip">{g.lines.length} lines</span>
                          <span className="ml-auto text-[11.5px] text-muted">
                            {t.each ? `${fmtNum(t.each, 0)} ea` : ""} {t.linear_ft ? ` · ${fmtNum(t.linear_ft, 0)} lf` : ""} {t.sq_ft ? ` · ${fmtNum(t.sq_ft, 0)} sf` : ""}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {open
                    ? g.lines.map((l) => (
                        <tr key={`${g.key}-${l.id}`} className={l.status === "unchanged" ? "" : l.status === "added" ? "bg-ok/5" : l.status === "removed" ? "bg-bad/5" : "bg-warn/5"}>
                          <td>
                            <div className="flex items-center gap-1.5 font-medium text-ink">{l.item}<StatusChip l={l} /></div>
                            <div className="text-[10.5px] text-[#58708f]">{l.id}</div>
                          </td>
                          <td className="text-muted">{l.category}</td>
                          <td className="text-muted">{l.area ?? "—"}</td>
                          <td className="text-right"><QtyCell l={l} onSet={(n) => setQty(l, n)} /></td>
                          <td className="text-muted">{UNIT_LABEL[l.unit] ?? l.unit}</td>
                          <td className="text-right text-muted">{fmtQty(l.baseQty, l.unit)}</td>
                          <td className="text-right"><Delta d={l.qty - l.baseQty} unit={l.unit} /></td>
                          <td className="text-[11.5px] text-muted">{l.spec || "—"}{l.notes ? <div className="text-[10.5px] text-[#6f89a8]">{l.notes}</div> : null}</td>
                          <td>
                            <div className="flex max-w-[220px] flex-wrap gap-1">
                              {l.structureIds.slice(0, 3).map((id) => (
                                <button key={id} className="chip hover:border-gold hover:text-gold-soft" onClick={() => { select([id]); router.push("/site"); }}>
                                  {structName.get(id) ?? id}
                                </button>
                              ))}
                              {l.structureIds.length > 3 ? <span className="chip">+{l.structureIds.length - 3}</span> : null}
                            </div>
                          </td>
                          <td className="text-[11px] text-muted">{l.basis}</td>
                        </tr>
                      ))
                    : null}
                </Fragment>
              );
            })}
            {!groups.length ? (
              <tr><td colSpan={10} className="py-10 text-center text-muted">No lines match. {tab === "diff" ? "The scene still matches the v2.2 schedule." : ""}</td></tr>
            ) : null}
          </tbody>
        </table>
        <div className="px-5 py-4 text-[11.5px] leading-relaxed text-muted">
          Zone-level lines (fence, decking, stairs, back of house, furniture, gravel) are shared area quantities from the workbook and are not auto-scaled when a structure changes; v2.2 zone codes do not match the v2.3 drawing sheet numbers, so nothing here is joined by numeric code. "Derived estimate" lines are rule-based (footprint × levels, perimeter × levels) for multi-level structures that differ from v2.2. Vendor, price and install dates are not in the source and remain unknown.
        </div>
      </div>
    </div>
  );
}
