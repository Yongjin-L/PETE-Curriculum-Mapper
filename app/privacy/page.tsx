import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy · PETE Curriculum Mapper" };

export default function Privacy() {
  return (
    <main className="doc">
      <p>
        <Link href="/">← PETE Curriculum Mapper</Link>
      </p>
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: November 6, 2026</p>

      <p>
        PETE Curriculum Mapper (&quot;the Service&quot;) is a free tool created and operated by Yongjin Lee (
        <a href="https://yongjin.info">yongjin.info</a>) to help physical education teacher education faculty map the SHAPE America standards to the courses of their programs.
      </p>

      <h2>Information you enter</h2>
      <p>
        Program details, courses and the standards components placed on them are stored in your own web browser
        (local storage). If you sign in with Google, they are also saved as a file in your own Google Drive. The Service does not operate a
        database of your maps and does not keep copies of them on its servers.
      </p>

      <h2>Google account data</h2>
      <p>If you choose to sign in with Google, the Service requests:</p>
      <ul>
        <li>
          <b>Your name, email address and profile picture</b>, only to show which account is signed in and to label your saved maps.
        </li>
        <li>
          <b>Access to files it creates or that you open with it</b> (the <code>drive.file</code> permission). The Service cannot see, read or
          change any other files in your Google Drive.
        </li>
      </ul>
      <p>
        Your Google access token is kept only in your browser&apos;s memory and is discarded when you close the page or sign out. The
        Service does not sell, share or transfer Google user data to anyone, and does not use it for advertising.
      </p>
      <p>
        The Service&apos;s use of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the
        Limited Use requirements.
      </p>

      <h2>AI features</h2>
      <p>
        If you use an optional AI feature (for example, reading an uploaded plan of study), the content you submit is sent to an AI provider
        (Anthropic) to produce the result. Uploaded files are processed and not stored by the Service. A hashed account identifier may be stored
        to enforce daily usage limits.
      </p>

      <h2>Usage statistics</h2>
      <p>
        The Service collects anonymous, aggregate usage statistics to understand how the tool is used and to report its reach (for example, in
        presentations or grant applications). These are (1) page-view statistics from Vercel Web Analytics, which uses no cookies and does not
        identify visitors, and (2) counts of features used (such as &quot;courses added&quot; or &quot;PDF exports&quot;). To estimate how many
        institutions use the tool, the university name you enter is converted into a one-way code that is counted and cannot be turned back
        into the name. No names, email addresses or map content are included in these statistics.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>You can use the Service without signing in.</li>
        <li>
          You can remove the Service&apos;s access at any time from your Google Account at{" "}
          <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>. Your map files stay in your Drive until you
          delete them.
        </li>
        <li>You can clear data stored in your browser by signing out and choosing to remove the map, or by clearing your browser&apos;s site data.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions about this policy: Yongjin Lee, <a href="https://yongjin.info">yongjin.info</a>.
      </p>
    </main>
  );
}
