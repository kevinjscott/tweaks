export interface GatewayModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  released: number | null;
  contextWindow: number | null;
  vision: boolean | null;
  tools: boolean | null;
  reasoning: boolean;
  inPerM: number | null;
  outPerM: number | null;
}

export interface RankedModel extends GatewayModel {
  rank: number;
  note: string;
  score: number;
}

export interface ModelsPayload {
  source: "gateway" | "gateway-sdk" | "fallback";
  fetchedAt: string;
  curated: RankedModel[];
  all: GatewayModel[];
  defaultModelId: string;
  warning?: string;
}

interface RawModel {
  id: string;
  name?: string;
  description?: string;
  owned_by?: string;
  released?: number;
  type?: string;
  context_window?: number;
  tags?: string[];
  modalities?: { input?: string[] };
  pricing?: { input?: string; output?: string };
}

export function normalizeRaw(m: RawModel): GatewayModel {
  const tags = m.tags ?? [];
  const input = m.modalities?.input ?? [];
  const price = (v?: string) => (v == null || v === "" ? null : parseFloat(v) * 1_000_000);
  return {
    id: m.id,
    name: m.name ?? m.id,
    provider: m.owned_by ?? m.id.split("/")[0],
    description: m.description ?? "",
    released: m.released ? m.released * 1000 : null,
    contextWindow: m.context_window ?? null,
    vision: input.includes("image") || tags.includes("vision"),
    tools: tags.includes("tool-use"),
    reasoning: tags.includes("reasoning"),
    inPerM: price(m.pricing?.input),
    outPerM: price(m.pricing?.output),
  };
}

const EXCLUDE = /(-batch|-fast\b|-fast-|highspeed|ultrafast|ultraspeed|-exp\b|-free|contributor|legal|lite|\bmini\b|nano|embed|image|banana|omni|-open\b|-code\b|flashx)/i;
const FRONTIER_BONUS: Record<string, number> = { anthropic: 0.45, openai: 0.45, google: 0.4, spacexai: 0.35, xai: 0.35 };

const NOTES: { re: RegExp; note: string }[] = [
  { re: /claude-opus/, note: "Anthropic flagship. Best-in-class multi-step tool use and careful spatial reasoning; strong vision for the viewport screenshot. Highest quality, slower." },
  { re: /claude-fable/, note: "Anthropic premium tier: long-horizon agentic work and vision. Priciest option, use for complex multi-structure edits." },
  { re: /claude-sonnet/, note: "Fast, very reliable tool calling with strong vision. Best speed/quality balance for interactive scene edits." },
  { re: /gpt-6\.\d+-sol|gpt-6-sol/, note: "OpenAI frontier tier: strong geometry/arithmetic reasoning, vision and dependable structured tool calls." },
  { re: /gpt-6\.\d+-terra|gpt-6-terra/, note: "Newest OpenAI 6.x generation: frontier vision + tool use at a lower price than the sol tier." },
  { re: /gemini-4/, note: "Google flagship: natively multimodal (images, video, PDF), excellent at reading plan drawings and spatial layouts; 1M context." },
  { re: /gemini-3/, note: "Google Gemini: fast with vision and tools; good for quick edits and plan reading." },
  { re: /grok/, note: "xAI Grok: strong reasoning and vision, good at coordinate math and parallel tool calls." },
  { re: /kimi/, note: "Moonshot Kimi: open-weight-class frontier model with vision and agentic tool use." },
  { re: /qwen/, note: "Alibaba Qwen: large multimodal model with solid tool calling; good value." },
  { re: /muse/, note: "Meta Muse: multimodal reasoning model with tool use." },
  { re: /deepseek/, note: "DeepSeek: very low cost, vision + tools; fine for simple edits." },
  { re: /glm/, note: "Z.ai GLM: capable tool caller with vision at low cost." },
  { re: /mistral/, note: "Mistral Large: multimodal with tool calling; strong European option." },
  { re: /minimax/, note: "MiniMax: efficient multimodal agentic model." },
];

function noteFor(m: GatewayModel) {
  const hit = NOTES.find((n) => n.re.test(m.id));
  const caps = [m.vision ? "vision" : null, m.tools ? "tool calling" : null, m.reasoning ? "reasoning" : null].filter(Boolean).join(", ");
  return hit ? hit.note : `${m.provider} model with ${caps || "limited capabilities"}.`;
}

export function rankModels(all: GatewayModel[], now = Date.now()): RankedModel[] {
  const eligible = all.filter((m) => m.tools && m.vision && !EXCLUDE.test(m.id) && !/-\d{4}$/.test(m.id));
  const scored = eligible.map((m) => {
    const out = m.outPerM ?? 0;
    const tier = out > 0 ? Math.min(1.4, Math.max(0, Math.log10(out) + 0.2)) : 0;
    const ageDays = m.released ? (now - m.released) / 86_400_000 : 999;
    const recency = Math.max(0, 1 - ageDays / 240);
    const ctx = m.contextWindow && m.contextWindow >= 500_000 ? 0.1 : 0;
    const score = tier * 1.1 + recency * 0.9 + (FRONTIER_BONUS[m.provider] ?? 0) + ctx + (m.reasoning ? 0.1 : 0);
    return { m, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const picked: { m: GatewayModel; score: number }[] = [];
  const perProvider = new Map<string, number>();
  const seenFamily = new Set<string>();
  const family = (id: string) => id.replace(/-\d{4}$/, "").replace(/-(preview|latest)$/, "");
  const take = (e: { m: GatewayModel; score: number }, cap: number) => {
    const p = e.m.provider;
    if ((perProvider.get(p) ?? 0) >= cap || seenFamily.has(family(e.m.id))) return false;
    picked.push(e);
    seenFamily.add(family(e.m.id));
    perProvider.set(p, (perProvider.get(p) ?? 0) + 1);
    return true;
  };
  for (const prov of ["anthropic", "openai", "google", "spacexai"]) {
    const e = scored.find((s) => s.m.provider === prov);
    if (e) take(e, 2);
  }
  for (const e of scored) {
    if (picked.length >= 10) break;
    if (!picked.includes(e)) take(e, 2);
  }
  picked.sort((a, b) => b.score - a.score);
  return picked.slice(0, 10).map((e, i) => ({ ...e.m, rank: i + 1, score: Math.round(e.score * 100) / 100, note: noteFor(e.m) }));
}

export function pickDefault(curated: RankedModel[]): string {
  const sonnet = curated.find((m) => /claude-sonnet/.test(m.id));
  return (sonnet ?? curated[0])?.id ?? "anthropic/claude-sonnet-5.5";
}

export const FALLBACK_MODELS: GatewayModel[] = [
  { id: "anthropic/claude-sonnet-5.5", name: "Claude Sonnet 5.5", provider: "anthropic", description: "", released: null, contextWindow: 1_000_000, vision: true, tools: true, reasoning: true, inPerM: null, outPerM: null },
  { id: "openai/gpt-6.1-sol", name: "GPT-6.1 Sol", provider: "openai", description: "", released: null, contextWindow: 1_050_000, vision: true, tools: true, reasoning: true, inPerM: null, outPerM: null },
  { id: "google/gemini-4-argon", name: "Gemini 4 Argon", provider: "google", description: "", released: null, contextWindow: 1_000_000, vision: true, tools: true, reasoning: true, inPerM: null, outPerM: null },
];
