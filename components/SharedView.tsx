"use client";

import { useEffect, useState } from "react";
import { buildReport, downloadBlob, exportFileName, PRESETS } from "@/lib/report";
import { readShareFragment } from "@/lib/sharelink";
import { saveLocalPlan } from "@/lib/plan";
import type { Plan } from "@/lib/types";
import { Logo } from "./Logo";
import { MapGrid, StandardTiles } from "./MapGrid";
import { NotesView } from "./NotesView";
import { useGridImage } from "./ShareModal";

const noop = () => {};

/** Read-only page for a shared map link (/view#…). */
export function SharedView() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const load = () =>
      readShareFragment(window.location.hash)
        .then((p) => {
          setPlan(p);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    if (!window.location.hash) setError("This page shows maps shared with a link. The link you used has no map in it.");
    else load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <a href="/" className="brand" title="PETE Curriculum Mapper home">
          <Logo size={36} />
        </a>
        <span className="readonly-badge">👁 View only</span>
      </header>
      {error && (
        <main className="start">
          <p className="error-text">{error}</p>
          <a className="btn btn-primary" href="/map">
            Open the mapper
          </a>
        </main>
      )}
      {!error && !plan && <div className="loading">Loading shared map…</div>}
      {plan && <Shared plan={plan} />}
      <footer className="footer small muted">
        Shared with PETE Curriculum Mapper · <a href="/">curriculum.yongjin.info</a> · Standards © SHAPE America (2017)
      </footer>
    </div>
  );
}

function Shared({ plan }: { plan: Plan }) {
  const [view, setView] = useState<"map" | "notes">("map");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [problemsOnly, setProblemsOnly] = useState(false);
  const image = useGridImage(plan);

  const pdf = async () => {
    const { renderPdf } = await import("@/lib/export-pdf");
    downloadBlob(renderPdf(buildReport(plan, PRESETS.standard)), exportFileName(plan, "standard", "pdf"));
  };
  const openCopy = () => {
    let hasMap = false;
    try {
      hasMap = !!JSON.parse(localStorage.getItem("petemap:plan:v1") ?? "null")?.courses?.length;
    } catch {
      /* ignore */
    }
    if (hasMap && !confirm("Replace the map in this browser with this shared copy? (Maps saved in Google Drive are not affected.)")) return;
    try {
      // Detach from any Google Drive file so this copy never overwrites it.
      const drive = JSON.parse(localStorage.getItem("petemap:drive:v1") ?? "null");
      if (drive) localStorage.setItem("petemap:drive:v1", JSON.stringify({ ...drive, link: null }));
      localStorage.removeItem("petemap:pending:v1");
    } catch {
      /* ignore */
    }
    saveLocalPlan({ ...plan, meta: { ...plan.meta, updatedAt: new Date().toISOString() } });
    window.location.href = "/map";
  };

  return (
    <main className="mapview">
      <div className="shared-head">
        <div>
          <h1>{plan.program.name || "Curriculum map"}</h1>
          {plan.program.university && <p className="muted">{plan.program.university}</p>}
        </div>
        <div className="row">
          <button className="btn" onClick={image.download} disabled={!image.img}>
            ⬇ Image
          </button>
          <button className="btn" onClick={pdf}>
            ⬇ PDF
          </button>
          <button className="btn btn-primary" onClick={openCopy} title="Edit your own copy in the mapper">
            Make a copy to edit
          </button>
        </div>
      </div>
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
        <NotesView plan={plan} dispatch={noop} readOnly />
      ) : (
        <>
          <StandardTiles
            plan={plan}
            onPick={(id) => {
              const next = new Set(collapsed);
              next.delete(id);
              setCollapsed(next);
              setTimeout(() => document.getElementById(`std-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
            }}
          />
          <div className="toolbar">
            <span className="brushes">
              <span className="lg-chip level-I">I</span>
              <span className="lg-chip level-R">R</span>
              <span className="lg-chip level-M">M</span>
              <span className="small muted hint">Introduced · Reinforced · Mastered. Click a component to read it.</span>
            </span>
            <span className="tools">
              <button className={"chip-btn" + (problemsOnly ? " on" : "")} onClick={() => setProblemsOnly(!problemsOnly)} aria-pressed={problemsOnly}>
                ! Problems only
              </button>
              <button className="chip-btn" onClick={() => setCollapsed(collapsed.size ? new Set() : new Set(["S1", "S2", "S3", "S4", "S5", "S6"]))}>
                {collapsed.size ? "Expand all" : "Collapse all"}
              </button>
            </span>
          </div>
          <MapGrid
            plan={plan}
            dispatch={noop}
            pending={new Map()}
            setPending={noop}
            problemsOnly={problemsOnly}
            brush="cycle"
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            readOnly
          />
          <p className="status-legend small muted">
            <span className="status st-ok">✓</span> builds to M <span className="status st-noM">!</span> never M{" "}
            <span className="status st-order">↯</span> order <span className="status st-none">○</span> not addressed
          </p>
        </>
      )}
    </main>
  );
}
