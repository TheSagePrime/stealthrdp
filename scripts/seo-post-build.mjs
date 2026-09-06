#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, "public");
const expectedBase = String(process.env.SRDP_BASE || "https://www.stealthrdp.com").replace(/\/+$/, "");

process.env.SEO_AUDIT_ROOT = process.env.SEO_AUDIT_ROOT || "public";
process.env.SEO_EXPECTED_BASE = process.env.SEO_EXPECTED_BASE || expectedBase;

await import("./seo-gates.mjs");

const failures = [];
const fail = (message) => failures.push(message);
const cleanRootRoutes = new Set(["docs", "blog", "plans", "status", "faq", "about", "privacy"]);

function htmlFiles(dir = PUBLIC) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(PUBLIC, file).replaceAll(path.sep, "/");
}

function first(html, expression) {
  return (html.match(expression) || [])[1] || "";
}

function canonicalPathFor(fileName) {
  if (fileName === "index.html") return "/";
  if (fileName.endsWith("/index.html")) return `/${fileName.slice(0, -"index.html".length)}`;
  if (!fileName.includes("/") && fileName.endsWith(".html")) {
    const stem = fileName.slice(0, -5);
    if (cleanRootRoutes.has(stem)) return `/${stem}`;
  }
  if (fileName.startsWith("docs/") && fileName.endsWith(".html")) return `/${fileName.slice(0, -5)}`;
  return `/${fileName}`;
}

const sitemapFile = path.join(PUBLIC, "sitemap.xml");
if (!fs.existsSync(sitemapFile)) {
  fail("public/sitemap.xml is missing after staging");
} else {
  const sitemap = fs.readFileSync(sitemapFile, "utf8");
  const sitemapLocs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  const indexableCanonicals = new Map();

  for (const file of htmlFiles()) {
    const name = rel(file);
    const html = fs.readFileSync(file, "utf8");
    const canonical = first(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i).trim();
    const robots = first(html, /<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i).toLowerCase();
    const expectedCanonical = `${expectedBase}${canonicalPathFor(name)}`;

    if (canonical !== expectedCanonical) {
      fail(`${name}: final canonical ${canonical || "missing"}, expected ${expectedCanonical}`);
    }

    const indexable = name !== "404.html" && !robots.includes("noindex");
    if (!indexable) {
      if (canonical && sitemapLocs.has(canonical)) fail(`${name}: noindex/404 canonical appears in sitemap`);
      continue;
    }

    if (indexableCanonicals.has(canonical)) {
      fail(`${name}: duplicate final canonical with ${indexableCanonicals.get(canonical)}`);
    } else {
      indexableCanonicals.set(canonical, name);
    }

    if (!sitemapLocs.has(canonical)) fail(`${name}: indexable canonical missing from final sitemap (${canonical})`);
  }

  for (const loc of sitemapLocs) {
    if (!indexableCanonicals.has(loc)) fail(`sitemap.xml: ${loc} has no matching indexable staged HTML page`);
  }
}

if (failures.length) {
  console.error(`Final SEO artifact validation failed with ${failures.length} issue(s):`);
  for (const issue of failures) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("Final SEO artifact canonical/sitemap parity passed.");
