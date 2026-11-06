import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of Use · PETE Curriculum Mapper" };

export default function Terms() {
  return (
    <main className="doc">
      <p>
        <Link href="/">← PETE Curriculum Mapper</Link>
      </p>
      <h1>Terms of Use</h1>
      <p className="muted">Last updated: November 6, 2026</p>

      <h2>The Service</h2>
      <p>
        PETE Curriculum Mapper is a free tool provided by Yongjin Lee for educational and program-review purposes. It is provided &quot;as
        is&quot;, without warranties of any kind, and may change or be discontinued at any time.
      </p>

      <h2>Your content</h2>
      <p>
        You own the maps and custom content you create. You are responsible for keeping copies of important work (for example, in Google Drive or
        by downloading a JSON file). Do not enter information you are not permitted to share.
      </p>

      <h2>Reference data</h2>
      <p>
        Topic lists and textbook references are provided for planning purposes. Textbook titles and chapter titles are cited for reference only
        and remain the property of their publishers. SHAPE America standards are summarized with short labels; consult SHAPE America&apos;s
        official documents for the full standards.
      </p>

      <h2>AI-generated results</h2>
      <p>
        Optional AI features may produce incomplete or inaccurate results. Review and confirm any AI output before relying on it. Daily usage
        limits apply.
      </p>

      <h2>Acceptable use</h2>
      <p>Do not misuse the Service, attempt to disrupt it, or use automated means to overload it or its AI features.</p>

      <h2>Limitation of liability</h2>
      <p>To the extent permitted by law, the creator is not liable for any loss of data or other damages arising from use of the Service.</p>

      <h2>Contact</h2>
      <p>
        Yongjin Lee, <a href="https://yongjin.info">yongjin.info</a>.
      </p>
    </main>
  );
}
