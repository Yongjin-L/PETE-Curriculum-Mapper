"use client";

import { useState } from "react";
import { buildReport, downloadBlob, exportFileName, LEVEL_INFO, PRESETS, type ExportLevel, type Sections } from "@/lib/report";
import type { Plan } from "@/lib/types";
import { Modal } from "./Modal";
import { fileNameFor, type DriveApi } from "./useDrive";

type Format = "pdf" | "docx" | "json";

const FORMATS: { id: Format; label: string; note: string }[] = [
  { id: "pdf", label: "PDF", note: "For sharing and printing" },
  { id: "docx", label: "Word", note: "Editable .docx document" },
  { id: "json", label: "JSON", note: "Full backup; re-open it here later" },
];

const SECTION_LABELS: { key: keyof Sections; label: string }[] = [
  { key: "chapters", label: "Linked textbook chapters for each topic" },
  { key: "standards", label: "SHAPE standards for each topic" },
  { key: "references", label: "Reference list of textbooks" },
  { key: "coverage", label: "Standards coverage table" },
  { key: "matrix", label: "Topics × courses matrix (landscape page)" },
  { key: "analysis", label: "AI analysis" },
];

export function ExportDialog({ plan, drive, onClose }: { plan: Plan; drive: DriveApi; onClose: () => void }) {
  const [format, setFormat] = useState<Format>("pdf");
  const [level, setLevel] = useState<ExportLevel>("standard");
  const [sections, setSections] = useState<Sections>(PRESETS.standard);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsSignIn = drive.enabled && (drive.status === "signed-out" || drive.status === "reconnect");
  const empty = plan.courses.length === 0;

  const chooseLevel = (l: ExportLevel) => {
    setLevel(l);
    setSections(PRESETS[l]);
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      if (format === "json") {
        downloadBlob(new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }), fileNameFor(plan));
      } else {
        const report = buildReport(plan, sections, plan.analysis?.markdown ?? null);
        if (format === "pdf") {
          const { renderPdf } = await import("@/lib/export-pdf");
          downloadBlob(renderPdf(report), exportFileName(plan, level, "pdf"));
        } else {
          const { renderDocx } = await import("@/lib/export-docx");
          downloadBlob(await renderDocx(report), exportFileName(plan, level, "docx"));
        }
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Export map"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          {needsSignIn ? (
            <button className="btn btn-primary" onClick={() => drive.signIn({ autoSave: true })}>
              {drive.status === "reconnect" ? "Reconnect Google to export" : "Sign in with Google to export"}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={run} disabled={busy || empty}>
              {busy ? "Preparing…" : `Download ${FORMATS.find((f) => f.id === format)!.label}`}
            </button>
          )}
        </>
      }
    >
      {empty && <p className="error-text">Add at least one course before exporting.</p>}
      {needsSignIn && (
        <div className="callout">
          <div>
            <b>Sign in to export.</b>
            <div className="small muted">Exporting is free. Signing in also saves your map to your Google Drive.</div>
          </div>
        </div>
      )}

      <fieldset className="field">
        <legend>Format</legend>
        <div className="option-cards three">
          {FORMATS.map((f) => (
            <label key={f.id} className={"option-card" + (format === f.id ? " on" : "")}>
              <input type="radio" name="format" checked={format === f.id} onChange={() => setFormat(f.id)} />
              <b>{f.label}</b>
              <span className="small muted">{f.note}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {format !== "json" && (
        <>
          <fieldset className="field">
            <legend>Level of detail</legend>
            <div className="option-cards three">
              {(Object.keys(LEVEL_INFO) as ExportLevel[]).map((l) => (
                <label key={l} className={"option-card" + (level === l ? " on" : "")}>
                  <input type="radio" name="level" checked={level === l} onChange={() => chooseLevel(l)} />
                  <b>{LEVEL_INFO[l].label}</b>
                  <span className="small muted">{LEVEL_INFO[l].description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <legend>Include</legend>
            <label className="check">
              <input type="checkbox" checked disabled />
              <span>Program details and each course&apos;s topics with I/R/M levels</span>
            </label>
            {SECTION_LABELS.map((s) => {
              const unavailable = s.key === "analysis" && !plan.analysis;
              return (
                <label key={s.key} className={"check" + (unavailable ? " muted" : "")}>
                  <input
                    type="checkbox"
                    disabled={unavailable}
                    checked={!unavailable && sections[s.key]}
                    onChange={(e) => setSections({ ...sections, [s.key]: e.target.checked })}
                  />
                  <span>
                    {s.label}
                    {unavailable && " (run it on the Coverage tab first)"}
                  </span>
                </label>
              );
            })}
          </fieldset>
        </>
      )}

      {format === "json" && (
        <p className="small muted">
          A JSON file contains everything in this map, including your custom topics and books. Use <b>Open JSON</b> to load it again later or on
          another computer.
        </p>
      )}
      {error && <p className="error-text">Export failed: {error}</p>}
    </Modal>
  );
}
