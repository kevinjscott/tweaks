export const dynamic = "force-dynamic";

export function GET() {
  const apiKey = !!process.env.AI_GATEWAY_API_KEY;
  const oidc = !!process.env.VERCEL_OIDC_TOKEN || !!process.env.VERCEL;
  return Response.json({
    configured: apiKey || oidc,
    auth: apiKey ? "api-key" : oidc ? "oidc" : "none",
    requiresCode: !!process.env.STUDIO_ACCESS_CODE,
    message: apiKey || oidc ? "AI Gateway ready." : "Set AI_GATEWAY_API_KEY in .env.local (or deploy on Vercel with OIDC) to enable the assistant.",
  });
}
