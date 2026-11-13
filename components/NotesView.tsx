"use client";

import { useState, type Dispatch, type ReactNode } from "react";
import type { Action } from "@/lib/plan";
import type { Course, Level, Plan } from "@/lib/types";

/** All course notes at a glance, in program order (grouped by year/semester), with search and inline editing. */
export function NotesView({ plan, dispatch, readOnly = false }: { plan: Plan; dispatch: Dispatch<Action>; readOnly?: boolean }) {
  const [q, setQ] = useState("");
  const [onlyWithNotes, setOnlyWithNotes] = useState(false);
  const needle = q.trim().toLowerCase();
  const withNotes = plan.courses.filter((c) => c.note).length;
  const matches = (c: Course) => !needle || `${c.number} ${c.name} ${c.note ?? ""}`.toLowerCase().includes(needle);
  const found = needle ? plan.courses.filter(matches).length : 0;
  const shown = plan.courses.map((c, i) => ({ c, i })).filter(({ c }) => !onlyWithNotes || c.note);

  // consecutive courses with the same term form one group (same as the map's column groups)
  const groups: { term: string; items: { c: Course; i: number }[] }[] = [];
  for (const x of shown) {
    const t = x.c.term ?? "";
    if (groups.length && groups[groups.length - 1].term === t) groups[groups.length - 1].items.push(x);
    else groups.push({ term: t, items: [x] });
  }

  return (
    <section className="notes-view" aria-label="Course notes">
      <div className="notes-bar">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a topic across courses, e.g. assessment"
          aria-label="Find a topic across courses"
        />
        <span className="small muted">
          {needle ? `Found in ${found} of ${plan.courses.length} courses` : `${withNotes} of ${plan.courses.length} courses have notes`}
        </span>
        <label className="check small">
          <input type="checkbox" checked={onlyWithNotes} onChange={(e) => setOnlyWithNotes(e.target.checked)} /> Only courses with notes
        </label>
      </div>

      {shown.length === 0 && <p className="muted center pad">No courses have notes yet.</p>}

      {groups.some((g) => g.term) ? (
        // Year/semester columns side by side, like a timeline
        <div className="notes-timeline">
          {groups.map((g, gi) => (
            <div className="notes-col" key={gi}>
              <h3 className="notes-term">{g.term || "No term"}</h3>
              {g.items.map(({ c, i }) => (
                <NoteCard key={c.id} course={c} index={i} plan={plan} dispatch={dispatch} needle={needle} dim={!!needle && !matches(c)} readOnly={readOnly} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="notes-grid">
          {shown.map(({ c, i }) => (
            <NoteCard key={c.id} course={c} index={i} plan={plan} dispatch={dispatch} needle={needle} dim={!!needle && !matches(c)} readOnly={readOnly} />
          ))}
        </div>
      )}
    </section>
  );
}

function NoteCard({
  course,
  index,
  plan,
  dispatch,
  needle,
  dim,
  readOnly,
}: {
  readOnly?: boolean;
  course: Course;
  index: number;
  plan: Plan;
  dispatch: Dispatch<Action>;
  needle: string;
  dim: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(course.note ?? "");
  const counts: Record<Level, number> = { I: 0, R: 0, M: 0 };
  for (const p of plan.placements) if (p.courseId === course.id) counts[p.level]++;

  const save = () => {
    dispatch({ type: "updateCourse", id: course.id, number: course.number, name: course.name, term: course.term, note: text });
    setEditing(false);
  };

  return (
    <article className={"note-card" + (dim ? " dim" : "") + (course.note ? "" : " empty")}>
      <header>
        <span className="note-idx">{index + 1}</span>
        <span className="note-head">
          <b>{highlight(course.number || `#${index + 1}`, needle)}</b> {highlight(course.name, needle)}
        </span>
        {!editing && !readOnly && (
          <button
            className="icon-btn"
            onClick={() => {
              setText(course.note ?? "");
              setEditing(true);
            }}
            aria-label={`Edit note for ${course.number || course.name}`}
            title="Edit note"
          >
            ✎
          </button>
        )}
      </header>
      <div className="note-levels" aria-label="SHAPE components in this course">
        {(["I", "R", "M"] as Level[]).map((l) =>
          counts[l] ? (
            <span key={l} className={`lv-pill level-${l}`}>
              {l} {counts[l]}
            </span>
          ) : null
        )}
        {!counts.I && !counts.R && !counts.M && <span className="small muted">no components yet</span>}
      </div>
      {editing ? (
        <div className="note-edit">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            maxLength={4000}
            autoFocus
            placeholder="Topics covered, key assignments…"
            aria-label={`Note for ${course.number || course.name}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <div className="row">
            <button className="btn btn-primary btn-sm" onClick={save}>
              Save
            </button>
            <button className="btn btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : course.note ? (
        <p className="note-body">{highlight(course.note, needle)}</p>
      ) : readOnly ? (
        <span className="small muted">No note</span>
      ) : (
        <button
          className="linklike small"
          onClick={() => {
            setText("");
            setEditing(true);
          }}
        >
          + Add a note
        </button>
      )}
    </article>
  );
}

/** Wraps case-insensitive matches of `needle` in <mark>. */
function highlight(text: string, needle: string): ReactNode {
  if (!needle) return text;
  const out: ReactNode[] = [];
  const lower = text.toLowerCase();
  let i = 0;
  for (let j = lower.indexOf(needle); j >= 0; j = lower.indexOf(needle, i)) {
    if (j > i) out.push(text.slice(i, j));
    out.push(<mark key={j}>{text.slice(j, j + needle.length)}</mark>);
    i = j + needle.length;
  }
  out.push(text.slice(i));
  return out;
}
