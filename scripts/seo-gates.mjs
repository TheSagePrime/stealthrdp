#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { BASE_TOKEN, checkAiDiscovery } = require("../lib/ai-discovery.js");

const ROOT = process.cwd();
const AUDIT_ROOT = path.resolve(ROOT, process.env.SEO_AUDIT_ROOT || ".");
const expectedBase = String(process.env.SEO_EXPECTED_BASE || BASE_TOKEN).replace(/\/+$/, "");
const expectedPrefix = `${expectedBase}/`;
const finalArtifact = AUDIT_ROOT !== path.resolve(ROOT);
const changedOnly = process.env.SEO_CHANGED_ONLY === "1";
const changedFiles = changedOnly
  ? new Set(execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean))
  : null;
const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const redirectSources = new Set((vercelConfig.redirects || []).map((item) => item.source));
const allowedNoindexFiles = new Set([
  "404.html",
  "privacy.html",
  "docs/payment-terms.html",
  "docs/use-of-service.html",
  "docs/termination-of-service.html",
  "docs/user-responsibilities.html",
  "docs/how-to-reset-server-change-or-reset-client-area-password.html",
  "docs/server-stops-randomly.html",
]);
const failures = [];
const warn = [];
const fail = (message) => failures.push(message);
const read = (file) => fs.readFileSync(file, "utf8");
const rel = (file) => path.relative(AUDIT_ROOT, file).replaceAll(path.sep, "/");
const isChanged = (file) => !changedFiles || changedFiles.has(rel(file));

function htmlFiles(dir = AUDIT_ROOT) {
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", "public", "backups", "data"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...htmlFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".html")) output.push(full);
  }
  return output;
}

function seoArtifactFiles(dir = AUDIT_ROOT) {
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", "backups", "data"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...seoArtifactFiles(full));
    else if (entry.isFile() && /\.(?:html|xml|txt|webmanifest)$/.test(entry.name)) output.push(full);
  }
  return output;
}

function first(html, expression) {
  return (html.match(expression) || [])[1] || "";
}

