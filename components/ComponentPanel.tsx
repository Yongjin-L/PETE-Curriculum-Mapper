"use client";

import { useDraggable } from "@dnd-kit/core";
import { useMemo, useState, type Dispatch } from "react";
import { DATASET_SOURCE, standardTitle, type Library } from "@/lib/dataset";
import type { Action } from "@/lib/plan";
import type { Component, Level, Plan } from "@/lib/types";

type Show = "all" | "unmapped" | "mapped";

export function ComponentPanel({ plan, lib, dispatch }: { plan: Plan; lib: Library; dispatch: Dispatch<Action> }) {
  const [q, setQ] = useState("");
  const [std, setStd] = useState("");
  const [show, setShow] = useState<Show>("all");

  const usage = useMemo(() => {
    const m = new Map<string, { courseId: string; level: Level }[]>();
    for (const p of plan.placements) {
      const list = m.get(p.topicId) ?? [];
      list.push({ courseId: p.courseId, level: p.level });
      m.set(p.topicId, list);
    }
    return m;
  }, [plan.placements]);

  const needle = q.trim().toLowerCase();
  const visible = (c: Component) => {
    if (std && c.standard_id !== std) return false;
    if (needle && !`${c.component_id} ${c.label} ${c.text}`.toLowerCase().includes(needle)) return false;
    const used = usage.has(c.component_id);
    return show === "all" || (show === "mapped" ? used : !used);
  };
  const mappedCount = lib.components.filter((c) => usage.has(c.component_id)).length;
  const groups = lib.standards
    .map((s) => ({ s, items: (lib.componentsByStandard.get(s.standard_id) ?? []).filter(visible) }))
    .filter((g) => g.items.length);

  return (
    <aside className="topics" aria-label="Standards and components">
      <div className="topics-head">
        <div className="row between">
          <h2>SHAPE components</h2>
          <span className="muted small">
            {mappedCount}/{lib.components.length} mapped
          </span>
        </div>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search components…" aria-label="Search components" />
        <select value={std} onChange={(e) => setStd(e.target.value)} aria-label="Filter by standard">
          <option value="">All six standards</option>
          {lib.standards.map((s) => (
            <option key={s.standard_id} value={s.standard_id}>
              {standardTitle(s)}
            </option>
          ))}
        </select>
        <div className="seg" role="group" aria-label="Show">
          {(["all", "unmapped", "mapped"] as Show[]).map((s) => (
            <button key={s} className={show === s ? "on" : ""} onClick={() => setShow(s)}>
              {s === "all" ? "All" : s === "unmapped" ? "Not yet mapped" : "Mapped"}
            </button>
          ))}
        </div>
      </div>

      <div className="topic-list">
        {groups.length === 0 && <p className="muted center">No components match these filters.</p>}
        {groups.map(({ s, items }) => (
          <div key={s.standard_id} className="std-group">
            <h3 className="std-group-title" title={s.description}>
              {standardTitle(s)}
            </h3>
            {items.map((c) => (
              <ComponentCard key={c.component_id} c={c} plan={plan} uses={usage.get(c.component_id) ?? []} dispatch={dispatch} />
            ))}
          </div>
        ))}
      </div>
      <div className="topics-foot">
        <p className="muted small">Source: {DATASET_SOURCE} © SHAPE America.</p>
      </div>
    </aside>
  );
}

function ComponentCard({ c, plan, uses, dispatch }: { c: Component; plan: Plan; uses: { courseId: string; level: Level }[]; dispatch: Dispatch<Action> }) {
  const [open, setOpen] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: "topic:" + c.component_id,
    data: { kind: "topic", topicId: c.component_id, name: `${c.component_id} ${c.label}` },
  });
  const order = new Map(plan.courses.map((x, i) => [x.id, i]));
  const sorted = [...uses].sort((a, b) => (order.get(a.courseId) ?? 0) - (order.get(b.courseId) ?? 0));
  const available = plan.courses.filter((x) => !uses.some((u) => u.courseId === x.id));

  return (
    <div className={"topic" + (isDragging ? " is-dragging" : "") + (uses.length ? " is-used" : "")}>
      <div className="topic-main" ref={setNodeRef} {...listeners} {...attributes}>
        <span className="handle" aria-hidden>
          ⋮⋮
        </span>
        <div className="topic-text">
          <div className="topic-name">
            <span className="comp-code">{c.component_id}</span> {c.label}
          </div>
          <div className="topic-meta">
            {sorted.length > 0 ? (
              <span className="uses" title="Levels across courses, in program order">
                {sorted.map((u, i) => (
                  <span key={i} className={`dot level-${u.level}`}>
                    {u.level}
                  </span>
                ))}
              </span>
            ) : (
              <span className="muted small">not mapped</span>
            )}
          </div>
        </div>
      </div>
      <div className="topic-tools">
        <button className="icon-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Details" title="Full wording">
          {open ? "▴" : "▾"}
        </button>
        {available.length > 0 && (
          <select
            className="add-to"
            value=""
            aria-label={`Add ${c.component_id} ${c.label} to a course`}
            title="Add to a course"
            onChange={(e) => e.target.value && dispatch({ type: "placeTopic", courseId: e.target.value, topicId: c.component_id })}
          >
            <option value="">+ Add</option>
            {available.map((x) => (
              <option key={x.id} value={x.id}>
                {x.number} {x.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {open && (
        <div className="topic-details">
          <p>
            <b>{c.component_id}</b> {c.text}
          </p>
          {sorted.length > 0 && (
            <>
              <h4>Mapped to</h4>
              <ul>
                {sorted.map((u) => {
                  const course = plan.courses.find((x) => x.id === u.courseId);
                  return (
                    <li key={u.courseId}>
                      {course?.number} {course?.name}: <b>{u.level}</b>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
