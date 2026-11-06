# Master data set guide

The master data set is the shared list of topics, textbooks, chapters and SHAPE standards that every user sees. It is maintained by the creator. (Users' own custom topics are stored separately in their Drive.)

## Files
| File | Purpose |
|---|---|
| `PETE_dataset_template.xlsx` | Workbook to fill in: one tab per table, plus instructions. Upload it to Google Sheets or open it in Excel |
| `csv/*.csv` | The source of truth the website is built from (one CSV per tab) |
| `../public/data/dataset.json` | Generated file the website loads. Don't edit it by hand |

## Tables
| Table | Columns (required in **bold**) | Notes |
|---|---|---|
| textbooks | **textbook_id**, **title**, **authors**, edition, year, publisher, isbn | ID format `TB01` |
| chapters | **chapter_id**, **textbook_id**, **chapter_no**, **chapter_title** | ID format `TB01-C05` |
| topics | **topic_id**, **topic_name**, description, keywords | ID format `T001`; keywords separated by `;` |
| topic_chapters | **topic_id**, **chapter_id**, relevance | relevance = `primary` (default) or `secondary` |
| standards | **standard_id**, **standard_no**, **short_label**, component | `S1`–`S6`; optional components as `S1a`, `S1b`… |
| topic_standards | **topic_id**, **standard_id** | One row per link |

A topic can link to any number of chapters and standards (one row per link).

## Workflow
1. Fill in the workbook. Replace or delete every `SAMPLE` row.
2. Download each tab as CSV with the exact tab name (e.g. `topics.csv`) into `dataset/csv/`.
3. Run the checker:
   ```bash
   node scripts/build-dataset.mjs
   ```
   - **ERROR**: must be fixed (duplicate ID, broken link, wrong ID format, empty required field). No JSON is written.
   - **WARNING**: worth checking (a topic with no chapters or no standard, a duplicate topic name, a textbook with no chapters).
4. When it reports `0 error(s)`, `public/data/dataset.json` is updated and ready to publish.

To rebuild the blank workbook from the CSVs: `python3 scripts/make-template-xlsx.py`

## Rules
- **Never reuse or renumber an ID** once the site is live; saved plans refer to topics by ID. To remove a topic, ask for a `retired` column to be added rather than deleting the row.
- **Copyright:** include citations and chapter titles only, never text from the books. Use short paraphrased labels for the SHAPE standards and verify the numbering against SHAPE America's official 2017 document.
- The sample `standards.csv` lists the six standard areas only. Add component rows (`S1a`…) if you want topics mapped at component level.
