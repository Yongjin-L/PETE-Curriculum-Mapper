# Master data set guide

The master data set is the shared list of topics, textbooks, chapters and SHAPE standards that every user sees. It lives in one Excel file:

**`dataset/PETE_dataset_template.xlsx`**

Edit that file, put it back in this folder, and the site updates itself. There are no CSV files to export.

## Editing the workbook
- Open it in **Excel**, or upload it to **Google Drive** and open it with Google Sheets. In Sheets, download it again with File → Download → Microsoft Excel (.xlsx).
- The **Instructions** tab explains everything. In short:
  - **White columns** are for you to fill in. Hover over a header to see a note about it.
  - **Grey columns** are automatic helpers that show names next to codes (for example the topic name beside `T004`). The site ignores them.
  - **Dropdowns** offer valid IDs in the linking tabs: `topic_chapters`, `topic_standards`, and `textbook_id` on `chapters`.
  - **Red ID cells** mean the ID is used twice.
  - **Yellow rows** are samples to replace.
  - On the **topics** tab, *(chapters linked)* and *(standards linked)* show 0 when a topic still needs links.

| Tab | You fill in | Notes |
|---|---|---|
| textbooks | textbook_id, title, authors, edition, year, publisher, isbn | IDs `TB01`, `TB02`, … |
| chapters | chapter_id, textbook_id, chapter_no, chapter_title | `chapter_id` = book ID + `-C` + number, e.g. `TB01-C05`; a grey column suggests it |
| topics | topic_id, topic_name, description, keywords | IDs `T001`, …; keywords separated by `;` |
| topic_chapters | topic_id, chapter_id, relevance | one row per link; relevance `primary` (default) or `secondary` |
| standards | standard_id, standard_no, component, short_label | `S1`–`S6`; optional components `S1a`, `S1b`, … |
| topic_standards | topic_id, standard_id | one row per link |

## Publishing your changes
**Option A (easiest):** send the file to Claude and ask to check and publish it.

**Option B (GitHub website):**
1. Go to **github.com/Yongjin-L/PETE-Curriculum-Mapper** → open the **dataset** folder.
2. **Add file → Upload files** → drop your `PETE_dataset_template.xlsx`. It must have exactly this name, so that it replaces the old one.
3. Click **Commit changes**.
4. Vercel rebuilds the site in about a minute. **The data is checked first.** If anything is wrong, the rebuild stops and the live site keeps its previous data. Vercel → **Deployments** → the failed deployment → **Build logs** lists each problem with its tab and row, for example:
   ```
   ERROR    topic_chapters row 12: chapter_id "TB02-C14" not found on the chapters tab
   ERROR    topics row 40: topic_id "T031" is used twice (first in row 33)
   ```
   Fix those rows and upload again. **WARNING** lines, such as a topic with no linked chapter, don't stop the rebuild.

**Option C (on a computer with the project):** run `npm run dataset` to check the file and update `public/data/dataset.json`, then commit.

## Rules
- **Never reuse or renumber an ID** once the site is in use, because saved maps refer to topics by ID. To retire a topic, ask Claude to add a `retired` column; don't delete the row.
- **Copyright:** list titles, authors and chapter titles only; don't copy text from the books. Use short paraphrased labels for the SHAPE standards and check the numbering against SHAPE America's official 2017 document.
- Keep row 1 (the headers) and the tab names exactly as they are.

## For maintainers
- `scripts/build-dataset.mjs` checks the workbook (or a folder of CSV files) and writes `public/data/dataset.json`. It runs automatically before every build (`prebuild`). The data set version changes only when the content changes.
- `scripts/make-template-xlsx.py` rebuilds the workbook's formatting (dropdowns, helper formulas, notes) while keeping its data: `npm run dataset:template`.
