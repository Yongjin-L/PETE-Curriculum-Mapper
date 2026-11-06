#!/usr/bin/env node
// Validates the PETE Curriculum Mapper master data set and converts it into the JSON file the website loads.
// Runs automatically before every build (npm "prebuild"), so a bad spreadsheet stops the deploy
// and the live site keeps its previous data.
//
// Usage:  node scripts/build-dataset.mjs [source] [outFile]
//   source: dataset/PETE_dataset_template.xlsx (default) or a folder of CSV files (one per tab)
//   outFile: public/data/dataset.json
// Exit code 1 if any ERROR is found (warnings do not fail the build). Columns whose header starts
// with "(" are helper columns and are ignored.

import fs from "node:fs";
import path from "node:path";
import readXlsxFile from "read-excel-file/node";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const source = path.resolve(process.argv[2] ?? path.join(root, "dataset/PETE_dataset_template.xlsx"));
const isCsvDir = fs.existsSync(source) && fs.statSync(source).isDirectory();
const outFile = path.resolve(process.argv[3] ?? path.join(root, "public/data/dataset.json"));

const SCHEMA = {
  textbooks: { required: ["textbook_id", "title", "authors"], optional: ["edition", "year", "publisher", "isbn"] },
  chapters: { required: ["chapter_id", "textbook_id", "chapter_no", "chapter_title"], optional: [] },
  topics: { required: ["topic_id", "topic_name"], optional: ["description", "keywords"] },
  topic_chapters: { required: ["topic_id", "chapter_id"], optional: ["relevance"] },
  standards: { required: ["standard_id", "standard_no", "short_label"], optional: ["component"] },
  topic_standards: { required: ["topic_id", "standard_id"], optional: [] },
};

const FORMAT_HINT = { textbook_id: "e.g. TB01", chapter_id: "e.g. TB01-C05", topic_id: "e.g. T001", standard_id: "e.g. S3 or S3a" };
const ID_PATTERNS = {
  textbook_id: /^TB\d{2,}$/,
  chapter_id: /^TB\d{2,}-C\d{2,}$/,
  topic_id: /^T\d{3,}$/,
  standard_id: /^S\d+[a-z]?$/,
};

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// Minimal RFC 4180 CSV parser (quotes, escaped quotes, commas/newlines in quotes).
function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

// Cell value -> trimmed string ("" for empty). Whole numbers lose any ".0"; dates become YYYY-MM-DD.
function cellText(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  return String(v).trim();
}

let workbook = null; // { sheetName: rows[][] }
async function loadWorkbook() {
  if (isCsvDir) return;
  if (!fs.existsSync(source)) { err(`Spreadsheet not found: ${source}`); workbook = {}; return; }
  try {
    const sheets = await readXlsxFile(source);
    workbook = Object.fromEntries(sheets.map((s) => [s.sheet.trim(), s.data.map((r) => r.map(cellText))]));
  } catch (e) {
    err(`Could not read the spreadsheet (${e.message}). Save it as an Excel .xlsx file and try again.`);
    workbook = {};
  }
}

function tableRows(name) {
  if (isCsvDir) {
    const file = path.join(source, `${name}.csv`);
    if (!fs.existsSync(file)) { err(`${name}.csv: file not found in ${source}`); return null; }
    return parseCsv(fs.readFileSync(file, "utf8"));
  }
  if (!workbook[name]) { err(`Tab "${name}" is missing from the spreadsheet (tab names must stay exactly as they are)`); return null; }
  return workbook[name];
}

function loadTable(name) {
  const all = tableRows(name);
  if (!all) return [];
  const [rawHeader = [], ...rows] = all;
  // Drop helper columns "(...)" and trailing empty headers.
  const keep = rawHeader.map((h, i) => ({ h: String(h ?? "").trim(), i })).filter(({ h }) => h && !h.startsWith("("));
  const cols = keep.map(({ h }) => h);
  const { required, optional } = SCHEMA[name];
  for (const c of required) if (!cols.includes(c)) err(`${name}: missing required column "${c}" in row 1`);
  for (const c of cols) if (![...required, ...optional].includes(c)) warn(`${name}: unknown column "${c}" (ignored)`);

  const label = isCsvDir ? `${name}.csv line` : `${name} row`;
  return rows
    .map((r, i) => ({ r, line: i + 2 })) // header is row 1
    .filter(({ r }) => keep.some(({ i }) => String(r[i] ?? "").trim() !== "")) // skip blank rows
    .map(({ r, line }) => {
    const obj = { _line: line, _label: `${label} ${line}` };
    keep.forEach(({ h, i }) => { obj[h] = String(r[i] ?? "").trim(); });
    for (const c of required) if (cols.includes(c) && !obj[c]) err(`${obj._label}: "${c}" is empty`);
    for (const [col, re] of Object.entries(ID_PATTERNS)) {
      if (obj[col] && !re.test(obj[col])) err(`${obj._label}: ${col} "${obj[col]}" is not in the right format (${FORMAT_HINT[col]})`);
    }
    return obj;
  });
}

function indexUnique(name, rows, key) {
  const map = new Map();
  for (const r of rows) {
    if (!r[key]) continue;
    if (map.has(r[key])) err(`${r._label}: ${key} "${r[key]}" is used twice (first in row ${map.get(r[key])._line})`);
    else map.set(r[key], r);
  }
  return map;
}

