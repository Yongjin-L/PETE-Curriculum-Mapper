"""(Re)builds dataset/PETE_dataset_template.xlsx with dropdowns, helper columns and notes.

Data is taken from the existing workbook (so your edits are kept), or from CSV files with --from-csv DIR.
Only the real data columns are read; grey helper columns are recreated.

Usage:
  python3 scripts/make-template-xlsx.py                # restyle the existing workbook, keeping its data
  python3 scripts/make-template-xlsx.py --from-csv dataset/csv
"""
import csv
import sys
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.comments import Comment
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dataset" / "PETE_dataset_template.xlsx"
MAX_ROW = 3000

# Data columns per sheet: (name, width, note, kind)  kind: text | number | long
SHEETS = {
    "textbooks": [
        ("textbook_id", 13, "Unique ID: TB01, TB02, ... Never change an ID once the site is live.", "text"),
        ("title", 50, "Book title.", "text"),
        ("authors", 34, "Last, F.; Last, F.", "text"),
        ("edition", 9, "Edition number, e.g. 3 (leave blank for 1st).", "number"),
        ("year", 8, "Publication year.", "number"),
        ("publisher", 22, "Publisher.", "text"),
        ("isbn", 18, "Optional.", "text"),
    ],
    "chapters": [
        ("chapter_id", 14, "Unique ID: the textbook ID + -C + chapter number, e.g. TB01-C05. The grey column suggests it.", "text"),
        ("textbook_id", 13, "Pick the book from the dropdown.", "text"),
        ("chapter_no", 11, "Chapter number.", "number"),
        ("chapter_title", 50, "Chapter title as printed.", "text"),
    ],
    "topics": [
        ("topic_id", 10, "Unique ID: T001, T002, ... Never reuse or renumber an ID once the site is live.", "text"),
        ("topic_name", 38, "Short name users drag onto courses.", "text"),
        ("description", 60, "One sentence describing the topic (optional).", "long"),
        ("keywords", 32, "Search words separated by semicolons (optional).", "text"),
    ],
    "topic_chapters": [
        ("topic_id", 10, "Pick the topic.", "text"),
        ("chapter_id", 14, "Pick the chapter.", "text"),
        ("relevance", 12, "primary (main coverage) or secondary. Blank = primary.", "text"),
    ],
    "standards": [
        ("standard_id", 13, "S1-S6 for the six standards; components as S1a, S1b, ...", "text"),
        ("standard_no", 12, "1-6.", "text"),
        ("component", 11, "Component letter (a, b, c...) or blank for the standard itself.", "text"),
        ("short_label", 50, "Short paraphrased label (not the official wording).", "text"),
    ],
    "topic_standards": [
        ("topic_id", 10, "Pick the topic.", "text"),
        ("standard_id", 13, "Pick the standard.", "text"),
    ],
}

# Grey helper columns (formulas; ignored by the site): (header, width, formula template with {r})
HELPERS = {
    "chapters": [
        ("(book title)", 40, '=IF(B{r}="","",IFERROR(VLOOKUP(B{r},textbooks!$A:$B,2,FALSE),"? unknown book"))'),
        ("(suggested chapter_id)", 20, '=IF(OR(B{r}="",C{r}=""),"",B{r}&"-C"&TEXT(C{r},"00"))'),
    ],
    "topics": [
        ("(chapters linked)", 19, '=IF(A{r}="","",COUNTIF(topic_chapters!$A:$A,A{r}))'),
        ("(standards linked)", 20, '=IF(A{r}="","",COUNTIF(topic_standards!$A:$A,A{r}))'),
    ],
    "topic_chapters": [
        ("(topic name)", 36, '=IF(A{r}="","",IFERROR(VLOOKUP(A{r},topics!$A:$B,2,FALSE),"? unknown topic"))'),
        ("(chapter)", 50, '=IF(B{r}="","",IFERROR(VLOOKUP(VLOOKUP(B{r},chapters!$A:$B,2,FALSE),textbooks!$A:$B,2,FALSE)&", Ch. "&VLOOKUP(B{r},chapters!$A:$C,3,FALSE)&": "&VLOOKUP(B{r},chapters!$A:$D,4,FALSE),"? unknown chapter"))'),
    ],
    "topic_standards": [
        ("(topic name)", 36, '=IF(A{r}="","",IFERROR(VLOOKUP(A{r},topics!$A:$B,2,FALSE),"? unknown topic"))'),
        ("(standard)", 46, '=IF(B{r}="","",IFERROR(VLOOKUP(B{r},standards!$A:$D,4,FALSE),"? unknown standard"))'),
    ],
}

