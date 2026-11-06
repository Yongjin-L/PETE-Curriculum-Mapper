/* Browser-side anonymous usage counting. Counts are batched and sent at most every 30 seconds
 * (and when the page is hidden). Nothing personal and no map content is sent. */

import type { EventName } from "./events";

const pending: Partial<Record<EventName, number>> = {};
let institution: string | undefined;
let sentInstitution: string | undefined;
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  const counts = { ...pending };
  for (const k of Object.keys(pending)) delete pending[k as EventName];
  const inst = institution && institution !== sentInstitution ? institution : undefined;
  if (!Object.keys(counts).length && !inst) return;
  if (inst) sentInstitution = inst;
  const body = JSON.stringify({ counts, institution: inst });
  try {
    if (navigator.sendBeacon?.("/api/event", new Blob([body], { type: "application/json" }))) return;
  } catch {
    /* fall through */
  }
  fetch("/api/event", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
}

export function track(name: EventName, n = 1) {
  if (typeof window === "undefined" || n <= 0) return;
  pending[name] = (pending[name] ?? 0) + n;
  if (!timer) timer = setTimeout(flush, 30_000);
}

/** Lets the site count distinct institutions (the server keeps only a one-way hash). */
export function trackInstitution(name: string) {
  const v = name.trim();
  if (v.length >= 3) institution = v;
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  window.addEventListener("pagehide", flush);
}
