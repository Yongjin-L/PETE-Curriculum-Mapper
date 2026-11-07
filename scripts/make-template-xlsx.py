"""(Re)builds dataset/PETE_dataset_template.xlsx: SHAPE America 2017 Initial PETE Standards and components.

Data is kept from the existing workbook when it already has the standards/components tabs;
otherwise the built-in 2017 standards are written.

Usage: python3 scripts/make-template-xlsx.py
"""
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.comments import Comment
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dataset" / "PETE_dataset_template.xlsx"
MAX_ROW = 500
SOURCE = "SHAPE America (2017). National Standards for Initial Physical Education Teacher Education."

STANDARDS = [
    ("S1", 1, "Content and Foundational Knowledge", "Physical education candidates demonstrate an understanding of common and specialized content, and scientific and theoretical foundations for the delivery of an effective preK-12 physical education program."),
    ("S2", 2, "Skillfulness and Health-Related Fitness", "Physical education candidates are physically literate individuals who can demonstrate skillful performance in physical education content areas and health-enhancing levels of fitness."),
    ("S3", 3, "Planning and Implementation", "Physical education candidates apply content and foundational knowledge to plan and implement developmentally appropriate learning experiences aligned with local, state and/or SHAPE America's National Standards and Grade-Level Outcomes for K-12 Physical Education through the effective use of resources, accommodations and/or modifications, technology and metacognitive strategies to address the diverse needs of all students."),
    ("S4", 4, "Instructional Delivery and Management", "Physical education candidates engage students in meaningful learning experiences through effective use of pedagogical skills. They use communication, feedback, technology, and instructional and managerial skills to enhance student learning."),
    ("S5", 5, "Assessment of Student Learning", "Physical education candidates select and implement appropriate assessments to monitor students' progress and guide decision making related to instruction and learning."),
    ("S6", 6, "Professional Responsibility", "Physical education candidates demonstrate behaviors essential to becoming effective professionals. They exhibit professional ethics and culturally competent practices; seek opportunities for continued professional development; and demonstrate knowledge of promotion/advocacy strategies for physical education and expanded physical activity opportunities that support the development of physically literate individuals."),
]

COMPONENTS = [
    ("1.a", "S1", "Common content knowledge", "Describe and apply common content knowledge for teaching preK-12 physical education."),
    ("1.b", "S1", "Specialized content knowledge", "Describe and apply specialized content knowledge for teaching preK-12 physical education."),
    ("1.c", "S1", "Physiological & biomechanical concepts", "Describe and apply physiological and biomechanical concepts related to skillful movement, physical activity and fitness for preK-12 students."),
    ("1.d", "S1", "Motor learning & behavior change", "Describe and apply motor learning and behavior-change/psychological principles related to skillful movement, physical activity and fitness for preK-12 students."),
    ("1.e", "S1", "Motor development", "Describe and apply motor development theory and principles related to fundamental motor skills, skillful movement, physical activity and fitness for preK-12 students."),
    ("1.f", "S1", "Historical, philosophical & social perspectives", "Describe the historical, philosophical and social perspectives of physical education issues and legislation."),
    ("2.a", "S2", "Motor skill competency & content areas", "Demonstrate competency in all fundamental motor skills, as well as skillful performance in a minimum of four physical education content areas (e.g., games and sports, aquatics, dance and rhythmic activities, fitness activities, outdoor pursuits, individual-performance activities)."),
    ("2.b", "S2", "Health-enhancing fitness", "Achieve and maintain a health-enhancing level of fitness throughout the program."),
    ("3.a", "S3", "Aligned short- & long-term objectives", "Plan and implement appropriate (e.g., measureable, developmentally appropriate, performance-based) short- and long-term plan objectives that are aligned with local, state and/or SHAPE America's National Standards and Grade-Level Outcomes for K-12 Physical Education."),
    ("3.b", "S3", "Progressive, sequential content", "Plan and implement progressive and sequential content that aligns with short- and long-term plan objectives and that addresses the diverse needs of all students."),
    ("3.c", "S3", "Resources & equitable experiences", "Plan for and manage resources to provide active, fair and equitable learning experiences."),
    ("3.d", "S3", "Individualized instruction & accommodations", "Plan and implement individualized instruction for diverse student needs, adding specific accommodations and/or modifications for all students."),
    ("3.e", "S3", "Technology in learning experiences", "Plan and implement learning experiences that require students to use technology appropriately in meeting one or more short- and long-term plan objective(s)."),
    ("3.f", "S3", "Metacognitive strategies", "Plan and implement learning experiences that engage students in using metacognitive strategies appropriately to analyze their own performance results."),
    ("4.a", "S4", "Respectful communication", "Demonstrate verbal and nonverbal communication skills that convey respect and sensitivity across all learning experiences."),
    ("4.b", "S4", "Demonstrations, explanations & cues", "Implement demonstrations, explanations and instructional cues that are aligned with short- and long-term plan objectives."),
    ("4.c", "S4", "Adjusting instruction", "Evaluate the changing dynamics of the learning environment and adjust instructional tasks as needed to further student progress."),
    ("4.d", "S4", "Routines & behavior management", "Implement transitions, routines and positive behavior management to create and maintain a safe, supportive and engaging learning environment."),
    ("4.e", "S4", "Skill analysis & feedback", "Analyze motor skills and performance concepts through multiple means (e.g., visual observation, technology) in order to provide specific, congruent feedback to enhance student learning."),
    ("5.a", "S5", "Authentic, formal assessments", "Select or create authentic, formal assessments that measure student attainment of short- and long-term objectives."),
    ("5.b", "S5", "Formative & summative assessment", "Implement formative assessments that monitor student learning before and throughout the long-term plan, as well as summative assessments that evaluate student learning upon completion of the long-term plan."),
    ("5.c", "S5", "Reflective cycle", "Implement a reflective cycle to guide decision making specific to candidate performance, student learning, and short- and long-term plan objectives."),
    ("6.a", "S6", "Professional ethics & cultural competence", "Engage in behavior that reflects professional ethics, practice and cultural competence."),
    ("6.b", "S6", "Professional growth & collaboration", "Engage in continued professional growth and collaboration in schools and/or professional organizations."),
    ("6.c", "S6", "Promotion & advocacy", "Describe strategies, including the use of technology, for the promotion and advocacy of physical education and expanded physical activity opportunities."),
]

