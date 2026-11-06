"use client";

import { useState } from "react";
import { standardCode, type Library } from "@/lib/dataset";
import type { Dispatch } from "react";
import type { Action } from "@/lib/plan";
import { LEVEL_NAMES, LEVELS, type Plan } from "@/lib/types";
import { AnalysisPanel } from "./AiPanels";
import type { AiApi } from "./useAi";

export function Coverage({ plan, lib, ai, dispatch }: { plan: Plan; lib: Library; ai: AiApi; dispatch: Dispatch<Action> }) {
  const [showAll, setShowAll] = useState(false);

  const cell = new Map(plan.placements.map((p) => [p.topicId + "|" + p.courseId, p.level]));
  const mapped = new Set(plan.placements.map((p) => p.topicId));
  const rows = lib.topics.filter((t) => showAll || mapped.has(t.topic_id));

  const mainStandards = lib.standards.filter((s) => !s.component);
  const stdSummary = mainStandards.map((s) => {
    const related = lib.topics.filter((t) => t.standards.some((x) => x === s.standard_id || x.startsWith(s.standard_id)));
    return { s, total: related.length, covered: related.filter((t) => mapped.has(t.topic_id)).length };
  });

  if (plan.courses.length === 0) return <p className="muted center pad">Add courses on the Map tab to see coverage.</p>;

  return (
    <section className="coverage">
      <h2>SHAPE standards coverage</h2>
      <div className="std-grid">
        {stdSummary.map(({ s, total, covered }) => (
          <div key={s.standard_id} className="std-card">
            <div className="std-code">{standardCode(s)}</div>
            <div className="std-label">{s.short_label}</div>
            <div className="bar" aria-hidden>
              <span style={{ width: total ? `${(covered / total) * 100}%` : 0 }} />
            </div>
            <div className="small muted">
              {covered} of {total} related topics mapped
            </div>
          </div>
        ))}
      </div>

      <div className="row between">
        <h2>Topics × courses</h2>
        <label className="check small">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show unmapped topics
        </label>
      </div>
      <div className="legend small">
        {LEVELS.map((l) => (
          <span key={l}>
            <span className={`dot level-${l}`}>{l}</span> {LEVEL_NAMES[l]}
          </span>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="muted">No topics mapped yet.</p>
      ) : (
        <div className="matrix-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th className="sticky-col">Topic</th>
                {plan.courses.map((c) => (
                  <th key={c.id} title={c.name}>
                    {c.number || c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.topic_id}>
                  <th className="sticky-col" scope="row">
                    {t.topic_name}
                  </th>
                  {plan.courses.map((c) => {
                    const lvl = cell.get(t.topic_id + "|" + c.id);
                    return <td key={c.id}>{lvl && <span className={`dot level-${lvl}`}>{lvl}</span>}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AnalysisPanel ai={ai} plan={plan} dispatch={dispatch} />
    </section>
  );
}
