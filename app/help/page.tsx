import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Help · PETE Curriculum Mapper",
  description: "How to map courses, topics and SHAPE America standards with PETE Curriculum Mapper.",
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
        PETE Curriculum Mapper helps physical education teacher education faculty see where key topics are taught across a program, how
        they build from course to course, and how they connect to textbook chapters and the SHAPE America 2017 Initial PETE Standards.
      </p>

      <h2>Getting started</h2>
      <ol>
        <li>
          <b>Enter your university and program</b> at the top of the page.
        </li>
        <li>
          <b>Add your courses</b> in the order students take them: type them one by one, paste a list (two columns from Excel or Google Sheets
          work), or upload your plan of study and let AI read it. You always review AI results before they are added.
        </li>
        <li>
          <b>Place topics on courses.</b> Drag a topic from the panel onto a course, or use its <b>+ Add</b> button (easier on tablets and
          phones). A topic can go on as many courses as you like.
        </li>
        <li>
          <b>Set the level</b> for each placement. Drag a placed topic by its ⋮⋮ handle to move it to another course, or ✕ to remove it.
        </li>
        <li>
          <b>Review coverage</b> on the Coverage tab, and optionally run the AI analysis.
        </li>
        <li>
          <b>Export</b> a PDF or Word report, or a JSON backup.
        </li>
      </ol>

      <h2>What I, R and M mean</h2>
      <ul>
        <li>
          <b>I: Introduced</b>. Students first meet the topic; basic knowledge and awareness.
        </li>
        <li>
          <b>R: Reinforced</b>. Students practice and deepen the topic with more complexity or application.
        </li>
        <li>
          <b>M: Mastered</b>. Students are expected to demonstrate the topic independently, often through a key assessment.
        </li>
      </ul>
      <p>
        When you place a topic, the level is suggested automatically: <b>I</b> if no earlier course has it yet, otherwise <b>R</b>. Change it
        with one click.
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

      <h2>Your own topics and books</h2>
      <p>
        Use <b>+ My topic</b> and <b>+ My book</b> below the topic list to add topics or textbooks that are not in the shared list. They are
        marked <i>custom</i>, stay private to you, and travel with the map file when you share it.
      </p>

      <h2>AI features</h2>
      <ul>
        <li>
          <b>Upload plan of study:</b> PDF, Word (.docx), image or CSV, up to 4 MB. For Excel, copy the cells into <b>Paste a list</b> or save
          as CSV.
        </li>
        <li>
          <b>Analyze my map</b> (Coverage tab): a short review of standards coverage, progression, course balance and gaps, with suggestions. It
          is saved with the map and can be included in a Full export.
        </li>
        <li>Both need Google sign-in and have a daily limit per person. AI can make mistakes; treat results as a starting point.</li>
      </ul>

      <h2>Exports</h2>
      <ul>
        <li>
          <b>Summary:</b> each course with its topics and levels.
        </li>
        <li>
          <b>Standard:</b> adds linked chapters, SHAPE standards and a reference list.
        </li>
        <li>
          <b>Full:</b> adds a standards coverage table, a topics × courses matrix and the AI analysis.
        </li>
      </ul>

      <h2>Questions and feedback</h2>
      <p>
        Found a problem or have a suggestion, such as a topic or textbook that should be in the shared list?{" "}
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
