/* Server-only: anonymous usage counters in the same Upstash Redis used for AI limits. */

import { createHash } from "node:crypto";
import { EVENTS, type EventName } from "@/lib/events";
import { AI_CONFIG, redis } from "./guard";

export const statsEnabled = () => !!(AI_CONFIG.redisUrl && AI_CONFIG.redisToken);
const month = () => new Date().toISOString().slice(0, 7);

/** Adds counts, e.g. { topic_placed: 3 }. Unknown names are ignored; each count is capped. */
export async function recordEvents(counts: Partial<Record<string, number>>, institution?: string) {
  if (!statsEnabled()) return;
  const m = month();
  const cmds: (string | number)[][] = [];
  for (const [name, raw] of Object.entries(counts)) {
    if (!(EVENTS as readonly string[]).includes(name)) continue;
    const n = Math.min(Math.max(Math.floor(Number(raw) || 0), 0), 200);
    if (!n) continue;
    cmds.push(["HINCRBY", "stats:total", name, n], ["HINCRBY", `stats:month:${m}`, name, n]);
  }
  // Distinct institutions are counted with a HyperLogLog of a one-way hash: the name itself is never stored.
  const inst = institution?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (inst && inst.length >= 3 && inst.length <= 120) {
    const h = createHash("sha256").update("petemap-inst:" + inst).digest("hex").slice(0, 24);
    cmds.push(["PFADD", "stats:institutions", h], ["PFADD", `stats:institutions:${m}`, h]);
  }
  if (cmds.length) await redis(cmds).catch(() => {});
}

export async function recordServerEvent(name: EventName) {
  await recordEvents({ [name]: 1 });
}

export interface Stats {
  total: Record<string, number>;
  months: { month: string; counts: Record<string, number>; institutions: number }[];
  institutions: number;
}

const toRecord = (flat: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (Array.isArray(flat)) for (let i = 0; i < flat.length; i += 2) out[String(flat[i])] = Number(flat[i + 1]);
  else if (flat && typeof flat === "object") for (const [k, v] of Object.entries(flat)) out[k] = Number(v);
  return out;
};

export async function readStats(monthsBack = 6): Promise<Stats> {
  const months: string[] = [];
  const d = new Date();
  for (let i = 0; i < monthsBack; i++) {
    months.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  }
  const res = await redis([
    ["HGETALL", "stats:total"],
    ["PFCOUNT", "stats:institutions"],
    ...months.flatMap((m) => [["HGETALL", `stats:month:${m}`], ["PFCOUNT", `stats:institutions:${m}`]]),
  ]);
  return {
    total: toRecord(res[0]),
    institutions: Number(res[1] ?? 0),
    months: months.map((m, i) => ({ month: m, counts: toRecord(res[2 + i * 2]), institutions: Number(res[3 + i * 2] ?? 0) })),
  };
}
