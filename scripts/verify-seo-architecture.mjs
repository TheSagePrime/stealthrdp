#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/\/scripts$/, "");
const base = process.argv[2] || "http://127.0.0.1:4173";
const origin = "https://www.stealthrdp.com";
const headers = { "X-Forwarded-Host": "www.stealthrdp.com" };
const docs = JSON.parse(fs.readFileSync(path.join(ROOT, "data/docs-articles.json"), "utf8"));
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const cleanSlug = (slug) => slug.replace(/^\d+-/, "").replaceAll("_", "-").toLowerCase();
const cleanDocs = docs.map((article) => `/docs/${cleanSlug(article.slug)}`);
const cleanDocsHtml = cleanDocs.map((route) => `${route}.html`);
const oldDocs = docs.map((article) => `/docs/${article.slug}.html`);
const malformedLegacy = "/docs/1737944563-how-to_re_activate-and-extend-your-180_day-windows-trial.html";
const rootRoutes = ["/", "/docs", "/blog", "/plans", "/status", "/faq", "/about", "/privacy"];
const osRoutes = ["/windows-vps/", "/linux-vps/"];
const noindexRoutes = new Set([
  "/docs/payment-terms",
  "/docs/use-of-service",
  "/docs/termination-of-service",
  "/docs/user-responsibilities",
  "/docs/how-to-reset-server-change-or-reset-client-area-password",
  "/docs/server-stops-randomly",
  "/privacy",
]);
const failures = [];
const canonicalMismatches = [];
let jsonLdBlocks = 0;
let jsonLdErrors = 0;

async function request(route, redirect = "manual") {
  const response = await fetch(new URL(route, base), { headers, redirect });
  return { response, text: await response.text() };
}

function canonical(html) {
  return (html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i) || [])[1] || "";
}

function robots(html) {
  return (html.match(/<meta\s+name="robots"\s+content="([^"]+)"/i) || [])[1] || "";
}

function parseJsonLd(route, html) {
  const blocks = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  if (!blocks.length) failures.push(`${route}: missing JSON-LD`);
  for (const block of blocks) {
    jsonLdBlocks += 1;
    try { JSON.parse(block[1]); } catch (_) {
      jsonLdErrors += 1;
      failures.push(`${route}: invalid JSON-LD`);
    }
  }
}

const sitemapResult = await request("/sitemap.xml");
if (sitemapResult.response.status !== 200) failures.push(`/sitemap.xml: HTTP ${sitemapResult.response.status}`);
const sitemapRoutes = [...sitemapResult.text.matchAll(/<loc>https:\/\/www\.stealthrdp\.com([^<]+)<\/loc>/g)].map((match) => match[1]);
const sitemapStatusCounts = {};
const crawled200 = new Map();

for (const route of new Set([...rootRoutes, ...osRoutes, ...cleanDocs, ...sitemapRoutes])) {
  const result = await request(route);
  if (result.response.status !== 200) failures.push(`${route}: expected 200, got ${result.response.status}`);
  else crawled200.set(route, result.text);
  if (result.response.status === 200) {
    const expected = `${origin}${route}`;
    if (canonical(result.text) !== expected) canonicalMismatches.push({ route, expected, actual: canonical(result.text) });
    parseJsonLd(route, result.text);
  }
}

for (const route of sitemapRoutes) {
  const result = await request(route);
  sitemapStatusCounts[result.response.status] = (sitemapStatusCounts[result.response.status] || 0) + 1;
  if (result.response.status !== 200) failures.push(`sitemap ${route}: HTTP ${result.response.status}`);
  if (/noindex/i.test(robots(result.text))) failures.push(`sitemap ${route}: noindex`);
}

const redirectsBySource = new Map(vercel.redirects.map((item) => [item.source, item]));
for (const [index, route] of oldDocs.entries()) {
  const result = await request(route);
  const expected = `/docs/${cleanSlug(docs[index].slug)}`;
  if (result.response.status !== 308) failures.push(`${route}: expected 308, got ${result.response.status}`);
  if (result.response.headers.get("location") !== expected) failures.push(`${route}: expected ${expected}, got ${result.response.headers.get("location")}`);
}
const malformedResult = await request(malformedLegacy);
if (malformedResult.response.status !== 308) failures.push(`${malformedLegacy}: expected 308, got ${malformedResult.response.status}`);
if (malformedResult.response.headers.get("location") !== "/docs/how-to-re-activate-and-extend-your-180-day-windows-trial") failures.push(`${malformedLegacy}: wrong destination`);

for (const route of cleanDocsHtml) {
  const result = await request(route);
  const expected = route.slice(0, -5);
  if (result.response.status !== 308) failures.push(`${route}: expected 308, got ${result.response.status}`);
  if (result.response.headers.get("location") !== expected) failures.push(`${route}: expected ${expected}, got ${result.response.headers.get("location")}`);
}

for (const route of ["docs", "blog", "plans", "status", "faq", "about", "privacy"]) {
  const result = await request(`/${route}.html`);
  if (result.response.status !== 308) failures.push(`/${route}.html: expected 308, got ${result.response.status}`);
  if (result.response.headers.get("location") !== `/${route}`) failures.push(`/${route}.html: wrong destination`);
}
for (const [source, destination] of [["/windows-vps", "/windows-vps/"], ["/linux-vps", "/linux-vps/"]]) {
  const result = await request(source);
  if (result.response.status !== 308 || result.response.headers.get("location") !== destination) failures.push(`${source}: canonical OS redirect failed`);
}

for (const route of noindexRoutes) {
  const html = crawled200.get(route) || (await request(route)).text;
  if (!/^noindex,\s*follow$/i.test(robots(html))) failures.push(`${route}: expected noindex, follow`);
  if (sitemapRoutes.includes(route)) failures.push(`${route}: noindex route in sitemap`);
}

const home = crawled200.get("/") || "";
const providerOccurrences = (home.match(/the provider/gi) || []).length;
const testimonialCount = (home.match(/<article class="testimonial-card">/g) || []).length;
if (providerOccurrences) failures.push(`homepage: ${providerOccurrences} occurrences of the provider`);
if (testimonialCount < 4 || testimonialCount > 6) failures.push(`homepage: ${testimonialCount} testimonials`);
if (canonicalMismatches.length) failures.push(`${canonicalMismatches.length} canonical mismatches`);

const report = {
  result: failures.length ? "FAIL" : "PASS",
  rootRoutesCrawled: rootRoutes.length,
  osRoutesCrawled: osRoutes.length,
  cleanDocsCrawled: cleanDocs.length,
  oldDocsRedirectsCrawled: oldDocs.length + 1,
  cleanDocsHtmlRedirectsCrawled: cleanDocsHtml.length,
  sitemapUrlCount: sitemapRoutes.length,
  sitemapHttpStatusCounts: sitemapStatusCounts,
  redirectSourceCount: redirectsBySource.size,
  docsRedirectSourceCount: oldDocs.length + 1,
  exactRedirectStatusObserved: 308,
  noindexPageCount: noindexRoutes.size,
  canonicalMismatchCount: canonicalMismatches.length,
  providerOccurrenceCount: providerOccurrences,
  testimonialCount,
  jsonLdBlocksParsed: jsonLdBlocks,
  jsonLdParseErrors: jsonLdErrors,
  failures,
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
