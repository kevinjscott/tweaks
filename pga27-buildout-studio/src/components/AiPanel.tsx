"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart, type UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { computeBom, totalsByUnit } from "@/lib/bom";
import { round } from "@/lib/geo";
import type { GatewayModel, ModelsPayload } from "@/lib/ai/models";
import { applyOps, describeChange, diffScenes } from "@/lib/scene";
import { captureViewport } from "@/lib/viewport";
import type { ToolOutput, ViewOp } from "@/lib/types";
import { useEffectiveScene, useStudio } from "@/store/studio";
import { ModelPicker } from "./ModelPicker";

const SUGGESTIONS = [
  "Add a 20x40m hospitality tent at the 16 green, two levels",
  "Move the media center 30m north",
  "Fly me from the main gate to the 17th tee",
  "What does adding 3 more grandstands do to the BOM?",
];

const TOOL_VERB: Record<string, string> = {
  find_structures: "Searched structures",
  locate_place: "Located place",
  get_structure: "Read structure",
  add_structure: "Add structure",
  move_structure: "Move structure",
  resize_structure: "Resize structure",
  rotate_structure: "Rotate structure",
  delete_structure: "Delete structure",
  select_structures: "Select",
  set_camera: "Camera",
  create_flythrough: "Create flythrough",
  play_flythrough: "Play flythrough",
  query_bom: "Query BOM",
  bom_diff: "BOM diff vs v2.2",
  modify_bom: "Modify BOM",
  measure: "Measure",
};

function inlineMd(t: string) {
  const parts = t.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) =>
    p.startsWith("**") ? <strong key={i} className="text-ink">{p.slice(2, -2)}</strong> : p.startsWith("`") ? <code key={i} className="rounded bg-navy-800 px-1 text-[11.5px] text-gold-soft">{p.slice(1, -1)}</code> : <span key={i}>{p}</span>,
  );
}

