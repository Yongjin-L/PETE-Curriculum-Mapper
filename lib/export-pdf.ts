/* Renders a Report as a PDF with jsPDF + jspdf-autotable. Loaded on demand. */

import { jsPDF } from "jspdf";
import { autoTable, type CellHookData } from "jspdf-autotable";
import { LEVEL_NAMES } from "./types";
import { LEVEL_COLORS, LEVEL_LEGEND, type Report } from "./report";

const MARGIN = 48;
const PRIMARY: [number, number, number] = [31, 78, 121];
const MUTED: [number, number, number] = [95, 107, 122];

// The built-in PDF fonts only cover Latin-1; map common typographic characters and drop the rest.
function t(s: string): string {
  return s
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/×/g, "x")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
}

const hex = (h: string): [number, number, number] => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];

export function renderPdf(r: Report): Blob {
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  let y = MARGIN;
  const pageW = () => doc.internal.pageSize.getWidth();
  const pageH = () => doc.internal.pageSize.getHeight();
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const ensure = (space: number) => {
    if (y + space > pageH() - MARGIN - 20) {
      doc.addPage("letter", "portrait");
      y = MARGIN;
    }
  };
  const heading = (text: string, size = 14) => {
    ensure(size + 30);
    doc.setFont("helvetica", "bold").setFontSize(size).setTextColor(...PRIMARY);
    const lines = doc.splitTextToSize(t(text), pageW() - MARGIN * 2);
    doc.text(lines, MARGIN, y);
    y += lines.length * size * 1.2 + 4;
    doc.setTextColor(0);
  };
  const para = (text: string, size = 10, color: [number, number, number] = [30, 36, 48]) => {
    doc.setFont("helvetica", "normal").setFontSize(size).setTextColor(...color);
    const lines = doc.splitTextToSize(t(text), pageW() - MARGIN * 2);
    ensure(lines.length * size * 1.35);
    doc.text(lines, MARGIN, y);
    y += lines.length * size * 1.35 + 4;
    doc.setTextColor(0);
  };
  const levelCell = (data: CellHookData, col: number) => {
    if (data.section !== "body" || data.column.index !== col) return;
    const v = String(data.cell.raw ?? "").charAt(0) as keyof typeof LEVEL_COLORS;
    const c = LEVEL_COLORS[v];
    if (c) {
      data.cell.styles.fillColor = hex(c.fill);
      data.cell.styles.textColor = hex(c.text);
      data.cell.styles.fontStyle = "bold";
    }
  };

  // ---- Title block
  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(...PRIMARY);
  doc.text(t(r.title), MARGIN, y + 6);
  y += 30;
  if (r.program || r.university) {
    doc.setFontSize(13).setTextColor(30, 36, 48);
    doc.text(t([r.program, r.university].filter(Boolean).join(" | ")), MARGIN, y);
    y += 18;
  }
  para(
    `Generated ${r.generated}  |  ${r.stats.courses} courses  |  ${r.stats.topicsMapped} topics mapped  |  ${r.stats.placements} placements ` +
      `(I ${r.stats.byLevel.I}, R ${r.stats.byLevel.R}, M ${r.stats.byLevel.M})`,
    9,
    MUTED
  );
  para(`Levels: ${LEVEL_LEGEND}`, 9, MUTED);
  y += 6;

  // ---- Courses
  heading("Courses and topics", 15);
  const detail = r.sections.chapters || r.sections.standards;
  for (const c of r.courses) {
    ensure(90); // keep the course heading with the start of its table
    heading(c.heading, 12);
    if (c.topics.length === 0) {
      para("No topics mapped yet.", 9, MUTED);
      y += 4;
      continue;
    }
    const head = ["Topic", "Level", ...(r.sections.chapters ? ["Chapters"] : []), ...(r.sections.standards ? ["SHAPE standards"] : [])];
    const body = c.topics.map((tp) => [
      t(tp.name + (tp.custom ? " (custom)" : "")),
      `${tp.level} - ${LEVEL_NAMES[tp.level]}`,
      ...(r.sections.chapters ? [t(tp.chapters.join("\n") || "-")] : []),
      ...(r.sections.standards ? [t(tp.standards.join("\n") || "-")] : []),
    ]);
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      margin: { left: MARGIN, right: MARGIN },
      styles: { font: "helvetica", fontSize: detail ? 8.5 : 9.5, cellPadding: 4, valign: "top", lineColor: [221, 225, 231], lineWidth: 0.5 },
      headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold" },
      columnStyles: detail
        ? { 0: { cellWidth: 130 }, 1: { cellWidth: 72 } }
        : { 1: { cellWidth: 110 } },
      didParseCell: (d) => levelCell(d, 1),
    });
    y = lastY() + 14;
  }

  // ---- Coverage
  if (r.sections.coverage) {
    ensure(120);
    heading("SHAPE America standards coverage", 15);
    para("Related topics are those linked to the standard in the data set. Levels count placements of those topics across courses.", 9, MUTED);
    autoTable(doc, {
      startY: y,
      head: [["Standard", "Related topics mapped", "Courses", "I", "R", "M"]],
      body: r.coverage.map((s) => [t(`${s.code}: ${s.label}`), `${s.mapped} of ${s.total}`, String(s.courses), String(s.levels.I), String(s.levels.R), String(s.levels.M)]),
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 9, cellPadding: 4, lineColor: [221, 225, 231], lineWidth: 0.5 },
      headStyles: { fillColor: PRIMARY, textColor: 255 },
      columnStyles: { 1: { halign: "center", cellWidth: 90 }, 2: { halign: "center", cellWidth: 52 }, 3: { halign: "center", cellWidth: 32 }, 4: { halign: "center", cellWidth: 32 }, 5: { halign: "center", cellWidth: 32 } },
    });
    y = lastY() + 16;
  }

  // ---- References
  if (r.sections.references && r.references.length) {
    ensure(80);
    heading("References", 15);
    for (const ref of r.references) para(ref, 9.5);
  }

  // ---- Analysis (Phase 5)
  if (r.sections.analysis && r.analysis) {
    ensure(80);
    heading("Analysis", 15);
    for (const block of r.analysis.split(/\n{2,}/)) para(block.replace(/^#+\s*/gm, "").replace(/\*\*/g, ""), 9.5);
  }

  // ---- Matrix (landscape pages)
  if (r.sections.matrix && r.matrix.rows.length) {
    doc.addPage("letter", "landscape");
    y = MARGIN;
    heading("Topics x courses matrix", 15);
    para(`Levels: ${LEVEL_LEGEND}`, 9, MUTED);
    const many = r.matrix.columns.length > 10;
    autoTable(doc, {
      startY: y,
      head: [["Topic", ...r.matrix.columns.map(t)]],
      body: r.matrix.rows.map((row) => [t(row.topic), ...row.cells]),
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: many ? 7 : 8.5, cellPadding: 3, halign: "center", valign: "middle", lineColor: [221, 225, 231], lineWidth: 0.5 },
      headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: many ? 6.5 : 8 },
      columnStyles: { 0: { halign: "left", cellWidth: many ? 150 : 190 } },
      horizontalPageBreak: true,
      horizontalPageBreakRepeat: 0,
      didParseCell: (d) => {
        if (d.section === "body" && d.column.index > 0) levelCell(d, d.column.index);
      },
    });
    y = lastY() + 12;
    if (r.matrix.columns.some((c, i) => c !== r.matrix.columnNames[i])) {
      para("Courses: " + r.matrix.columnNames.map((n, i) => `${r.matrix.columns[i]} = ${n}`).join("; "), 8, MUTED);
    }
  }

  // ---- Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
    const w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight();
    doc.text(t(`${r.credit}  |  Data set ${r.datasetVersion}`), MARGIN, h - 24);
    doc.text(`Page ${i} of ${pages}`, w - MARGIN, h - 24, { align: "right" });
  }

  return doc.output("blob");
}
