"""Builds dataset/PETE_dataset_template.xlsx from the CSV files.

One tab per table, a frozen and styled header row, and an Instructions tab.
Upload the workbook to Google Sheets (or open it in Excel), fill it in, then
download each tab as CSV into dataset/csv/ and run scripts/build-dataset.mjs.

Usage: python3 scripts/make-template-xlsx.py
"""
import csv
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

ROOT = Path(__file__).resolve().parent.parent
CSV_DIR = ROOT / "dataset" / "csv"
OUT = ROOT / "dataset" / "PETE_dataset_template.xlsx"

TABLES = ["textbooks", "chapters", "topics", "topic_chapters", "standards", "topic_standards"]

INSTRUCTIONS = [
    ("PETE Curriculum Mapper: master data set", True),
    ("", False),
    ("Fill in one tab per table. Keep the header row exactly as it is.", False),
    ("Rows marked SAMPLE are placeholders. Replace or delete them.", False),
    ("", False),
    ("ID formats", True),
    ("textbook_id    TB01, TB02, ...", False),
    ("chapter_id     <textbook_id>-C<chapter number>, e.g. TB01-C05", False),
    ("topic_id       T001, T002, ...  (never reuse or renumber an ID once published)", False),
    ("standard_id    S1-S6 for the six standards; add components as S1a, S1b, ... if you want them", False),
    ("", False),
    ("Tabs", True),
    ("textbooks        One row per textbook", False),
    ("chapters         One row per chapter; textbook_id must exist in textbooks", False),
    ("topics           The flat list of topics users drag onto courses. keywords are separated by semicolons", False),
    ("topic_chapters   Links a topic to a chapter. relevance = primary or secondary (blank = primary)", False),
    ("standards        SHAPE America 2017 Initial PETE Standards. Use short paraphrased labels, not the official text", False),
    ("topic_standards  Links a topic to a standard", False),
    ("", False),
    ("Copyright", True),
    ("List textbook titles, authors and chapter titles only. Do not copy text from the books.", False),
    ("Verify standard and component numbering against SHAPE America's official document.", False),
    ("", False),
    ("When finished", True),
    ("Download each tab as CSV (File > Download > CSV) named <tab>.csv into dataset/csv/,", False),
    ("then run:  node scripts/build-dataset.mjs", False),
]

HEADER_FILL = PatternFill("solid", fgColor="1F4E79")
HEADER_FONT = Font(bold=True, color="FFFFFF")


def main() -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Instructions"
    for i, (text, bold) in enumerate(INSTRUCTIONS, start=1):
        cell = ws.cell(row=i, column=1, value=text)
        cell.font = Font(bold=bold, size=14 if i == 1 else 11)
    ws.column_dimensions["A"].width = 110

    for name in TABLES:
        with open(CSV_DIR / f"{name}.csv", newline="", encoding="utf-8") as f:
            rows = list(csv.reader(f))
        sheet = wb.create_sheet(name)
        for r in rows:
            sheet.append(r)
        for cell in sheet[1]:
            cell.fill = HEADER_FILL
            cell.font = HEADER_FONT
        sheet.freeze_panes = "A2"
        for col_idx, header in enumerate(rows[0], start=1):
            longest = max(len(r[col_idx - 1]) if col_idx - 1 < len(r) else 0 for r in rows)
            letter = sheet.cell(row=1, column=col_idx).column_letter
            sheet.column_dimensions[letter].width = min(max(longest, len(header)) + 4, 70)
            if header == "description":
                for c in sheet[letter][1:]:
                    c.alignment = Alignment(wrap_text=True, vertical="top")

    wb.save(OUT)
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
