import Link from "next/link";
import { ContinueLink } from "@/components/ContinueLink";
import { Logo } from "@/components/Logo";
import { getLibrary } from "@/lib/dataset";
import type { Level } from "@/lib/types";

const DEMO_COURSES = ["PED 101", "PED 210", "PED 320", "PED 490"];
const DEMO_ROWS: { code: string; label: string; cells: (Level | "")[] }[] = [
  { code: "1.e", label: "Motor development", cells: ["", "I", "R", ""] },
  { code: "3.b", label: "Progressive, sequential content", cells: ["", "", "R", "M"] },
  { code: "4.d", label: "Routines & behavior management", cells: ["", "", "R", "M"] },
  { code: "5.b", label: "Formative & summative assessment", cells: ["", "", "I", "M"] },
  { code: "6.a", label: "Professional ethics & cultural competence", cells: ["I", "", "R", "M"] },
];

export default function Home() {
  const lib = getLibrary();
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link href="/" className="landing-brand" aria-label="PETE Curriculum Mapper home">
          <Logo size={38} />
        </Link>
        <nav>
          <a href="#how">How it works</a>
          <Link href="/help">Help</Link>
          <Link href="/map" className="btn btn-primary">
            Open the mapper
          </Link>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-text">
            <p className="eyebrow">For physical education teacher education faculty</p>
            <h1>Map your PETE program to the SHAPE America standards</h1>
            <p className="lead">
              Upload your plan of study. AI suggests which of the 25 components of the SHAPE America 2017 Initial PETE Standards each course
              addresses: <b className="t-I">Introduced</b>, <b className="t-R">Reinforced</b> or <b className="t-M">Mastered</b>. Review it,
              refine it, and share a clear curriculum map with your faculty.
            </p>
            <div className="hero-cta">
              <ContinueLink className="btn btn-primary btn-lg" />
              <a href="#how" className="btn btn-lg">
                See how it works
              </a>
            </div>
            <p className="small muted">Free · Try it without an account · Your maps stay in your own browser or Google Drive</p>
          </div>

          <figure className="demo" aria-label="Example curriculum map">
            <div className="demo-head">
              <span>SHAPE component</span>
              {DEMO_COURSES.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            {DEMO_ROWS.map((r) => (
              <div className="demo-row" key={r.code}>
                <span className="demo-label">
                  <b>{r.code}</b> {r.label}
                </span>
                {r.cells.map((lv, i) => (
                  <span key={i} className="demo-cell">
                    {lv && <span className={`dot level-${lv}`}>{lv}</span>}
                  </span>
                ))}
              </div>
            ))}
            <figcaption className="small muted">Example: how each component builds from course to course.</figcaption>
          </figure>
        </section>

        <section id="how" className="landing-section">
          <h2>How it works</h2>
          <ol className="how">
            <li>
              <span className="how-num">1</span>
              <h3>Upload your plan of study</h3>
              <p>PDF, Word, image or CSV. AI lists your courses and suggests the SHAPE components and I / R / M level for each.</p>
            </li>
            <li>
              <span className="how-num">2</span>
              <h3>Review the suggestions</h3>
              <p>Fix course names, skip courses, and remove suggestions before anything is added. You stay in control.</p>
            </li>
            <li>
              <span className="how-num">3</span>
              <h3>Refine and share</h3>
              <p>Drag components between courses, change levels, check coverage, and export a PDF or Word report for your faculty.</p>
            </li>
          </ol>
        </section>

        <section className="landing-section">
          <h2>What you get</h2>
          <div className="features">
            <div>
              <h3>Coverage at a glance</h3>
              <p>See which standards and components each course addresses, and spot gaps before your next program review.</p>
            </div>
            <div>
              <h3>Progression from I to M</h3>
              <p>Check that each component is introduced, reinforced and mastered in a sensible order across the program.</p>
            </div>
            <div>
              <h3>Reports for your faculty</h3>
              <p>Export summary or detailed reports with a components × courses matrix, as PDF or Word.</p>
            </div>
            <div>
              <h3>Work together</h3>
              <p>Save maps to your Google Drive and share them with colleagues. Changes from several people are merged safely.</p>
            </div>
            <div>
              <h3>AI review</h3>
              <p>Get a short, constructive analysis of coverage, progression and course balance, with concrete suggestions.</p>
            </div>
            <div>
              <h3>Private by design</h3>
              <p>No database of your maps: they stay in your browser or your own Drive. Uploaded files are read once and not stored.</p>
            </div>
          </div>
        </section>

        <section className="landing-section standards-section">
          <h2>Built on the SHAPE America 2017 Initial PETE Standards</h2>
          <p className="muted">Six standards and 25 components, mapped course by course.</p>
          <ol className="std-list">
            {lib.standards.map((s) => (
              <li key={s.standard_id}>
                <span className="std-num">{s.standard_no}</span>
                <span>
                  <b>{s.title}</b>
                  <span className="small muted"> · {(lib.componentsByStandard.get(s.standard_id) ?? []).length} components</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="small muted">
            Source: SHAPE America (2017). National Standards for Initial Physical Education Teacher Education. © SHAPE America.
          </p>
        </section>

        <section className="landing-cta">
          <h2>Ready to map your program?</h2>
          <ContinueLink className="btn btn-primary btn-lg" />
        </section>
      </main>

      <footer className="footer small muted">
        PETE Curriculum Mapper · Created by{" "}
        <a href="https://yongjin.info" target="_blank" rel="noopener noreferrer">
          Yongjin Lee
        </a>{" "}
        · <Link href="/help">Help</Link> · <a href={process.env.NEXT_PUBLIC_FEEDBACK_URL || "https://yongjin.info"}>Feedback</a> ·{" "}
        <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
      </footer>
    </div>
  );
}