# Dropdowns: sheet -> {column letter: source}
LISTS = {
    "chapters": {"B": "=textbooks!$A$2:$A$%d" % MAX_ROW},
    "topic_chapters": {"A": "=topics!$A$2:$A$%d" % MAX_ROW, "B": "=chapters!$A$2:$A$%d" % MAX_ROW, "C": '"primary,secondary"'},
    "topic_standards": {"A": "=topics!$A$2:$A$%d" % MAX_ROW, "B": "=standards!$A$2:$A$%d" % MAX_ROW},
}
UNIQUE_ID = {"textbooks": "A", "chapters": "A", "topics": "A", "standards": "A"}
TAB_COLORS = {"textbooks": "4F81BD", "chapters": "4F81BD", "topics": "2E7D4F", "topic_chapters": "B45309", "standards": "7030A0", "topic_standards": "B45309"}

INSTRUCTIONS = [
    ("PETE Curriculum Mapper: master data set", "title"),
    ("This workbook is the shared list of topics, textbooks and SHAPE standards that every user of the site sees.", ""),
    ("", ""),
    ("How to edit", "h"),
    ("1. Work through the tabs left to right: textbooks → chapters → topics → topic_chapters → standards → topic_standards.", ""),
    ("2. Type only in the white columns. Grey columns starting with ( ) are automatic helpers so you can read the codes; the site ignores them.", ""),
    ("3. In the linking tabs (topic_chapters, topic_standards) and the textbook_id column of chapters, pick IDs from the dropdowns.", ""),
    ("4. Rows highlighted in yellow are SAMPLES. Replace or delete them.", ""),
    ("5. A red ID cell means that ID is used twice in the same tab. Every ID must be unique.", ""),
    ("6. Keep the header row (row 1) exactly as it is. Don't rename or reorder tabs. You may add rows anywhere.", ""),
    ("", ""),
    ("IDs", "h"),
    ("textbook_id   TB01, TB02, ...", "mono"),
    ("chapter_id    <textbook_id>-C<chapter number>, e.g. TB01-C05 (the grey column in chapters suggests it)", "mono"),
    ("topic_id      T001, T002, ...", "mono"),
    ("standard_id   S1–S6, components S1a, S1b, ...", "mono"),
    ("Once the site is live, never reuse or renumber an ID: saved maps refer to topics by ID. To retire a topic, ask Claude to add a 'retired' column.", ""),
    ("", ""),
    ("Linking", "h"),
    ("A topic can link to many chapters (one row per link in topic_chapters) and many standards (one row per link in topic_standards).", ""),
    ("The topics tab shows how many chapters and standards each topic is linked to. 0 means the topic still needs links.", ""),
    ("", ""),
    ("Copyright", "h"),
    ("List textbook titles, authors and chapter titles only; don't copy text from the books.", ""),
    ("Use short paraphrased labels for SHAPE standards and check the numbering against SHAPE America's official 2017 document.", ""),
    ("", ""),
    ("Publishing your changes", "h"),
    ("Option A (easiest): send this file to Claude in a conversation and ask to check and publish it.", ""),
    ("Option B: on github.com/Yongjin-L/PETE-Curriculum-Mapper, open the dataset folder → Add file → Upload files → drop this file", ""),
    ("   (same name: PETE_dataset_template.xlsx) → Commit changes. The site rebuilds in about a minute.", ""),
    ("   The site checks the data while it rebuilds. If something is wrong, the rebuild stops, the live site stays as it was,", ""),
    ("   and Vercel → Deployments shows the error list (for example: topic_chapters row 12: chapter_id TB02-C14 not found).", ""),
    ("Editing in Google Sheets works too: open the file from Drive, edit, then File → Download → Microsoft Excel (.xlsx).", ""),
]

HEADER_FILL = PatternFill("solid", fgColor="1F4E79")
HELPER_HEAD_FILL = PatternFill("solid", fgColor="A6A6A6")
HELPER_FILL = PatternFill("solid", fgColor="EDEDED")
SAMPLE_FILL = PatternFill("solid", fgColor="FFF2CC")
DUP_FILL = PatternFill("solid", fgColor="F8CBAD")


def read_existing() -> dict:
    """Data rows from the current workbook (data columns only, by header name)."""
    wb = load_workbook(OUT, data_only=True)
    out = {}
    for name, cols in SHEETS.items():
        ws = wb[name]
        headers = [c.value for c in ws[1]]
        idx = {h: i for i, h in enumerate(headers) if h}
        rows = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            rec = [row[idx[c[0]]] if c[0] in idx and idx[c[0]] < len(row) else None for c in cols]
            if any(v not in (None, "") for v in rec):
                rows.append(rec)
        out[name] = rows
    return out


def read_csv(folder: Path) -> dict:
    out = {}
    for name, cols in SHEETS.items():
        with open(folder / f"{name}.csv", newline="", encoding="utf-8") as f:
            recs = list(csv.DictReader(f))
        out[name] = [[r.get(c[0], "") for c in cols] for r in recs]
    return out


