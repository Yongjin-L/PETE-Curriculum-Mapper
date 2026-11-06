import raw from "@/public/data/dataset.json";
import type { Chapter, Dataset, Plan, Standard, Textbook, Topic } from "./types";

export const masterDataset = raw as unknown as Dataset;

/** Master data merged with the user's private custom items, plus lookups. */
export interface Library {
  topics: Topic[];
  textbooks: Textbook[];
  standards: Standard[];
  topicById: Map<string, Topic>;
  chapterById: Map<string, Chapter>;
  textbookById: Map<string, Textbook>;
  standardById: Map<string, Standard>;
  chaptersByTextbook: Map<string, Chapter[]>;
}

export function buildLibrary(plan: Plan): Library {
  const topics = [...masterDataset.topics, ...plan.customTopics];
  const textbooks = [...masterDataset.textbooks, ...plan.customTextbooks];
  const chapters = [...masterDataset.chapters, ...plan.customChapters];
  const standards = masterDataset.standards;

  const chaptersByTextbook = new Map<string, Chapter[]>();
  for (const c of chapters) {
    const list = chaptersByTextbook.get(c.textbook_id) ?? [];
    list.push(c);
    chaptersByTextbook.set(c.textbook_id, list);
  }
  for (const list of chaptersByTextbook.values())
    list.sort((a, b) => Number(a.chapter_no) - Number(b.chapter_no));

  return {
    topics,
    textbooks,
    standards,
    topicById: new Map(topics.map((t) => [t.topic_id, t])),
    chapterById: new Map(chapters.map((c) => [c.chapter_id, c])),
    textbookById: new Map(textbooks.map((b) => [b.textbook_id, b])),
    standardById: new Map(standards.map((s) => [s.standard_id, s])),
    chaptersByTextbook,
  };
}

export function standardCode(s: Standard): string {
  return s.component ? `${s.standard_no}.${s.component}` : `Std ${s.standard_no}`;
}

export function chapterLabel(lib: Library, chapterId: string): string {
  const ch = lib.chapterById.get(chapterId);
  if (!ch) return chapterId;
  const book = lib.textbookById.get(ch.textbook_id);
  return `${book?.title ?? ch.textbook_id}, Ch. ${ch.chapter_no}: ${ch.chapter_title}`;
}
