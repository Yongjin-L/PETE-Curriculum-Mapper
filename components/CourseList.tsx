"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useState, type Dispatch } from "react";
import type { Library } from "@/lib/dataset";
import { parseCourseLines, type Action } from "@/lib/plan";
import { LEVELS, LEVEL_NAMES, type Course, type Level, type Plan } from "@/lib/types";

export function CourseList({ plan, lib, dispatch }: { plan: Plan; lib: Library; dispatch: Dispatch<Action> }) {
  return (
    <section className="courses" aria-label="Courses">
      {plan.courses.length === 0 && <Welcome />}
      {plan.courses.map((c, i) => (
        <CourseCard key={c.id} course={c} index={i} total={plan.courses.length} plan={plan} lib={lib} dispatch={dispatch} />
      ))}
      <AddCourses dispatch={dispatch} hasCourses={plan.courses.length > 0} />
    </section>
  );
}

function Welcome() {
  return (
    <div className="welcome">
      <h2>Map your program in three steps</h2>
      <ol>
        <li>
          <strong>Add your courses</strong> below, in the order students take them. You can type them one at a time or paste a
          whole list.
        </li>
        <li>
          <strong>Drag topics</strong> from the topic panel onto each course. A topic can go on as many courses as you like.
        </li>
        <li>
          <strong>Set the level</strong> for each placement: <b>I</b>ntroduced, <b>R</b>einforced or <b>M</b>astered.
        </li>
      </ol>
      <p className="muted">Your work is saved in this browser automatically. No account is needed.</p>
    </div>
  );
}

function CourseCard({
  course,
  index,
  total,
  plan,
  lib,
  dispatch,
}: {
  course: Course;
  index: number;
  total: number;
  plan: Plan;
  lib: Library;
  dispatch: Dispatch<Action>;
}) {
  const { setNodeRef, isOver, active } = useDroppable({ id: "course:" + course.id, data: { courseId: course.id } });
  const [editing, setEditing] = useState(!course.number && !course.name);
  const [num, setNum] = useState(course.number);
  const [name, setName] = useState(course.name);

  const placements = plan.placements.filter((p) => p.courseId === course.id);
  const dragTopicId = active?.data.current?.topicId as string | undefined;
  const duplicate = isOver && dragTopicId && placements.some((p) => p.topicId === dragTopicId);

  const save = () => {
    dispatch({ type: "updateCourse", id: course.id, number: num, name });
    setEditing(false);
  };
  const remove = () => {
    if (placements.length === 0 || confirm(`Delete ${course.number || "this course"} and its ${placements.length} topic placement(s)?`))
      dispatch({ type: "deleteCourse", id: course.id });
  };

  return (
    <article ref={setNodeRef} className={"course" + (isOver ? (duplicate ? " is-dup" : " is-over") : "")}>
      <header className="course-head">
        <span className="course-order">{index + 1}</span>
        {editing ? (
          <form
            className="course-edit"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <input value={num} onChange={(e) => setNum(e.target.value)} placeholder="Course no." aria-label="Course number" className="w-num" autoFocus />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Course name" aria-label="Course name" />
            <button className="btn btn-primary btn-sm" type="submit">
              Save
            </button>
          </form>
        ) : (
          <button className="course-title" onClick={() => setEditing(true)} title="Edit course">
            <span className="course-num">{course.number}</span> {course.name}
          </button>
        )}
        <div className="course-actions">
          <span className="count" title="Topics in this course">
            {placements.length}
          </span>
          <button className="icon-btn" disabled={index === 0} onClick={() => dispatch({ type: "moveCourse", id: course.id, delta: -1 })} aria-label="Move up" title="Move up">
            ↑
          </button>
          <button className="icon-btn" disabled={index === total - 1} onClick={() => dispatch({ type: "moveCourse", id: course.id, delta: 1 })} aria-label="Move down" title="Move down">
            ↓
          </button>
          <button className="icon-btn danger" onClick={remove} aria-label="Delete course" title="Delete course">
            🗑
          </button>
        </div>
      </header>
      <div className="dropzone">
        {placements.length === 0 && <p className="drop-hint">{duplicate ? "" : "Drag topics here"}</p>}
        {placements.map((p) => (
          <PlacementChip
            key={p.topicId}
            courseId={course.id}
            topicId={p.topicId}
            level={p.level}
            name={lib.topicById.get(p.topicId)?.topic_name ?? `Unknown topic (${p.topicId})`}
            custom={!!lib.topicById.get(p.topicId)?.custom}
            dispatch={dispatch}
          />
        ))}
        {duplicate && <p className="drop-hint dup">Already in this course</p>}
      </div>
    </article>
  );
}

