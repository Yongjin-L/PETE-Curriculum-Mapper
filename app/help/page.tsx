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
        <Link href="/map">← Back to the mapper</Link>
      </p>
      <h1>Help</h1>
      <p>
        PETE Curriculum Mapper shows where each component of the SHAPE America (2017) National Standards for Initial Physical Education
        Teacher Education is addressed across your program&apos;s courses, and how it builds from course to course.
      </p>

      <h2>Getting started</h2>
      <ol>
        <li>
          <b>Drop your plan of study</b> (PDF, Word, image or CSV). AI adds your courses as columns and suggests levels as{" "}
          <b>dotted cells</b>. Sign in with Google for this step.
        </li>
        <li>
          <b>Review the suggestions.</b> Click a dotted cell to accept it, or use <b>Accept all</b> / <b>Discard</b>.
        </li>
        <li>
          <b>Edit the grid.</b> Click a cell to cycle <b>I → R → M → empty</b>. Press and drag across cells to fill several with the
          same level.
        </li>
        <li>
          <b>Check the icons</b> at the end of each component: ✓ builds to M, ! never reaches M, ↯ order problem (for example M before
          I), ○ not addressed. <b>Problems only</b> shows just the rows to check.
        </li>
        <li>
          <b>Export</b> a PDF or Word report, or a JSON backup.
        </li>
      </ol>
      <h3>Courses</h3>
      <ul>
        <li>Click a course name at the top of a column to rename it, set its year or semester, move it left or right, or delete it.</li>
        <li>
          Click <b>+</b> after the last column to add a course. No plan of study file? Type or paste your courses on the start screen, then
          use <b>✨ Suggest</b>.
        </li>
        <li>Courses with a year or semester are grouped under that heading.</li>
      </ul>
      <h3>The six tiles</h3>
      <p>
        Each tile shows one standard: the ring fills as more of its components are addressed, <b>M x/y</b> counts components that reach
        Mastered, and <b>!</b> counts components to check. Click a tile to jump to that standard. <b>Collapse all</b> shows one summary row
        per standard.
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

      <h2>The standards</h2>
      <p>
        The six standards and their 25 components are the rows of the grid, grouped by standard. <b>Click a component&apos;s name</b> to
        see its full wording and where it is taught. To see longer names, <b>drag the edge of the component column</b> to widen it
        (double-click the edge to reset). Source: SHAPE America (2017), <i>National Standards for Initial Physical Education Teacher Education</i>. © SHAPE America.
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
          <b>✨ Suggest:</b> for courses you typed or pasted, adds dotted suggestions for courses that have none yet.
        </li>
        <li>
          <b>✨ AI review:</b> a short review of standards coverage, progression, course balance and gaps, with suggestions.
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