SHEETS = {
    "standards": [
        ("standard_id", 12, "S1-S6. Never change an ID once the site is in use.", "text"),
        ("standard_no", 12, "1-6.", "number"),
        ("title", 40, "Standard title.", "text"),
        ("description", 90, "Full standard statement.", "long"),
    ],
    "components": [
        ("component_id", 14, "e.g. 3.b (standard number, dot, letter). Never change an ID once the site is in use: saved maps refer to it.", "text"),
        ("standard_id", 12, "Pick the standard (S1-S6).", "text"),
        ("label", 42, "Short name shown on the map (about 2-6 words).", "text"),
        ("text", 100, "Full component statement (shown in details, exports and used by the AI).", "long"),
    ],
}
HELPERS = {
    "components": [("(standard title)", 36, '=IF(B{r}="","",IFERROR(VLOOKUP(B{r},standards!$A:$C,3,FALSE),"? unknown standard"))')],
}

INSTRUCTIONS = [
    ("PETE Curriculum Mapper: standards and components", "title"),
    ("The site maps these components onto each program's courses with I / R / M levels.", ""),
    ("Source: " + SOURCE + " © SHAPE America.", ""),
    ("", ""),
    ("How to edit", "h"),
    ("• standards tab: the six standards (ID, number, title, full statement).", ""),
    ("• components tab: one row per component. 'label' is the short name shown on the map; 'text' is the full statement.", ""),
    ("• Type only in white columns. Grey columns starting with ( ) are automatic helpers; the site ignores them.", ""),
    ("• A red ID cell means that ID is used twice. Keep row 1 and the tab names exactly as they are.", ""),
    ("• Never change an ID once the site is in use: saved maps refer to components by ID (e.g. 3.b).", ""),
    ("", ""),
    ("Publishing your changes", "h"),
    ("Option A: send this file to Claude and ask to check and publish it.", ""),
    ("Option B: on github.com/Yongjin-L/PETE-Curriculum-Mapper → dataset folder → Add file → Upload files →", ""),
    ("   drop this file (same name) → Commit changes. The site checks the data and rebuilds in about a minute;", ""),
    ("   if something is wrong, the live site keeps its data and Vercel → Deployments → Build logs lists the problems.", ""),
]