function hrefTargets(html) {
  return [...html.matchAll(/\bhref\s*=\s*["']([^"'#]+)(?:#[^"']*)?["']/gi)]
    .map((match) => match[1])
    .filter((href) => href.startsWith("/"));
}

function resolveLocal(href) {
  const clean = href.split("?")[0];
  if (clean === "/") return path.join(AUDIT_ROOT, "index.html");
  const candidate = path.join(AUDIT_ROOT, clean.replace(/^\//, ""));
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  if (fs.existsSync(`${candidate}.html`)) return `${candidate}.html`;
  if (fs.existsSync(path.join(candidate, "index.html"))) return path.join(candidate, "index.html");
  return null;
}

function validateKeywordMap() {
  const file = path.join(ROOT, "seo", "keyword-map.json");
  if (!fs.existsSync(file)) {
    fail("seo/keyword-map.json: missing");
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(read(file));
  } catch {
    fail("seo/keyword-map.json: invalid JSON");
    return;
  }

  const pages = Array.isArray(parsed.pages) ? parsed.pages : [];
  const required = ["/", "/plans", "/windows-vps/", "/linux-vps/"];
  const byPath = new Map();
  for (const page of pages) {
    if (!page || typeof page.path !== "string") {
      fail("seo/keyword-map.json: page entry missing path");
      continue;
    }
    if (byPath.has(page.path)) fail(`seo/keyword-map.json: duplicate page path ${page.path}`);
    byPath.set(page.path, page);
  }
  for (const route of required) {
    if (!byPath.has(route)) fail(`seo/keyword-map.json: core commercial route missing ${route}`);
  }

  const primaryOwners = new Map();
  for (const page of pages) {
    const keyword = typeof page.primaryKeyword === "string" ? page.primaryKeyword.trim().toLowerCase() : "";
    if (!keyword) continue;
    if (primaryOwners.has(keyword)) fail(`seo/keyword-map.json: primary keyword "${keyword}" assigned to both ${primaryOwners.get(keyword)} and ${page.path}`);
    primaryOwners.set(keyword, page.path);
  }

  for (const route of required) {
    const page = byPath.get(route);
    if (page && !String(page.primaryKeyword || "").trim()) warn.push(`${route}: keyword research pending in seo/keyword-map.json`);
  }
}

if (!fs.existsSync(AUDIT_ROOT) || !fs.statSync(AUDIT_ROOT).isDirectory()) {
  fail(`audit root does not exist: ${AUDIT_ROOT}`);
}
if (finalArtifact && expectedBase === BASE_TOKEN) fail("final artifact audit requires a baked SEO_EXPECTED_BASE");
if (finalArtifact && !/^https:\/\//i.test(expectedBase)) fail(`final artifact base must be HTTPS: ${expectedBase}`);
validateKeywordMap();

const files = failures.length && !fs.existsSync(AUDIT_ROOT) ? [] : htmlFiles();
const canonicals = new Map();
const routes = new Set(files.map(rel));

for (const file of files) {
  const name = rel(file);
  const html = read(file);
  const is404 = name === "404.html";
  const title = first(html, /<title[^>]*>([\s\S]*?)<\/title>/i).trim();
  const description = first(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i).trim();
  const canonical = first(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i).trim();
  const robots = first(html, /<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i).toLowerCase();
  const h1Count = (html.match(/<h1(?:\s|>)/gi) || []).length;
  const mainHtml = (html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i) || [html.replace(/<footer\b[^>]*class=["']footer["'][\s\S]*?<\/footer>/i, "")])[0];
  const headings = [...mainHtml.matchAll(/<h([1-6])(?:\s|>)/gi)].map((match) => Number(match[1]));
  const schemas = [...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  const visibleText = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  if (!title || title.length < 10 || title.length > 70) fail(`${name}: title length is ${title.length}`);
  if (!is404 && (!description || description.length < 70 || description.length > 170)) fail(`${name}: meta description length is ${description.length}`);
  if (!is404 && h1Count !== 1) fail(`${name}: expected one H1, found ${h1Count}`);
  if (!canonical || !canonical.startsWith(expectedPrefix)) fail(`${name}: invalid canonical ${canonical || "missing"}`);
  if (!allowedNoindexFiles.has(name) && robots.includes("noindex")) fail(`${name}: indexable page has noindex`);
  if (allowedNoindexFiles.has(name) && !robots.includes("noindex")) fail(`${name}: expected noindex`);
  if (!is404 && schemas.length === 0) fail(`${name}: missing JSON-LD`);
  if (canonical) {
    const route = name === "index.html" ? "/" : `/${name}`;
    if (redirectSources.has(route)) {
      // Legacy redirect sources may retain the destination's canonical.
    } else if (canonicals.has(canonical)) fail(`${name}: duplicate canonical with ${canonicals.get(canonical)}`);
    else canonicals.set(canonical, name);
  }
  if (isChanged(file)) {
    for (let i = 1; i < headings.length; i += 1) {
      const legacyCardHeading = headings[i - 1] === 1 && headings[i] === 3;
      if (headings[i] > headings[i - 1] + 1 && !legacyCardHeading) fail(`${name}: heading jumps H${headings[i - 1]} to H${headings[i]}`);
    }
    for (const image of html.matchAll(/<img\b[^>]*>/gi)) {
      const alt = first(image[0], /\balt\s*=\s*["']([^"']*)["']/i).trim();
      if (!alt) fail(`${name}: image without useful alt text`);
    }
    if (/\b(?:TODO|TBD|PLACEHOLDER|LOREM IPSUM)\b/i.test(visibleText)) fail(`${name}: placeholder text remains`);
  }
  for (const href of hrefTargets(html)) {
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(href)) continue;
    if (!resolveLocal(href)) fail(`${name}: broken internal link ${href}`);
  }
  for (const block of schemas) {
    try {
      const parsed = JSON.parse(block);
      if (parsed["@context"] !== "https://schema.org") fail(`${name}: schema missing schema.org context`);
    } catch {
      fail(`${name}: invalid JSON-LD`);
    }
  }
}

const sitemap = path.join(AUDIT_ROOT, "sitemap.xml");
if (!fs.existsSync(sitemap)) fail("sitemap.xml: missing");
else {
  const locs = [...read(sitemap).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  if (new Set(locs).size !== locs.length) fail("sitemap.xml: duplicate loc values");
  for (const loc of locs) {
    if (!loc.startsWith(expectedPrefix)) fail(`sitemap.xml: non-canonical loc ${loc}`);
    const route = loc.replace(expectedBase, "");
    if (redirectSources.has(route)) fail(`sitemap.xml: redirect source ${route}`);
    if (/^\/docs\/\d{10}-|^\/docs\/[^?]*_|^\/(?:docs|blog|plans|status|faq|about|privacy)\.html$/.test(route)) fail(`sitemap.xml: legacy route ${route}`);
  }
}

const robotsFile = path.join(AUDIT_ROOT, "robots.txt");
if (!fs.existsSync(robotsFile)) fail("robots.txt: missing");
else {
  const robots = read(robotsFile);
  if (!robots.includes(`Sitemap: ${expectedBase}/sitemap.xml`)) fail("robots.txt: sitemap reference missing");
  if (!/^User-agent:\s*\*/m.test(robots)) fail("robots.txt: wildcard user-agent missing");
}

try {
  for (const issue of checkAiDiscovery({ root: AUDIT_ROOT, base: expectedBase })) fail(issue);
} catch (error) {
  fail(`AI discovery files unreadable: ${error.message}`);
}

if (finalArtifact) {
  for (const file of seoArtifactFiles()) {
    if (read(file).includes(BASE_TOKEN)) fail(`${rel(file)}: unresolved ${BASE_TOKEN} token in final artifact`);
  }
}

if (routes.size === 0) fail("routes: no HTML routes found");
if (failures.length) {
  console.error(`SEO gates failed with ${failures.length} issue(s):`);
  for (const issue of failures) console.error(`- ${issue}`);
  process.exit(1);
}
console.log(`SEO gates passed for ${files.length} HTML routes in ${path.relative(ROOT, AUDIT_ROOT) || "."}.`);
if (warn.length) for (const item of warn) console.warn(`Warning: ${item}`);
