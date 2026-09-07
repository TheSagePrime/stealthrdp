#!/usr/bin/env node
/**
 * Inject the preview UX/behavior system into generated/static HTML.
 * Existing visible copy, metadata, schema, links, pricing and data are not rewritten.
 */
import fs from "fs";
import path from "path";

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const LINK = '  <link rel="stylesheet" href="/css/visual-reframe-v10.css?v=2026-09-08-v10" />';
const GUIDE_SCRIPT = '  <script defer src="/js/os-guide-flow.js?v=2026-09-08-v3"></script>';
const BEHAVIOR_SCRIPT = '  <script defer src="/js/behavior-system-v8.js?v=2026-09-08-v8"></script>';
const OS_DEMO_SCRIPT = '  <script defer src="/js/os-reference-demo-v8.js?v=2026-09-08-v8"></script>';
const OS_V10_SCRIPT = '  <script defer src="/js/os-reference-demo-v10.js?v=2026-09-08-v10"></script>';
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

  html = html.replace(/\s*<link rel="stylesheet" href="\/css\/visual-reframe(?:-v2|-v3|-v4|-v5|-v6|-v7|-v8|-v9|-v10)?\.css[^>]*>\s*/g, "\n");
  html = html.replace(/\s*<script defer src="\/js\/(?:os-guide-flow|behavior-system(?:-v8)?|os-reference-demo-v8|os-reference-demo-v9|os-reference-demo-v10)\.js[^>]*><\/script>\s*/g, "\n");
  html = html.replace("</head>", `${LINK}\n${GUIDE_SCRIPT}\n${BEHAVIOR_SCRIPT}\n${OS_DEMO_SCRIPT}\n${OS_V10_SCRIPT}\n</head>`);
  fs.writeFileSync(file, html);
  changed += 1;
}

console.log(`apply-visual-reframe: applied exact Win11 + rectangular OS v10 to ${changed} HTML files`);
