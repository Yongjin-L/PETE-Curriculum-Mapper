/* Draws the curriculum map (components × courses) as a PNG image for slides, emails and posters. */

import { getLibrary } from "./dataset";
import { levelGrid, rowStatus, STATUS_ICON } from "./status";
import type { Level, Plan } from "./types";

const C = {
  text: "#1c2430",
  muted: "#5f6b7a",
  primary: "#1F4E79",
  border: "#dde1e7",
  group: "#eef2f7",
  empty: "#f0f2f5",
  I: { fill: "#DCE7FF", ink: "#1D4ED8" },
  R: { fill: "#F8D58F", ink: "#92400E" },
  M: { fill: "#15803D", ink: "#FFFFFF" },
  st: { ok: ["#dcf3e3", "#15803d"], noM: ["#fdf0d8", "#b45309"], order: ["#fdecea", "#b42318"], none: ["#ffffff", "#9aa6b5"] } as Record<string, [string, string]>,
};
const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

export async function renderGridPng(plan: Plan, scale = 2): Promise<Blob> {
  const lib = getLibrary();
  const row = levelGrid(plan);
  const n = plan.courses.length;
  const hasTerms = plan.courses.some((c) => c.term);

  const PAD = 32, LABEL_W = 340, COL_W = n > 12 ? 52 : 66, ROW_H = 24, GROUP_H = 28, HEAD_H = 54, TERM_H = hasTerms ? 22 : 0;
  const gridW = LABEL_W + n * COL_W;
  const width = Math.max(gridW + PAD * 2, 720);
  const rows = lib.standards.reduce((sum, s) => sum + GROUP_H + (lib.componentsByStandard.get(s.standard_id)?.length ?? 0) * ROW_H, 0);
  const TOP = 104;
  const height = TOP + TERM_H + HEAD_H + rows + 64;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const g = canvas.getContext("2d")!;
  g.scale(scale, scale);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, width, height);
  g.textBaseline = "middle";

  const font = (w: number, px: number) => (g.font = `${w} ${px}px ${FONT}`);
  const fit = (text: string, max: number) => {
    if (g.measureText(text).width <= max) return text;
    let t = text;
    while (t.length > 1 && g.measureText(t + "…").width > max) t = t.slice(0, -1);
    return t + "…";
  };
  const rr = (x: number, y: number, w: number, h: number, r: number, fill: string) => {
    g.fillStyle = fill;
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fill();
  };

  // ---- title
  font(800, 22);
  g.fillStyle = C.text;
  g.fillText(fit(plan.program.name || "Curriculum Map", width - PAD * 2), PAD, 34);
  font(400, 14);
  g.fillStyle = C.muted;
  g.fillText(fit([plan.program.university, "SHAPE America 2017 Initial PETE Standards × courses"].filter(Boolean).join("  ·  "), width - PAD * 2), PAD, 58);
  // legend
  let lx = PAD;
  for (const [l, name] of [["I", "Introduced"], ["R", "Reinforced"], ["M", "Mastered"]] as [Level, string][]) {
    rr(lx, 74, 22, 18, 4, C[l].fill);
    font(800, 11);
    g.fillStyle = C[l].ink;
    g.textAlign = "center";
    g.fillText(l, lx + 11, 83.5);
    g.textAlign = "left";
    font(400, 12);
    g.fillStyle = C.muted;
    g.fillText(name, lx + 28, 83.5);
    lx += 28 + g.measureText(name).width + 18;
  }

  const x0 = PAD;
  let y = TOP;

  // ---- term row
  if (hasTerms) {
    let i = 0;
    while (i < n) {
      const t = plan.courses[i].term ?? "";
      let j = i;
      while (j + 1 < n && (plan.courses[j + 1].term ?? "") === t) j++;
      const x = x0 + LABEL_W + i * COL_W, w = (j - i + 1) * COL_W;
      if (t) {
        font(700, 10);
        g.fillStyle = C.primary;
        g.textAlign = "center";
        g.fillText(fit(t.toUpperCase().replace(/\bYEAR\s*/, "Y"), w - 6), x + w / 2, y + 9);
        g.textAlign = "left";
        g.fillStyle = "#d6e3f1";
        g.fillRect(x + 2, y + TERM_H - 3, w - 4, 2);
      }
      i = j + 1;
    }
    y += TERM_H;
  }

  // ---- course header
  font(400, 11);
  g.fillStyle = C.muted;
  g.fillText("SHAPE component", x0 + 4, y + HEAD_H / 2);
  plan.courses.forEach((c, i) => {
    const cx = x0 + LABEL_W + i * COL_W + COL_W / 2;
    g.textAlign = "center";
    font(800, 11);
    g.fillStyle = C.primary;
    g.fillText(fit(c.number || `#${i + 1}`, COL_W - 4), cx, y + 16);
    font(400, 9);
    g.fillStyle = C.muted;
    // course name on up to two lines
    const words = (c.name || "").split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const tryLine = cur ? cur + " " + w : w;
      if (g.measureText(tryLine).width <= COL_W - 6) cur = tryLine;
      else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    lines.slice(0, 2).forEach((ln, k) => g.fillText(fit(k === 1 && lines.length > 2 ? ln + "…" : ln, COL_W - 6), cx, y + 30 + k * 11));
    g.textAlign = "left";
  });
  y += HEAD_H;
  g.fillStyle = C.border;
  g.fillRect(x0, y - 1, gridW, 1);

  // ---- rows
  for (const s of lib.standards) {
    rr(x0, y + 2, gridW, GROUP_H - 4, 6, C.group);
    rr(x0 + 6, y + 6, 20, 16, 4, C.primary);
    font(800, 11);
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.fillText(s.standard_no, x0 + 16, y + 14.5);
    g.textAlign = "left";
    font(700, 12);
    g.fillStyle = C.text;
    g.fillText(fit(s.title, LABEL_W - 40), x0 + 34, y + 14.5);
    y += GROUP_H;
    for (const comp of lib.componentsByStandard.get(s.standard_id) ?? []) {
      const levels = row(comp.component_id);
      const st = rowStatus(levels);
      font(700, 11);
      g.fillStyle = C.primary;
      g.fillText(comp.component_id, x0 + 6, y + ROW_H / 2);
      font(400, 11.5);
      g.fillStyle = C.text;
      g.fillText(fit(comp.label, LABEL_W - 64), x0 + 34, y + ROW_H / 2);
      const [bg, ink] = C.st[st.kind];
      g.fillStyle = bg;
      g.beginPath();
      g.arc(x0 + LABEL_W - 14, y + ROW_H / 2, 8, 0, Math.PI * 2);
      g.fill();
      if (st.kind === "none") {
        g.strokeStyle = C.border;
        g.lineWidth = 1.2;
        g.stroke();
      }
      font(800, 9.5);
      g.fillStyle = ink;
      g.textAlign = "center";
      g.fillText(STATUS_ICON[st.kind], x0 + LABEL_W - 14, y + ROW_H / 2 + 0.5);
      levels.forEach((lv, i) => {
        const cx = x0 + LABEL_W + i * COL_W;
        rr(cx + 2, y + 2, COL_W - 4, ROW_H - 4, 4, lv ? C[lv].fill : C.empty);
        if (lv) {
          font(800, 10.5);
          g.fillStyle = C[lv].ink;
          g.fillText(lv, cx + COL_W / 2, y + ROW_H / 2 + 0.5);
        }
      });
      g.textAlign = "left";
      y += ROW_H;
    }
  }

  // ---- footer
  font(400, 10.5);
  g.fillStyle = C.muted;
  g.fillText("✓ builds to M    ! never reaches M    ↯ order problem    ○ not addressed", PAD, height - 40);
  g.fillText(fit("Created with PETE Curriculum Mapper · curriculum.yongjin.info · Standards © SHAPE America (2017)", width - PAD * 2), PAD, height - 22);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create the image."))), "image/png"));
}
