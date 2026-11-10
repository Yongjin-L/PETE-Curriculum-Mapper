"use client";

import { Fragment, useEffect, useRef, useState, type Dispatch } from "react";
import { getLibrary } from "@/lib/dataset";
import type { Action } from "@/lib/plan";
import { cycle, levelGrid, rowStatus, STATUS_ICON, summarize } from "@/lib/status";
import { LEVEL_NAMES, type Course, type Level, type Plan } from "@/lib/types";

export type Pending = Map<string, Level>;
/** What clicking a cell does: cycle I->R->M->empty, set one level, or clear. */
export type Brush = "cycle" | Level | "clear"; // key: componentId|courseId
export const pendingKey = (componentId: string, courseId: string) => componentId + "|" + courseId;

export function MapGrid({
  plan,
  dispatch,
  pending,
  setPending,
  problemsOnly,
  brush,
  collapsed,
  setCollapsed,
}: {
  plan: Plan;
  dispatch: Dispatch<Action>;
  pending: Pending;
  setPending: (p: Pending) => void;
  problemsOnly: boolean;
  brush: Brush;
  collapsed: Set<string>;
  setCollapsed: (s: Set<string>) => void;
}) {
  const lib = getLibrary();
  const row = levelGrid(plan);
  const summary = summarize(plan);
  const [menu, setMenu] = useState<string | "new" | null>(null);

  // ---- resizable component column (remembered in this browser)
  const [firstW, setFirstW] = useState<number | null>(null);
  useEffect(() => {
    try {
      const w = Number(localStorage.getItem(COLW_KEY));
      if (w) setFirstW(clampW(w));
    } catch {
      /* ignore */
    }
  }, []);
  const saveWidth = (w: number | null) => {
    setFirstW(w);
    try {
      if (w) localStorage.setItem(COLW_KEY, String(w));
      else localStorage.removeItem(COLW_KEY);
    } catch {
      /* ignore */
    }
  };
  const currentFirstW = () => (document.querySelector(".cmap th.first") as HTMLElement | null)?.offsetWidth ?? 300;
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    const w0 = firstW ?? currentFirstW();
    let w = w0;
    const move = (ev: PointerEvent) => {
      w = clampW(w0 + ev.clientX - x0);
      setFirstW(w);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      saveWidth(w);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ---- full-component card
  const [detail, setDetail] = useState<{ id: string; top: number; left: number } | null>(null);
  useEffect(() => {
    if (!detail) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".comp-card") && !t.closest(".comp-name")) setDetail(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setDetail(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("resize", () => setDetail(null), { once: true });
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [detail]);

  // ---- painting: press on a cell, then drag across others to give them the same value
  const paint = useRef<{ value: Level | null; seen: Set<string> } | null>(null);
  useEffect(() => {
    const end = () => (paint.current = null);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  const apply = (componentId: string, courseId: string, value: Level | null) => {
    dispatch({ type: "setCells", cells: [{ courseId, topicId: componentId, level: value }] });
    const k = pendingKey(componentId, courseId);
    if (pending.has(k)) {
      const next = new Map(pending);
      next.delete(k);
      setPending(next);
    }
  };

  const start = (componentId: string, courseId: string, current: Level | "") => {
    const k = pendingKey(componentId, courseId);
    // A dotted AI suggestion is accepted by clicking it.
    const value =
      brush === "clear" ? null : brush !== "cycle" ? brush : pending.has(k) && !current ? pending.get(k)! : cycle(current);
    if (brush === "clear" && pending.has(k)) {
      const next = new Map(pending);
      next.delete(k);
      setPending(next);
    }
    paint.current = { value, seen: new Set([k]) };
    apply(componentId, courseId, value);
  };
  const enter = (componentId: string, courseId: string) => {
    const p = paint.current;
    const k = pendingKey(componentId, courseId);
    if (!p || p.seen.has(k)) return;
    p.seen.add(k);
    apply(componentId, courseId, p.value);
  };

  // ---- term groups for the header (consecutive courses with the same term)
  const hasTerms = plan.courses.some((c) => c.term);
  const groups: { term: string; span: number }[] = [];
  for (const c of plan.courses) {
    const t = c.term ?? "";
    if (groups.length && groups[groups.length - 1].term === t) groups[groups.length - 1].span++;
    else groups.push({ term: t, span: 1 });
  }

  return (
    <div
      className="grid-wrap"
      onDragStart={(e) => e.preventDefault()}
      onScroll={() => detail && setDetail(null)}
      style={firstW ? ({ ["--first-w" as string]: `${Math.min(firstW, Math.round(window.innerWidth * 0.55))}px` } as React.CSSProperties) : undefined}
    >
      <table className="cmap" style={{ minWidth: `calc(var(--first-w) + 48px + ${plan.courses.length * 70}px)` }}>
        <thead>
          {hasTerms && (
            <tr className="term-row">
              <th className="first" />
              {groups.map((g, i) => (
                <th key={i} colSpan={g.span} className="term" title={g.term}>
                  {g.term.replace(/\byear\s*/i, "Y").replace(/\bsemester\s*/i, "Sem ")}
                </th>
              ))}
              <th className="add-col" />
            </tr>
          )}
          <tr>
            <th className="first corner">
              <span className="muted small">SHAPE component</span>
              <span
                className="col-resize"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize component column"
                title="Drag to widen · double-click to reset"
                tabIndex={0}
                onPointerDown={startResize}
                onDoubleClick={() => saveWidth(null)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    saveWidth(clampW((firstW ?? currentFirstW()) + (e.key === "ArrowRight" ? 30 : -30)));
                  }
                }}
              />
            </th>
            {plan.courses.map((c, i) => (
              <th key={c.id} className="course-h">
                <button className="course-btn" onClick={() => setMenu(menu === c.id ? null : c.id)} title={[c.number, c.name, c.term].filter(Boolean).join(" · ")}>
                  <span className="cnum">{c.number || `#${i + 1}`}</span>
                  <span className="cname">{c.name}</span>
                </button>
                {menu === c.id && <CourseMenu course={c} index={i} total={plan.courses.length} dispatch={dispatch} onClose={() => setMenu(null)} />}
              </th>
            ))}
            <th className="course-h add-col">
              <button className="add-btn" onClick={() => setMenu(menu === "new" ? null : "new")} title="Add a course" aria-label="Add a course">
                +
              </button>
              {menu === "new" && <CourseMenu dispatch={dispatch} onClose={() => setMenu(null)} />}
            </th>
          </tr>
        </thead>
        <tbody>
          {lib.standards.map((s, si) => {
            const sum = summary[si];
            const isCollapsed = collapsed.has(s.standard_id);
            const comps = (lib.componentsByStandard.get(s.standard_id) ?? []).filter(
              (c) => !problemsOnly || rowStatus(row(c.component_id)).kind !== "ok"
            );
            if (problemsOnly && !comps.length) return null;
            return (
              <Fragment key={s.standard_id}>
                <tr className="std-row" id={`std-${s.standard_id}`}>
                  <th className="first">
                    <button
                      className="std-toggle"
                      aria-expanded={!isCollapsed}
                      onClick={() => {
                        const next = new Set(collapsed);
                        if (isCollapsed) next.delete(s.standard_id);
                        else next.add(s.standard_id);
                        setCollapsed(next);
                      }}
                    >
                      <span className="caret">{isCollapsed ? "▸" : "▾"}</span>
                      <span className="std-no">{s.standard_no}</span>
                      <span className="std-title" title={s.description}>
                        {s.title}
                      </span>
                      <span className="std-count" title={`${sum.covered} of ${sum.total} components addressed`}>
                        {sum.covered}/{sum.total}
                      </span>
                    </button>
                  </th>
                  {plan.courses.map((c, i) => (
                    <td key={c.id} className="std-cell">
                      {isCollapsed && sum.strongest[i] && <span className={`mini level-${sum.strongest[i]}`}>{sum.strongest[i]}</span>}
                    </td>
                  ))}
                  <td />
                </tr>
                {!isCollapsed &&
                  comps.map((comp) => {
                    const levels = row(comp.component_id);
                    const st = rowStatus(levels);
                    return (
                      <tr key={comp.component_id} className="comp-row">
                        <th className="first">
                          <div className="fcell">
                            <button
                              className="comp-name"
                              title="Show the full component"
                              aria-expanded={detail?.id === comp.component_id}
                              onClick={(e) => {
                                if (detail?.id === comp.component_id) return setDetail(null);
                                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setDetail({ id: comp.component_id, top: r.bottom + 6, left: r.left });
                              }}
                            >
                              <span className="ccode">{comp.component_id}</span>
                              <span className="clabel">{comp.label}</span>
                            </button>
                            <span className={`status st-${st.kind}`} title={st.tip} aria-label={st.tip}>
                              {STATUS_ICON[st.kind]}
                            </span>
                          </div>
                        </th>
                        {plan.courses.map((c, i) => {
                          const lv = levels[i];
                          const sug = !lv ? pending.get(pendingKey(comp.component_id, c.id)) : undefined;
                          return (
                            <td key={c.id} className="cell-td">
                              <button
                                className={"cell" + (lv ? ` level-${lv}` : "") + (sug ? ` sug level-${sug}` : "")}
                                aria-label={`${comp.component_id} in ${c.number || c.name}: ${lv ? LEVEL_NAMES[lv] : sug ? `AI suggests ${LEVEL_NAMES[sug]}` : "not addressed"}`}
                                title={sug ? `AI suggestion: ${LEVEL_NAMES[sug]}. Click to accept.` : undefined}
                                onPointerDown={(e) => {
                                  if (e.button !== 0) return;
                                  e.preventDefault();
                                  start(comp.component_id, c.id, lv);
                                }}
                                onPointerEnter={() => enter(comp.component_id, c.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    start(comp.component_id, c.id, lv);
                                    paint.current = null;
                                  }
                                }}
                              >
                                {lv || sug || ""}
                              </button>
                            </td>
                          );
                        })}
                        <td />
                      </tr>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {detail && <ComponentCard id={detail.id} top={detail.top} left={detail.left} plan={plan} dispatch={dispatch} onClose={() => setDetail(null)} />}
    </div>
  );
}

const COLW_KEY = "petemap:colw:v1";
const clampW = (w: number) => Math.round(Math.min(640, Math.max(140, w)));

/** Floating card with the full SHAPE wording of a component and its levels across courses. */
function ComponentCard({ id, top, left, plan, dispatch, onClose }: { id: string; top: number; left: number; plan: Plan; dispatch: Dispatch<Action>; onClose: () => void }) {
  const lib = getLibrary();
  const comp = lib.componentById.get(id);
  const std = comp && lib.standardById.get(comp.standard_id);
  const levels = levelGrid(plan)(id);
  const st = rowStatus(levels);
  if (!comp) return null;
  // keep the card on screen
  const width = Math.min(380, window.innerWidth - 24);
  const x = Math.max(12, Math.min(left, window.innerWidth - width - 12));
  const below = top + 260 < window.innerHeight;
  return (
    <div
      className="comp-card"
      role="dialog"
      aria-label={`${comp.component_id} ${comp.label}`}
      style={{ left: x, width, ...(below ? { top } : { bottom: Math.max(12, window.innerHeight - top + 40) }) }}
    >
      <div className="row between">
        <span className="small muted">{std ? `Standard ${std.standard_no}: ${std.title}` : ""}</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <h3>
        <span className="ccode">{comp.component_id}</span> {comp.label}
      </h3>
      <p className="comp-text">{comp.text}</p>
      <div className="comp-levels">
        {plan.courses.map((c, i) =>
          levels[i] ? (
            <span key={c.id} className={`lv-pill level-${levels[i]}`} title={c.name}>
              {c.number || c.name} <b>{levels[i]}</b>
            </span>
          ) : null
        )}
        <span className={`status st-${st.kind}`} title={st.tip}>
          {STATUS_ICON[st.kind]}
        </span>
        <span className="small muted">{st.tip}</span>
      </div>
      <div className="row between">
        <span className="small muted src">SHAPE America (2017), Initial PETE Standards.</span>
        {levels.some(Boolean) && (
          <button
            className="btn btn-sm danger"
            onClick={() => dispatch({ type: "setCells", cells: plan.courses.map((c) => ({ courseId: c.id, topicId: id, level: null })) })}
          >
            ⌫ Clear this row
          </button>
        )}
      </div>
    </div>
  );
}

function CourseMenu({
  course,
  index = 0,
  total = 0,
  dispatch,
  onClose,
}: {
  course?: Course;
  index?: number;
  total?: number;
  dispatch: Dispatch<Action>;
  onClose: () => void;
}) {
  const [num, setNum] = useState(course?.number ?? "");
  const [name, setName] = useState(course?.name ?? "");
  const [term, setTerm] = useState(course?.term ?? "");
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    setTimeout(() => document.addEventListener("mousedown", close), 0);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  return (
    <form
      ref={ref}
      className="course-menu"
      onSubmit={(e) => {
        e.preventDefault();
        if (!num.trim() && !name.trim()) return;
        if (course) dispatch({ type: "updateCourse", id: course.id, number: num, name, term });
        else dispatch({ type: "addCourses", source: "manual", courses: [{ number: num, name, term }] });
        onClose();
      }}
    >
      <input value={num} onChange={(e) => setNum(e.target.value)} placeholder="Course no." aria-label="Course number" autoFocus />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Course name" aria-label="Course name" />
      <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Year / semester (optional)" aria-label="Term" />
      <div className="row between">
        {course ? (
          <span className="row">
            <button type="button" className="icon-btn" disabled={index === 0} onClick={() => dispatch({ type: "moveCourse", id: course.id, delta: -1 })} title="Move left" aria-label="Move left">
              ←
            </button>
            <button type="button" className="icon-btn" disabled={index === total - 1} onClick={() => dispatch({ type: "moveCourse", id: course.id, delta: 1 })} title="Move right" aria-label="Move right">
              →
            </button>
            <button
              type="button"
              className="icon-btn"
              title="Clear all levels in this course"
              aria-label="Clear all levels in this course"
              onClick={() => {
                dispatch({ type: "setCells", cells: getLibrary().components.map((x) => ({ courseId: course.id, topicId: x.component_id, level: null })) });
                onClose();
              }}
            >
              ⌫
            </button>
            <button
              type="button"
              className="icon-btn danger"
              title="Delete course"
              aria-label="Delete course"
              onClick={() => {
                if (confirm(`Delete ${course.number || course.name}?`)) {
                  dispatch({ type: "deleteCourse", id: course.id });
                  onClose();
                }
              }}
            >
              🗑
            </button>
          </span>
        ) : (
          <span />
        )}
        <button className="btn btn-primary btn-sm" type="submit">
          {course ? "Save" : "Add"}
        </button>
      </div>
    </form>
  );
}

/** Six standard tiles with a coverage ring. */
export function StandardTiles({ plan, onPick }: { plan: Plan; onPick: (standardId: string) => void }) {
  return (
    <div className="tiles">
      {summarize(plan).map((s) => {
        const frac = s.total ? s.covered / s.total : 0;
        const r = 15, c = 2 * Math.PI * r;
        const done = s.mastered === s.total && s.total > 0;
        return (
          <button key={s.standardId} className="tile" onClick={() => onPick(s.standardId)} title={`Standard ${s.no}: ${s.title}`}>
            <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
              <circle cx="20" cy="20" r={r} className="ring-bg" />
              <circle cx="20" cy="20" r={r} className={"ring-fg" + (done ? " done" : "")} strokeDasharray={`${frac * c} ${c}`} transform="rotate(-90 20 20)" />
              <text x="20" y="24.5" textAnchor="middle" className="ring-no">
                {s.no}
              </text>
            </svg>
            <span className="tile-text">
              <span className="tile-title">{s.title}</span>
              <span className="tile-stats">
                {s.covered}/{s.total}
                <span className={"tile-m" + (done ? " ok" : "")} title={`${s.mastered} of ${s.total} components reach Mastered`}>
                  M {s.mastered}/{s.total}
                </span>
                {s.issues > 0 && (
                  <span className="tile-warn" title={`${s.issues} component(s) to check`}>
                    ! {s.issues}
                  </span>
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
