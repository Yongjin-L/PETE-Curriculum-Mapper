/* Read-only share links: the map is packed into the URL fragment (#…), which browsers never send to the server.
 * Format: "z." + base64url(deflate-raw(JSON)) or, where CompressionStream is unavailable, "u." + base64url(JSON). */

import { getLibrary } from "./dataset";
import { emptyPlan, normalizePlan } from "./plan";
import type { Level, Plan } from "./types";

interface Packed {
  v: 1;
  u: string; // university
  n: string; // program name
  c: { n: string; t: string; s?: string; o?: string; l: string }[]; // number, title, term, note, levels (one char per component)
}

const LEVELS = new Set(["I", "R", "M"]);

function pack(plan: Plan): Packed {
  const ids = getLibrary().components.map((c) => c.component_id);
  const cell = new Map(plan.placements.map((p) => [p.topicId + "|" + p.courseId, p.level]));
  return {
    v: 1,
    u: plan.program.university,
    n: plan.program.name,
    c: plan.courses.map((c) => ({
      n: c.number,
      t: c.name,
      ...(c.term ? { s: c.term } : {}),
      ...(c.note ? { o: c.note } : {}),
      l: ids.map((id) => cell.get(id + "|" + c.id) ?? ".").join("").replace(/\.+$/, ""),
    })),
  };
}

function unpack(p: Packed): Plan {
  if (!p || p.v !== 1 || !Array.isArray(p.c)) throw new Error("This share link is not valid.");
  const ids = getLibrary().components.map((c) => c.component_id);
  const base = emptyPlan();
  const courses = p.c.slice(0, 200).map((c, i) => ({
    id: `s${i + 1}`,
    number: String(c.n ?? ""),
    name: String(c.t ?? ""),
    ...(c.s ? { term: String(c.s) } : {}),
    ...(c.o ? { note: String(c.o) } : {}),
  }));
  const placements = p.c.slice(0, 200).flatMap((c, i) =>
    [...String(c.l ?? "")].slice(0, ids.length).flatMap((ch, j) => (LEVELS.has(ch) ? [{ courseId: `s${i + 1}`, topicId: ids[j], level: ch as Level }] : []))
  );
  return normalizePlan({ ...base, program: { university: String(p.u ?? ""), name: String(p.n ?? "") }, courses, placements });
}

const toB64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64 = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (ch) => ch.charCodeAt(0));
};

async function streamBytes(input: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([input as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Builds the full share URL for a plan. */
export async function makeShareUrl(plan: Plan, origin = window.location.origin): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(pack(plan)));
  let code: string;
  if (typeof CompressionStream !== "undefined") code = "z." + toB64(await streamBytes(json, new CompressionStream("deflate-raw")));
  else code = "u." + toB64(json);
  return `${origin}/view#${code}`;
}

/** Reads a plan from a share fragment ("#z.…" or "#u.…"). Throws a friendly error if it can't. */
export async function readShareFragment(hash: string): Promise<Plan> {
  const code = hash.replace(/^#/, "");
  try {
    if (code.startsWith("z.")) {
      const bytes = await streamBytes(fromB64(code.slice(2)), new DecompressionStream("deflate-raw"));
      return unpack(JSON.parse(new TextDecoder().decode(bytes)));
    }
    if (code.startsWith("u.")) return unpack(JSON.parse(new TextDecoder().decode(fromB64(code.slice(2)))));
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("This share link")) throw e;
  }
  throw new Error("This share link is incomplete or damaged. Ask the sender to copy it again.");
}
