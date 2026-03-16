import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } from "docx";

const ROOT_DIR = path.resolve(process.cwd(), "repository");
const OUT_DIR = path.resolve(process.cwd(), "exports");

const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "out",
  "coverage",
  ".turbo",
  ".vercel",
]);

const EXCLUDE_FILES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);

const INCLUDE_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".txt",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".html",
  ".yml",
  ".yaml",
  ".env",
  ".example",
  ".sql",
  ".prisma",
  ".graphql",
  ".gql",
  ".sh",
  ".ps1",
  ".bat",
  ".cmd",
  ".ini",
  ".toml",
  ".xml",
  ".csv",
]);

function isExcludedByDir(filePath) {
  const parts = filePath.split(path.sep);
  for (const p of parts) {
    if (EXCLUDE_DIRS.has(p)) return true;
  }
  return false;
}

function isProbablyText(filePath) {
  const base = path.basename(filePath);
  if (EXCLUDE_FILES.has(base)) return false;

  const ext = path.extname(filePath).toLowerCase();
  if (INCLUDE_EXTS.has(ext)) return true;

  if (!ext) {
    const low = base.toLowerCase();
    if (low === ".env" || low.startsWith(".env.")) return true;
  }

  return false;
}

function walkFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (isExcludedByDir(full)) continue;

    if (ent.isDirectory()) {
      out.push(...walkFiles(full));
      continue;
    }

    if (ent.isFile() && isProbablyText(full)) out.push(full);
  }

  return out.sort((a, b) => a.localeCompare(b));
}

function safeReadUtf8(filePath, maxBytes = 2_000_000) {
  const st = fs.statSync(filePath);
  if (st.size > maxBytes) {
    return { text: null, note: `SKIP (too large: ${st.size} bytes)` };
  }

  const buf = fs.readFileSync(filePath);
  let text = null;
  let note = null;

  try {
    text = buf.toString("utf8");
  } catch {
    text = buf.toString("utf8");
    note = "WARN (utf8 with replacement)";
  }

  return { text, note };
}

function codeParagraph(line) {
  return new Paragraph({
    children: [
      new TextRun({
        text: line,
        font: "Consolas",
        size: 18,
      }),
    ],
    spacing: { before: 0, after: 0 },
  });
}

function heading(text, level) {
  return new Paragraph({
    text,
    heading: level,
  });
}

function normal(text) {
  return new Paragraph({
    children: [new TextRun({ text })],
  });
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

async function main() {
  if (!fs.existsSync(ROOT_DIR) || !fs.statSync(ROOT_DIR).isDirectory()) {
    throw new Error("Folder 'repository' tidak ditemukan di current directory.");
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = walkFiles(ROOT_DIR);
  const stamp = nowStamp();
  const outPath = path.join(OUT_DIR, `repository-full-${stamp}.docx`);

  const children = [];

  children.push(heading("Repository Export (Full Content)", HeadingLevel.TITLE));
  children.push(normal(`Root: ${toPosix(path.relative(process.cwd(), ROOT_DIR))}`));
  children.push(normal(`Generated: ${new Date().toISOString()}`));
  children.push(normal(`Total files included: ${files.length}`));

  children.push(heading("Table of Contents (Paths)", HeadingLevel.HEADING_1));
  for (const f of files) {
    children.push(normal(toPosix(path.relative(process.cwd(), f))));
  }

  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading("Files", HeadingLevel.HEADING_1));

  for (const f of files) {
    const rel = toPosix(path.relative(process.cwd(), f));
    children.push(heading(rel, HeadingLevel.HEADING_2));

    const { text, note } = safeReadUtf8(f);
    if (note) children.push(normal(note));
    if (text == null) {
      children.push(normal(""));
      continue;
    }

    const lines = text.split(/\r?\n/);
    for (const line of lines) children.push(codeParagraph(line));
    children.push(normal(""));
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buf);
  process.stdout.write(`${outPath}\n`);
}

main().catch((e) => {
  process.stderr.write(`${e?.message || String(e)}\n`);
  process.exit(1);
});