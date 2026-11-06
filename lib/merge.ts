import type { Plan } from "./types";

/** Plan content without timestamps, for "did anything really change?" checks. */
export function contentKey(plan: Plan): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { meta, ...rest } = plan;
  return JSON.stringify(rest);
}

export function sameContent(a: Plan, b: Plan): boolean {
  return contentKey(a) === contentKey(b);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Three-way merge of two lists of records keyed by id.
 * - Added on either side -> kept.
 * - Deleted on one side and untouched on the other -> deleted.
 * - Edited on both sides -> "mine" wins.
 * Order follows "mine", with records only in "theirs" inserted after their predecessor.
 */
function mergeById<T>(base: T[], mine: T[], theirs: T[], key: (x: T) => string): T[] {
  const b = new Map(base.map((x) => [key(x), x]));
  const m = new Map(mine.map((x) => [key(x), x]));
  const t = new Map(theirs.map((x) => [key(x), x]));

  const pick = (k: string): T | null => {
    const inB = b.get(k), inM = m.get(k), inT = t.get(k);
    if (inM && inT) return same(inM, inB) ? inT : inM; // both have it: prefer whichever side edited it (mine if both)
    if (inM && !inT) return inB && same(inM, inB) ? null : inM; // they deleted it; keep only if I edited/added it
    if (!inM && inT) return inB && same(inT, inB) ? null : inT; // I deleted it; keep only if they edited/added it
    return null;
  };

  const order: string[] = mine.map(key);
  theirs.forEach((x, i) => {
    const k = key(x);
    if (order.includes(k)) return;
    const prev = i > 0 ? key(theirs[i - 1]) : null;
    const at = prev ? order.indexOf(prev) : -1;
    order.splice(at + 1, 0, k);
  });

  return order.map(pick).filter((x): x is T => x !== null);
}

function mergeField<T>(base: T, mine: T, theirs: T): T {
  return same(mine, base) ? theirs : mine;
}

export function mergePlans(base: Plan, mine: Plan, theirs: Plan): Plan {
  const courses = mergeById(base.courses, mine.courses, theirs.courses, (c) => c.id);
  const courseIds = new Set(courses.map((c) => c.id));
  const topicKey = (t: { topic_id: string }) => t.topic_id;
  const customTopics = mergeById(base.customTopics, mine.customTopics, theirs.customTopics, topicKey);
  const customTextbooks = mergeById(base.customTextbooks, mine.customTextbooks, theirs.customTextbooks, (b) => b.textbook_id);
  const customChapters = mergeById(base.customChapters, mine.customChapters, theirs.customChapters, (c) => c.chapter_id);

  const placements = mergeById(base.placements, mine.placements, theirs.placements, (p) => p.courseId + "|" + p.topicId)
    // drop placements whose course was deleted in the merge
    .filter((p) => courseIds.has(p.courseId));

  return {
    ...mine,
    program: {
      university: mergeField(base.program.university, mine.program.university, theirs.program.university),
      name: mergeField(base.program.name, mine.program.name, theirs.program.name),
    },
    courses,
    placements,
    customTopics,
    customTextbooks,
    customChapters,
    analysis: mergeField(base.analysis, mine.analysis, theirs.analysis),
    meta: { ...mine.meta, updatedAt: new Date().toISOString() },
  };
}

/** Human-readable list of what changed from `base` to `next`, e.g. ["2 courses added", "1 level changed"]. */
export function describeChanges(base: Plan, next: Plan): string[] {
  const out: string[] = [];
  const count = (n: number, one: string, verb: string) => n > 0 && out.push(`${n} ${one}${n === 1 ? "" : "s"} ${verb}`);

  const bc = new Map(base.courses.map((c) => [c.id, c]));
  const nc = new Map(next.courses.map((c) => [c.id, c]));
  count([...nc.keys()].filter((k) => !bc.has(k)).length, "course", "added");
  count([...bc.keys()].filter((k) => !nc.has(k)).length, "course", "removed");
  count([...nc.entries()].filter(([k, c]) => bc.has(k) && !same(bc.get(k), c)).length, "course", "edited");

  const pk = (p: { courseId: string; topicId: string }) => p.courseId + "|" + p.topicId;
  const bp = new Map(base.placements.map((p) => [pk(p), p]));
  const np = new Map(next.placements.map((p) => [pk(p), p]));
  count([...np.keys()].filter((k) => !bp.has(k)).length, "topic placement", "added");
  count([...bp.keys()].filter((k) => !np.has(k)).length, "topic placement", "removed");
  count([...np.entries()].filter(([k, p]) => bp.has(k) && bp.get(k)!.level !== p.level).length, "level", "changed");

  if (!same(base.program, next.program)) out.push("program details edited");
  const bt = base.customTopics.length + base.customTextbooks.length;
  const nt = next.customTopics.length + next.customTextbooks.length;
  if (!same(base.customTopics, next.customTopics) || !same(base.customTextbooks, next.customTextbooks))
    out.push(nt === bt ? "custom topics/books edited" : `custom topics/books ${nt > bt ? "added" : "removed"}`);

  return out.length ? out : ["no content changes"];
}
