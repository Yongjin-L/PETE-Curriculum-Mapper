"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { buildLibrary } from "@/lib/dataset";
import { emptyPlan, loadLocalPlan, normalizePlan, planReducer, saveLocalPlan } from "@/lib/plan";
import { CourseList } from "./CourseList";
import { AccountArea, ConflictDialog, MyMapsDialog, ShareDialog } from "./DriveUI";
import { useDrive } from "./useDrive";
import { Coverage } from "./Coverage";
import { TopicPanel } from "./TopicPanel";

type Tab = "map" | "coverage";

export function Mapper() {
  const [plan, dispatch] = useReducer(planReducer, undefined, emptyPlan);
  const [loaded, setLoaded] = useState(false);
  const [saveOk, setSaveOk] = useState(true);
  const [tab, setTab] = useState<Tab>("map");
  const [dragName, setDragName] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const lib = useMemo(() => buildLibrary(plan), [plan]);

  // Load the saved plan once, then autosave on every change.
  useEffect(() => {
    const saved = loadLocalPlan();
    if (saved) dispatch({ type: "replacePlan", plan: saved });
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) setSaveOk(saveLocalPlan(plan));
  }, [plan, loaded]);

  const drive = useDrive({ plan, loaded, dispatch, toast: setToast });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const onDragStart = (e: DragStartEvent) => setDragName((e.active.data.current?.name as string) ?? null);

  const onDragEnd = (e: DragEndEvent) => {
    setDragName(null);
    const a = e.active.data.current;
    const toCourseId = e.over?.data.current?.courseId as string | undefined;
    if (!a || !toCourseId) return;
    const course = plan.courses.find((c) => c.id === toCourseId);
    const already = plan.placements.some((p) => p.courseId === toCourseId && p.topicId === a.topicId);
    if (a.kind === "topic") {
      if (already) setToast(`"${a.name}" is already in ${course?.number || "that course"}.`);
      else dispatch({ type: "placeTopic", courseId: toCourseId, topicId: a.topicId });
    } else if (a.kind === "placement" && a.courseId !== toCourseId) {
      if (already) setToast(`"${a.name}" is already in ${course?.number || "that course"}.`);
      else dispatch({ type: "movePlacement", fromCourseId: a.courseId, toCourseId, topicId: a.topicId });
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = (plan.program.name || plan.program.university || "curriculum-map").replace(/[^\w\- ]+/g, "").trim() || "curriculum-map";
    a.href = url;
    a.download = `${base}.petemap.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const next = normalizePlan(JSON.parse(await file.text()));
      if (plan.courses.length > 0 && !confirm(drive.link ? "Open the imported file as a new map? Your current map stays in Google Drive." : "Replace your current map with the imported file?")) return;
      drive.detach();
      dispatch({ type: "replacePlan", plan: next });
      setToast(`Imported ${next.courses.length} course(s) and ${next.placements.length} placement(s).`);
    } catch (err) {
      alert(`Could not import this file. ${err instanceof Error ? err.message : ""}`);
    }
  };

  const newPlan = () => {
    const msg = drive.link
      ? "Start a new, empty map? Your current map stays saved in Google Drive."
      : "Start a new, empty map? Download your current map as JSON first if you want to keep it.";
    if (confirm(msg)) {
      drive.detach();
      dispatch({ type: "replacePlan", plan: emptyPlan() });
      setTab("map");
    }
  };

  if (!loaded) return <div className="loading">Loading…</div>;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            ◧
          </span>
          <div>
            <h1>PETE Curriculum Mapper</h1>
            <span className="muted small">Map key topics across your PETE program</span>
          </div>
        </div>
        <div className="actions">
          {saveOk ? (
            <AccountArea drive={drive} onShare={() => setShareOpen(true)} />
          ) : (
            <span className="save-status small warn" title="This browser is blocking storage. Sign in to save to Google Drive, or download your map as JSON.">
              ⚠ Browser storage blocked
            </span>
          )}
          {!saveOk && drive.status === "signed-out" && (
            <button className="btn" onClick={drive.signIn}>
              Sign in
            </button>
          )}
          <button className="btn" onClick={() => fileInput.current?.click()}>
            Open JSON
          </button>
          <button className="btn" onClick={exportJson}>
            Download JSON
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
        <label>
          <span className="small muted">University</span>
          <input value={plan.program.university} onChange={(e) => dispatch({ type: "setProgram", university: e.target.value })} placeholder="e.g. Adelphi University" />
        </label>
        <label>
          <span className="small muted">Program</span>
          <input value={plan.program.name} onChange={(e) => dispatch({ type: "setProgram", name: e.target.value })} placeholder="e.g. B.S. Physical Education (Teacher Certification)" />
        </label>
        <nav className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "map"} className={tab === "map" ? "on" : ""} onClick={() => setTab("map")}>
            Map
          </button>
          <button role="tab" aria-selected={tab === "coverage"} className={tab === "coverage" ? "on" : ""} onClick={() => setTab("coverage")}>
            Coverage
          </button>
        </nav>
      </div>

      {tab === "map" ? (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragName(null)}>
          <main className="workspace">
            <CourseList plan={plan} lib={lib} dispatch={dispatch} />
            <TopicPanel plan={plan} lib={lib} dispatch={dispatch} />
          </main>
          <DragOverlay dropAnimation={null}>{dragName && <div className="drag-ghost">{dragName}</div>}</DragOverlay>
        </DndContext>
      ) : (
        <main className="workspace single">
          <Coverage plan={plan} lib={lib} />
        </main>
      )}

      <footer className="footer small muted">
        PETE Curriculum Mapper · Created by{" "}
        <a href="https://yongjin.info" target="_blank" rel="noopener noreferrer">
          Yongjin Lee
        </a>{" "}
        · Data set version {plan.datasetVersion} · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
      </footer>

      {drive.mapsOpen && <MyMapsDialog drive={drive} plan={plan} onNewMap={newPlan} />}
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
