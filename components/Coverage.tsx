"use client";

import { useState, type Dispatch } from "react";
import { standardTitle, type Library } from "@/lib/dataset";
import type { Action } from "@/lib/plan";
import { LEVEL_NAMES, LEVELS, type Level, type Plan } from "@/lib/types";
import { AnalysisPanel } from "./AiPanels";
import type { AiApi } from "./useAi";

export function Coverage({ plan, lib, ai, dispatch }: { plan: Plan; lib: Library; ai: AiApi; dispatch: Dispatch<Action> }) {
  const [showAll, setShowAll] = useState(true);

  const cell = new Map(plan.placements.map((p) => [p.topicId + "|" + p.courseId, p.level]));
  const mapped = new Set(plan.placements.map((p) => p.topicId));

  if (plan.courses.length === 0) return <p className="muted center pad">Add courses on the Map tab to see coverage.</p>;

  const summary = lib.standards.map((s) => {
    const comps = lib.componentsByStandard.get(s.standard_id) ?? [];
    const levels: Record<Level, number> = { I: 0, R: 0, M: 0 };
    for (const p of plan.placements) if (comps.some((c) => c.component_id === p.topicId)) levels[p.level]++;
    return { s, total: comps.length, covered: comps.filter((c) => mapped.has(c.component_id)).length, levels };
  });

  return (
    <section className="coverage">
      <h2>SHAPE America standards coverage</h2>
      <div className="std-grid">
        {summary.map(({ s, total, covered, levels }) => (
          <div key={s.standard_id} className="std-card">
            <div className="std-code">Standard {s.standard_no}</div>
            <div className="std-label">{s.title}</div>
            <div className="bar" aria-hidden>
              <span style={{ width: total ? `${(covered / total) * 100}%` : 0 }} />
            </div>
            <div className="small muted">
              {covered} of {total} components mapped · I {levels.I} · R {levels.R} · M {levels.M}
            </div>
          </div>
        ))}
      </div>

      <div className="row between">
        <h2>Components × courses</h2>
        <label className="check small">
          <input type="checkbox" checked={!showAll} onChange={(e) => setShowAll(!e.target.checked)} /> Hide unmapped components
        </label>
      </div>
      <div className="legend small">
        {LEVELS.map((l) => (
          <span key={l}>
            <span className={`dot level-${l}`}>{l}</span> {LEVEL_NAMES[l]}
          </span>
        ))}
      </div>
      <div className="matrix-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th className="sticky-col">Component</th>
              {plan.courses.map((c) => (
                <th key={c.id} title={c.name}>
                  {c.number || c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lib.standards.map((s) => {
              const comps = (lib.componentsByStandard.get(s.standard_id) ?? []).filter((c) => showAll || mapped.has(c.component_id));
              if (!comps.length) return null;
              return [
                <tr key={s.standard_id} className="matrix-group">
                  <th className="sticky-col" colSpan={1}>
                    {standardTitle(s)}
                  </th>
                  <td colSpan={plan.courses.length} />
                </tr>,
                ...comps.map((c) => (
                  <tr key={c.component_id} className={mapped.has(c.component_id) ? "" : "unmapped-row"}>
                    <th className="sticky-col" scope="row" title={c.text}>
                      <span className="comp-code">{c.component_id}</span> {c.label}
                    </th>
                    {plan.courses.map((course) => {
                      const lvl = cell.get(c.component_id + "|" + course.id);
                      return <td key={course.id}>{lvl && <span className={`dot level-${lvl}`}>{lvl}</span>}</td>;
                    })}
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
      <AnalysisPanel ai={ai} plan={plan} dispatch={dispatch} />
    </section>
  );
}
