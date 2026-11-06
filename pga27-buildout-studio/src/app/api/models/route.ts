import { gateway } from "ai";
import { FALLBACK_MODELS, normalizeRaw, pickDefault, rankModels, type GatewayModel, type ModelsPayload } from "@/lib/ai/models";

export const revalidate = 3600;

const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/models";

async function fetchLive(): Promise<{ models: GatewayModel[]; source: ModelsPayload["source"] }> {
  try {
    const res = await fetch(GATEWAY_URL, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { data: Parameters<typeof normalizeRaw>[0][] };
    const models = json.data.filter((m) => m.type === "language").map(normalizeRaw);
    if (models.length) return { models, source: "gateway" };
  } catch {
    // fall through to the SDK
  }
  const sdk = await gateway.getAvailableModels();
  const models: GatewayModel[] = sdk.models
    .filter((m) => !m.modelType || m.modelType === "language")
    .map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      provider: m.id.split("/")[0],
      description: m.description ?? "",
      released: null,
      contextWindow: null,
      vision: null,
      tools: null,
      reasoning: false,
      inPerM: m.pricing?.input ? parseFloat(m.pricing.input) * 1_000_000 : null,
      outPerM: m.pricing?.output ? parseFloat(m.pricing.output) * 1_000_000 : null,
    }));
  return { models, source: "gateway-sdk" };
}

export async function GET() {
  try {
    const { models, source } = await fetchLive();
    let curated = rankModels(models);
    if (!curated.length) curated = rankModels(models.map((m) => ({ ...m, vision: m.vision ?? true, tools: m.tools ?? true })));
    const payload: ModelsPayload = {
      source,
      fetchedAt: new Date().toISOString(),
      curated,
      all: models.sort((a, b) => (b.released ?? 0) - (a.released ?? 0)),
      defaultModelId: pickDefault(curated),
    };
    return Response.json(payload);
  } catch (e) {
    const curated = rankModels(FALLBACK_MODELS).map((m) => ({ ...m, note: m.note }));
    const payload: ModelsPayload = {
      source: "fallback",
      fetchedAt: new Date().toISOString(),
      curated,
      all: FALLBACK_MODELS,
      defaultModelId: pickDefault(curated),
      warning: `Could not reach the AI Gateway model list (${(e as Error).message}). Showing a minimal offline list.`,
    };
    return Response.json(payload);
  }
}
