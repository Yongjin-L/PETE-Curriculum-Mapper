// ---- Data set (public/data/dataset.json, built from dataset/PETE_dataset_template.xlsx)

export interface Standard {
  standard_id: string; // S1-S6
  standard_no: string; // "1"-"6"
  title: string;
  description: string;
}

export interface Component {
  component_id: string; // e.g. "3.b"
  standard_id: string;
  label: string; // short name shown on the map
  text: string; // full component statement
}

export interface Dataset {
  datasetVersion: string;
  source: string;
  standards: Standard[];
  components: Component[];
}

// ---- User plan (saved in the browser now; Google Drive in Phase 3)

export type Level = "I" | "R" | "M";

export const LEVELS: Level[] = ["I", "R", "M"];

export const LEVEL_NAMES: Record<Level, string> = {
  I: "Introduced",
  R: "Reinforced",
  M: "Mastered",
};

export interface Course {
  id: string;
  number: string;
  name: string;
  term?: string; // e.g. "Year 1 Fall" (from the plan of study); used to group columns
}

export interface Placement {
  courseId: string;
  topicId: string; // component ID, e.g. "3.b" (field name kept for saved maps)
  level: Level;
}

export interface Plan {
  schemaVersion: 1;
  datasetVersion: string;
  program: { university: string; name: string };
  courses: Course[]; // array order = program order
  placements: Placement[];
  analysis: Analysis | null; // latest AI analysis, if any
  meta: { createdAt: string; updatedAt: string };
}

export interface Analysis {
  markdown: string;
  createdAt: string;
}
