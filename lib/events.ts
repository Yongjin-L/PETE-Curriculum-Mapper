/** Anonymous usage events. Only these names are counted; no personal data or content is ever sent. */
export const EVENTS = [
  "map_started",
  "courses_added_manual",
  "courses_added_paste",
  "courses_added_ai",
  "topic_placed",
  "custom_topic_added",
  "custom_book_added",
  "signed_in",
  "drive_file_created",
  "drive_map_opened",
  "share_opened",
  "conflict_resolved",
  "export_pdf",
  "export_docx",
  "export_json",
  "json_imported",
  "ai_upload",
  "ai_analysis",
] as const;

export type EventName = (typeof EVENTS)[number];

export const EVENT_LABELS: Record<EventName, string> = {
  map_started: "Maps started (first course added)",
  courses_added_manual: "Courses typed in",
  courses_added_paste: "Courses pasted",
  courses_added_ai: "Courses added from AI upload",
  topic_placed: "Topics placed on courses",
  custom_topic_added: "Custom topics created",
  custom_book_added: "Custom books created",
  signed_in: "Google sign-ins",
  drive_file_created: "Maps saved to a new Drive file",
  drive_map_opened: "Maps opened from Drive",
  share_opened: "Share dialog opened",
  conflict_resolved: "Edit conflicts resolved",
  export_pdf: "PDF exports",
  export_docx: "Word exports",
  export_json: "JSON exports",
  json_imported: "JSON files opened",
  ai_upload: "AI plan-of-study uploads",
  ai_analysis: "AI map analyses",
};
