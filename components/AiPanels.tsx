"use client";

import { useRef, useState, type Dispatch } from "react";
import type { Action } from "@/lib/plan";
import type { Plan } from "@/lib/types";
import { Markdown } from "./Markdown";
import type { AiApi, ParsedPlan } from "./useAi";

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
  const [result, setResult] = useState<(ParsedPlan & { rows: { number: string; name: string; term: string; keep: boolean }[] }) | null>(null);
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
    return (
      <div className="review">
        <div className="row between">
          <b>Review the courses found ({rows.length})</b>
          <span className="small muted">Edit anything that&apos;s wrong, untick courses to skip them.</span>
        </div>
        {result.notes && <p className="small muted">Note from the AI: {result.notes}</p>}
        <div className="review-table-wrap">
          <table className="review-table">
            <thead>
              <tr>
                <th>Add</th>
                <th>Course no.</th>
                <th>Course name</th>
                <th>Term</th>
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
                  </td>
                  <td>
                    <input value={r.name} onChange={(e) => update(i, { name: e.target.value })} aria-label="Course name" />
                  </td>
                  <td className="small muted">{r.term}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canSetProgram && (
          <label className="check small">
            <input type="checkbox" checked={setProgram} onChange={(e) => setSetProgram(e.target.checked)} />
            <span>
              Also fill in the program details: {[result.program_name, result.university].filter(Boolean).join(", ")}
            </span>
          </label>
        )}
        <p className="small muted">AI can make mistakes. Check the list against your official plan of study before confirming.</p>
        <div className="row">
          <button
            className="btn btn-primary"
            disabled={kept.length === 0}
            onClick={() => {
              dispatch({ type: "addCourses", courses: kept.map(({ number, name }) => ({ number, name })) });
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
            <span className="spinner" aria-hidden /> Reading your plan of study… this can take up to a minute.
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
        <span>The AI lists the courses; you review and confirm before anything is added.</span>
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
            {!ready && <span className="small muted">Map some topics to courses first.</span>}
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
