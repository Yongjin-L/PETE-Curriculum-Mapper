/* Server-only: Claude API calls for plan-of-study extraction and map analysis. */

import Anthropic from "@anthropic-ai/sdk";
import { buildLibrary, standardCode } from "@/lib/dataset";
import { LEVEL_NAMES, type Plan } from "@/lib/types";
import { AI_CONFIG, HttpError } from "./guard";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ apiKey: AI_CONFIG.apiKey, maxRetries: 2, timeout: 110_000 }));

type Content = Anthropic.Beta.BetaContentBlockParam[];

/** One Claude request with safety-refusal fallback; returns the final text. */
async function ask(params: { system: string; content: Content; effort: "low" | "medium"; schema?: Record<string, unknown> }): Promise<string> {
  let msg: Anthropic.Beta.BetaMessage;
  try {
    msg = await anthropic().beta.messages.create({
      model: AI_CONFIG.model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: params.system,
      output_config: { effort: params.effort, ...(params.schema ? { format: { type: "json_schema", schema: params.schema } } : {}) },
      messages: [{ role: "user", content: params.content }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new HttpError(503, "The AI service is busy right now. Please try again in a minute.");
    if (e instanceof Anthropic.BadRequestError) {
      console.error("Claude 400:", e.message);
      throw new HttpError(422, "The AI service could not read this input. Try a different file (for example, a PDF).");
    }
    if (e instanceof Anthropic.AuthenticationError) {
      console.error("Claude auth error:", e.message);
      throw new HttpError(503, "AI features are misconfigured (API key). Please tell the site owner.");
    }
    if (e instanceof Anthropic.APIError) {
      console.error(`Claude ${e.status}:`, e.message);
      throw new HttpError(503, "The AI service is temporarily unavailable. Please try again later.");
    }
    throw e;
  }

  if (msg.stop_reason === "refusal") throw new HttpError(422, "The AI declined to process this input. Please check the file and try again.");
  if (msg.stop_reason === "max_tokens") throw new HttpError(422, "The response was too long to finish. Try a shorter document.");
  const text = msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (!text.trim()) throw new HttpError(502, "The AI returned an empty answer. Please try again.");
  return text;
}

// ---------------------------------------------------------------- Plan of study

export interface ParsedPlan {
  university: string;
  program_name: string;
  courses: { number: string; name: string; term: string }[];
  notes: string;
}

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["university", "program_name", "courses", "notes"],
  properties: {
    university: { type: "string", description: "Institution name if stated, else empty string" },
    program_name: { type: "string", description: "Degree/program name if stated, else empty string" },
    courses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["number", "name", "term"],
        properties: {
          number: { type: "string", description: "Course code exactly as written, e.g. 'PED 210'; empty if none" },
          name: { type: "string", description: "Course title" },
          term: { type: "string", description: "Year/semester label if the document gives one, else empty string" },
        },
      },
    },
    notes: { type: "string", description: "One or two sentences on anything uncertain; empty if none" },
  },
};

const PLAN_SYSTEM = `You read university plans of study, program sheets and degree audits for physical education teacher education (PETE) programs and list their courses.

Return every course a student in the program takes, in the order the document presents them (usually by year and semester). Copy course codes and titles as written; expand obvious abbreviations in titles only when unambiguous. Include major, professional education and required field-experience/student-teaching courses. Leave out generic placeholders that are not specific courses (for example "General Education Elective", "Free elective", "Liberal Arts Core") and list each course only once even if the document repeats it. If the document contains several programs, use the PETE / physical education teacher program. If the input is not a plan of study, return an empty course list and explain in notes.`;

export type PlanInput =
  | { kind: "pdf"; mediaType: string; base64: string }
  | { kind: "image"; mediaType: string; base64: string }
  | { kind: "text"; text: string };

