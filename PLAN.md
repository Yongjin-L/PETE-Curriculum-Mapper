# PETE Curriculum Mapper: Project Plan

**Creator:** Yongjin Lee, Adelphi University ([yongjin.info](https://yongjin.info))
**Purpose:** A free public web tool that helps physical education teacher education (PETE) faculty map key topics, textbook chapters and SHAPE America 2017 Initial PETE Standards onto their program's courses, for internal program review.

---

## 1. Features

| Area | Decision |
|---|---|
| Audience | Public; PETE program faculty at any university |
| Program info | University, program name, ordered list of courses (course number and name only) |
| Course input | Type in manually **or** upload a plan of study (PDF, Word, Excel/CSV, image). The AI extracts the courses, then the user edits and confirms in a review table |
| Topics | Flat list from the master data set, each linked to textbook chapters and SHAPE standards |
| Mapping | Drag a topic onto a course; the same topic can go on any number of courses; each placement has a level **I / R / M** (Introduced, Reinforced, Mastered) |
| Custom content | Users can add their own topics and books, kept private (stored in their own Drive) |
| Evaluation | Optional "Analyze my map" AI report; no automatic warnings |
| Sign-in | Not needed to use the tool. Google sign-in is needed only to save to Drive, export, or use the AI features |
| Collaboration | Share the plan file through Google Drive; a save-conflict check plus a merge dialog stops silent overwrites |
| Export | PDF and Word at three levels (Summary / Standard / Full), plus JSON export and re-import |
| Analytics | Anonymous, cookie-free usage statistics |
| Accessibility | No formal requirement; basic keyboard drag and drop via dnd-kit |

## 2. Architecture

```
Browser (Next.js + React + TypeScript)
 ├─ dnd-kit ................ drag and drop
 ├─ Local autosave ......... IndexedDB/localStorage before sign-in
 ├─ Google Identity Services + Drive API (scope: drive.file) + Google Picker
 ├─ Export ................. docx (Word), pdf generation, JSON
 └─ Calls ──► Vercel serverless functions
               ├─ POST /api/parse-plan   uploaded plan of study → [{number, name}]
               ├─ POST /api/analyze-map  map → analysis report
               │     ├─ verifies Google ID token (signed-in users only)
               │     ├─ per-user daily limit (Upstash Redis via Vercel Marketplace,
               │     │  keyed by a SHA-256 hash of the Google user ID, never the email)
               │     └─ Claude API (key stored only as a Vercel environment variable)
               └─ (no database of user content: plans live in users' Drives)

Master data set ── public/data/dataset.json (built from CSVs by scripts/build-dataset.mjs)
```

**Hosting:** Vercel (free Hobby tier to start; move to Pro if traffic or function limits require it) at **https://curriculum.yongjin.info** (subdomain of the creator's existing domain, DNS at GoDaddy).

## 3. Data model

### Master data set (maintained by the creator)
See `dataset/README.md`. Tables: `textbooks`, `chapters`, `topics`, `topic_chapters`, `standards`, `topic_standards`.

### User plan file (`<Program name>.petemap.json` in the user's Drive)
```json
{
  "schemaVersion": 1,
  "datasetVersion": "2026-11-06",
  "program": { "university": "", "name": "" },
  "courses": [{ "id": "c1", "number": "PED 210", "name": "Foundations of PE", "order": 1 }],
  "placements": [{ "courseId": "c1", "topicId": "T012", "level": "I" }],
  "customTopics": [{ "topic_id": "U-T001", "topic_name": "", "chapters": [], "standards": [] }],
  "customTextbooks": [], "customChapters": [],
  "analysis": { "createdAt": null, "markdown": null },
  "meta": { "lastEditedBy": "", "lastEditedAt": "" }
}
```
- Custom IDs use the `U-` prefix, so they never collide with master IDs.
- Custom items a plan uses are copied into that plan, so a shared plan opens correctly for colleagues.
- The user's full custom library is kept in a separate `My Library.petemap-lib.json` file.
- Master topic IDs are never reused or renumbered; retired topics stay in the data set with a `retired` flag, so old plans still resolve.

## 4. Collaboration (no real-time sync)
1. The owner shares the `.petemap.json` file from Google Drive.
2. A collaborator opens it in the app through the Google Picker (this gives the app access under `drive.file`).
3. On save, the app compares the file's current Drive version with the version it loaded. If they differ, a merge dialog shows the added/removed courses and placements: **keep both / keep mine / keep theirs**.
4. A banner shows "Last edited by … at …" with a Refresh button.

## 5. AI features
| Feature | Input | Output | Default limit |
|---|---|---|---|
| Plan-of-study import | PDF / DOCX / XLSX / CSV / image (≤ 10 MB) | JSON list of courses → editable review table | 5 per user per day |
| Map analysis | Courses, placements, levels, standards | Short report: standards coverage, topics never reinforced, sequencing notes (e.g. M before I), suggestions | 10 per user per day |

- Structured output (a JSON schema) for the import, so the parsing is reliable.
- Uploaded files are processed in memory and **not stored**.
- A global monthly spending cap is set in the Claude Console as a backstop.
- Model choice and cost estimates are settled in Phase 5 with current pricing.

## 6. Export levels
| Level | Contents |
|---|---|
| Summary | Program header; each course with its topics and I/R/M levels |
| Standard | Summary + linked chapters (full citations) + SHAPE standards per topic |
| Full | Standard + topics × courses matrix + standards coverage table + AI analysis (if run) |

Formats: **PDF**, **Word (.docx)**, **JSON** (lossless, re-importable). Users can also switch individual sections on or off. When Google sign-in is configured, exporting requires sign-in (which also saves the map to Drive). Every export carries "Created with PETE Curriculum Mapper by Yongjin Lee (curriculum.yongjin.info)" and the data set version.

## 7. Anonymous usage statistics
- **Tool:** Vercel Web Analytics (cookie-free, no personal data, no consent banner needed) for page views, plus custom events.
- **Events** (counts only, no content, no IDs): `plan_created`, `course_added_manual`, `plan_uploaded_ai`, `topic_placed`, `drive_saved`, `export_pdf`, `export_docx`, `export_json`, `analysis_run`, `custom_topic_added`.
- **Optional:** a voluntary "Add your program to the list of adopters" form, if publications or grants need institution counts.
- Alternatives if more detail is needed later: Plausible or self-hosted Umami.

## 8. Google OAuth verification checklist
- [ ] Google Cloud project "PETE Curriculum Mapper" (owner: Yongjin Lee)
- [ ] OAuth consent screen: app name, logo, support email, authorized domain
- [ ] Scopes: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/drive.file` (non-sensitive: no security assessment)
- [ ] Public pages on the custom domain: Home, **Privacy Policy**, **Terms of Use**
- [ ] Domain ownership verified in Google Search Console
- [ ] Submit for brand verification; publish the app (leave "Testing" mode)

## 9. Build phases
| # | Phase | Deliverable | Status |
|---|---|---|---|
| 1 | Data set | Template, checker/converter, guide | **Done (template); creator fills in data** |
| 2 | Prototype | Course list, topic panel, drag and drop, I/R/M, local autosave, custom topics, coverage view, JSON open/download | **Done** |
| 3 | Google | Sign-in, Drive save/open, Picker, conflict merge | **Done** (credentials: docs/GOOGLE_SETUP.md) |
| 4 | Export | PDF, Word (3 levels), JSON import/export | **Done** |
| 5 | AI | `/api/parse-plan` with review table, `/api/analyze-map`, rate limits | Next |
| 6 | Launch | Domain, privacy/terms pages, OAuth verification, analytics, faculty pilot | |

## 10. Running costs (estimate)
| Item | Cost |
|---|---|
| Vercel hosting | $0 (Hobby) to $20/month (Pro) |
| Custom domain | ~$10–15/year |
| Upstash Redis (rate limits) | $0 free tier |
| Google APIs | $0 |
| Claude API | Usage-based; capped by per-user limits and a monthly spending limit |