HEADER_FILL = PatternFill("solid", fgColor="1F4E79")
HELPER_HEAD_FILL = PatternFill("solid", fgColor="A6A6A6")
HELPER_FILL = PatternFill("solid", fgColor="EDEDED")
DUP_FILL = PatternFill("solid", fgColor="F8CBAD")


def read_existing():
    try:
        wb = load_workbook(OUT, data_only=True)
    except FileNotFoundError:
        return None
    if not all(n in wb.sheetnames for n in SHEETS):
        return None
    out = {}
    for name, cols in SHEETS.items():
        ws = wb[name]
        idx = {c.value: i for i, c in enumerate(ws[1]) if c.value}
        rows = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            rec = [row[idx[c[0]]] if c[0] in idx and idx[c[0]] < len(row) else None for c in cols]
            if any(v not in (None, "") for v in rec):
                rows.append(rec)
        out[name] = rows
    return out


def build(data):
    wb = Workbook()
    ws = wb.active
    ws.title = "Instructions"
    for i, (text, style) in enumerate(INSTRUCTIONS, start=1):
        c = ws.cell(row=i, column=1, value=text)
        if style == "title":
            c.font = Font(bold=True, size=16, color="1F4E79")
        elif style == "h":
            c.font = Font(bold=True, size=12, color="1F4E79")
    ws.column_dimensions["A"].width = 120
    for name, cols in SHEETS.items():
        sh = wb.create_sheet(name)
        sh.sheet_properties.tabColor = "1F4E79" if name == "standards" else "2E7D4F"
        helpers = HELPERS.get(name, [])
        for j, (col, width, note, _) in enumerate(cols, start=1):
            c = sh.cell(row=1, column=j, value=col)
            c.fill, c.font = HEADER_FILL, Font(bold=True, color="FFFFFF")
            c.comment = Comment(note, "PETE Curriculum Mapper", width=260, height=90)
            sh.column_dimensions[c.column_letter].width = width
        for k, (head, width, _) in enumerate(helpers):
            c = sh.cell(row=1, column=len(cols) + 1 + k, value=head)
            c.fill, c.font = HELPER_HEAD_FILL, Font(bold=True, italic=True, color="FFFFFF")
            sh.column_dimensions[c.column_letter].width = width
        rows = data[name]
        for r, rec in enumerate(rows, start=2):
            for j, (_, _, _, kind) in enumerate(cols, start=1):
                v = rec[j - 1]
                if kind == "number" and v not in (None, ""):
                    v = int(float(v))
                c = sh.cell(row=r, column=j, value=v)
                c.alignment = Alignment(wrap_text=kind == "long", vertical="top")
        for r in range(2, len(rows) + 50):
            for k, (_, _, formula) in enumerate(helpers):
                c = sh.cell(row=r, column=len(cols) + 1 + k, value=formula.format(r=r))
                c.fill, c.font = HELPER_FILL, Font(color="595959", italic=True)
                c.alignment = Alignment(vertical="top")
        for j, (_, _, _, kind) in enumerate(cols, start=1):
            if kind != "number":
                for r in range(2, MAX_ROW + 1):
                    sh.cell(row=r, column=j).number_format = "@"
        if name == "components":
            dv = DataValidation(type="list", formula1="=standards!$A$2:$A$%d" % MAX_ROW, allow_blank=True)
            dv.error, dv.errorTitle, dv.errorStyle, dv.showErrorMessage = "Pick a standard ID from the list.", "Not in the list", "warning", True
            sh.add_data_validation(dv)
            dv.add(f"B2:B{MAX_ROW}")
        sh.conditional_formatting.add(f"A2:A{MAX_ROW}", FormulaRule(formula=[f'AND(A2<>"",COUNTIF($A$2:$A${MAX_ROW},A2)>1)'], fill=DUP_FILL))
        sh.freeze_panes = "B2"
    return wb


def main():
    data = read_existing() or {"standards": [list(s) for s in STANDARDS], "components": [list(c) for c in COMPONENTS]}
    build(data).save(OUT)
    print(f"Wrote {OUT.relative_to(ROOT)} (standards: {len(data['standards'])}, components: {len(data['components'])})")


if __name__ == "__main__":
    main()
