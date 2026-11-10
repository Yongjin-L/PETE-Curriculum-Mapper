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
          <div className="small muted">Free, with a daily limit per person.</div>
        </div>
        <button className="btn btn-primary" onClick={ai.signIn}>
          Sign in with Google
        </button>
      </div>
    );
  return null;
}

const remainingText = (u?: { remaining: number; limit: number }) => (u ? `${u.remaining} of ${u.limit} left today` : "");

/** Drop zone for a plan of study. Calls onParsed with the AI result (courses + suggested components). */
export function DropPlan({ ai, onParsed, compact }: { ai: AiApi; onParsed: (r: ParsedPlan) => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const ready = !ai.needsGoogle && ai.enabled === true && ai.signedIn;

  const run = async (file: File) => {
    setError(null);
    if (file.size > 4 * 1024 * 1024) return setError("Larger than 4 MB. Try a smaller PDF or a screenshot.");
    setBusy(true);
    try {
      const r = await ai.parsePlan(file);
      if (!r.courses.length) setError(r.notes || "No courses found in this file.");
      else onParsed(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={"dropplan" + (compact ? " compact" : "")}>
      <div
        className={"dropfile" + (over ? " is-over" : "") + (ready ? "" : " disabled")}
        onDragOver={(e) => {
          e.preventDefault();
          if (ready) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && ready && !busy) run(f);
        }}
        onClick={() => ready && !busy && input.current?.click()}
        role="button"
        tabIndex={ready ? 0 : -1}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && ready && input.current?.click()}
      >
        {busy ? (
          <p className="drop-main">
            <span className="spinner" aria-hidden /> Reading your plan of study…
          </p>
        ) : (
          <>
            <div className="drop-icon" aria-hidden>
              ⬆
            </div>
            <p className="drop-main">Drop your plan of study</p>
            <p className="small muted">PDF · Word · image · CSV</p>
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
      {!ready && <AiGate ai={ai} what="upload a plan of study" />}
      {ready && ai.usage.parse && <p className="small muted center">{remainingText(ai.usage.parse)}</p>}
      {error && <p className="error-text small">{error}</p>}
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

