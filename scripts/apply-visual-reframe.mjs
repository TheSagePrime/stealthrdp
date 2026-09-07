#!/usr/bin/env node
/**
 * Inject the preview UX/behavior system into generated/static HTML.
 * Existing visible copy, metadata, schema, links, pricing and data are not rewritten.
 */
import fs from "fs";
import path from "path";

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const LINK = '  <link rel="stylesheet" href="/css/visual-reframe-v5.css?v=2026-09-08-v5" />';
const GUIDE_SCRIPT = '  <script defer src="/js/os-guide-flow.js?v=2026-09-08-v3"></script>';
const BEHAVIOR_SCRIPT = '  <script defer src="/js/behavior-system.js?v=2026-09-08-v5"></script>';
const SKIP_DIRS = new Set([".git", "node_modules", "public"]);

function collectHtml(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectHtml(full, out);
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

let changed = 0;
for (const file of collectHtml(ROOT)) {
  let html = fs.readFileSync(file, "utf8");
  if (!html.includes("</head>")) continue;

  // Remove older preview-only layers before inserting the current version.
  html = html.replace(/\s*<link rel="stylesheet" href="\/css\/visual-reframe(?:-v2|-v3|-v4|-v5)?\.css[^>]*>\s*/g, "\n");
  html = html.replace(/\s*<script defer src="\/js\/(?:os-guide-flow|behavior-system)\.js[^>]*><\/script>\s*/g, "\n");
  html = html.replace("</head>", `${LINK}\n${GUIDE_SCRIPT}\n${BEHAVIOR_SCRIPT}\n</head>`);
  fs.writeFileSync(file, html);
  changed += 1;
}

console.log(`apply-visual-reframe: applied behavioral v5 to ${changed} HTML files`);
