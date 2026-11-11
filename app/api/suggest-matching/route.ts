import { aiUnavailableReason, consume, errorResponse, HttpError, verifyGoogle } from "@/lib/server/guard";
import { suggestMatching } from "@/lib/server/ai";
import { recordServerEvent } from "@/lib/server/stats";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Suggest SHAPE component matching for courses entered by hand: { program, courses: [{number, name}] } in program order. */
export async function POST(req: Request) {
  try {
    const reason = aiUnavailableReason();
    if (reason) throw new HttpError(503, reason);
    const id = await verifyGoogle(req);

    const raw = await req.text();
    if (raw.length > 100_000) throw new HttpError(413, "Too many courses.");
    let body: { program?: { university?: unknown; name?: unknown }; courses?: { number?: unknown; name?: unknown }[] };
    try {
      body = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "The request could not be read.");
    }
    const courses = (Array.isArray(body.courses) ? body.courses : [])
      .map((c) => ({ number: String(c?.number ?? "").slice(0, 40), name: String(c?.name ?? "").slice(0, 200), note: String((c as { note?: unknown })?.note ?? "").slice(0, 600) }))
      .filter((c) => c.number || c.name);
    if (!courses.length) throw new HttpError(400, "Add courses first.");
    if (courses.length > 100) throw new HttpError(413, "Too many courses (maximum 100).");
    const program = { university: String(body.program?.university ?? ""), name: String(body.program?.name ?? "") };

    const { usage, release } = await consume("suggest", id.sub);
    try {
      const result = await suggestMatching(program, courses);
      await recordServerEvent("ai_suggest");
      return Response.json({ ...result, usage });
    } catch (e) {
      await release();
      throw e;
    }
  } catch (e) {
    return errorResponse(e);
  }
}
