#!/usr/bin/env node
import process from "node:process";

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/check-preview.mjs https://preview.example/page.html");
  process.exit(2);
}

const url = new URL(target);
const failures = [];
const fail = (message) => failures.push(message);
const response = await fetch(url, { redirect: "manual" });
const html = await response.text();

if (response.status !== 200) fail(`page returned HTTP ${response.status}`);
if (!/<meta\s+name=["']viewport["'][^>]*content=["'][^"']*width=device-width/i.test(html)) fail("mobile viewport is missing");
const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || "";
const description = (html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) || [])[1]?.trim() || "";
const canonical = (html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i) || [])[1]?.trim() || "";
const robots = (html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i) || [])[1] || "";
const robotsHeader = response.headers.get("x-robots-tag") || "";
const h1Count = (html.match(/<h1(?:\s|>)/gi) || []).length;
const schemaBlocks = [...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);

if (!title) fail("title is missing from rendered HTML");
if (!description) fail("meta description is missing from rendered HTML");
if (!canonical) fail("canonical is missing from rendered HTML");
if (!/noindex/i.test(robots) && !/noindex/i.test(robotsHeader)) fail("preview page must contain noindex");
if (h1Count !== 1) fail(`expected one H1, found ${h1Count}`);
if (!schemaBlocks.length) fail("structured data is missing");
for (const block of schemaBlocks) {
  try { JSON.parse(block); } catch { fail("structured data does not parse"); }
}

const robotsUrl = new URL("/robots.txt", url.origin);
const robotsResponse = await fetch(robotsUrl);
const robotsText = await robotsResponse.text();
if (robotsResponse.status !== 200) fail(`robots.txt returned HTTP ${robotsResponse.status}`);
if (!/Disallow:\s*\/\s*$/m.test(robotsText)) fail("robots.txt must block the whole preview host");

const sitemapUrl = new URL("/sitemap.xml", url.origin);
const sitemapResponse = await fetch(sitemapUrl);
const sitemapText = await sitemapResponse.text();
if (sitemapResponse.status !== 404) fail(`preview sitemap must be hidden, returned HTTP ${sitemapResponse.status}`);
if (sitemapText.trim() !== "Not found") fail("preview sitemap response body is unexpected");

const internalLinks = [...html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)]
  .map((m) => m[1])
  .filter((href) => href.startsWith("/") && !href.startsWith("/cdn-cgi/l/email-protection"));
for (const href of [...new Set(internalLinks)]) {
  const linkResponse = await fetch(new URL(href, url.origin), { redirect: "manual" });
  if (linkResponse.status >= 400) fail(`internal link ${href} returned HTTP ${linkResponse.status}`);
}

const cta = /dash\.stealthrdp\.com|checkout|order|buy|sign.?up/i.test(html);
if (!cta) fail("no purchase or signup CTA detected");

if (failures.length) {
  console.error(`Preview SEO checks failed with ${failures.length} issue(s):`);
  for (const issue of failures) console.error(`- ${issue}`);
  process.exit(1);
}
console.log(`Preview SEO checks passed for ${url.href}`);
