# Standards data set

The site maps the **SHAPE America (2017) National Standards for Initial Physical Education Teacher Education**: 6 standards and 25 components. They live in one Excel file:

**`dataset/PETE_dataset_template.xlsx`**

| Tab | Columns | Notes |
|---|---|---|
| standards | standard_id, standard_no, title, description | `S1`–`S6` |
| components | component_id, standard_id, label, text | `component_id` like `3.b`; `label` is the short name shown on the map; `text` is the full statement (shown in details and exports, and given to the AI) |

The grey *(standard title)* column on the components tab is an automatic helper, and the site ignores it. A red ID cell means the ID is used twice.

## Editing
You'll rarely need to change this file. The most likely edit is a **label**, the short name shown on the map, if you'd like different wording.

- **Never change a `component_id`** once the site is in use: saved maps refer to components by ID.
- Keep row 1 (the headers) and the tab names exactly as they are.

## Publishing changes
- **Send the file to Claude**, or
- On GitHub: open the **dataset** folder → **Add file → Upload files** → drop the file (same name) → **Commit changes**.

The site checks the file while it rebuilds. If anything is wrong, the rebuild stops, the live site keeps its data, and Vercel → Deployments → Build logs lists each problem by tab and row.

## For maintainers
- `scripts/build-dataset.mjs` checks the workbook and writes `public/data/dataset.json`. It runs automatically before every build (`prebuild`). The data set version changes only when the content changes.
- `scripts/make-template-xlsx.py` rebuilds the workbook's formatting (dropdowns, helper formulas, notes) while keeping its data: `npm run dataset:template`.
- Textbooks, chapters and topics were removed in November 2026 to keep the tool simple; they can be added back as extra tabs later.
