"use client";

import { useDraggable } from "@dnd-kit/core";
import { useMemo, useState, type Dispatch } from "react";
import { chapterLabel, standardCode, type Library } from "@/lib/dataset";
import type { Action } from "@/lib/plan";
import type { Level, Plan, Topic } from "@/lib/types";
import { CustomBookDialog, CustomTopicDialog } from "./CustomDialogs";

type Show = "all" | "unmapped" | "mapped";

export function TopicPanel({ plan, lib, dispatch }: { plan: Plan; lib: Library; dispatch: Dispatch<Action> }) {
  const [q, setQ] = useState("");
  const [std, setStd] = useState("");
  const [book, setBook] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [editing, setEditing] = useState<Topic | "new" | null>(null);
  const [addingBook, setAddingBook] = useState(false);

  const usage = useMemo(() => {
    const m = new Map<string, { courseId: string; level: Level }[]>();
    for (const p of plan.placements) {
      const list = m.get(p.topicId) ?? [];
      list.push({ courseId: p.courseId, level: p.level });
      m.set(p.topicId, list);
    }
    return m;
  }, [plan.placements]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lib.topics.filter((t) => {
      if (needle) {
        const hay = [t.topic_name, t.description ?? "", ...t.keywords].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (std && !t.standards.some((s) => s === std || s.startsWith(std))) return false;
      if (book && !t.chapters.some((c) => lib.chapterById.get(c.chapter_id)?.textbook_id === book)) return false;
      const used = usage.has(t.topic_id);
      if (show === "mapped" && !used) return false;
      if (show === "unmapped" && used) return false;
      return true;
    });
  }, [lib, q, std, book, show, usage]);

  const mainStandards = lib.standards.filter((s) => !s.component);
  const mappedCount = lib.topics.filter((t) => usage.has(t.topic_id)).length;

  return (
    <aside className="topics" aria-label="Topics">
      <div className="topics-head">
        <div className="row between">
          <h2>Topics</h2>
          <span className="muted small">
            {mappedCount}/{lib.topics.length} mapped
          </span>
        </div>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search topics, keywords…" aria-label="Search topics" />
        <div className="filters">
          <select value={std} onChange={(e) => setStd(e.target.value)} aria-label="Filter by SHAPE standard">
            <option value="">All standards</option>
            {mainStandards.map((s) => (
              <option key={s.standard_id} value={s.standard_id}>
                {s.standard_no}. {s.short_label}
              </option>
            ))}
          </select>
          <select value={book} onChange={(e) => setBook(e.target.value)} aria-label="Filter by textbook">
            <option value="">All textbooks</option>
            {lib.textbooks.map((b) => (
              <option key={b.textbook_id} value={b.textbook_id}>
                {b.title}
              </option>
            ))}
          </select>
        </div>
        <div className="seg" role="group" aria-label="Show">
          {(["all", "unmapped", "mapped"] as Show[]).map((s) => (
            <button key={s} className={show === s ? "on" : ""} onClick={() => setShow(s)}>
              {s === "all" ? "All" : s === "unmapped" ? "Not yet mapped" : "Mapped"}
            </button>
          ))}
        </div>
      </div>

      <div className="topic-list">
        {filtered.length === 0 && <p className="muted center">No topics match these filters.</p>}
        {filtered.map((t) => (
          <TopicCard
            key={t.topic_id}
            topic={t}
            lib={lib}
            plan={plan}
            uses={usage.get(t.topic_id) ?? []}
            dispatch={dispatch}
            onEdit={() => setEditing(t)}
          />
        ))}
      </div>

      <div className="topics-foot">
        <button className="btn" onClick={() => setEditing("new")}>
          + My topic
        </button>
        <button className="btn" onClick={() => setAddingBook(true)}>
          + My book
        </button>
        {plan.customTextbooks.length > 0 && (
          <details className="my-books">
            <summary>My books ({plan.customTextbooks.length})</summary>
            <ul>
              {plan.customTextbooks.map((b) => (
                <li key={b.textbook_id}>
                  <span>
                    {b.title} <span className="muted small">({lib.chaptersByTextbook.get(b.textbook_id)?.length ?? 0} ch.)</span>
                  </span>
                  <button
                    className="icon-btn danger"
                    aria-label={`Delete ${b.title}`}
                    onClick={() => confirm(`Delete "${b.title}"? Its chapters will be unlinked from your topics.`) && dispatch({ type: "deleteCustomTextbook", textbookId: b.textbook_id })}
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="muted small">Your own topics and books are private to you.</p>
      </div>

      {editing && (
        <CustomTopicDialog
          topic={editing === "new" ? null : editing}
          plan={plan}
          lib={lib}
          dispatch={dispatch}
          onAddBook={() => setAddingBook(true)}
          onClose={() => setEditing(null)}
        />
      )}
      {addingBook && <CustomBookDialog plan={plan} dispatch={dispatch} onClose={() => setAddingBook(false)} />}
    </aside>
  );
}

function TopicCard({
  topic,
  lib,
  plan,
  uses,
  dispatch,
  onEdit,
}: {
  topic: Topic;
  lib: Library;
  plan: Plan;
  uses: { courseId: string; level: Level }[];
  dispatch: Dispatch<Action>;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: "topic:" + topic.topic_id,
    data: { kind: "topic", topicId: topic.topic_id, name: topic.topic_name },
  });

  const courseOrder = new Map(plan.courses.map((c, i) => [c.id, i]));
  const sortedUses = [...uses].sort((a, b) => (courseOrder.get(a.courseId) ?? 0) - (courseOrder.get(b.courseId) ?? 0));
  const available = plan.courses.filter((c) => !uses.some((u) => u.courseId === c.id));

  return (
    <div className={"topic" + (isDragging ? " is-dragging" : "") + (uses.length ? " is-used" : "")}>
      <div className="topic-main" ref={setNodeRef} {...listeners} {...attributes}>
        <span className="handle" aria-hidden>
          ⋮⋮
        </span>
        <div className="topic-text">
          <div className="topic-name">
            {topic.topic_name}
            {topic.custom && <span className="badge-custom">custom</span>}
          </div>
          <div className="topic-meta">
            {topic.standards.map((s) => {
              const st = lib.standardById.get(s);
              return (
                <span key={s} className="badge-std" title={st?.short_label}>
                  {st ? standardCode(st) : s}
                </span>
              );
            })}
            {sortedUses.length > 0 ? (
              <span className="uses" title="Levels across courses, in program order">
                {sortedUses.map((u, i) => (
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
        <button className="icon-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Details" title="Details">
          {open ? "▴" : "▾"}
        </button>
        {available.length > 0 && (
          <select
            className="add-to"
            value=""
            aria-label={`Add ${topic.topic_name} to a course`}
            title="Add to a course"
            onChange={(e) => e.target.value && dispatch({ type: "placeTopic", courseId: e.target.value, topicId: topic.topic_id })}
          >
            <option value="">+ Add</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.number} {c.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {open && (
        <div className="topic-details">
          {topic.description && <p>{topic.description}</p>}
          {topic.chapters.length > 0 && (
            <>
              <h4>Chapters</h4>
              <ul>
                {topic.chapters.map((c) => (
                  <li key={c.chapter_id}>
                    {chapterLabel(lib, c.chapter_id)}
                    {c.relevance === "secondary" && <span className="muted small"> (secondary)</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {topic.standards.length > 0 && (
            <>
              <h4>SHAPE standards</h4>
              <ul>
                {topic.standards.map((s) => {
                  const st = lib.standardById.get(s);
                  return <li key={s}>{st ? `${standardCode(st)}: ${st.short_label}` : s}</li>;
                })}
              </ul>
            </>
          )}
          {sortedUses.length > 0 && (
            <>
              <h4>Mapped to</h4>
              <ul>
                {sortedUses.map((u) => {
                  const c = plan.courses.find((x) => x.id === u.courseId);
                  return (
                    <li key={u.courseId}>
                      {c?.number} {c?.name}: <b>{u.level}</b>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {topic.custom && (
            <div className="row">
              <button className="btn btn-sm" onClick={onEdit}>
                Edit
              </button>
              <button
                className="btn btn-sm danger"
                onClick={() =>
                  confirm(`Delete "${topic.topic_name}"${uses.length ? ` and remove it from ${uses.length} course(s)` : ""}?`) &&
                  dispatch({ type: "deleteCustomTopic", topicId: topic.topic_id })
                }
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
