"use client";

import { useRef, useState, type Dispatch } from "react";
import type { Action } from "@/lib/plan";
import { getLibrary } from "@/lib/dataset";
import { track } from "@/lib/track";
import type { Plan } from "@/lib/types";
import { Markdown } from "./Markdown";
import type { AiApi, ParsedPlan, Suggested } from "./useAi";

const ACCEPT = ".pdf,.docx,.txt,.csv,.tsv,image/png,image/jpeg,image/webp,image/gif";

/** Shown when AI can't be used yet: not configured, or the user must sign in. Returns null when ready. */
function AiGate({ ai, what }: { ai: AiApi; what: string }) {
  if (ai.needsGoogle || ai.enabled === false)
    return <p className="muted small">{ai.reason ?? "AI features are not available yet."}</p>;
  if (ai.enabled === null) return <p className="muted small">Checking AI availability…</p>;
  if (!ai.signedIn)
    return (
      <div className="callout">
        <div>
          <b>Sign in to {what}.</b>
          <div className="small muted">AI features are free, with a daily limit per person.</div>
        </div>
        <button className="btn btn-primary" onClick={ai.signIn}>
          Sign in with Google
        </button>
      </div>
    );
  return null;
}

const remainingText = (u?: { remaining: number; limit: number }) => (u ? `${u.remaining} of ${u.limit} left today` : "");

