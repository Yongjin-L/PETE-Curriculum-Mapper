// ---- Master data set (public/data/dataset.json, built by scripts/build-dataset.mjs)

export interface Textbook {
  textbook_id: string;
  title: string;
  authors: string;
  edition?: number | string | null;
  year?: number | string | null;
  publisher?: string;
  isbn?: string;
  custom?: boolean;
}

export interface Chapter {
  chapter_id: string;
  textbook_id: string;
  chapter_no: number | string | null;
  chapter_title: string;
  custom?: boolean;
}

export interface Standard {
  standard_id: string;
  standard_no: string;
  component?: string;
  short_label: string;
}

export type Relevance = "primary" | "secondary";

export interface Topic {
  topic_id: string;
  topic_name: string;
  description?: string;
  keywords: string[];
  chapters: { chapter_id: string; relevance: Relevance | string }[];
  standards: string[];
  custom?: boolean;
}

export interface Dataset {
  datasetVersion: string;
  textbooks: Textbook[];
  chapters: Chapter[];
  standards: Standard[];
  topics: Topic[];
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
}

export interface Placement {
  courseId: string;
  topicId: string;
  level: Level;
}

export interface Plan {
  schemaVersion: 1;
  datasetVersion: string;
  program: { university: string; name: string };
  courses: Course[]; // array order = program order
  placements: Placement[];
  customTopics: Topic[];
  customTextbooks: Textbook[];
  customChapters: Chapter[];
  meta: { createdAt: string; updatedAt: string };
}
