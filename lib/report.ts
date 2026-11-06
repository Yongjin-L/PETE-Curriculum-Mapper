/* Builds a format-independent report from a plan. The PDF and Word exporters render this model. */

import { buildLibrary, standardCode } from "./dataset";
import { LEVEL_NAMES, LEVELS, type Level, type Plan, type Textbook } from "./types";

export type ExportLevel = "summary" | "standard" | "full";

export interface Sections {
  chapters: boolean; // linked chapters under each topic
  standards: boolean; // SHAPE standards under each topic
  matrix: boolean; // topics x courses grid
  coverage: boolean; // standards coverage table
  references: boolean; // textbook reference list
  analysis: boolean; // AI analysis (Phase 5)
}

export const PRESETS: Record<ExportLevel, Sections> = {
  summary: { chapters: false, standards: false, matrix: false, coverage: false, references: false, analysis: false },
  standard: { chapters: true, standards: true, matrix: false, coverage: false, references: true, analysis: false },
  full: { chapters: true, standards: true, matrix: true, coverage: true, references: true, analysis: true },
};

export const LEVEL_INFO: Record<ExportLevel, { label: string; description: string }> = {
  summary: { label: "Summary", description: "Each course with its topics and I/R/M levels." },
  standard: { label: "Standard", description: "Summary plus linked textbook chapters, SHAPE standards and references." },
  full: { label: "Full", description: "Standard plus a topics × courses matrix and a standards coverage table." },
};

export interface ReportTopic {
  name: string;
  level: Level;
  custom: boolean;
  chapters: string[];
  standards: string[];
}

export interface Report {
  title: string;
  university: string;
  program: string;
  generated: string;
  datasetVersion: string;
  credit: string;
  sections: Sections;
  stats: { courses: number; topicsMapped: number; placements: number; byLevel: Record<Level, number> };
  courses: { heading: string; number: string; name: string; topics: ReportTopic[] }[];
  matrix: { columns: string[]; columnNames: string[]; rows: { topic: string; cells: (Level | "")[] }[] };
  coverage: { code: string; label: string; mapped: number; total: number; courses: number; levels: Record<Level, number> }[];
  references: string[];
  analysis: string | null;
}

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export function citation(b: Textbook): string {
  const ed = Number(b.edition);
  const edition = b.edition && !(ed === 1) ? ` (${Number.isFinite(ed) && ed > 0 ? ordinal(ed) : b.edition} ed.)` : "";
  const year = b.year ? ` (${b.year}).` : ".";
  return `${b.authors || "Unknown author"}${year} ${b.title}${edition}.${b.publisher ? " " + b.publisher + "." : ""}`.replace(/\.\./g, ".");
}

