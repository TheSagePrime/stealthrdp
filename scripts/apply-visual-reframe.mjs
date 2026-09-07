#!/usr/bin/env node
/**
 * Inject the visual-only reframe stylesheet into prerendered HTML.
 * This deliberately does not alter visible copy, metadata, schema, links, or data.
 */
import fs from "fs";
import path from "path";

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const LINK = '  <link rel="stylesheet" href="/css/visual-reframe.css?v=2026-09-07-v1" />';
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
  const html = fs.readFileSync(file, "utf8");
  if (html.includes('/css/visual-reframe.css')) continue;
  if (!html.includes("</head>")) continue;
  fs.writeFileSync(file, html.replace("</head>", `${LINK}\n</head>`));
  changed += 1;
}

console.log(`apply-visual-reframe: injected stylesheet into ${changed} HTML files`);
