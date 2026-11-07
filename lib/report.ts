/* Builds a format-independent report from a plan. The PDF and Word exporters render this model. */

import { DATASET_SOURCE, getLibrary } from "./dataset";
import { LEVEL_NAMES, LEVELS, type Level, type Plan } from "./types";

export type ExportLevel = "summary" | "standard" | "full";

export interface Sections {
  wording: boolean; // full SHAPE wording under each component
  coverage: boolean; // standards coverage table
  matrix: boolean; // components x courses grid
  analysis: boolean; // AI analysis
}

export const PRESETS: Record<ExportLevel, Sections> = {
  summary: { wording: false, coverage: false, matrix: false, analysis: false },
  standard: { wording: true, coverage: true, matrix: false, analysis: false },
  full: { wording: true, coverage: true, matrix: true, analysis: true },
};

export const LEVEL_INFO: Record<ExportLevel, { label: string; description: string }> = {
  summary: { label: "Summary", description: "Each course with its SHAPE components and I/R/M levels." },
  standard: { label: "Standard", description: "Summary plus the full component wording and a standards coverage table." },
  full: { label: "Full", description: "Standard plus a components × courses matrix and the AI analysis." },
};

export interface ReportItem {
  code: string; // "3.b"
  label: string;
  text: string;
  level: Level;
}

export interface Report {
  title: string;
  university: string;
  program: string;
  generated: string;
  datasetVersion: string;
  credit: string;
  source: string;
  sections: Sections;
  stats: { courses: number; componentsMapped: number; componentsTotal: number; placements: number; byLevel: Record<Level, number> };
  courses: { heading: string; number: string; name: string; items: ReportItem[] }[];
  matrix: {
    columns: string[];
    columnNames: string[];
    groups: { standard: string; rows: { code: string; label: string; cells: (Level | "")[] }[] }[];
  };
  coverage: { code: string; label: string; mapped: number; total: number; courses: number; levels: Record<Level, number> }[];
  analysis: string | null;
}

const byCode = (a: { topicId: string }, b: { topicId: string }) => a.topicId.localeCompare(b.topicId, undefined, { numeric: true });

export function buildReport(plan: Plan, sections: Sections, analysis: string | null = null): Report {
  const lib = getLibrary();
  const byLevel: Record<Level, number> = { I: 0, R: 0, M: 0 };
  for (const p of plan.placements) byLevel[p.level]++;
  const mapped = new Set(plan.placements.map((p) => p.topicId));

  const courses = plan.courses.map((c, i) => {
    const items: ReportItem[] = plan.placements
      .filter((p) => p.courseId === c.id)
      .sort(byCode)
      .map((p) => {
        const comp = lib.componentById.get(p.topicId);
        return { code: p.topicId, label: comp?.label ?? "Unknown component", text: comp?.text ?? "", level: p.level };
      });
    return { heading: `${i + 1}. ${[c.number, c.name].filter(Boolean).join(" ")}`, number: c.number, name: c.name, items };
  });

  const cell = new Map(plan.placements.map((p) => [p.topicId + "|" + p.courseId, p.level]));
  const matrix = {
    columns: plan.courses.map((c, i) => c.number || `#${i + 1}`),
    columnNames: plan.courses.map((c) => [c.number, c.name].filter(Boolean).join(" ")),
    groups: lib.standards
      .map((s) => ({
        standard: `Standard ${s.standard_no}: ${s.title}`,
        rows: (lib.componentsByStandard.get(s.standard_id) ?? []).map((comp) => ({
          code: comp.component_id,
          label: comp.label,
          cells: plan.courses.map((c) => cell.get(comp.component_id + "|" + c.id) ?? ""),
        })),
      }))
      .filter((g) => g.rows.length),
  };

  const coverage = lib.standards.map((s) => {
    const ids = new Set((lib.componentsByStandard.get(s.standard_id) ?? []).map((c) => c.component_id));
    const ps = plan.placements.filter((p) => ids.has(p.topicId));
    const levels: Record<Level, number> = { I: 0, R: 0, M: 0 };
    for (const p of ps) levels[p.level]++;
    return {
      code: `Standard ${s.standard_no}`,
      label: s.title,
      mapped: [...ids].filter((id) => mapped.has(id)).length,
      total: ids.size,
      courses: new Set(ps.map((p) => p.courseId)).size,
      levels,
    };
  });

  return {
    title: "Curriculum Map",
    university: plan.program.university.trim(),
    program: plan.program.name.trim(),
    generated: new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
    datasetVersion: plan.datasetVersion,
    credit: "Created with PETE Curriculum Mapper by Yongjin Lee (curriculum.yongjin.info)",
    source: `${DATASET_SOURCE} © SHAPE America.`,
    sections: { ...sections, analysis: sections.analysis && !!analysis },
    stats: {
      courses: plan.courses.length,
      componentsMapped: mapped.size,
      componentsTotal: lib.components.length,
      placements: plan.placements.length,
      byLevel,
    },
    courses,
    matrix,
    coverage,
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

export type MdBlock = { kind: "heading" | "bullet" | "number" | "para"; text: string; n?: number };

/** Splits AI Markdown into simple blocks for the PDF and Word exporters (bold/italic markers removed). */
export function markdownBlocks(md: string): MdBlock[] {
  const clean = (x: string) => x.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/(^|\s)\*([^*\s][^*]*)\*/g, "$1$2").trim();
  const out: MdBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: "para", text: clean(para.join(" ")) });
    para = [];
  };
  for (const raw of md.replace(/\r\n/g, "\n").split("\n")) {
    const h = raw.match(/^#{1,4}\s+(.*)$/), ul = raw.match(/^\s*[-*•]\s+(.*)$/), ol = raw.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (h) { flush(); out.push({ kind: "heading", text: clean(h[1]) }); }
    else if (ul) { flush(); out.push({ kind: "bullet", text: clean(ul[1]) }); }
    else if (ol) { flush(); out.push({ kind: "number", text: clean(ol[2]), n: Number(ol[1]) }); }
    else if (!raw.trim()) flush();
    else if (/^\s{2,}/.test(raw) && out.length && out[out.length - 1].kind !== "heading" && !para.length) out[out.length - 1].text += " " + clean(raw);
    else para.push(raw.trim());
  }
  flush();
  return out;
}
