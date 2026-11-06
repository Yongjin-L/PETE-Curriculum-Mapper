/* Renders a Report as a Word (.docx) document with the docx library. Loaded on demand. */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
} from "docx";
import { LEVEL_NAMES, type Level } from "./types";
import { LEVEL_COLORS, LEVEL_LEGEND, type Report } from "./report";

const PRIMARY = "1F4E79";
const MUTED = "5F6B7A";
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "DDE1E7" };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

const p = (text: string, opts: { size?: number; color?: string; bold?: boolean; after?: number } = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 80 },
    children: [new TextRun({ text, size: opts.size ?? 20, color: opts.color, bold: opts.bold })],
  });

const lines = (items: string[], size = 18) =>
  (items.length ? items : ["-"]).map((s) => new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: s, size })] }));

function headCell(text: string, width?: number) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18 })] })],
    shading: { type: ShadingType.CLEAR, color: "auto", fill: PRIMARY },
    borders: BORDERS,
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
  });
}

function cell(children: Paragraph[], opts: { fill?: string; width?: number } = {}) {
  return new TableCell({
    children,
    borders: BORDERS,
    shading: opts.fill ? { type: ShadingType.CLEAR, color: "auto", fill: opts.fill } : undefined,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
  });
}

function levelCell(level: Level | "", label: string, width?: number, center = false) {
  const c = level ? LEVEL_COLORS[level] : null;
  return cell(
    [
      new Paragraph({
        alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text: label, bold: !!c, color: c?.text, size: 18 })],
      }),
    ],
    { fill: c?.fill, width }
  );
}

const table = (rows: TableRow[]) => new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });

function footer(r: Report) {
  return {
    default: new Footer({
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: `${r.credit}  |  Data set ${r.datasetVersion}  |  Page `, size: 15, color: MUTED }),
            new TextRun({ children: [PageNumber.CURRENT], size: 15, color: MUTED }),
            new TextRun({ text: " of ", size: 15, color: MUTED }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, color: MUTED }),
          ],
        }),
      ],
    }),
  };
}

