import { aiUnavailableReason, consume, errorResponse, HttpError, verifyGoogle } from "@/lib/server/guard";
import { parsePlanOfStudy } from "@/lib/server/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel functions accept request bodies up to 4.5 MB
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_TEXT = 200_000;

/** Upload a plan of study (PDF, Word, image, text/CSV) and get back the list of courses. Nothing is stored. */
export async function POST(req: Request) {
  try {
    const reason = aiUnavailableReason();
    if (reason) throw new HttpError(503, reason);
    const id = await verifyGoogle(req);

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "No file was uploaded.");
    if (file.size === 0) throw new HttpError(400, "The file is empty.");
    if (file.size > MAX_BYTES) throw new HttpError(413, "The file is larger than 4 MB. Try a smaller PDF, or a screenshot of the plan of study.");

    const name = file.name.toLowerCase();
    const type = file.type || "";
    const bytes = Buffer.from(await file.arrayBuffer());
    let input: Parameters<typeof parsePlanOfStudy>[0];

    if (type === "application/pdf" || name.endsWith(".pdf")) {
      input = { kind: "pdf", mediaType: "application/pdf", base64: bytes.toString("base64") };
    } else if (IMAGE_TYPES.includes(type)) {
      input = { kind: "image", mediaType: type, base64: bytes.toString("base64") };
    } else if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer: bytes });
      input = { kind: "text", text: value };
    } else if (name.endsWith(".txt") || name.endsWith(".csv") || name.endsWith(".tsv") || type.startsWith("text/")) {
      input = { kind: "text", text: bytes.toString("utf8") };
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      throw new HttpError(415, "Excel files aren't supported for upload. Copy the course cells and use \"Paste a list\", or save the sheet as CSV or PDF.");
    } else if (name.endsWith(".doc")) {
      throw new HttpError(415, "Old .doc files aren't supported. Save it as .docx or PDF and try again.");
    } else {
      throw new HttpError(415, "Please upload a PDF, Word (.docx), image (PNG/JPG), or text/CSV file.");
    }
    if (input.kind === "text") {
      if (!input.text.trim()) throw new HttpError(422, "No text could be read from this file.");
      if (input.text.length > MAX_TEXT) throw new HttpError(413, "This document is too long. Upload only the plan-of-study pages.");
    }

    const { usage, release } = await consume("parse", id.sub);
    try {
      const result = await parsePlanOfStudy(input);
      return Response.json({ ...result, usage });
    } catch (e) {
      await release();
      throw e;
    }
  } catch (e) {
    return errorResponse(e);
  }
}
