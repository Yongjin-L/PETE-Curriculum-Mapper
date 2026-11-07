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
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type Dispatch } from "react";
import { getLibrary } from "@/lib/dataset";
import { emptyPlan, loadLocalPlan, normalizePlan, planReducer, saveLocalPlan, type Action } from "@/lib/plan";
import { track, trackInstitution } from "@/lib/track";
import { CourseList } from "./CourseList";
import { AccountArea, ConflictDialog, MyMapsDialog, ShareDialog } from "./DriveUI";
import { ExportDialog } from "./ExportDialog";
import { useAi } from "./useAi";
import { useDrive } from "./useDrive";
import { Coverage } from "./Coverage";
import { ComponentPanel } from "./ComponentPanel";
import { Logo } from "./Logo";

type Tab = "map" | "coverage";

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
    } else if (a.type === "placeTopic") {
      if (!p.placements.some((x) => x.courseId === a.courseId && x.topicId === a.topicId)) track("topic_placed");
    }
    rawDispatch(a);
  }, []);
  const [loaded, setLoaded] = useState(false);
  const [saveOk, setSaveOk] = useState(true);
  const [tab, setTab] = useState<Tab>("map");
  const [dragName, setDragName] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const lib = getLibrary();

  // Load the saved plan once, then autosave on every change.
  useEffect(() => {
    const saved = loadLocalPlan();
    if (saved) rawDispatch({ type: "replacePlan", plan: saved });
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

  const importJson = async (file: File) => {
    try {
      const next = normalizePlan(JSON.parse(await file.text()));
      if (plan.courses.length > 0 && !confirm(drive.link ? "Open the imported file as a new map? Your current map stays in Google Drive." : "Replace your current map with the imported file?")) return;
      drive.detach();
      dispatch({ type: "replacePlan", plan: next });
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
      setTab("map");
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
            <CourseList plan={plan} lib={lib} dispatch={dispatch} ai={ai} />
            <ComponentPanel plan={plan} lib={lib} dispatch={dispatch} />
          </main>
          <DragOverlay dropAnimation={null}>{dragName && <div className="drag-ghost">{dragName}</div>}</DragOverlay>
        </DndContext>
      ) : (
        <main className="workspace single">
          <Coverage plan={plan} lib={lib} ai={ai} dispatch={dispatch} />
        </main>
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
