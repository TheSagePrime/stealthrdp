"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const {
  isPublicIndexHost,
  previewRobotsTxt,
  applyPreviewHtml,
  PUBLIC_CANONICAL_ORIGIN,
} = require("../lib/index-policy");
const proxy = require("../proxy");

test("only stealthrdp.com hosts are indexable", () => {
  assert.strictEqual(isPublicIndexHost("www.stealthrdp.com"), true);
  assert.strictEqual(isPublicIndexHost("stealthrdp.com"), true);
  assert.strictEqual(isPublicIndexHost("WWW.StealthRDP.com"), true);
  assert.strictEqual(isPublicIndexHost("preview.antah.de"), false);
  assert.strictEqual(isPublicIndexHost("stealthrdp.antah.de"), false);
  assert.strictEqual(isPublicIndexHost("localhost:8080"), false);
  assert.strictEqual(isPublicIndexHost("stealthrdp-stealths-projects-f859c954.vercel.app"), false);
});

test("preview robots block the whole host and omit a sitemap", () => {
  const robots = previewRobotsTxt();
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Disallow: \//);
  assert.ok(!robots.includes("Sitemap:"));
  assert.ok(!robots.includes("Allow: /"));
});

test("preview HTML flips robots meta and keeps production as the token origin", () => {
  const html = applyPreviewHtml('<meta name="robots" content="index,follow" />');
  assert.ok(html.includes('content="noindex,nofollow"'));
  assert.ok(!html.includes("index,follow"));
  assert.strictEqual(PUBLIC_CANONICAL_ORIGIN, "https://www.stealthrdp.com");
});

test("Vercel preview policy blocks robots and sitemap and marks pages noindex", async () => {
  const robots = proxy(new Request("https://preview.example/robots.txt"));
  assert.strictEqual(robots.status, 200);
  assert.match(await robots.text(), /Disallow: \/\n/);

  const sitemap = proxy(new Request("https://preview.example/sitemap.xml"));
  assert.strictEqual(sitemap.status, 404);
  assert.strictEqual(await sitemap.text(), "Not found");

  const page = proxy(new Request("https://preview.example/windows-vps/"));
  assert.strictEqual(page.headers.get("x-robots-tag"), "noindex, nofollow");
});