export function UploadPlan({ ai, plan, dispatch, onDone }: { ai: AiApi; plan: Plan; dispatch: Dispatch<Action>; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(ParsedPlan & { rows: (ParsedPlan["courses"][number] & { keep: boolean })[] }) | null>(null);
  const [applyMatching, setApplyMatching] = useState(true);
  const lib = getLibrary();
  const [setProgram, setSetProgram] = useState(true);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const gate = <AiGate ai={ai} what="upload a plan of study" />;
  if (ai.needsGoogle || ai.enabled !== true || !ai.signedIn) return gate;

  const run = async (file: File) => {
    setError(null);
    setResult(null);
    if (file.size > 4 * 1024 * 1024) return setError("The file is larger than 4 MB. Try a smaller PDF, or a screenshot of the plan of study.");
    setBusy(true);
    try {
      const r = await ai.parsePlan(file);
      if (!r.courses.length) setError(r.notes || "No courses were found in this file.");
      else setResult({ ...r, rows: r.courses.map((c) => ({ ...c, keep: true })) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const rows = result.rows;
    const kept = rows.filter((r) => r.keep && (r.number.trim() || r.name.trim()));
    const update = (i: number, patch: Partial<(typeof rows)[number]>) => setResult({ ...result, rows: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
    const canSetProgram = (!!result.university && !plan.program.university) || (!!result.program_name && !plan.program.name);
    const placements = kept.reduce((n, r) => n + r.components.length, 0);
    const covered = new Set(kept.flatMap((r) => r.components.map((c) => c.id))).size;
    return (
      <div className="review">
        <div className="row between">
          <b>Review the courses and suggested matching ({rows.length} courses)</b>
          <span className="small muted">Fix course details, untick courses to skip, ✕ to drop a suggested component.</span>
        </div>
        {result.notes && <p className="small muted">Note from the AI: {result.notes}</p>}
        <div className="review-table-wrap">
          <table className="review-table">
            <thead>
              <tr>
                <th>Add</th>
                <th>Course no.</th>
                <th>Course name</th>
                <th>Suggested SHAPE components</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={r.keep ? "" : "skipped"}>
                  <td>
                    <input type="checkbox" checked={r.keep} onChange={(e) => update(i, { keep: e.target.checked })} aria-label={`Add ${r.number} ${r.name}`} />
                  </td>
                  <td>
                    <input value={r.number} onChange={(e) => update(i, { number: e.target.value })} aria-label="Course number" />
                    {r.term && <div className="small muted term">{r.term}</div>}
                  </td>
                  <td>
                    <input value={r.name} onChange={(e) => update(i, { name: e.target.value })} aria-label="Course name" />
                  </td>
                  <td>
                    <div className="sugg">
                      {r.components.length === 0 && <span className="small muted">none</span>}
                      {r.components.map((c) => {
                        const comp = lib.componentById.get(c.id);
                        return (
                          <span key={c.id} className={`sugg-chip level-${c.level}`} title={comp ? `${c.id} ${comp.label}: ${comp.text}` : c.id}>
                            <b>{c.id}</b>
                            <span className={`dot level-${c.level}`}>{c.level}</span>
                            <button
                              className="sugg-x"
                              aria-label={`Remove ${c.id} from ${r.number || r.name}`}
                              onClick={() => update(i, { components: r.components.filter((x) => x.id !== c.id) })}
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="check small">
          <input type="checkbox" checked={applyMatching} onChange={(e) => setApplyMatching(e.target.checked)} />
          <span>
            Apply the suggested matching ({placements} placements covering {covered} of {lib.components.length} components). You can change
            everything on the map afterwards.
          </span>
        </label>
        {canSetProgram && (
          <label className="check small">
            <input type="checkbox" checked={setProgram} onChange={(e) => setSetProgram(e.target.checked)} />
            <span>
              Also fill in the program details: {[result.program_name, result.university].filter(Boolean).join(", ")}
            </span>
          </label>
        )}
        <p className="small muted">
          AI can make mistakes. The matching is a starting point based on course titles (and descriptions, if your file has them); review it
          with your faculty.
        </p>
        <div className="row">
          <button
            className="btn btn-primary"
            disabled={kept.length === 0}
            onClick={() => {
              dispatch({
                type: "addCourses",
                source: "ai",
                courses: kept.map(({ number, name, components }) => ({ number, name, components: applyMatching ? components : [] })),
              });
              if (applyMatching && placements) track("ai_matching_applied", placements);
              if (canSetProgram && setProgram)
                dispatch({
                  type: "setProgram",
                  university: plan.program.university || result.university || undefined,
                  name: plan.program.name || result.program_name || undefined,
                });
              setResult(null);
              onDone();
            }}
          >
            Confirm and add {kept.length} course{kept.length === 1 ? "" : "s"}
          </button>
          <button className="btn" onClick={() => setResult(null)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="upload">
      <div
        className={"dropfile" + (dragging ? " is-over" : "")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) run(f);
        }}
      >
        {busy ? (
          <p>
            <span className="spinner" aria-hidden /> Reading your plan of study and suggesting the SHAPE matching… this can take up to a minute.
          </p>
        ) : (
          <>
            <p>
              <b>Drop a plan of study here</b> or{" "}
              <button className="linklike" onClick={() => input.current?.click()}>
                choose a file
              </button>
            </p>
            <p className="small muted">PDF, Word (.docx), image or CSV, up to 4 MB. The file is read once and not stored.</p>
          </>
        )}
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) run(f);
            e.target.value = "";
          }}
        />
      </div>
      <div className="row between small muted">
        <span>AI lists your courses and suggests SHAPE components for each; you review before anything is added.</span>
        <span>{remainingText(ai.usage.parse)}</span>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

export function AnalysisPanel({ ai, plan, dispatch }: { ai: AiApi; plan: Plan; dispatch: Dispatch<Action> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = plan.courses.length > 0 && plan.placements.length > 0;
  const gate = <AiGate ai={ai} what="get an AI analysis of your map" />;
  const usable = !ai.needsGoogle && ai.enabled === true && ai.signedIn;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await ai.analyze(plan);
      dispatch({ type: "setAnalysis", analysis: { markdown: r.markdown, createdAt: r.createdAt } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="analysis">
      <div className="row between">
        <h2>AI analysis</h2>
        {usable && <span className="small muted">{remainingText(ai.usage.analyze)}</span>}
      </div>
      {!usable ? (
        gate
      ) : (
        <>
          {!plan.analysis && (
            <p className="small muted">
              Get a short review of standards coverage, I → R → M progression, course balance and gaps, with suggestions. The analysis is saved with
              your map and can be included in exports.
            </p>
          )}
          <div className="row">
            <button className="btn btn-primary" onClick={run} disabled={busy || !ready}>
              {busy ? "Analyzing… (up to a minute)" : plan.analysis ? "Run analysis again" : "Analyze my map"}
            </button>
            {plan.analysis && !busy && (
              <button className="btn" onClick={() => confirm("Remove the saved analysis from this map?") && dispatch({ type: "setAnalysis", analysis: null })}>
                Remove
              </button>
            )}
            {!ready && <span className="small muted">Map some components to courses first.</span>}
          </div>
        </>
      )}
      {error && <p className="error-text">{error}</p>}
      {plan.analysis && (
        <div className="analysis-body">
          <p className="small muted">
            Generated {new Date(plan.analysis.createdAt).toLocaleString()} · AI can make mistakes; use it as a starting point for faculty discussion.
          </p>
          <Markdown text={plan.analysis.markdown} />
        </div>
      )}
    </section>
  );
}

/** For courses entered by hand: suggest SHAPE components for the courses that have none yet (with undo). */
export function SuggestMatching({ ai, plan, dispatch }: { ai: AiApi; plan: Plan; dispatch: Dispatch<Action> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ added: { courseId: string; topicId: string }[]; courses: number; notes: string } | null>(null);

  const empty = plan.courses.filter((c) => !plan.placements.some((p) => p.courseId === c.id));
  if (ai.needsGoogle || ai.enabled === false) return null;
  if (!done && empty.length === 0) return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await ai.suggest(
        plan,
        plan.courses.map((c) => ({ number: c.number, name: c.name }))
      );
      const emptyIds = new Set(empty.map((c) => c.id));
      const added = plan.courses.flatMap((c, i) =>
        emptyIds.has(c.id) ? (r.suggestions[i] ?? ([] as Suggested)).map((s) => ({ courseId: c.id, topicId: s.id, level: s.level })) : []
      );
      dispatch({ type: "addPlacements", placements: added });
      track("ai_matching_applied", added.length);
      setDone({ added, courses: new Set(added.map((a) => a.courseId)).size, notes: r.notes });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div className="callout suggest-bar">
        <div>
          <b>
            Added {done.added.length} suggested component{done.added.length === 1 ? "" : "s"} to {done.courses} course{done.courses === 1 ? "" : "s"}.
          </b>
          <div className="small muted">Review them below: change levels, drag components between courses, or ✕ to remove.{done.notes ? ` ${done.notes}` : ""}</div>
        </div>
        <div className="row">
          <button
            className="btn"
            onClick={() => {
              for (const a of done.added) dispatch({ type: "removePlacement", courseId: a.courseId, topicId: a.topicId });
              setDone(null);
            }}
          >
            Undo
          </button>
          <button className="btn" onClick={() => setDone(null)}>
            OK
          </button>
        </div>
      </div>
    );

  return (
    <div className="callout suggest-bar">
      <div>
        <b>
          {empty.length} course{empty.length === 1 ? " has" : "s have"} no SHAPE components yet.
        </b>
        <div className="small muted">
          AI can suggest an initial matching with I / R / M levels for {empty.length === 1 ? "it" : "them"}, using your whole course sequence.{" "}
          {ai.signedIn && remainingText(ai.usage.suggest)}
        </div>
        {error && <div className="error-text small">{error}</div>}
      </div>
      {ai.signedIn ? (
        <button className="btn btn-primary" onClick={run} disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden /> Suggesting…
            </>
          ) : (
            "Suggest matching with AI"
          )}
        </button>
      ) : (
        <button className="btn btn-primary" onClick={ai.signIn}>
          Sign in for AI suggestions
        </button>
      )}
    </div>
  );
}
