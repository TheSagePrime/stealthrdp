#!/usr/bin/env node
/**
 * Import the verified StealthRDP documentation snapshot into the native docs
 * data artifact. The source snapshot is intentionally external to the site;
 * set DOCS_SOURCE when running this importer in another checkout.
 */
import fs from "node:fs";
import path from "node:path";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_SOURCE = path.resolve(ROOT, "../cache/stealthrdp-chatwoot-articles-20260813.json");
const SOURCE_PATH = process.env.DOCS_SOURCE || DEFAULT_SOURCE;
const OUTPUT_PATH = path.join(ROOT, "data", "docs-articles.json");
const MIGRATION_DATE = "2026-08-13";
const SOURCE_LABEL = "Verified StealthRDP documentation snapshot";
const EXAMPLE_IP = "123.456.78.9";

const CATEGORY_BY_SOURCE = {
  "windows-server": "Windows",
  "vpn-setup": "VPN and networking",
  "installing-web-panels": "Web panels",
  "basic-web-hosting-tutorials": "Web panels",
  "terms-and-conditions": "Terms and policies",
  faqs: "Account and billing",
  "stealthrdp-server-essentials": "Server management",
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function cleanTitle(title) {
  return String(title || "")
    .replace(/\s*\|\s*Stealth\s+RDP\s+Docs\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugFromUrl(url) {
  const match = String(url || "").match(/\/articles\/([^/?#\s)]+)/i);
  return match ? match[1] : "";
}

function categoryFromContent(content) {
  const match = String(content || "").match(/\/categories\/([^\s)]+)/i);
  return CATEGORY_BY_SOURCE[match ? match[1].toLowerCase() : ""] || "Getting started";
}

function dateFromContent(content) {
  const match = String(content || "").match(/Last updated on\s+([^\n]+)/i);
  return match ? match[1].trim() : "Date not provided";
}

function removeSourceBreadcrumb(content) {
  const lines = String(content || "").replace(/\r\n?/g, "\n").split("\n");
  let index = 0;
  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (!trimmed || /^\[[^\]]+\]\(https:\/\/docs\.stealthrdp\.com\//i.test(trimmed)) {
      index += 1;
      continue;
    }
    break;
  }
  return lines.slice(index).join("\n");
}

function firstParagraph(content, title) {
  const blocks = String(content).split(/\n\s*\n/);
  for (const block of blocks) {
    const text = block
      .replace(/^#{1,6}\s+/, "")
      .replace(/^[=-]{3,}\s*$/gm, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .replace(/^Last updated on.*$/im, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text && text.toLowerCase() !== title.toLowerCase() && !/^\[[^\]]+\]$/.test(text)) {
      return text.length > 220 ? `${text.slice(0, 217).trimEnd()}…` : text;
    }
  }
  return `Verified source article: ${title}.`;
}

function sanitizeContent(content, urlToSlug) {
  let result = removeSourceBreadcrumb(content)
    .replace(/\[#\]\([^)]*\)/g, "")
    .replace(new RegExp(EXAMPLE_IP.replaceAll(".", "\\."), "g"), "[redacted example endpoint]");

  result = result.replace(/\[([^\]]+)\]\((https:\/\/docs\.stealthrdp\.com\/[^)]+)\)/gi, (full, label, target) => {
    const cleanTarget = target.split(/\s+["']/)[0].trim();
    const slug = urlToSlug.get(cleanTarget.split("#")[0]);
    return slug ? `[${label}](/docs/${slug}.html)` : label;
  });

  result = result.replace(/https:\/\/docs\.stealthrdp\.com\/[^\s)]+/gi, (target) => {
    const slug = urlToSlug.get(target.split("#")[0]);
    return slug ? `/docs/${slug}.html` : "documentation page";
  });

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

const source = readJson(SOURCE_PATH);
if (!Array.isArray(source) || source.length === 0) {
  throw new Error(`Expected a non-empty article array in ${SOURCE_PATH}`);
}

const urlToSlug = new Map(source.map((article) => [String(article.url || "").split("#")[0], slugFromUrl(article.url)]));
const articles = source.map((article) => {
  const title = cleanTitle(article.title);
  const rawContent = String(article.content || "");
  const content = sanitizeContent(rawContent, urlToSlug);
  const sourceUrl = String(article.url || "");
  const relatedSlugs = [...new Set(
    [...rawContent.matchAll(/https:\/\/docs\.stealthrdp\.com\/[^\s)]+/gi)]
      .map((match) => urlToSlug.get(match[0].split("#")[0]))
      .filter((slug) => slug && slug !== slugFromUrl(sourceUrl)),
  )];

  return {
    slug: slugFromUrl(sourceUrl),
    title,
    category: categoryFromContent(rawContent),
    date: dateFromContent(rawContent),
    sourceTitle: title,
    sourceUrl,
    migration: {
      source: SOURCE_LABEL,
      date: MIGRATION_DATE,
      redactions: ["example endpoint placeholder redacted"],
    },
    summary: firstParagraph(content, title),
    relatedSlugs,
    content,
  };
});

if (articles.some((article) => !article.slug || !article.title || !article.content)) {
  throw new Error("Every imported article must have a slug, title, and content");
}
if (articles.some((article) => article.content.includes("docs.stealthrdp.com") || article.content.includes(EXAMPLE_IP))) {
  throw new Error("Sanitization failed: source-host links or example IP remain in article content");
}

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(articles, null, 2)}\n`);
console.log(`Imported ${articles.length} verified articles from ${SOURCE_PATH}`);
console.log(`Wrote ${OUTPUT_PATH}`);