function PlacementChip({
  courseId,
  topicId,
  level,
  name,
  custom,
  dispatch,
}: {
  courseId: string;
  topicId: string;
  level: Level;
  name: string;
  custom: boolean;
  dispatch: Dispatch<Action>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `placement:${courseId}:${topicId}`,
    data: { kind: "placement", courseId, topicId, name },
  });
  return (
    <div ref={setNodeRef} className={`chip level-${level}` + (isDragging ? " is-dragging" : "")}>
      <span className="handle" {...listeners} {...attributes} title="Drag to another course">
        ⋮⋮
      </span>
      <span className="chip-name">
        {name}
        {custom && <span className="badge-custom">custom</span>}
      </span>
      <span className="levels" role="radiogroup" aria-label={`Level for ${name}`}>
        {LEVELS.map((l) => (
          <button
            key={l}
            role="radio"
            aria-checked={l === level}
            className={"lvl" + (l === level ? " on" : "")}
            title={LEVEL_NAMES[l]}
            onClick={() => dispatch({ type: "setLevel", courseId, topicId, level: l })}
          >
            {l}
          </button>
        ))}
      </span>
      <button className="icon-btn chip-x" onClick={() => dispatch({ type: "removePlacement", courseId, topicId })} aria-label={`Remove ${name}`} title="Remove">
        ✕
      </button>
    </div>
  );
}

function AddCourses({ dispatch, hasCourses }: { dispatch: Dispatch<Action>; hasCourses: boolean }) {
  const [mode, setMode] = useState<"one" | "paste">("one");
  const [num, setNum] = useState("");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const parsed = parseCourseLines(text);

  return (
    <div className="add-courses">
      <div className="tabs-mini">
        <button className={mode === "one" ? "on" : ""} onClick={() => setMode("one")}>
          Add a course
        </button>
        <button className={mode === "paste" ? "on" : ""} onClick={() => setMode("paste")}>
          Paste a list
        </button>
        <span className="muted small soon">Upload a plan of study (AI): coming soon</span>
      </div>
      {mode === "one" ? (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!num.trim() && !name.trim()) return;
            dispatch({ type: "addCourses", courses: [{ number: num, name }] });
            setNum("");
            setName("");
            (e.currentTarget.elements.namedItem("num") as HTMLInputElement)?.focus();
          }}
        >
          <input name="num" value={num} onChange={(e) => setNum(e.target.value)} placeholder="Course no." className="w-num" aria-label="Course number" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Course name" aria-label="Course name" />
          <button className="btn btn-primary" type="submit">
            {hasCourses ? "Add" : "Add first course"}
          </button>
        </form>
      ) : (
        <div className="paste">
          <textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"One course per line, e.g.\nPED 210 Foundations of Physical Education\nPED 315 - Motor Development\n(You can also paste two columns from Excel or Google Sheets.)"}
          />
          {parsed.length > 0 && (
            <table className="preview">
              <thead>
                <tr>
                  <th>Course no.</th>
                  <th>Course name</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((c, i) => (
                  <tr key={i}>
                    <td>{c.number || <span className="muted">(none)</span>}</td>
                    <td>{c.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button
            className="btn btn-primary"
            disabled={parsed.length === 0}
            onClick={() => {
              dispatch({ type: "addCourses", courses: parsed });
              setText("");
              setMode("one");
            }}
          >
            Add {parsed.length || ""} course{parsed.length === 1 ? "" : "s"}
          </button>
        </div>
      )}
    </div>
  );
}
