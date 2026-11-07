/* Server-only: Google sign-in verification and per-user daily limits for the AI routes. */

import { createHash } from "node:crypto";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---- Configuration (Vercel environment variables)

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

export const AI_CONFIG = {
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  model: process.env.AI_MODEL || "claude-opus-5-5",
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  redisUrl: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "",
  redisToken: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "",
  limits: {
    parse: num(process.env.AI_DAILY_UPLOADS, 5),
    analyze: num(process.env.AI_DAILY_ANALYSES, 10),
    suggest: num(process.env.AI_DAILY_SUGGESTIONS, 5),
    global: num(process.env.AI_GLOBAL_DAILY_LIMIT, 100),
  },
};

export type Feature = "parse" | "analyze" | "suggest";

const FEATURE_NAMES: Record<Feature, string> = { parse: "plan-of-study uploads", analyze: "AI analyses", suggest: "AI matching suggestions" };

/** Why AI is unavailable, or null when it is ready. */
export function aiUnavailableReason(): string | null {
  if (process.env.AI_DISABLED === "true") return "AI features are turned off.";
  if (!AI_CONFIG.apiKey) return "AI features are not set up yet (no API key).";
  if (!AI_CONFIG.clientId) return "AI features need Google sign-in, which is not set up yet.";
  if (!AI_CONFIG.redisUrl || !AI_CONFIG.redisToken) {
    if (process.env.NODE_ENV === "production") return "AI features are not set up yet (no usage-limit store).";
  }
  return null;
}

// ---- Google access token verification

interface GoogleIdentity {
  sub: string;
  email?: string;
}

const tokenCache = new Map<string, { id: GoogleIdentity; until: number }>();

export async function verifyGoogle(req: Request): Promise<GoogleIdentity> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) throw new HttpError(401, "Please sign in with Google to use AI features.");

  const cached = tokenCache.get(token);
  if (cached && cached.until > Date.now()) return cached.id;

  // GOOGLE_TOKENINFO_URL exists only so automated tests can point at a fake; leave it unset in Vercel.
  const tokeninfo = process.env.GOOGLE_TOKENINFO_URL || "https://oauth2.googleapis.com/tokeninfo";
  const r = await fetch(`${tokeninfo}?access_token=${encodeURIComponent(token)}`);
  if (!r.ok) throw new HttpError(401, "Your Google sign-in has expired. Please reconnect and try again.");
  const info = (await r.json()) as { aud?: string; azp?: string; sub?: string; email?: string; expires_in?: string };
  if (!info.sub || (info.aud !== AI_CONFIG.clientId && info.azp !== AI_CONFIG.clientId))
    throw new HttpError(401, "This sign-in does not belong to PETE Curriculum Mapper.");

  const id = { sub: info.sub, email: info.email };
  const ttl = Math.min(Number(info.expires_in ?? 300), 300) * 1000;
  tokenCache.set(token, { id, until: Date.now() + ttl });
  if (tokenCache.size > 500) tokenCache.delete(tokenCache.keys().next().value!);
  return id;
}

// ---- Daily limits (Upstash Redis REST; in-memory fallback only for local development)

const memory = new Map<string, number>();

export async function redis(commands: (string | number)[][]): Promise<unknown[]> {
  const r = await fetch(`${AI_CONFIG.redisUrl}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${AI_CONFIG.redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!r.ok) throw new HttpError(503, "Usage limits are temporarily unavailable. Please try again later.");
  const out = (await r.json()) as { result?: unknown; error?: string }[];
  return out.map((x) => x.result);
}

async function incr(keys: string[]): Promise<number[]> {
  if (!AI_CONFIG.redisUrl) return keys.map((k) => memory.set(k, (memory.get(k) ?? 0) + 1).get(k)!);
  const res = await redis(keys.flatMap((k) => [["INCR", k], ["EXPIRE", k, 60 * 60 * 26]]));
  return keys.map((_, i) => Number(res[i * 2]));
}

async function decr(keys: string[]) {
  if (!AI_CONFIG.redisUrl) return keys.forEach((k) => memory.set(k, Math.max(0, (memory.get(k) ?? 1) - 1)));
  await redis(keys.map((k) => ["DECR", k])).catch(() => {});
}

async function get(keys: string[]): Promise<number[]> {
  if (!AI_CONFIG.redisUrl) return keys.map((k) => memory.get(k) ?? 0);
  const res = await redis(keys.map((k) => ["GET", k]));
  return res.map((v) => Number(v ?? 0));
}

const day = () => new Date().toISOString().slice(0, 10); // UTC day
const userHash = (sub: string) => createHash("sha256").update("petemap:" + sub).digest("hex").slice(0, 32);
const keysFor = (feature: Feature, sub: string) => [`ai:${feature}:${userHash(sub)}:${day()}`, `ai:global:${day()}`];

export interface Usage {
  used: number;
  limit: number;
  remaining: number;
}

/** Counts one use; throws 429 when over the limit. Returns a release() to refund the use if the AI call fails. */
export async function consume(feature: Feature, sub: string): Promise<{ usage: Usage; release: () => Promise<void> }> {
  const keys = keysFor(feature, sub);
  const [mine, global] = await incr(keys);
  const limit = AI_CONFIG.limits[feature];
  if (mine > limit || global > AI_CONFIG.limits.global) {
    await decr(keys);
    throw new HttpError(
      429,
      mine > limit
        ? `You've reached today's limit of ${limit} ${FEATURE_NAMES[feature]}. The limit resets at midnight UTC.`
        : "The site has reached its AI usage limit for today. Please try again tomorrow."
    );
  }
  return { usage: { used: mine, limit, remaining: Math.max(0, limit - mine) }, release: () => decr(keys) };
}

export async function usageFor(sub: string): Promise<Record<Feature, Usage>> {
  const features: Feature[] = ["parse", "analyze", "suggest"];
  const used = await get(features.map((f) => keysFor(f, sub)[0]));
  const u = (n: number, limit: number) => ({ used: n, limit, remaining: Math.max(0, limit - n) });
  return Object.fromEntries(features.map((f, i) => [f, u(used[i], AI_CONFIG.limits[f])])) as Record<Feature, Usage>;
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: "Something went wrong with the AI request. Please try again." }, { status: 500 });
}
