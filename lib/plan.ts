import { masterDataset } from "./dataset";
import type { Chapter, Course, Level, Placement, Plan, Textbook, Topic } from "./types";
import { LEVELS } from "./types";

export const STORAGE_KEY = "petemap:plan:v1";

export function emptyPlan(): Plan {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    datasetVersion: masterDataset.datasetVersion,
    program: { university: "", name: "" },
    courses: [],
    placements: [],
    customTopics: [],
    customTextbooks: [],
    customChapters: [],
    analysis: null,
    meta: { createdAt: now, updatedAt: now },
  };
}

export function newCourseId(): string {
  return "c" + Math.random().toString(36).slice(2, 10);
}

/** Next free custom ID, e.g. nextCustomId(["U-T001"], "U-T", 3) -> "U-T002" */
export function nextCustomId(existing: string[], prefix: string, pad: number): string {
  let max = 0;
  for (const id of existing) {
    if (!id.startsWith(prefix)) continue;
    const n = parseInt(id.slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return prefix + String(max + 1).padStart(pad, "0");
}

/** I if no earlier course already covers the topic, otherwise R. */
export function suggestLevel(plan: Plan, courseId: string, topicId: string): Level {
  const idx = plan.courses.findIndex((c) => c.id === courseId);
  const earlier = new Set(plan.courses.slice(0, idx).map((c) => c.id));
  return plan.placements.some((p) => p.topicId === topicId && earlier.has(p.courseId)) ? "R" : "I";
}

export type Action =
  | { type: "setProgram"; university?: string; name?: string }
  | { type: "addCourses"; courses: { number: string; name: string }[]; source?: "manual" | "paste" | "ai" }
  | { type: "updateCourse"; id: string; number: string; name: string }
  | { type: "deleteCourse"; id: string }
  | { type: "moveCourse"; id: string; delta: -1 | 1 }
  | { type: "placeTopic"; courseId: string; topicId: string }
  | { type: "movePlacement"; fromCourseId: string; toCourseId: string; topicId: string }
  | { type: "setLevel"; courseId: string; topicId: string; level: Level }
  | { type: "removePlacement"; courseId: string; topicId: string }
  | { type: "saveCustomTopic"; topic: Topic }
  | { type: "deleteCustomTopic"; topicId: string }
  | { type: "addCustomTextbook"; textbook: Textbook; chapters: Chapter[] }
  | { type: "deleteCustomTextbook"; textbookId: string }
  | { type: "setAnalysis"; analysis: Plan["analysis"] }
  | { type: "replacePlan"; plan: Plan };

function reduce(plan: Plan, a: Action): Plan {
  switch (a.type) {
    case "setProgram":
      return { ...plan, program: { ...plan.program, ...stripUndefined({ university: a.university, name: a.name }) } };

    case "addCourses": {
      const added: Course[] = a.courses
        .filter((c) => c.number.trim() || c.name.trim())
        .map((c) => ({ id: newCourseId(), number: c.number.trim(), name: c.name.trim() }));
      return { ...plan, courses: [...plan.courses, ...added] };
    }

    case "updateCourse":
      return {
        ...plan,
        courses: plan.courses.map((c) => (c.id === a.id ? { ...c, number: a.number.trim(), name: a.name.trim() } : c)),
      };

    case "deleteCourse":
      return {
        ...plan,
        courses: plan.courses.filter((c) => c.id !== a.id),
        placements: plan.placements.filter((p) => p.courseId !== a.id),
      };

    case "moveCourse": {
      const i = plan.courses.findIndex((c) => c.id === a.id);
      const j = i + a.delta;
      if (i < 0 || j < 0 || j >= plan.courses.length) return plan;
      const courses = [...plan.courses];
      [courses[i], courses[j]] = [courses[j], courses[i]];
      return { ...plan, courses };
    }

    case "placeTopic": {
      if (hasPlacement(plan, a.courseId, a.topicId)) return plan;
      const p: Placement = { courseId: a.courseId, topicId: a.topicId, level: suggestLevel(plan, a.courseId, a.topicId) };
      return { ...plan, placements: [...plan.placements, p] };
    }

    case "movePlacement": {
      if (a.fromCourseId === a.toCourseId || hasPlacement(plan, a.toCourseId, a.topicId)) return plan;
      return {
        ...plan,
        placements: plan.placements.map((p) =>
          p.courseId === a.fromCourseId && p.topicId === a.topicId ? { ...p, courseId: a.toCourseId } : p
        ),
      };
    }

    case "setLevel":
      return {
        ...plan,
        placements: plan.placements.map((p) =>
          p.courseId === a.courseId && p.topicId === a.topicId ? { ...p, level: a.level } : p
        ),
      };

    case "removePlacement":
      return {
        ...plan,
        placements: plan.placements.filter((p) => !(p.courseId === a.courseId && p.topicId === a.topicId)),
      };

    case "saveCustomTopic": {
      const exists = plan.customTopics.some((t) => t.topic_id === a.topic.topic_id);
      const topic = { ...a.topic, custom: true };
      return {
        ...plan,
        customTopics: exists
          ? plan.customTopics.map((t) => (t.topic_id === topic.topic_id ? topic : t))
          : [...plan.customTopics, topic],
      };
    }

    case "deleteCustomTopic":
      return {
        ...plan,
        customTopics: plan.customTopics.filter((t) => t.topic_id !== a.topicId),
        placements: plan.placements.filter((p) => p.topicId !== a.topicId),
      };

    case "addCustomTextbook":
      return {
        ...plan,
        customTextbooks: [...plan.customTextbooks, { ...a.textbook, custom: true }],
        customChapters: [...plan.customChapters, ...a.chapters.map((c) => ({ ...c, custom: true }))],
      };

    case "deleteCustomTextbook": {
      const removed = new Set(plan.customChapters.filter((c) => c.textbook_id === a.textbookId).map((c) => c.chapter_id));
      return {
        ...plan,
        customTextbooks: plan.customTextbooks.filter((b) => b.textbook_id !== a.textbookId),
        customChapters: plan.customChapters.filter((c) => c.textbook_id !== a.textbookId),
        customTopics: plan.customTopics.map((t) => ({ ...t, chapters: t.chapters.filter((c) => !removed.has(c.chapter_id)) })),
      };
    }

    case "setAnalysis":
      return { ...plan, analysis: a.analysis };

    case "replacePlan":
      return a.plan;
  }
}

export function planReducer(plan: Plan, a: Action): Plan {
  const next = reduce(plan, a);
  if (next === plan || a.type === "replacePlan") return next;
  return { ...next, meta: { ...next.meta, updatedAt: new Date().toISOString() } };
}

function hasPlacement(plan: Plan, courseId: string, topicId: string) {
  return plan.placements.some((p) => p.courseId === courseId && p.topicId === topicId);
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// ---- Persistence & import

export function loadLocalPlan(): Plan | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? normalizePlan(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

export function saveLocalPlan(plan: Plan): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    return true;
  } catch {
    return false;
  }
}

/** Validates and fills defaults for a plan loaded from storage or an imported JSON file. Throws on invalid input. */
export function normalizePlan(input: unknown): Plan {
  if (!input || typeof input !== "object") throw new Error("Not a plan file.");
  const o = input as Record<string, unknown>;
  if (o.schemaVersion !== 1 || !Array.isArray(o.courses) || !Array.isArray(o.placements))
    throw new Error("This file is not a PETE Curriculum Mapper plan (schemaVersion 1).");

  const base = emptyPlan();
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const program = (o.program ?? {}) as Record<string, unknown>;

  const courses: Course[] = arr<Record<string, unknown>>(o.courses)
    .filter((c) => c && typeof c.id === "string")
    .map((c) => ({ id: c.id as string, number: str(c.number), name: str(c.name) }));
  const courseIds = new Set(courses.map((c) => c.id));

  const seen = new Set<string>();
  const placements: Placement[] = arr<Record<string, unknown>>(o.placements)
    .filter((p) => p && courseIds.has(p.courseId as string) && typeof p.topicId === "string")
    .map((p) => ({
      courseId: p.courseId as string,
      topicId: p.topicId as string,
      level: LEVELS.includes(p.level as Level) ? (p.level as Level) : "I",
    }))
    .filter((p) => {
      const k = p.courseId + "|" + p.topicId;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  const meta = (o.meta ?? {}) as Record<string, unknown>;
  const an = (o.analysis ?? null) as Record<string, unknown> | null;
  const analysis = an && typeof an.markdown === "string" ? { markdown: an.markdown, createdAt: str(an.createdAt) } : null;
  return {
    ...base,
    datasetVersion: str(o.datasetVersion) || base.datasetVersion,
    program: { university: str(program.university), name: str(program.name) },
    courses,
    placements,
    customTopics: arr<Topic>(o.customTopics).map((t) => ({
      ...t,
      keywords: arr<string>(t.keywords),
      chapters: arr(t.chapters),
      standards: arr<string>(t.standards),
      custom: true,
    })),
    customTextbooks: arr<Textbook>(o.customTextbooks).map((b) => ({ ...b, custom: true })),
    customChapters: arr<Chapter>(o.customChapters).map((c) => ({ ...c, custom: true })),
    analysis,
    meta: { createdAt: str(meta.createdAt) || base.meta.createdAt, updatedAt: str(meta.updatedAt) || base.meta.updatedAt },
  };
}

/** Parses pasted lines like "PED 210  Foundations of PE", "PED 210 - Foundations", or tab-separated cells. */
export function parseCourseLines(text: string): { number: string; name: string }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const tab = line.split("\t").map((s) => s.trim()).filter(Boolean);
      if (tab.length >= 2) return { number: tab[0], name: tab.slice(1).join(" ") };
      const m = line.match(/^([A-Za-z]{2,5}[\s-]?\d{2,4}[A-Za-z]?)\s*[-–—:,.]?\s+(.+)$/);
      if (m) return { number: m[1], name: m[2] };
      return { number: "", name: line };
    });
}