export async function parsePlanOfStudy(input: PlanInput): Promise<ParsedPlan> {
  const content: Content = [];
  if (input.kind === "pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: input.base64 } });
  else if (input.kind === "image")
    content.push({ type: "image", source: { type: "base64", media_type: input.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: input.base64 } });
  else content.push({ type: "text", text: `<document>\n${input.text}\n</document>` });
  content.push({ type: "text", text: "List the courses in this plan of study." });

  const text = await ask({ system: PLAN_SYSTEM, content, effort: "low", schema: PLAN_SCHEMA });
  let parsed: ParsedPlan;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(502, "The AI returned an unreadable answer. Please try again.");
  }
  parsed.courses = (parsed.courses ?? [])
    .map((c) => ({ number: String(c.number ?? "").trim().slice(0, 40), name: String(c.name ?? "").trim().slice(0, 200), term: String(c.term ?? "").trim().slice(0, 60) }))
    .filter((c) => c.number || c.name)
    .slice(0, 150);
  return parsed;
}

// ---------------------------------------------------------------- Map analysis

/** Compact, plain-text description of the map for the model. Built from validated plan data only. */
export function describeMap(plan: Plan): string {
  const lib = buildLibrary(plan);
  const cut = (s: string, n = 160) => (s.length > n ? s.slice(0, n) + "…" : s);
  const stdLabel = (id: string) => {
    const s = lib.standardById.get(id);
    return s ? standardCode(s) : id;
  };
  const lines: string[] = [];
  lines.push(`Program: ${cut(plan.program.name || "(not named)")} at ${cut(plan.program.university || "(university not named)")}`);
  lines.push(`Levels: I = ${LEVEL_NAMES.I}, R = ${LEVEL_NAMES.R}, M = ${LEVEL_NAMES.M}`);
  lines.push("", "COURSES IN PROGRAM ORDER (topic [level] {standards}):");
  plan.courses.forEach((c, i) => {
    const ps = plan.placements.filter((p) => p.courseId === c.id);
    const items = ps.map((p) => {
      const t = lib.topicById.get(p.topicId);
      return `${cut(t?.topic_name ?? p.topicId, 80)} [${p.level}]${t?.standards.length ? ` {${t.standards.map(stdLabel).join(", ")}}` : ""}`;
    });
    lines.push(`${i + 1}. ${cut([c.number, c.name].filter(Boolean).join(" "), 120)}: ${items.length ? items.join("; ") : "(no topics)"}`);
  });

  const mapped = new Set(plan.placements.map((p) => p.topicId));
  const unmapped = lib.topics.filter((t) => !mapped.has(t.topic_id));
  lines.push("", `TOPICS IN THE DATA SET NOT MAPPED TO ANY COURSE (${unmapped.length}):`);
  lines.push(unmapped.length ? unmapped.map((t) => `${cut(t.topic_name, 80)}${t.standards.length ? ` {${t.standards.map(stdLabel).join(", ")}}` : ""}`).join("; ") : "(none)");

  lines.push("", "SHAPE AMERICA 2017 INITIAL PETE STANDARDS (short labels):");
  for (const s of lib.standards.filter((x) => !x.component)) lines.push(`${standardCode(s)}: ${s.short_label}`);
  return lines.join("\n");
}

const ANALYSIS_SYSTEM = `You are an experienced physical education teacher education (PETE) program reviewer helping faculty with an internal program review. You receive a curriculum map: the program's courses in sequence, the topics placed in each course with an I/R/M level (Introduced, Reinforced, Mastered), the SHAPE America 2017 Initial PETE Standards each topic relates to, and the topics not yet mapped.

Write a concise, constructive review in Markdown, about 400-700 words, with these sections:
## Overall
## Standards coverage
## Progression across courses
## Course balance
## Suggestions

Base every observation on the map you are given and refer to courses by number. Things worth checking: standards with few or no mapped topics; topics that are introduced but never reinforced or mastered; topics mastered before they are introduced or with no earlier exposure; courses carrying many or very few topics; important unmapped topics. Suggestions should be specific and actionable (which topic, which course, which level), at most six, most important first. The map shows planned emphasis, not actual teaching quality, so do not judge instruction. Do not quote or invent standard wording beyond the labels given. Use short paragraphs and bullet lists; no tables.`;

export async function analyzeMap(plan: Plan): Promise<string> {
  const text = await ask({
    system: ANALYSIS_SYSTEM,
    content: [{ type: "text", text: `<curriculum_map>\n${describeMap(plan)}\n</curriculum_map>\n\nReview this curriculum map.` }],
    effort: "medium",
  });
  return text.trim();
}