export async function renderDocx(r: Report): Promise<Blob> {
  const main: (Paragraph | Table)[] = [];

  main.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: r.title, color: PRIMARY })] }));
  if (r.program || r.university) main.push(p([r.program, r.university].filter(Boolean).join(" | "), { size: 26, after: 120 }));
  main.push(
    p(
      `Generated ${r.generated}  |  ${r.stats.courses} courses  |  ${r.stats.topicsMapped} topics mapped  |  ${r.stats.placements} placements ` +
        `(I ${r.stats.byLevel.I}, R ${r.stats.byLevel.R}, M ${r.stats.byLevel.M})`,
      { size: 18, color: MUTED }
    ),
    p(`Levels: ${LEVEL_LEGEND}`, { size: 18, color: MUTED, after: 240 })
  );

  main.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Courses and topics")] }));
  const { chapters, standards } = r.sections;
  for (const c of r.courses) {
    main.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240 }, children: [new TextRun(c.heading)] }));
    if (!c.topics.length) {
      main.push(p("No topics mapped yet.", { color: MUTED, size: 18 }));
      continue;
    }
    const detail = chapters || standards;
    const widths = detail ? [28, 14, ...(chapters && standards ? [34, 24] : [58])] : [70, 30];
    main.push(
      table([
        new TableRow({
          tableHeader: true,
          children: [headCell("Topic", widths[0]), headCell("Level", widths[1]), ...(chapters ? [headCell("Chapters", widths[2])] : []), ...(standards ? [headCell("SHAPE standards", widths[chapters ? 3 : 2])] : [])],
        }),
        ...c.topics.map(
          (tp) =>
            new TableRow({
              cantSplit: true,
              children: [
                cell(lines([tp.name + (tp.custom ? " (custom)" : "")], 19)),
                levelCell(tp.level, `${tp.level} - ${LEVEL_NAMES[tp.level]}`),
                ...(chapters ? [cell(lines(tp.chapters, 17))] : []),
                ...(standards ? [cell(lines(tp.standards, 17))] : []),
              ],
            })
        ),
      ])
    );
  }

  if (r.sections.coverage) {
    main.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360 }, children: [new TextRun("SHAPE America standards coverage")] }));
    main.push(p("Related topics are those linked to the standard in the data set. Levels count placements of those topics across courses.", { size: 18, color: MUTED }));
    main.push(
      table([
        new TableRow({ tableHeader: true, children: [headCell("Standard", 46), headCell("Related topics mapped", 20), headCell("Courses", 10), headCell("I", 8), headCell("R", 8), headCell("M", 8)] }),
        ...r.coverage.map(
          (s) =>
            new TableRow({
              children: [
                cell(lines([`${s.code}: ${s.label}`], 18)),
                cell(lines([`${s.mapped} of ${s.total}`], 18)),
                cell(lines([String(s.courses)], 18)),
                levelCell(s.levels.I ? "I" : "", String(s.levels.I), undefined, true),
                levelCell(s.levels.R ? "R" : "", String(s.levels.R), undefined, true),
                levelCell(s.levels.M ? "M" : "", String(s.levels.M), undefined, true),
              ],
            })
        ),
      ])
    );
  }

  if (r.sections.references && r.references.length) {
    main.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360 }, children: [new TextRun("References")] }));
    for (const ref of r.references) main.push(new Paragraph({ indent: { left: 360, hanging: 360 }, spacing: { after: 100 }, children: [new TextRun({ text: ref, size: 20 })] }));
  }

  if (r.sections.analysis && r.analysis) {
    main.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360 }, children: [new TextRun("Analysis")] }));
    for (const block of r.analysis.split(/\n{2,}/)) main.push(p(block.replace(/^#+\s*/gm, "").replace(/\*\*/g, "")));
  }

  const sections: ISectionOptions[] = [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, footers: footer(r), children: main }];

  if (r.sections.matrix && r.matrix.rows.length) {
    const n = r.matrix.columns.length;
    const topicW = n > 10 ? 22 : 30;
    const colW = (100 - topicW) / Math.max(n, 1);
    const size = n > 12 ? 14 : 17;
    const matrix: (Paragraph | Table)[] = [
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Topics × courses matrix")] }),
      p(`Levels: ${LEVEL_LEGEND}`, { size: 18, color: MUTED }),
      table([
        new TableRow({
          tableHeader: true,
          children: [
            headCell("Topic", topicW),
            ...r.matrix.columns.map(
              (c) =>
                new TableCell({
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c, bold: true, color: "FFFFFF", size })] })],
                  shading: { type: ShadingType.CLEAR, color: "auto", fill: PRIMARY },
                  borders: BORDERS,
                  width: { size: colW, type: WidthType.PERCENTAGE },
                  margins: { top: 40, bottom: 40, left: 30, right: 30 },
                })
            ),
          ],
        }),
        ...r.matrix.rows.map(
          (row) =>
            new TableRow({
              cantSplit: true,
              children: [cell(lines([row.topic], size + 1)), ...row.cells.map((lv) => levelCell(lv, lv, colW, true))],
            })
        ),
      ]),
    ];
    if (r.matrix.columns.some((c, i) => c !== r.matrix.columnNames[i]))
      matrix.push(p("Courses: " + r.matrix.columnNames.map((name, i) => `${r.matrix.columns[i]} = ${name}`).join("; "), { size: 16, color: MUTED }));
    sections.push({
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 800, bottom: 800, left: 800, right: 800 } } },
      footers: footer(r),
      children: matrix,
    });
  }

  const doc = new Document({
    creator: "PETE Curriculum Mapper (Yongjin Lee)",
    title: [r.title, r.program].filter(Boolean).join(" - "),
    description: r.credit,
    styles: {
      default: { document: { run: { font: "Calibri" } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 30, bold: true, color: PRIMARY }, paragraph: { spacing: { before: 240, after: 120 } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 24, bold: true, color: "1C2430" }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true } },
      ],
    },
    sections,
  });
  return Packer.toBlob(doc);
}