def coerce(value, kind):
    if value in (None, ""):
        return None
    if kind == "number":
        try:
            f = float(value)
            return int(f) if f.is_integer() else f
        except (TypeError, ValueError):
            return value
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value).strip()


def build(data: dict) -> Workbook:
    wb = Workbook()
    ws = wb.active
    ws.title = "Instructions"
    ws.sheet_properties.tabColor = "1F4E79"
    for i, (text, style) in enumerate(INSTRUCTIONS, start=1):
        c = ws.cell(row=i, column=1, value=text)
        if style == "title":
            c.font = Font(bold=True, size=16, color="1F4E79")
        elif style == "h":
            c.font = Font(bold=True, size=12, color="1F4E79")
        elif style == "mono":
            c.font = Font(name="Consolas", size=10)
    ws.column_dimensions["A"].width = 130

    for name, cols in SHEETS.items():
        sh = wb.create_sheet(name)
        sh.sheet_properties.tabColor = TAB_COLORS[name]
        helpers = HELPERS.get(name, [])
        # headers
        for j, (col, width, note, kind) in enumerate(cols, start=1):
            c = sh.cell(row=1, column=j, value=col)
            c.fill, c.font = HEADER_FILL, Font(bold=True, color="FFFFFF")
            c.comment = Comment(note, "PETE Curriculum Mapper", width=260, height=90)
            sh.column_dimensions[c.column_letter].width = width
        for k, (head, width, _) in enumerate(helpers):
            c = sh.cell(row=1, column=len(cols) + 1 + k, value=head)
            c.fill, c.font = HELPER_HEAD_FILL, Font(bold=True, italic=True, color="FFFFFF")
            c.comment = Comment("Automatic helper. Don't type here; the site ignores this column.", "PETE Curriculum Mapper", width=240, height=60)
            sh.column_dimensions[c.column_letter].width = width
        # data
        rows = data.get(name, [])
        for r, rec in enumerate(rows, start=2):
            sample = any(isinstance(v, str) and "SAMPLE" in v for v in rec)
            for j, (col, _, _, kind) in enumerate(cols, start=1):
                c = sh.cell(row=r, column=j, value=coerce(rec[j - 1], kind))
                if kind == "long":
                    c.alignment = Alignment(wrap_text=True, vertical="top")
                if sample:
                    c.fill = SAMPLE_FILL
        # helper formulas for the existing rows plus room to grow
        last = max(len(rows) + 1, 2) + 300
        for r in range(2, last + 1):
            for k, (_, _, formula) in enumerate(helpers):
                c = sh.cell(row=r, column=len(cols) + 1 + k, value=formula.format(r=r))
                c.fill, c.font = HELPER_FILL, Font(color="595959", italic=True)
        # text format for ID-like columns so Excel never turns "1" into a number or drops zeros
        for j, (col, _, _, kind) in enumerate(cols, start=1):
            if kind != "number":
                for r in range(2, MAX_ROW + 1):
                    sh.cell(row=r, column=j).number_format = "@"
        # dropdowns
        for letter, source in LISTS.get(name, {}).items():
            dv = DataValidation(type="list", formula1=source, allow_blank=True, showDropDown=False)
            dv.error = "Pick a value from the list. Add new IDs on their own tab first."
            dv.errorTitle = "Not in the list"
            dv.errorStyle = "warning"
            dv.showErrorMessage = True
            sh.add_data_validation(dv)
            dv.add(f"{letter}2:{letter}{MAX_ROW}")
        # duplicate IDs turn red
        if name in UNIQUE_ID:
            L = UNIQUE_ID[name]
            sh.conditional_formatting.add(
                f"{L}2:{L}{MAX_ROW}", FormulaRule(formula=[f'AND({L}2<>"",COUNTIF(${L}$2:${L}${MAX_ROW},{L}2)>1)'], fill=DUP_FILL)
            )
        sh.freeze_panes = "B2" if name in ("topics", "chapters", "textbooks") else "A2"
        sh.auto_filter.ref = f"A1:{sh.cell(row=1, column=len(cols) + len(helpers)).column_letter}{max(len(rows) + 1, 2)}"
    return wb


def main():
    if len(sys.argv) >= 3 and sys.argv[1] == "--from-csv":
        data = read_csv(Path(sys.argv[2]))
    elif OUT.exists():
        data = read_existing()
    else:
        sys.exit("No workbook found; use --from-csv DIR")
    build(data).save(OUT)
    print(f"Wrote {OUT.relative_to(ROOT)} ({', '.join(f'{k}: {len(v)} rows' for k, v in data.items())})")


if __name__ == "__main__":
    main()
