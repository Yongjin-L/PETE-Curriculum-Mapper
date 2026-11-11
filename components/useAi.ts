"use client";

import { useCallback, useEffect, useState } from "react";
import type { Level, Plan } from "@/lib/types";
import type { DriveApi } from "./useDrive";

export interface Usage {
  used: number;
  limit: number;
  remaining: number;
}

export interface ParsedPlan {
  university: string;
  program_name: string;
  courses: { number: string; name: string; term: string; components: Suggested }[];
  notes: string;
  usage?: Usage;
}

export type Suggested = { id: string; level: Level }[];

/** AI features: availability, remaining uses, and the two calls. Requires Google sign-in. */
export function useAi(drive: DriveApi) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ parse?: Usage; analyze?: Usage; suggest?: Usage }>({});
  const signedIn = !!drive.user && !["signed-out", "reconnect", "off"].includes(drive.status);

  useEffect(() => {
    let alive = true;
    const token = signedIn ? drive.getToken() : null;
    fetch("/api/ai-status", { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setEnabled(!!j.enabled);
        setReason(j.reason ?? null);
        if (j.usage) setUsage(j.usage);
      })
      .catch(() => alive && (setEnabled(false), setReason("Could not reach the AI service.")));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const call = useCallback(
    async <T,>(url: string, body: BodyInit, feature: "parse" | "analyze" | "suggest", json = false): Promise<T> => {
      const token = drive.getToken();
      if (!token) throw new Error("Please sign in with Google (or reconnect) to use AI features.");
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, ...(json ? { "Content-Type": "application/json" } : {}) },
        body,
      });
      const data = await r.json().catch(() => ({ error: `The AI request failed (${r.status}).` }));
      if (!r.ok) {
        if (r.status === 429) setUsage((u) => ({ ...u, [feature]: { ...(u[feature] ?? { limit: 0 }), used: u[feature]?.limit ?? 0, remaining: 0 } }));
        throw new Error(data.error || `The AI request failed (${r.status}).`);
      }
      if (data.usage) setUsage((u) => ({ ...u, [feature]: data.usage }));
      return data as T;
    },
    [drive]
  );

  const parsePlan = useCallback((file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return call<ParsedPlan>("/api/parse-plan", fd, "parse");
  }, [call]);

  const analyze = useCallback(
    (plan: Plan) => call<{ markdown: string; createdAt: string; usage: Usage }>("/api/analyze-map", JSON.stringify(plan), "analyze", true),
    [call]
  );

  const suggest = useCallback(
    (plan: Plan, courses: { number: string; name: string; note?: string }[]) =>
      call<{ suggestions: Suggested[]; notes: string; usage: Usage }>(
        "/api/suggest-matching",
        JSON.stringify({ program: plan.program, courses }),
        "suggest",
        true
      ),
    [call]
  );

  return { enabled, reason, usage, signedIn, suggest, needsGoogle: !drive.enabled, signIn: () => drive.signIn(), parsePlan, analyze };
}

export type AiApi = ReturnType<typeof useAi>;