export function buildReport(plan: Plan, sections: Sections, analysis: string | null = null): Report {
  const lib = buildLibrary(plan);
  const byLevel: Record<Level, number> = { I: 0, R: 0, M: 0 };
  for (const p of plan.placements) byLevel[p.level]++;
  const mappedTopicIds = new Set(plan.placements.map((p) => p.topicId));
  const usedChapterIds = new Set<string>();

  const courses = plan.courses.map((c, i) => {
    const topics: ReportTopic[] = plan.placements
      .filter((p) => p.courseId === c.id)
      .map((p) => {
        const t = lib.topicById.get(p.topicId);
        const chapters = (t?.chapters ?? []).map((ch) => {
          usedChapterIds.add(ch.chapter_id);
          const chapter = lib.chapterById.get(ch.chapter_id);
          const book = chapter && lib.textbookById.get(chapter.textbook_id);
          if (!chapter) return ch.chapter_id;
          const author = book?.authors?.split(/[;,]/)[0]?.trim();
          return `${book?.title ?? chapter.textbook_id}${author ? ` (${author}${book?.year ? ", " + book.year : ""})` : ""}, Ch. ${chapter.chapter_no}: ${chapter.chapter_title}`;
        });
        const standards = (t?.standards ?? []).map((s) => {
          const st = lib.standardById.get(s);
          return st ? `${standardCode(st)}: ${st.short_label}` : s;
        });
        return { name: t?.topic_name ?? `Unknown topic (${p.topicId})`, level: p.level, custom: !!t?.custom, chapters, standards };
      });
    const label = [c.number, c.name].filter(Boolean).join(" ");
    return { heading: `${i + 1}. ${label}`, number: c.number, name: c.name, topics };
  });

  const cell = new Map(plan.placements.map((p) => [p.topicId + "|" + p.courseId, p.level]));
  const matrixTopics = lib.topics.filter((t) => mappedTopicIds.has(t.topic_id));
  const matrix = {
    columns: plan.courses.map((c, i) => c.number || `#${i + 1}`),
    columnNames: plan.courses.map((c) => [c.number, c.name].filter(Boolean).join(" ")),
    rows: matrixTopics.map((t) => ({ topic: t.topic_name, cells: plan.courses.map((c) => cell.get(t.topic_id + "|" + c.id) ?? "") })),
  };

  const coverage = lib.standards
    .filter((s) => !s.component)
    .map((s) => {
      const related = lib.topics.filter((t) => t.standards.some((x) => x === s.standard_id || x.startsWith(s.standard_id)));
      const relatedIds = new Set(related.map((t) => t.topic_id));
      const ps = plan.placements.filter((p) => relatedIds.has(p.topicId));
      const levels: Record<Level, number> = { I: 0, R: 0, M: 0 };
      for (const p of ps) levels[p.level]++;
      return {
        code: standardCode(s),
        label: s.short_label,
        mapped: related.filter((t) => mappedTopicIds.has(t.topic_id)).length,
        total: related.length,
        courses: new Set(ps.map((p) => p.courseId)).size,
        levels,
      };
    });

  const bookIds = new Set([...usedChapterIds].map((id) => lib.chapterById.get(id)?.textbook_id).filter(Boolean) as string[]);
  const references = lib.textbooks
    .filter((b) => bookIds.has(b.textbook_id))
    .map(citation)
    .sort((a, b) => a.localeCompare(b));

  const program = plan.program.name.trim();
  const university = plan.program.university.trim();
  return {
    title: "Curriculum Map",
    university,
    program,
    generated: new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
    datasetVersion: plan.datasetVersion,
    credit: "Created with PETE Curriculum Mapper by Yongjin Lee (curriculum.yongjin.info)",
    sections: { ...sections, analysis: sections.analysis && !!analysis },
    stats: { courses: plan.courses.length, topicsMapped: mappedTopicIds.size, placements: plan.placements.length, byLevel },
    courses,
    matrix,
    coverage,
    references,
    analysis,
  };
}

export const LEVEL_LEGEND = LEVELS.map((l) => `${l} = ${LEVEL_NAMES[l]}`).join("   ");

/** Colors for level cells (hex without #), shared by PDF and Word. */
export const LEVEL_COLORS: Record<Level, { fill: string; text: string }> = {
  I: { fill: "DCE7FF", text: "1D4ED8" },
  R: { fill: "FDEBC8", text: "92400E" },
  M: { fill: "D4F0DD", text: "166534" },
};

/** File-system- and browser-safe name: some browsers reject download names with dashes like "–". */
export function safeFileBase(s: string): string {
  return (
    s
      .replace(/[\u2010-\u2015\u2212]/g, "-")
      .replace(/[\u2018\u2019]/g, "'")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9 .,()&'_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "Curriculum map"
  );
}

export function exportFileName(plan: Plan, level: ExportLevel, ext: string): string {
  const named = plan.program.name || plan.program.university;
  const base = named ? `${safeFileBase(named)} - curriculum map` : "Curriculum map";
  return `${base} (${LEVEL_INFO[level].label}).${ext}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
