/* Visual status rules for the curriculum map (icons on rows and standard tiles). */

import { getLibrary } from "./dataset";
import type { Level, Plan } from "./types";

export type RowStatus = { kind: "ok" | "noM" | "order" | "none"; tip: string };

const RANK: Record<Level, number> = { I: 1, R: 2, M: 3 };

/** Levels in program (column) order -> status. */
export function rowStatus(levels: (Level | "")[]): RowStatus {
  const seq = levels.filter(Boolean) as Level[];
  if (!seq.length) return { kind: "none", tip: "Not addressed in any course" };
  if (seq[0] === "M") return { kind: "order", tip: "Mastered before it is introduced or reinforced" };
  for (let i = 1; i < seq.length; i++)
    if (RANK[seq[i]] < RANK[seq[i - 1]]) return { kind: "order", tip: `${seq[i]} comes after ${seq[i - 1]}: check the order` };
  if (!seq.includes("M")) return { kind: "noM", tip: "Never reaches Mastered" };
  return { kind: "ok", tip: "Introduced and builds to Mastered" };
}

export const STATUS_ICON: Record<RowStatus["kind"], string> = { ok: "✓", noM: "!", order: "↯", none: "○" };

export interface StandardSummary {
  standardId: string;
  no: string;
  title: string;
  total: number;
  covered: number;
  mastered: number;
  issues: number;
  strongest: (Level | "")[]; // per course, for the collapsed row
}

export function levelGrid(plan: Plan) {
  const cell = new Map(plan.placements.map((p) => [p.topicId + "|" + p.courseId, p.level]));
  return (componentId: string) => plan.courses.map((c) => cell.get(componentId + "|" + c.id) ?? ("" as const));
}

export function summarize(plan: Plan): StandardSummary[] {
  const lib = getLibrary();
  const row = levelGrid(plan);
  return lib.standards.map((s) => {
    const comps = lib.componentsByStandard.get(s.standard_id) ?? [];
    const rows = comps.map((c) => row(c.component_id));
    const strongest = plan.courses.map((_, i) =>
      rows.reduce<Level | "">((best, r) => (r[i] && (!best || RANK[r[i] as Level] > RANK[best]) ? r[i] : best), "")
    );
    return {
      standardId: s.standard_id,
      no: s.standard_no,
      title: s.title,
      total: comps.length,
      covered: rows.filter((r) => r.some(Boolean)).length,
      mastered: rows.filter((r) => r.includes("M")).length,
      issues: rows.filter((r) => ["noM", "order"].includes(rowStatus(r).kind)).length,
      strongest,
    };
  });
}

export const cycle = (l: Level | ""): Level | null => (l === "" ? "I" : l === "I" ? "R" : l === "R" ? "M" : null);
