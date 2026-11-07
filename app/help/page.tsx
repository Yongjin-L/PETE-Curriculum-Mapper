import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Help · PETE Curriculum Mapper",
  description: "How to map your PETE program to the SHAPE America 2017 Initial PETE Standards with PETE Curriculum Mapper.",
};

const feedback = process.env.NEXT_PUBLIC_FEEDBACK_URL || "https://yongjin.info";

export default function Help() {
  return (
    <main className="doc">
      <p>
        <Link href="/">← Back to the mapper</Link>
      </p>
      <h1>Help</h1>
      <p>
        PETE Curriculum Mapper shows where each component of the SHAPE America (2017) National Standards for Initial Physical Education
        Teacher Education is addressed across your program&apos;s courses, and how it builds from course to course.
      </p>

      <h2>Getting started</h2>
      <ol>
        <li>
          <b>Upload your plan of study</b> (PDF, Word, image or CSV). AI lists your courses and suggests which SHAPE components each course
          addresses, with an I / R / M level. You need to sign in with Google for this step.
        </li>
        <li>
          <b>Review and confirm.</b> Fix course numbers or names, untick courses to skip, and remove any suggested component with ✕. Nothing is
          added until you confirm.
        </li>
        <li>
          <b>Refine the map.</b> On each course, click I, R or M to change a level, drag a component by its ⋮⋮ handle to another course, or ✕ to
          remove it. Add components from the panel on the right by dragging them onto a course or with <b>+ Add</b>.
        </li>
        <li>
          <b>Check coverage</b> on the Coverage tab, and optionally run the AI analysis.
        </li>
        <li>
          <b>Export</b> a PDF or Word report, or a JSON backup.
        </li>
      </ol>
      <p>
        No plan of study file? Choose <b>Type or paste your courses instead</b>, then use <b>Suggest matching with AI</b> above your course
        list, or place components yourself.
      </p>

      <h2>What I, R and M mean</h2>
      <ul>
        <li>
          <b>I: Introduced</b>. Candidates first learn about the component.
        </li>
        <li>
          <b>R: Reinforced</b>. Candidates practice and deepen it with more complexity or application.
        </li>
        <li>
          <b>M: Mastered</b>. Candidates demonstrate it independently, often in field experiences, student teaching or a key assessment.
        </li>
      </ul>
      <p>
        When you place a component by hand, the level is suggested automatically: <b>I</b> if no earlier course has it yet, otherwise{" "}
        <b>R</b>. Change it with one click.
      </p>

      <h2>The standards</h2>
      <p>
        The six standards and their 25 components appear in the panel on the right, grouped by standard. Click ▾ on a component to read its
        full wording. Source: SHAPE America (2017), <i>National Standards for Initial Physical Education Teacher Education</i>. © SHAPE America.
      </p>

      <h2>Saving your work</h2>
      <ul>
        <li>Without an account, your map is saved in this browser automatically. Clearing browser data removes it.</li>
        <li>
          Sign in with Google to save maps to your own Google Drive (a <b>PETE Curriculum Mapper</b> folder). They save automatically as you
          work. The site can only see files it created or that you open with it.
        </li>
        <li>
          After reloading the page, click <b>Reconnect Drive</b> once to continue saving to Drive.
        </li>
        <li>
          <b>Export → JSON</b> makes a complete backup you can open again with <b>Open JSON</b>.
        </li>
      </ul>

      <h2>Working with colleagues</h2>
      <ol>
        <li>Open the account menu → <b>Share with colleagues…</b> → <b>Open in Google Drive</b>, and share the file with Editor access.</li>
        <li>
          Colleagues sign in here → account menu → <b>My maps in Drive…</b> → <b>Open a map shared with me…</b> and pick the file.
        </li>
        <li>
          Everyone edits the same file. Changes are checked about once a minute. If two people change the map at the same time, you choose what
          to keep. <b>Keep both</b> combines the changes.
        </li>
      </ol>

      <h2>AI features</h2>
      <ul>
        <li>
          <b>Upload plan of study:</b> reads your courses and suggests the initial matching. PDF, Word (.docx), image or CSV, up to 4 MB. For
          Excel, save as CSV or PDF, or paste the courses.
        </li>
        <li>
          <b>Suggest matching:</b> for courses you typed or pasted, suggests components and levels for courses that have none yet. Undo is
          available right after.
        </li>
        <li>
          <b>Analyze my map</b> (Coverage tab): a short review of standards coverage, progression, course balance and gaps, with suggestions.
        </li>
        <li>
          All AI features need Google sign-in and have a daily limit per person. The matching is based mainly on course titles, so treat it as
          a starting point for faculty review.
        </li>
      </ul>

      <h2>Exports</h2>
      <ul>
        <li>
          <b>Summary:</b> each course with its components and levels.
        </li>
        <li>
          <b>Standard:</b> adds the full wording of each component and a standards coverage table.
        </li>
        <li>
          <b>Full:</b> adds a components × courses matrix and the AI analysis.
        </li>
      </ul>

      <h2>Questions and feedback</h2>
      <p>
        Found a problem or have a suggestion?{" "}
        <a href={feedback} target="_blank" rel="noopener noreferrer">
          Send feedback
        </a>
        . Created by <a href="https://yongjin.info">Yongjin Lee</a>.
      </p>
      <p className="small muted">
        <Link href="/privacy">Privacy policy</Link> · <Link href="/terms">Terms of use</Link>
      </p>
    </main>
  );
}
