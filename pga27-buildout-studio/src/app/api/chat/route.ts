import { convertToModelMessages, createUIMessageStreamResponse, gateway, isStepCount, streamText, toUIMessageStream, type UIMessage } from "ai";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { toAiTools } from "@/lib/ai/tools";
import type { SceneState } from "@/lib/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface ChatBody {
  messages: UIMessage[];
  modelId?: string;
  scene: SceneState;
  vision?: boolean;
}

function gatewayConfigured() {
  return !!process.env.AI_GATEWAY_API_KEY || !!process.env.VERCEL_OIDC_TOKEN || !!process.env.VERCEL;
}

function friendlyError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  if (/api key|unauthor|401|authentication/i.test(msg)) return "AI Gateway authentication failed. Check AI_GATEWAY_API_KEY (or Vercel OIDC).";
  if (/credit|payment|402|insufficient/i.test(msg)) return "AI Gateway reports insufficient credits or a payment problem for this key.";
  if (/rate limit|429/i.test(msg)) return "Rate limited by the AI Gateway. Wait a moment or pick another model.";
  if (/does not support|not support.*tool|tool.*not support|image|modalit/i.test(msg)) return `The selected model rejected the request (${msg.slice(0, 160)}). Pick a model with tool calling (and vision for screenshots).`;
  return `Model error: ${msg.slice(0, 300)}`;
}

export async function POST(req: Request) {
  if (!gatewayConfigured()) {
    return Response.json(
      {
        error: "gateway_not_configured",
        message: "AI Gateway is not configured. Add AI_GATEWAY_API_KEY to .env.local (see .env.example) or deploy on Vercel with OIDC, then restart.",
      },
      { status: 503 },
    );
  }

  const body = (await req.json()) as ChatBody;
  const modelId = body.modelId || "anthropic/claude-sonnet-5.5";
  const ctx = { scene: body.scene };
  const hasImage = !!body.vision && body.messages.some((m) => m.parts.some((p) => p.type === "file"));

  const messages = body.vision
    ? body.messages
    : body.messages.map((m) => ({ ...m, parts: m.parts.filter((p) => p.type !== "file") }));

  const result = streamText({
    model: gateway(modelId),
    system: buildSystemPrompt(body.scene, { hasImage }),
    messages: await convertToModelMessages(messages),
    tools: toAiTools(ctx),
    stopWhen: isStepCount(16),
    abortSignal: req.signal,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream, onError: friendlyError }),
  });
}
