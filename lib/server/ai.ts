/* Server-only: Claude API calls: plan-of-study reading with initial SHAPE matching, matching suggestions, map analysis. */

import Anthropic from "@anthropic-ai/sdk";
import { getLibrary } from "@/lib/dataset";
import { LEVEL_NAMES, LEVELS, type Level, type Plan } from "@/lib/types";
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

// ---------------------------------------------------------------- SHAPE reference for prompts

function standardsReference(): string {
  const lib = getLibrary();
  return lib.standards
    .map((s) => {
      const comps = (lib.componentsByStandard.get(s.standard_id) ?? []).map((c) => `  ${c.component_id} ${c.text}`).join("\n");
      return `Standard ${s.standard_no}. ${s.title}: ${s.description}\n${comps}`;
    })
    .join("\n\n");
}

const componentIds = () => getLibrary().components.map((c) => c.component_id);

const MATCHING_GUIDANCE = `How to suggest the initial matching:
- For each course, list the SHAPE components it substantially addresses, with a level:
  I (Introduced): candidates first learn about it; R (Reinforced): they practice and deepen it; M (Mastered): they demonstrate it independently, usually in methods practica, field experiences, student teaching or capstone courses.
- Base the matching on the course titles, any course descriptions in the input, and how PETE programs are commonly designed. Use the course order: earlier exposure is usually I, later courses R, culminating experiences M.
- Be selective: typically 1-6 components per course. Courses unrelated to physical education teacher preparation (for example general education) can have an empty list.
- It is fine to leave a component unmatched if no course plausibly covers it; faculty will review and edit every suggestion.`;

export type Suggested = { id: string; level: Level }[];

const COMPONENT_LIST_SCHEMA = () => ({
  type: "array",
  description: "SHAPE components this course substantially addresses, with a level",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["id", "level"],
    properties: { id: { type: "string", enum: componentIds() }, level: { type: "string", enum: LEVELS } },
  },
});

function cleanSuggestions(list: unknown): Suggested {
  const ids = new Set(componentIds());
  const out: Suggested = [];
  for (const x of Array.isArray(list) ? list : []) {
    const id = String((x as { id?: unknown })?.id ?? "");
    const level = String((x as { level?: unknown })?.level ?? "") as Level;
    if (ids.has(id) && LEVELS.includes(level) && !out.some((o) => o.id === id)) out.push({ id, level });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(502, "The AI returned an unreadable answer. Please try again.");
  }
}

// ---------------------------------------------------------------- Plan of study

export interface ParsedPlan {
  university: string;
  program_name: string;
  courses: { number: string; name: string; term: string; components: Suggested }[];
  notes: string;
}

const planSchema = () => ({
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
        required: ["number", "name", "term", "components"],
        properties: {
          number: { type: "string", description: "Course code exactly as written, e.g. 'PED 210'; empty if none" },
          name: { type: "string", description: "Course title" },
          term: { type: "string", description: "Year/semester label if the document gives one, else empty string" },
          components: COMPONENT_LIST_SCHEMA(),
        },
      },
    },
    notes: { type: "string", description: "One or two sentences on anything uncertain (e.g. matching based on titles only); empty if none" },
  },
});

const planSystem = () => `You help physical education teacher education (PETE) faculty map their program to the SHAPE America 2017 National Standards for Initial Physical Education Teacher Education. You read a plan of study (program sheet, curriculum sheet or degree audit), list its courses, and suggest an initial matching of each course to the standards' components.

Listing courses: return every course a student in the program takes, in the order the document presents them (usually by year and semester). Copy course codes and titles as written. Include major, professional education, field-experience and student-teaching courses, and specific required science or health courses. Leave out generic placeholders that are not specific courses (for example "General Education Elective", "Free elective", "Liberal Arts Core") and list each course only once. If the document contains several programs, use the PETE / physical education teacher program. If the input is not a plan of study, return an empty course list and explain in notes.

${MATCHING_GUIDANCE}

SHAPE America 2017 Initial PETE Standards and components:
${standardsReference()}`;

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
  content.push({ type: "text", text: "List the courses in this plan of study and suggest the initial SHAPE component matching for each." });

  const parsed = parseJson<ParsedPlan>(await ask({ system: planSystem(), content, effort: "medium", schema: planSchema() }));
  parsed.courses = (parsed.courses ?? [])
    .map((c) => ({
      number: String(c.number ?? "").trim().slice(0, 40),
      name: String(c.name ?? "").trim().slice(0, 200),
      term: String(c.term ?? "").trim().slice(0, 60),
      components: cleanSuggestions(c.components),
    }))
    .filter((c) => c.number || c.name)
    .slice(0, 150);
  parsed.university = String(parsed.university ?? "").slice(0, 200);
  parsed.program_name = String(parsed.program_name ?? "").slice(0, 200);
  parsed.notes = String(parsed.notes ?? "").slice(0, 600);
  return parsed;
}

// ---------------------------------------------------------------- Matching for courses entered by hand