function checkRef(name, r, col, map, target) {
  if (r[col] && !map.has(r[col])) err(`${r._label}: ${col} "${r[col]}" not found on the ${target} tab`);
}

function checkDuplicatePairs(name, rows, a, b) {
  const seen = new Set();
  for (const r of rows) {
    const k = `${r[a]}|${r[b]}`;
    if (seen.has(k)) warn(`${r._label}: duplicate link ${r[a]} -> ${r[b]}`);
    seen.add(k);
  }
}

// ---- Load
await loadWorkbook();
const t = Object.fromEntries(Object.keys(SCHEMA).map((n) => [n, loadTable(n)]));

// ---- Unique IDs
const textbooks = indexUnique("textbooks", t.textbooks, "textbook_id");
const chapters = indexUnique("chapters", t.chapters, "chapter_id");
const topics = indexUnique("topics", t.topics, "topic_id");
const standards = indexUnique("standards", t.standards, "standard_id");

// Duplicate topic names (case-insensitive) are probably mistakes
const names = new Map();
for (const r of t.topics) {
  const k = r.topic_name?.toLowerCase();
  if (!k) continue;
  if (names.has(k)) warn(`${r._label}: topic name "${r.topic_name}" is also used by ${names.get(k)}`);
  else names.set(k, r.topic_id);
}

// ---- References
for (const r of t.chapters) {
  checkRef("chapters", r, "textbook_id", textbooks, "textbooks");
  if (r.chapter_id && r.textbook_id && !r.chapter_id.startsWith(r.textbook_id + "-"))
    warn(`${r._label}: chapter_id "${r.chapter_id}" does not start with its textbook_id "${r.textbook_id}"`);
}
for (const r of t.topic_chapters) {
  checkRef("topic_chapters", r, "topic_id", topics, "topics");
  checkRef("topic_chapters", r, "chapter_id", chapters, "chapters");
  if (!r.relevance) r.relevance = "primary";
  if (!["primary", "secondary"].includes(r.relevance))
    err(`${r._label}: relevance must be "primary" or "secondary", got "${r.relevance}"`);
}
for (const r of t.topic_standards) {
  checkRef("topic_standards", r, "topic_id", topics, "topics");
  checkRef("topic_standards", r, "standard_id", standards, "standards");
}
checkDuplicatePairs("topic_chapters", t.topic_chapters, "topic_id", "chapter_id");
checkDuplicatePairs("topic_standards", t.topic_standards, "topic_id", "standard_id");

// ---- Coverage warnings
const linkedTopicsCh = new Set(t.topic_chapters.map((r) => r.topic_id));
const linkedTopicsSt = new Set(t.topic_standards.map((r) => r.topic_id));
for (const id of topics.keys()) {
  if (!linkedTopicsCh.has(id)) warn(`topic ${id} has no linked chapters`);
  if (!linkedTopicsSt.has(id)) warn(`topic ${id} has no linked SHAPE standard`);
}
const usedTextbooks = new Set(t.chapters.map((r) => r.textbook_id));
for (const id of textbooks.keys()) if (!usedTextbooks.has(id)) warn(`textbook ${id} has no chapters`);

// ---- Report
for (const w of warnings) console.log(`WARNING  ${w}`);
for (const e of errors) console.log(`ERROR    ${e}`);
console.log(
  `\n${t.textbooks.length} textbooks, ${t.chapters.length} chapters, ${t.topics.length} topics, ` +
  `${t.standards.length} standards, ${t.topic_chapters.length} topic-chapter links, ${t.topic_standards.length} topic-standard links`
);
console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
if (errors.length) { console.log("\nNo JSON written. Fix the errors above and run again."); process.exit(1); }

// ---- Build JSON (topics carry their links so the app needs no joins)
const strip = ({ _line, _label, ...rest }) => rest;
const num = (v) => (v === "" || v === undefined ? null : Number.isNaN(Number(v)) ? v : Number(v));

const dataset = {
  datasetVersion: "",
  textbooks: t.textbooks.map((r) => ({ ...strip(r), edition: num(r.edition), year: num(r.year) })),
  chapters: t.chapters.map((r) => ({ ...strip(r), chapter_no: num(r.chapter_no) })),
  standards: t.standards.map(strip),
  topics: t.topics.map((r) => ({
    ...strip(r),
    keywords: (r.keywords ?? "").split(";").map((k) => k.trim()).filter(Boolean),
    chapters: t.topic_chapters.filter((l) => l.topic_id === r.topic_id).map((l) => ({ chapter_id: l.chapter_id, relevance: l.relevance })),
    standards: t.topic_standards.filter((l) => l.topic_id === r.topic_id).map((l) => l.standard_id),
  })),
};

// Keep the previous version label when the content hasn't changed, so rebuilds don't bump it.
let previous = null;
try { previous = JSON.parse(fs.readFileSync(outFile, "utf8")); } catch { /* first build */ }
const sameContent = previous && JSON.stringify({ ...previous, datasetVersion: "" }) === JSON.stringify(dataset);
dataset.datasetVersion = sameContent ? previous.datasetVersion : new Date().toISOString().slice(0, 10);

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(dataset, null, 2) + "\n");
console.log(`\n${sameContent ? "No content changes" : "Updated"}: wrote ${path.relative(process.cwd(), outFile) || outFile} (data set version ${dataset.datasetVersion})`);
