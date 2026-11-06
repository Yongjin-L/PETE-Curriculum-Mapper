import { aiUnavailableReason, errorResponse, usageFor, verifyGoogle } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

/** Whether AI features are available, and (when signed in) how many uses remain today. */
export async function GET(req: Request) {
  const reason = aiUnavailableReason();
  if (reason) return Response.json({ enabled: false, reason });
  if (!req.headers.get("authorization")) return Response.json({ enabled: true });
  try {
    const id = await verifyGoogle(req);
    return Response.json({ enabled: true, usage: await usageFor(id.sub) });
  } catch (e) {
    return errorResponse(e);
  }
}
