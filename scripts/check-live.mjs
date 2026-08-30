#!/usr/bin/env node
import process from "node:process";

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/check-live.mjs https://www.stealthrdp.com/plans.html");
  process.exit(2);
}
const url = new URL(target);
const failures = [];
const fail = (message) => failures.push(message);
const fetchText = async (value) => {
  const response = await fetch(value, { redirect: "manual" });
  return { response, text: await response.text() };
};

const { response, text: html } = await fetchText(url);
if (response.status !== 200) fail(`live page returned HTTP ${response.status}`);
const canonical = (html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i) || [])[1]?.trim() || "";
const robots = (html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i) || [])[1] || "";
const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || "";
const description = (html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) || [])[1]?.trim() || "";
const h1Count = (html.match(/<h1(?:\s|>)/gi) || []).length;
const schemaBlocks = [...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
if (!title) fail("live title is missing");
if (!description) fail("live meta description is missing");
if (!canonical) fail("live canonical is missing");
if (/noindex/i.test(robots)) fail("live page contains noindex");
if (h1Count !== 1) fail(`live page has ${h1Count} H1 elements`);
if (!schemaBlocks.length) fail("live structured data is missing");
for (const block of schemaBlocks) { try { JSON.parse(block); } catch { fail("live structured data does not parse"); } }

const robotsResult = await fetchText(new URL("/robots.txt", url.origin));
if (robotsResult.response.status !== 200) fail(`live robots.txt returned HTTP ${robotsResult.response.status}`);
if (/Disallow:\s*\/\s*$/m.test(robotsResult.text)) fail("live robots.txt blocks the whole site");
const sitemapResult = await fetchText(new URL("/sitemap.xml", url.origin));
if (sitemapResult.response.status !== 200) fail(`live sitemap.xml returned HTTP ${sitemapResult.response.status}`);
if (!sitemapResult.text.includes(url.href) && !sitemapResult.text.includes(url.pathname)) fail("live sitemap does not include the page");

if (failures.length) {
  console.error(`Live SEO checks failed with ${failures.length} issue(s):`);
  for (const issue of failures) console.error(`- ${issue}`);
  process.exit(1);
}
console.log(`Live SEO checks passed for ${url.href}`);
