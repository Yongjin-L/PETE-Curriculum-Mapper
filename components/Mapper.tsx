"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type Dispatch } from "react";
import { emptyPlan, loadLocalPlan, newCourseId, normalizePlan, parseCourseLines, planReducer, saveLocalPlan, type Action } from "@/lib/plan";
import { track, trackInstitution } from "@/lib/track";
import { AnalysisPanel, DropPlan } from "./AiPanels";
import { MapGrid, pendingKey, StandardTiles, type Brush, type Pending } from "./MapGrid";
import { Modal } from "./Modal";
import { NotesView } from "./NotesView";
import { ShareModal } from "./ShareModal";
import type { ParsedPlan } from "./useAi";
import { AccountArea, ConflictDialog, MyMapsDialog, ShareDialog } from "./DriveUI";
import { ExportDialog } from "./ExportDialog";
import { useAi } from "./useAi";
import { useDrive } from "./useDrive";
import { Logo } from "./Logo";

import type { Level } from "@/lib/types";

const PENDING_KEY = "petemap:pending:v1";

export function Mapper() {
  const [plan, rawDispatch] = useReducer(planReducer, undefined, emptyPlan);
  const planRef = useRef(plan);
  planRef.current = plan;

  // Same as dispatch, plus anonymous usage counting (counts only, never content).
  const dispatch: Dispatch<Action> = useCallback((a: Action) => {
    const p = planRef.current;
    if (a.type === "addCourses") {
      const n = a.courses.filter((c) => c.number.trim() || c.name.trim()).length;
      if (n && p.courses.length === 0) track("map_started");
      if (n) track(a.source === "ai" ? "courses_added_ai" : a.source === "paste" ? "courses_added_paste" : "courses_added_manual", n);
    } else if (a.type === "setCells") {
      const added = a.cells.filter((c) => c.level && !p.placements.some((x) => x.courseId === c.courseId && x.topicId === c.topicId)).length;
      if (added) track("topic_placed", added);
    }
    rawDispatch(a);
  }, []);
  const [loaded, setLoaded] = useState(false);
  const [saveOk, setSaveOk] = useState(true);
  const [pending, setPendingState] = useState<Pending>(new Map());
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [brush, setBrush] = useState<Brush>("cycle");
  const [view, setView] = useState<"map" | "notes">("map");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<"upload" | "review" | "typed" | "share" | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // AI suggestions waiting for review (dotted cells). Kept in this browser until accepted or discarded.
  const setPending = useCallback((p: Pending) => {
    setPendingState(p);
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify([...p]));
    } catch {
      /* ignore */
    }
  }, []);

  // Load the saved plan once, then autosave on every change.
  useEffect(() => {
    const saved = loadLocalPlan();
    if (saved) rawDispatch({ type: "replacePlan", plan: saved });
    try {
      const raw = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]") as [string, Level][];
      const ids = new Set((saved?.courses ?? []).map((c) => c.id));
      setPendingState(new Map(raw.filter(([k]) => ids.has(k.split("|")[1]))));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) setSaveOk(saveLocalPlan(plan));
  }, [plan, loaded]);

  // Lets the site count how many different institutions use it (only a one-way hash is stored).
  useEffect(() => {
    if (loaded && plan.program.university) trackInstitution(plan.program.university);
  }, [loaded, plan.program.university]);

  const drive = useDrive({ plan, loaded, dispatch, toast: setToast });
  const ai = useAi(drive);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // ---- AI: plan-of-study upload -> new courses + dotted suggestions
  const onParsed = (r: ParsedPlan) => {
    const rows = r.courses.map((c) => ({ ...c, id: newCourseId() }));
    dispatch({ type: "addCourses", source: "ai", courses: rows.map(({ id, number, name, term }) => ({ id, number, name, term })) });
    if (!plan.program.university || !plan.program.name)
      dispatch({ type: "setProgram", university: plan.program.university || r.university || undefined, name: plan.program.name || r.program_name || undefined });
    const next = new Map(pending);
    for (const c of rows) for (const s of c.components) next.set(pendingKey(s.id, c.id), s.level);
    setPending(next);
    setModal(null);
    setToast(`${rows.length} courses added. Dotted cells are AI suggestions: click one to accept it, or use Accept all.`);
  };

  const acceptAll = () => {
    const cells = [...pending].map(([k, level]) => {
      const [topicId, courseId] = k.split("|");
      return { courseId, topicId, level };
    });
    dispatch({ type: "setCells", cells: cells.filter((c) => !plan.placements.some((p) => p.courseId === c.courseId && p.topicId === c.topicId)) });
    track("ai_matching_applied", cells.length);
    setPending(new Map());
  };

  const emptyCourses = plan.courses.filter(
    (c) => !plan.placements.some((p) => p.courseId === c.id) && ![...pending.keys()].some((k) => k.endsWith("|" + c.id))
  );
  const suggest = async () => {
    setSuggesting(true);
    try {
      const r = await ai.suggest(plan, plan.courses.map((c) => ({ number: c.number, name: c.name, note: c.note })));
      const targets = new Set(emptyCourses.map((c) => c.id));
      const next = new Map(pending);
      plan.courses.forEach((c, i) => {
        if (targets.has(c.id)) for (const s of r.suggestions[i] ?? []) next.set(pendingKey(s.id, c.id), s.level);
      });
      setPending(next);
      setToast(`${next.size - pending.size} suggestions added as dotted cells.`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setSuggesting(false);
    }
  };

  const importJson = async (file: File) => {
    try {
      const next = normalizePlan(JSON.parse(await file.text()));
      if (plan.courses.length > 0 && !confirm(drive.link ? "Open the imported file as a new map? Your current map stays in Google Drive." : "Replace your current map with the imported file?")) return;
      drive.detach();
      dispatch({ type: "replacePlan", plan: next });
      setPending(new Map());
      track("json_imported");
      setToast(`Imported ${next.courses.length} course(s) and ${next.placements.length} placement(s).`);
    } catch (err) {
      alert(`Could not import this file. ${err instanceof Error ? err.message : ""}`);
    }
  };

  const newPlan = () => {
    const msg = drive.link
      ? "Start a new, empty map? Your current map stays saved in Google Drive."
      : "Start a new, empty map? Use Export → JSON first if you want to keep it.";
    if (confirm(msg)) {
      drive.detach();
      dispatch({ type: "replacePlan", plan: emptyPlan() });
      setPending(new Map());
    }
  };

  if (!loaded) return <div className="loading">Loading…</div>;

  return (
    <div className="app">
      <header className="topbar">
        <a href="/" className="brand" title="PETE Curriculum Mapper home">
          <Logo size={36} />
          <h1 className="sr-only">PETE Curriculum Mapper</h1>
        </a>
        <div className="actions">
          {saveOk ? (
            <AccountArea
              drive={drive}
              onShare={() => {
                setShareOpen(true);
                track("share_opened");
              }}
            />
          ) : (
            <span className="save-status small warn" title="This browser is blocking storage. Sign in to save to Google Drive, or download your map as JSON.">
              ⚠ Browser storage blocked
            </span>
          )}
          {!saveOk && drive.status === "signed-out" && (
            <button className="btn" onClick={() => drive.signIn()}>
              Sign in
            </button>
          )}
          <a className="btn" href="/help" target="_blank" rel="noopener">
            Help
          </a>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            Open JSON
          </button>
          {plan.courses.length > 0 && (
            <button className="btn" onClick={() => setModal("share")}>
              🔗 Share
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setExportOpen(true)}>
            Export
          </button>
          <button className="btn" onClick={newPlan}>
            New map
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      <div className="program-bar">
        <input value={plan.program.university} onChange={(e) => dispatch({ type: "setProgram", university: e.target.value })} placeholder="University" aria-label="University" />
        <input value={plan.program.name} onChange={(e) => dispatch({ type: "setProgram", name: e.target.value })} placeholder="Program" aria-label="Program" />
      </div>

      {plan.courses.length === 0 ? (
        <main className="start">
          <DropPlan ai={ai} onParsed={onParsed} />
          {(ai.enabled !== null || ai.needsGoogle) && <TypeCourses dispatch={dispatch} open={ai.enabled === false || ai.needsGoogle} />}
        </main>
      ) : (
        <main className="mapview">
          <nav className="view-tabs" role="tablist" aria-label="View">
            <button role="tab" aria-selected={view === "map"} className={view === "map" ? "on" : ""} onClick={() => setView("map")}>
              ▦ Map
            </button>
            <button role="tab" aria-selected={view === "notes"} className={view === "notes" ? "on" : ""} onClick={() => setView("notes")}>
              📝 Notes
              <span className="tab-count">{plan.courses.filter((c) => c.note).length}</span>
            </button>
          </nav>
          {view === "notes" ? (
            <NotesView plan={plan} dispatch={dispatch} />
          ) : (
            <>
          <StandardTiles
            plan={plan}
            onPick={(id) => {
              const next = new Set(collapsed);
              next.delete(id);
              setCollapsed(next);
              setProblemsOnly(false);
              setTimeout(() => document.getElementById(`std-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
            }}
          />
          <div className="toolbar">
            <span className="brushes" role="radiogroup" aria-label="What clicking a cell does">
              {(
                [
                  ["cycle", "↻", "Cycle: click a cell for I → R → M → empty"],
                  ["I", "I", "Introduced: click or drag to set I"],
                  ["R", "R", "Reinforced: click or drag to set R"],
                  ["M", "M", "Mastered: click or drag to set M"],
                  ["clear", "⌫ Clear", "Clear: click or drag to remove"],
                ] as [Brush, string, string][]
              ).map(([b, label, tip]) => (
                <button
                  key={b}
                  role="radio"
                  aria-checked={brush === b}
                  title={tip}
                  className={"brush" + (b === "I" || b === "R" || b === "M" ? ` lg-chip level-${b}` : "") + (b === "clear" ? " brush-clear" : "") + (brush === b ? " on" : "")}
                  onClick={() => setBrush(b)}
                >
                  {label}
                </button>
              ))}
              <span className="small muted hint">
                {brush === "cycle" ? "Click a cell to cycle · drag to fill" : brush === "clear" ? "Click or drag to remove" : `Click or drag to set ${brush}`}
              </span>
            </span>
            <span className="tools">
              <button className={"chip-btn" + (problemsOnly ? " on" : "")} onClick={() => setProblemsOnly(!problemsOnly)} aria-pressed={problemsOnly}>
                ! Problems only
              </button>
              <button
                className="chip-btn"
                onClick={() => setCollapsed(collapsed.size ? new Set() : new Set(["S1", "S2", "S3", "S4", "S5", "S6"]))}
              >
                {collapsed.size ? "Expand all" : "Collapse all"}
              </button>
              {emptyCourses.length > 0 && ai.enabled && !ai.needsGoogle && (
                <button className="chip-btn ai" onClick={ai.signedIn ? suggest : ai.signIn} disabled={suggesting}>
                  {suggesting ? "Suggesting…" : "✨ AI suggestion"}
                </button>
              )}
              <button className="chip-btn ai" onClick={() => setModal("review")}>
                ✨ AI review
              </button>
              {plan.placements.length > 0 && (
                <button
                  className="chip-btn"
                  title="Remove every level from the map (courses stay)"
                  onClick={() => {
                    if (confirm(`Clear all ${plan.placements.length} levels from the map? Your courses stay.`))
                      dispatch({ type: "setCells", cells: plan.placements.map((p) => ({ courseId: p.courseId, topicId: p.topicId, level: null })) });
                  }}
                >
                  ⌫ Clear all
                </button>
              )}
              <button className="chip-btn" onClick={() => setModal("upload")}>
                ⬆ Upload plan
              </button>
            </span>
          </div>
          {pending.size > 0 && (
            <div className="pending-bar">
              <span>
                <b>{pending.size}</b> AI suggestions (dotted). Click one to accept it.
              </span>
              <span className="row">
                <button className="btn btn-primary btn-sm" onClick={acceptAll}>
                  Accept all
                </button>
                <button className="btn btn-sm" onClick={() => setPending(new Map())}>
                  Discard
                </button>
              </span>
            </div>
          )}
          <MapGrid
            plan={plan}
            dispatch={dispatch}
            pending={pending}
            setPending={setPending}
            problemsOnly={problemsOnly}
            brush={brush}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
          />
          <p className="status-legend small muted">
            <span className="status st-ok">✓</span> builds to M <span className="status st-noM">!</span> never M{" "}
            <span className="status st-order">↯</span> order <span className="status st-none">○</span> not addressed
          </p>
            </>
          )}
        </main>
      )}

      {modal === "upload" && (
        <Modal title="Add courses from a plan of study" onClose={() => setModal(null)}>
          <DropPlan ai={ai} onParsed={onParsed} compact />
        </Modal>
      )}
      {modal === "share" && <ShareModal plan={plan} onClose={() => setModal(null)} />}
      {modal === "review" && (
        <Modal title="AI review" onClose={() => setModal(null)} wide>
          <AnalysisPanel ai={ai} plan={plan} dispatch={dispatch} />
        </Modal>
      )}

      <footer className="footer small muted">
        PETE Curriculum Mapper · Created by{" "}
        <a href="https://yongjin.info" target="_blank" rel="noopener noreferrer">
          Yongjin Lee
        </a>{" "}
        · Data set version {plan.datasetVersion} · <a href="/help">Help</a> · <a href={process.env.NEXT_PUBLIC_FEEDBACK_URL || "https://yongjin.info"} target="_blank" rel="noopener noreferrer">Feedback</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
      </footer>

      {drive.mapsOpen && <MyMapsDialog drive={drive} plan={plan} onNewMap={newPlan} />}
      {exportOpen && <ExportDialog plan={plan} drive={drive} onClose={() => setExportOpen(false)} />}
      {shareOpen && drive.link && <ShareDialog drive={drive} onClose={() => setShareOpen(false)} />}
      {drive.conflict && <ConflictDialog drive={drive} />}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

/** Fallback when there is no plan-of-study file: paste or type courses (one per line). */
function TypeCourses({ dispatch, open }: { dispatch: Dispatch<Action>; open: boolean }) {
  const [show, setShow] = useState(open);
  const [text, setText] = useState("");
  const rows = parseCourseLines(text);
  if (!show && !open)
    return (
      <button className="linklike small" onClick={() => setShow(true)}>
        No file? Type or paste your courses
      </button>
    );
  return (
    <div className="type-courses">
      <textarea
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"One course per line\nPED 101 Foundations of Physical Education\nPED 210 Motor Development"}
        aria-label="Courses, one per line"
      />
      <button
        className="btn btn-primary"
        disabled={!rows.length}
        onClick={() => dispatch({ type: "addCourses", source: "paste", courses: rows })}
      >
        Add {rows.length || ""} course{rows.length === 1 ? "" : "s"}
      </button>
    </div>
  );
}