function Markdownish({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    out.push(
      <ul key={`ul${out.length}`} className="list-disc space-y-0.5 pl-5">
        {list.map((l, j) => (
          <li key={j}>{inlineMd(l)}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  for (const raw of lines) {
    const m = raw.match(/^\s*[-*]\s+(.*)$/);
    if (m) list.push(m[1]);
    else {
      flush();
      if (raw.trim()) out.push(<p key={`p${out.length}`}>{inlineMd(raw.replace(/^#+\s*/, ""))}</p>);
    }
  }
  flush();
  return <div className="space-y-1.5 text-[13px] leading-relaxed text-[#d6e0ee]">{out}</div>;
}

function stripOldFiles(messages: UIMessage[]): UIMessage[] {
  let lastUser = -1;
  messages.forEach((m, i) => {
    if (m.role === "user") lastUser = i;
  });
  return messages.map((m, i) => (i === lastUser ? m : { ...m, parts: m.parts.filter((p) => p.type !== "file") }));
}

export function AiPanel({ hidden }: { hidden?: boolean }) {
  const router = useRouter();
  const scene = useStudio((s) => s.scene);
  const proposal = useStudio((s) => s.proposal);
  const past = useStudio((s) => s.past);
  const future = useStudio((s) => s.future);
  const preview = useEffectiveScene();
  const store = useStudio;

  const [status, setStatus] = useState<{ configured: boolean; auth: string; message: string } | null>(null);
  const [models, setModels] = useState<ModelsPayload | null>(null);
  const [modelId, setModelId] = useState<string>("anthropic/claude-sonnet-5.5");
  const [attachShot, setAttachShot] = useState(true);
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const seenCalls = useRef(new Set<string>());

  const modelRef = useRef<{ id: string; vision: boolean }>({ id: modelId, vision: true });

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => setStatus({ configured: false, auth: "none", message: "Could not reach /api/status." }));
    fetch("/api/models")
      .then((r) => r.json())
      .then((p: ModelsPayload) => {
        setModels(p);
        const saved = typeof window !== "undefined" ? window.localStorage.getItem("pga27.model") : null;
        setModelId(saved && p.all.some((m) => m.id === saved) ? saved : p.defaultModelId);
      })
      .catch(() => undefined);
  }, []);

  const model: GatewayModel | undefined = useMemo(() => models?.all.find((m) => m.id === modelId) ?? models?.curated.find((m) => m.id === modelId), [models, modelId]);
  const toolsOk = model ? model.tools !== false : true;
  const visionOk = model ? model.vision === true : false;
  const fallbackId = models?.defaultModelId ?? "anthropic/claude-sonnet-5.5";
  const usedModelId = toolsOk ? modelId : fallbackId;
  const usedModel = models?.all.find((m) => m.id === usedModelId);
  modelRef.current = { id: usedModelId, vision: usedModel ? usedModel.vision === true : visionOk };

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => {
          const st = store.getState();
          const effective = st.proposal ? applyOps(st.scene, st.proposal.ops) : st.scene;
          return { body: { messages: stripOldFiles(messages), modelId: modelRef.current.id, scene: effective, vision: modelRef.current.vision } };
        },
      }),
    [store],
  );
  const { messages, sendMessage, status: chatStatus, error, stop, setMessages } = useChat({ transport });
  const busy = chatStatus === "submitted" || chatStatus === "streaming";

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, chatStatus, proposal]);

  const runViewOp = (v: ViewOp) => {
    const st = store.getState();
    switch (v.op) {
      case "set_camera":
        st.flyTo(v.pose, v.seconds ?? 2, v.mode);
        if (!/^\/(site|flythrough)/.test(window.location.pathname)) router.push("/site");
        break;
      case "select":
        st.select(v.ids);
        break;
      case "play_tour":
        router.push("/flythrough");
        setTimeout(() => store.getState().playTour(v.tourId), 400);
        break;
      case "show_measurement":
        st.setPlanHighlight({ id: v.measurement.id, points: v.measurement.points, kind: v.measurement.kind === "area" ? "area" : "distance", label: v.measurement.label });
        break;
    }
  };

  useEffect(() => {
    const st = store.getState();
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (const part of m.parts) {
        if (!isToolUIPart(part)) continue;
        const p = part as unknown as { toolCallId: string; state: string; output?: ToolOutput };
        if (p.state !== "output-available" || !p.output || typeof p.output !== "object") continue;
        const out = p.output as ToolOutput;
        if (seenCalls.current.has(p.toolCallId)) continue;
        seenCalls.current.add(p.toolCallId);
        if (out.sceneOp) st.addProposalOps(p.toolCallId, [out.sceneOp], [out.message.split(/\.\s/)[0].slice(0, 90)]);
        if (out.viewOp) runViewOp(out.viewOp);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    if (!toolsOk) store.getState().notify("info", `${model?.name} has no tool-calling support; using ${usedModel?.name ?? fallbackId} for this request.`);
    const files: { type: "file"; mediaType: string; url: string }[] = [];
    if (attachShot && modelRef.current.vision) {
      const shot = captureViewport();
      if (shot) files.push({ type: "file", mediaType: "image/jpeg", url: shot });
    }
    setInput("");
    await sendMessage(files.length ? { text: t, files } : { text: t });
  };

  const diff = useMemo(() => diffScenes(scene, preview), [scene, preview]);
  const bomImpact = useMemo(() => {
    if (!proposal) return null;
    const a = totalsByUnit(computeBom(scene).lines);
    const b = totalsByUnit(computeBom(preview).lines);
    return { each: round(b.each - a.each, 1), lf: round(b.linear_ft - a.linear_ft, 0), sf: round(b.sq_ft - a.sq_ft, 0) };
  }, [proposal, scene, preview]);

  const errMsg = (() => {
    if (!error) return null;
    try {
      const j = JSON.parse(error.message);
      return j.message ?? error.message;
    } catch {
      return error.message;
    }
  })();

  return (
    <aside className={`flex w-[400px] shrink-0 flex-col border-l border-line bg-navy-900 ${hidden ? "hidden" : ""}`}>
      <div className="border-b border-line px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-display text-[15px] font-semibold text-gold-soft">Buildout Assistant</div>
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted" title={visionOk ? "Send a screenshot of the 3D viewport with each message" : "Selected model has no vision support"}>
              <input type="checkbox" checked={attachShot && visionOk} disabled={!visionOk} onChange={(e) => setAttachShot(e.target.checked)} />
              viewport shot
            </label>
            <button
              className="btn btn-ghost px-1.5 py-0.5 text-[11px]"
              onClick={() => {
                setMessages([]);
              }}
              disabled={!messages.length || busy}
            >
              Clear
            </button>
          </div>
        </div>
        <ModelPicker
          payload={models}
          value={modelId}
          onChange={(id) => {
            setModelId(id);
            window.localStorage.setItem("pga27.model", id);
          }}
        />
        {model && !toolsOk ? <div className="mt-1.5 rounded border border-warn/40 bg-warn/10 px-2 py-1 text-[11px] text-warn">This model has no tool-calling support, so requests fall back to {usedModel?.name ?? fallbackId}.</div> : null}
        {model && toolsOk && !visionOk ? <div className="mt-1.5 text-[11px] text-muted">No vision on this model: viewport screenshots are not sent.</div> : null}
      </div>

      {status && !status.configured ? (
        <div className="m-3 rounded-lg border border-gold/50 bg-gold/10 p-3 text-[12.5px] leading-relaxed text-ink">
          <div className="mb-1 font-semibold text-gold-soft">AI Gateway not configured</div>
          <ol className="list-decimal space-y-0.5 pl-4 text-[12px] text-[#d6e0ee]">
            <li>Create a key at vercel.com/ai-gateway.</li>
            <li>
              Add <code className="rounded bg-navy-800 px-1">AI_GATEWAY_API_KEY=…</code> to <code className="rounded bg-navy-800 px-1">.env.local</code>, or deploy on Vercel (OIDC works with no key).
            </li>
            <li>Restart <code className="rounded bg-navy-800 px-1">npm run dev</code>.</li>
          </ol>
          <div className="mt-1 text-[11px] text-muted">The 3D scene, CAD, BOM and scenarios work without it.</div>
        </div>
      ) : null}

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-auto px-3 py-3">
        {!messages.length ? (
          <div className="space-y-2">
            <div className="text-[12.5px] leading-relaxed text-muted">
              Describe a change in plain language. The model drives the scene through typed tools (add / move / resize / rotate / delete, camera, flythroughs, BOM, measure). Edits appear as a previewable diff you accept or reject, with full undo/redo.
            </div>
            {SUGGESTIONS.map((s) => (
              <button key={s} className="block w-full rounded-lg border border-line bg-navy-850 px-3 py-2 text-left text-[12.5px] text-ink hover:border-gold" onClick={() => void send(s)} disabled={!status?.configured}>
                {s}
              </button>
            ))}
          </div>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "ml-6" : ""}>
            {m.role === "user" ? (
              <div className="rounded-lg border border-line bg-navy-800 px-3 py-2 text-[13px]">
                {m.parts.map((p, i) =>
                  p.type === "text" ? (
                    <div key={i}>{p.text}</div>
                  ) : p.type === "file" && p.mediaType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={p.url} alt="viewport screenshot sent to the model" className="mt-1.5 h-16 rounded border border-line" />
                  ) : null,
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {m.parts.map((p, i) => {
                  if (p.type === "text") return p.text.trim() ? <Markdownish key={i} text={p.text} /> : null;
                  if (isToolUIPart(p)) {
                    const name = getToolName(p);
                    const tp = p as unknown as { state: string; output?: ToolOutput; errorText?: string };
                    const out = tp.output;
                    const ok = tp.state === "output-available" ? out?.ok !== false : tp.state === "output-error" ? false : null;
                    return (
                      <div key={i} className="rounded-md border border-line/80 bg-navy-850/80 px-2.5 py-1.5 text-[12px]">
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${ok === null ? "pulse bg-gold" : ok ? "bg-ok" : "bg-bad"}`} />
                          <span className="font-semibold text-gold-soft">{TOOL_VERB[name] ?? name}</span>
                          {out?.sceneOp ? <span className="chip">proposal</span> : null}
                        </div>
                        <div className="mt-0.5 text-[11.5px] leading-snug text-muted">{out?.message ?? tp.errorText ?? "Running…"}</div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        ))}
        {busy ? <div className="flex items-center gap-2 text-[12px] text-muted"><span className="pulse h-2 w-2 rounded-full bg-gold" />Thinking…</div> : null}
        {errMsg ? <div className="rounded-lg border border-bad/50 bg-bad/10 px-3 py-2 text-[12.5px] text-[#ffc4c8]">{errMsg}</div> : null}
      </div>

      {proposal ? (
        <div className="border-t border-gold/50 bg-[#1a1608] px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-gold-soft">Proposed changes · previewing in scene</div>
            <span className="chip">{proposal.ops.length} op{proposal.ops.length === 1 ? "" : "s"}</span>
          </div>
          <div className="max-h-36 space-y-0.5 overflow-auto text-[12px]">
            {diff.added.map((s) => (
              <div key={s.id} className="text-ok">+ {s.name} <span className="text-muted">{s.w}×{s.l} m{s.levels && s.levels > 1 ? `, ${s.levels} levels` : ""}</span></div>
            ))}
            {diff.removed.map((s) => (
              <div key={s.id} className="text-bad">− {s.name} <span className="text-muted">({s.id})</span></div>
            ))}
            {diff.changed.map((c) => (
              <div key={c.after.id} className="text-warn">
                ~ {c.after.name} <span className="text-muted">{c.changes.map(describeChange).join("; ")}</span>
              </div>
            ))}
            {diff.toursAdded.map((t) => (
              <div key={t} className="text-info">+ Flythrough “{t}”</div>
            ))}
            {diff.bomAdjustmentsAdded > 0 ? <div className="text-info">+ {diff.bomAdjustmentsAdded} BOM adjustment(s)</div> : null}
          </div>
          {bomImpact ? (
            <div className="mt-1.5 text-[11.5px] text-muted">
              BOM impact: {bomImpact.each >= 0 ? "+" : ""}{bomImpact.each} each · {bomImpact.lf >= 0 ? "+" : ""}{bomImpact.lf} lf · {bomImpact.sf >= 0 ? "+" : ""}{bomImpact.sf} sf
            </div>
          ) : null}
          <div className="mt-2 flex gap-2">
            <button className="btn btn-gold flex-1" onClick={() => store.getState().acceptProposal()}>Accept</button>
            <button className="btn flex-1" onClick={() => store.getState().rejectProposal()}>Reject</button>
          </div>
        </div>
      ) : null}

      <div className="border-t border-line p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex gap-2"
        >
          <textarea
            className="input min-h-[40px] resize-none"
            rows={2}
            placeholder={status?.configured === false ? "Configure AI_GATEWAY_API_KEY to chat…" : "e.g. Move the media center 30m north"}
            value={input}
            disabled={status?.configured === false}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          {busy ? (
            <button type="button" className="btn btn-danger self-end" onClick={() => void stop()}>Stop</button>
          ) : (
            <button type="submit" className="btn btn-gold self-end" disabled={!input.trim() || status?.configured === false}>Send</button>
          )}
        </form>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
          <button className="hover:text-ink" onClick={() => setShowHistory((s) => !s)}>
            History ({past.length}){future.length ? ` · ${future.length} redo` : ""} {showHistory ? "▴" : "▾"}
          </button>
          <span>{status?.configured ? `Gateway: ${status.auth}` : "Gateway: not configured"}</span>
        </div>
        {showHistory ? (
          <div className="mt-1.5 max-h-28 overflow-auto rounded border border-line bg-navy-850 p-1.5 text-[11.5px]">
            {past.length === 0 ? <div className="text-muted">No changes yet.</div> : null}
            {[...past].reverse().map((h, i) => (
              <div key={i} className="flex items-center justify-between gap-2 border-b border-line/40 py-0.5 last:border-0">
                <span className="truncate text-[#c3d1e4]">{h.label}</span>
                {i === 0 ? <button className="text-gold hover:underline" onClick={() => store.getState().undo()}>undo</button> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
