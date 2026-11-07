#!/usr/bin/env node
// Checks the standards workbook and converts it into the JSON file the website loads.
// Runs automatically before every build (npm "prebuild"), so a bad spreadsheet stops the deploy
// and the live site keeps its previous data.
//
// Usage:  node scripts/build-dataset.mjs [workbook.xlsx] [outFile]
// Defaults: dataset/PETE_dataset_template.xlsx -> public/data/dataset.json
// Columns whose header starts with "(" are helper columns and are ignored.

import fs from "node:fs";
import path from "node:path";
import readXlsxFile from "read-excel-file/node";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const source = path.resolve(process.argv[2] ?? path.join(root, "dataset/PETE_dataset_template.xlsx"));
const outFile = path.resolve(process.argv[3] ?? path.join(root, "public/data/dataset.json"));

const SCHEMA = {
  standards: { required: ["standard_id", "standard_no", "title"], optional: ["description"] },
  components: { required: ["component_id", "standard_id", "label"], optional: ["text"] },
};
const PATTERNS = {
  standard_id: [/^S\d+$/, "e.g. S3"],
  component_id: [/^\d+\.[a-z]$/, "e.g. 3.b"],
};

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const cellText = (v) => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

let workbook = {};
if (!fs.existsSync(source)) err(`Spreadsheet not found: ${source}`);
else {
  try {
    const sheets = await readXlsxFile(source);
    workbook = Object.fromEntries(sheets.map((s) => [s.sheet.trim(), s.data.map((r) => r.map(cellText))]));
  } catch (e) {
    err(`Could not read the spreadsheet (${e.message}). Save it as an Excel .xlsx file and try again.`);
  }
}

function loadTable(name) {
  const all = workbook[name];
  if (!all) {
    if (fs.existsSync(source)) err(`Tab "${name}" is missing from the spreadsheet (tab names must stay exactly as they are)`);
    return [];
  }
  const [header = [], ...rows] = all;
  const keep = header.map((h, i) => ({ h: String(h ?? "").trim(), i })).filter(({ h }) => h && !h.startsWith("("));
  const cols = keep.map(({ h }) => h);
  const { required, optional } = SCHEMA[name];
  for (const c of required) if (!cols.includes(c)) err(`${name}: missing required column "${c}" in row 1`);
  for (const c of cols) if (![...required, ...optional].includes(c)) warn(`${name}: unknown column "${c}" (ignored)`);

  return rows
    .map((r, i) => ({ r, line: i + 2 }))
    .filter(({ r }) => keep.some(({ i }) => String(r[i] ?? "").trim() !== ""))
    .map(({ r, line }) => {
      const obj = { _label: `${name} row ${line}`, _line: line };
      keep.forEach(({ h, i }) => (obj[h] = String(r[i] ?? "").trim()));
      for (const c of required) if (cols.includes(c) && !obj[c]) err(`${obj._label}: "${c}" is empty`);
      for (const [col, [re, hint]] of Object.entries(PATTERNS))
        if (obj[col] && !re.test(obj[col])) err(`${obj._label}: ${col} "${obj[col]}" is not in the right format (${hint})`);
      return obj;
    });
}

const standards = loadTable("standards");
const components = loadTable("components");

const byId = new Map();
for (const s of standards) {
  if (byId.has(s.standard_id)) err(`${s._label}: standard_id "${s.standard_id}" is used twice (first in row ${byId.get(s.standard_id)._line})`);
  else byId.set(s.standard_id, s);
  if (s.standard_id && s.standard_no && s.standard_id !== "S" + s.standard_no) warn(`${s._label}: standard_id "${s.standard_id}" doesn't match standard_no ${s.standard_no}`);
}
const seen = new Map();
for (const c of components) {
  if (seen.has(c.component_id)) err(`${c._label}: component_id "${c.component_id}" is used twice (first in row ${seen.get(c.component_id)._line})`);
  else seen.set(c.component_id, c);
  if (c.standard_id && !byId.has(c.standard_id)) err(`${c._label}: standard_id "${c.standard_id}" not found on the standards tab`);
  else if (c.component_id && c.standard_id && c.component_id.split(".")[0] !== byId.get(c.standard_id)?.standard_no)
    warn(`${c._label}: component ${c.component_id} is listed under ${c.standard_id}`);
  if (!c.text) warn(`${c._label}: component ${c.component_id} has no full text`);
}
for (const s of standards) if (!components.some((c) => c.standard_id === s.standard_id)) warn(`standard ${s.standard_id} has no components`);

for (const w of warnings) console.log(`WARNING  ${w}`);
for (const e of errors) console.log(`ERROR    ${e}`);
console.log(`\n${standards.length} standards, ${components.length} components`);
console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
if (errors.length) {
  console.log("\nNo JSON written. Fix the errors above and run again.");
  process.exit(1);
}

const order = (a, b) => a.component_id.localeCompare(b.component_id, undefined, { numeric: true });
const dataset = {
  datasetVersion: "",
  source: "SHAPE America (2017). National Standards for Initial Physical Education Teacher Education.",
  standards: standards.map((s) => ({ standard_id: s.standard_id, standard_no: s.standard_no, title: s.title, description: s.description ?? "" })),
  components: [...components].sort(order).map((c) => ({ component_id: c.component_id, standard_id: c.standard_id, label: c.label, text: c.text ?? "" })),
};

// Keep the previous version label when the content hasn't changed.
let previous = null;
try {
  previous = JSON.parse(fs.readFileSync(outFile, "utf8"));
} catch {
  /* first build */
}
const sameContent = previous && JSON.stringify({ ...previous, datasetVersion: "" }) === JSON.stringify(dataset);
dataset.datasetVersion = sameContent ? previous.datasetVersion : new Date().toISOString().slice(0, 10);

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(dataset, null, 2) + "\n");
console.log(`\n${sameContent ? "No content changes" : "Updated"}: wrote ${path.relative(process.cwd(), outFile) || outFile} (data set version ${dataset.datasetVersion})`);
