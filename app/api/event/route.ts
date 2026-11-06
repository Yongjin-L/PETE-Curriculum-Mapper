import { recordEvents } from "@/lib/server/stats";

export const dynamic = "force-dynamic";

/** Anonymous usage counts from the browser: { counts: { topic_placed: 3, ... }, institution?: string }. */
export async function POST(req: Request) {
  try {
    const text = await req.text();
    if (text.length > 4000) return new Response(null, { status: 413 });
    const body = JSON.parse(text) as { counts?: Record<string, number>; institution?: string };
    if (body && typeof body.counts === "object") await recordEvents(body.counts, typeof body.institution === "string" ? body.institution : undefined);
  } catch {
    /* ignore malformed input */
  }
  return new Response(null, { status: 204 });
}