const suggestSchema = () => ({
  type: "object",
  additionalProperties: false,
  required: ["courses", "notes"],
  properties: {
    courses: {
      type: "array",
      description: "One entry per input course, same order",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "components"],
        properties: { index: { type: "integer", description: "The course's number in the input list" }, components: COMPONENT_LIST_SCHEMA() },
      },
    },
    notes: { type: "string" },
  },
});

export async function suggestMatching(program: { university: string; name: string }, courses: { number: string; name: string }[]) {
  const list = courses.map((c, i) => `${i + 1}. ${[c.number, c.name].filter(Boolean).join(" ").slice(0, 160)}`).join("\n");
  const system = `You help physical education teacher education (PETE) faculty map their program to the SHAPE America 2017 National Standards for Initial Physical Education Teacher Education. You receive the program's courses in order and suggest an initial matching of each course to the standards' components.

${MATCHING_GUIDANCE}

SHAPE America 2017 Initial PETE Standards and components:
${standardsReference()}`;
  const text = await ask({
    system,
    content: [
      {
        type: "text",
        text: `Program: ${program.name.slice(0, 160) || "(not named)"} at ${program.university.slice(0, 160) || "(not named)"}\n\n<courses_in_program_order>\n${list}\n</courses_in_program_order>\n\nSuggest the initial SHAPE component matching for each course. Use the course's number in this list as index.`,
      },
    ],
    effort: "medium",
    schema: suggestSchema(),
  });
  const r = parseJson<{ courses: { index: number; components: unknown }[]; notes: string }>(text);
  const result: Suggested[] = courses.map(() => []);
  for (const c of r.courses ?? []) {
    const i = Number(c.index) - 1;
    if (i >= 0 && i < courses.length) result[i] = cleanSuggestions(c.components);
  }
  return { suggestions: result, notes: String(r.notes ?? "").slice(0, 600) };
}

// ---------------------------------------------------------------- Map analysis

/** Compact, plain-text description of the map for the model. Built from validated plan data only. */
export function describeMap(plan: Plan): string {
  const lib = getLibrary();
  const cut = (s: string, n = 160) => (s.length > n ? s.slice(0, n) + "…" : s);
  const lines: string[] = [];
  lines.push(`Program: ${cut(plan.program.name || "(not named)")} at ${cut(plan.program.university || "(university not named)")}`);
  lines.push(`Levels: I = ${LEVEL_NAMES.I}, R = ${LEVEL_NAMES.R}, M = ${LEVEL_NAMES.M}`);
  lines.push("", "COURSES IN PROGRAM ORDER (component [level]):");
  plan.courses.forEach((c, i) => {
    const items = plan.placements
      .filter((p) => p.courseId === c.id && lib.componentById.has(p.topicId))
      .sort((a, b) => a.topicId.localeCompare(b.topicId, undefined, { numeric: true }))
      .map((p) => `${p.topicId} [${p.level}]`);
    lines.push(`${i + 1}. ${cut([c.number, c.name].filter(Boolean).join(" "), 120)}: ${items.length ? items.join(", ") : "(none)"}`);
  });
  const mapped = new Set(plan.placements.map((p) => p.topicId));
  const unmapped = lib.components.filter((c) => !mapped.has(c.component_id)).map((c) => c.component_id);
  lines.push("", `COMPONENTS NOT MAPPED TO ANY COURSE (${unmapped.length}): ${unmapped.join(", ") || "(none)"}`);
  lines.push("", "SHAPE AMERICA 2017 INITIAL PETE STANDARDS AND COMPONENTS:", standardsReference());
  return lines.join("\n");
}

const ANALYSIS_SYSTEM = `You are an experienced physical education teacher education (PETE) program reviewer helping faculty with an internal program review. You receive a curriculum map: the program's courses in sequence, the SHAPE America 2017 Initial PETE Standards components placed in each course with an I/R/M level (Introduced, Reinforced, Mastered), the components not yet mapped, and the standards' wording.

Write a concise, constructive review in Markdown, about 400-700 words, with these sections:
## Overall
## Standards coverage
## Progression across courses
## Course balance
## Suggestions

Base every observation on the map you are given and refer to courses by number and components by code (e.g. 3.b). Things worth checking: standards or components with no or thin coverage; components introduced but never reinforced or mastered; components mastered before they are introduced or with no earlier exposure; whether each standard reaches M before program completion; courses carrying many or very few components. Suggestions should be specific and actionable (which component, which course, which level), at most six, most important first. The map shows planned emphasis, not actual teaching quality, so do not judge instruction. Use short paragraphs and bullet lists; no tables.`;

export async function analyzeMap(plan: Plan): Promise<string> {
  const text = await ask({
    system: ANALYSIS_SYSTEM,
    content: [{ type: "text", text: `<curriculum_map>\n${describeMap(plan)}\n</curriculum_map>\n\nReview this curriculum map.` }],
    effort: "medium",
  });
  return text.trim();
}
