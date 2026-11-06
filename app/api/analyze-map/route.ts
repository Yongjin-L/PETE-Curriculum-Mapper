import { aiUnavailableReason, consume, errorResponse, HttpError, verifyGoogle } from "@/lib/server/guard";
import { analyzeMap } from "@/lib/server/ai";
import { normalizePlan } from "@/lib/plan";
import { recordServerEvent } from "@/lib/server/stats";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BODY = 1024 * 1024;

/** Analyze a curriculum map and return a Markdown report. Nothing is stored. */
export async function POST(req: Request) {
  try {
    const reason = aiUnavailableReason();
    if (reason) throw new HttpError(503, reason);
    const id = await verifyGoogle(req);

    const raw = await req.text();
    if (raw.length > MAX_BODY) throw new HttpError(413, "This map is too large to analyze.");
    let plan;
    try {
      plan = normalizePlan(JSON.parse(raw));
    } catch {
      throw new HttpError(400, "The map could not be read.");
    }
    if (plan.courses.length === 0 || plan.placements.length === 0) throw new HttpError(400, "Add courses and map some topics before running an analysis.");
    if (plan.courses.length > 100 || plan.placements.length > 3000) throw new HttpError(413, "This map is too large to analyze.");

    const { usage, release } = await consume("analyze", id.sub);
    try {
      const markdown = await analyzeMap(plan);
      await recordServerEvent("ai_analysis");
      return Response.json({ markdown, usage, createdAt: new Date().toISOString() });
    } catch (e) {
      await release();
      throw e;
    }
  } catch (e) {
    return errorResponse(e);
  }
}
