"use client";

import { useState, type Dispatch } from "react";
import { standardCode, type Library } from "@/lib/dataset";
import { nextCustomId, type Action } from "@/lib/plan";
import type { Chapter, Plan, Topic } from "@/lib/types";
import { Modal } from "./Modal";

export function CustomTopicDialog({
  topic,
  plan,
  lib,
  dispatch,
  onAddBook,
  onClose,
}: {
  topic: Topic | null;
  plan: Plan;
  lib: Library;
  dispatch: Dispatch<Action>;
  onAddBook: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(topic?.topic_name ?? "");
  const [description, setDescription] = useState(topic?.description ?? "");
  const [keywords, setKeywords] = useState(topic?.keywords.join("; ") ?? "");
  const [standards, setStandards] = useState<string[]>(topic?.standards ?? []);
  const [chapters, setChapters] = useState<string[]>(topic?.chapters.map((c) => c.chapter_id) ?? []);
  const [bookId, setBookId] = useState(lib.textbooks[0]?.textbook_id ?? "");

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const save = () => {
    if (!name.trim()) return;
    const id =
      topic?.topic_id ??
      nextCustomId(
        plan.customTopics.map((t) => t.topic_id),
        "U-T",
        3
      );
    dispatch({
      type: "saveCustomTopic",
      topic: {
        topic_id: id,
        topic_name: name.trim(),
        description: description.trim(),
        keywords: keywords.split(";").map((k) => k.trim()).filter(Boolean),
        standards,
        chapters: chapters.map((c) => ({
          chapter_id: c,
          relevance: topic?.chapters.find((x) => x.chapter_id === c)?.relevance ?? "primary",
        })),
        custom: true,
      },
    });
    onClose();
  };

  const bookChapters = lib.chaptersByTextbook.get(bookId) ?? [];

  return (
    <Modal
      title={topic ? "Edit my topic" : "Add my topic"}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>
            Save topic
          </button>
        </>
      }
    >
      <label className="field">
        <span>Topic name *</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="field">
        <span>Keywords (separate with semicolons)</span>
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} />
      </label>

      <fieldset className="field">
        <legend>SHAPE America standards</legend>
        <div className="check-grid">
          {lib.standards.map((s) => (
            <label key={s.standard_id} className="check">
              <input type="checkbox" checked={standards.includes(s.standard_id)} onChange={() => toggle(standards, setStandards, s.standard_id)} />
              <span>
                <b>{standardCode(s)}</b> {s.short_label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Linked chapters ({chapters.length} selected)</legend>
        <div className="row">
          <select value={bookId} onChange={(e) => setBookId(e.target.value)} aria-label="Textbook">
            {lib.textbooks.map((b) => (
              <option key={b.textbook_id} value={b.textbook_id}>
                {b.title}
                {b.custom ? " (my book)" : ""}
              </option>
            ))}
          </select>
          <button className="btn btn-sm" type="button" onClick={onAddBook}>
            + My book
          </button>
        </div>
        <div className="check-list">
          {bookChapters.length === 0 && <p className="muted small">This book has no chapters.</p>}
          {bookChapters.map((c) => (
            <label key={c.chapter_id} className="check">
              <input type="checkbox" checked={chapters.includes(c.chapter_id)} onChange={() => toggle(chapters, setChapters, c.chapter_id)} />
              <span>
                Ch. {c.chapter_no}: {c.chapter_title}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </Modal>
  );
}

export function CustomBookDialog({ plan, dispatch, onClose }: { plan: Plan; dispatch: Dispatch<Action>; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [edition, setEdition] = useState("");
  const [year, setYear] = useState("");
  const [publisher, setPublisher] = useState("");
  const [chapterText, setChapterText] = useState("");

  const chapterLines = chapterText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      const m = l.match(/^(?:ch(?:apter)?\.?\s*)?(\d+)[.):\-–\s]+(.+)$/i);
      return m ? { no: Number(m[1]), title: m[2].trim() } : { no: i + 1, title: l };
    });

  const save = () => {
    if (!title.trim()) return;
    const id = nextCustomId(
      plan.customTextbooks.map((b) => b.textbook_id),
      "U-TB",
      2
    );
    const chapters: Chapter[] = chapterLines.map((c) => ({
      chapter_id: `${id}-C${String(c.no).padStart(2, "0")}`,
      textbook_id: id,
      chapter_no: c.no,
      chapter_title: c.title,
    }));
    const unique = chapters.filter((c, i) => chapters.findIndex((x) => x.chapter_id === c.chapter_id) === i);
    dispatch({
      type: "addCustomTextbook",
      textbook: { textbook_id: id, title: title.trim(), authors: authors.trim(), edition: edition.trim(), year: year.trim(), publisher: publisher.trim() },
      chapters: unique,
    });
    onClose();
  };

  return (
    <Modal
      title="Add my book"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!title.trim()}>
            Save book
          </button>
        </>
      }
    >
      <label className="field">
        <span>Title *</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>
      <label className="field">
        <span>Authors</span>
        <input value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder="Last, F.; Last, F." />
      </label>
      <div className="row">
        <label className="field">
          <span>Edition</span>
          <input value={edition} onChange={(e) => setEdition(e.target.value)} />
        </label>
        <label className="field">
          <span>Year</span>
          <input value={year} onChange={(e) => setYear(e.target.value)} />
        </label>
        <label className="field grow">
          <span>Publisher</span>
          <input value={publisher} onChange={(e) => setPublisher(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Chapters (one per line, e.g. &quot;3. Motor development&quot;)</span>
        <textarea rows={6} value={chapterText} onChange={(e) => setChapterText(e.target.value)} />
      </label>
      {chapterLines.length > 0 && <p className="muted small">{chapterLines.length} chapter(s) will be added.</p>}
    </Modal>
  );
}
