import { timingSafeEqual } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { EVENT_LABELS, EVENTS } from "@/lib/events";
import { readStats, statsEnabled } from "@/lib/server/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Usage statistics · PETE Curriculum Mapper", robots: { index: false, follow: false } };

function keyOk(given: string | undefined) {
  const expected = process.env.STATS_KEY ?? "";
  if (!expected || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  if (!keyOk(key))
    return (
      <main className="doc">
        <h1>Usage statistics</h1>
        <p className="muted">This page is private. Open it with the link that includes your statistics key.</p>
      </main>
    );
  if (!statsEnabled())
    return (
      <main className="doc">
        <h1>Usage statistics</h1>
        <p>Statistics need the Upstash Redis database connected in Vercel (see docs/AI_SETUP.md, step 2).</p>
      </main>
    );

  const s = await readStats(6);
  const fmt = (n?: number) => (n ?? 0).toLocaleString();
  return (
    <main className="doc wide-doc">
      <p>
        <Link href="/">← PETE Curriculum Mapper</Link>
      </p>
      <h1>Usage statistics</h1>
      <p className="muted small">Anonymous counts only: no names, emails or map content. Months are UTC.</p>
      <div className="std-grid stat-tiles">
        <div className="std-card">
          <div className="std-code">Institutions</div>
          <div className="stat-big">{fmt(s.institutions)}</div>
          <div className="small muted">distinct universities entered (approximate)</div>
        </div>
        <div className="std-card">
          <div className="std-code">Maps started</div>
          <div className="stat-big">{fmt(s.total.map_started)}</div>
        </div>
        <div className="std-card">
          <div className="std-code">Exports</div>
          <div className="stat-big">{fmt((s.total.export_pdf ?? 0) + (s.total.export_docx ?? 0))}</div>
          <div className="small muted">PDF + Word</div>
        </div>
        <div className="std-card">
          <div className="std-code">Google sign-ins</div>
          <div className="stat-big">{fmt(s.total.signed_in)}</div>
        </div>
      </div>
      <div className="matrix-wrap">
        <table className="matrix stats-table">
          <thead>
            <tr>
              <th className="sticky-col">Measure</th>
              <th>All time</th>
              {s.months.map((m) => (
                <th key={m.month}>{m.month}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="sticky-col" scope="row">
                Distinct institutions
              </th>
              <td>{fmt(s.institutions)}</td>
              {s.months.map((m) => (
                <td key={m.month}>{fmt(m.institutions)}</td>
              ))}
            </tr>
            {EVENTS.map((e) => (
              <tr key={e}>
                <th className="sticky-col" scope="row">
                  {EVENT_LABELS[e]}
                </th>
                <td>{fmt(s.total[e])}</td>
                {s.months.map((m) => (
                  <td key={m.month}>{fmt(m.counts[e])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">Page views and visitor counts are in Vercel → your project → Analytics.</p>
    </main>
  );
}
