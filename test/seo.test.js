"use strict";
/* StealthRDP v2 — SEO surface tests (node --test)
   Asserts every public route has: title, meta description, one H1, canonical,
   OG/Twitter, parseable JSON-LD, and that sitemap/robots are valid. */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HTML = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const BLOG = require(path.join(ROOT, "js", "blog-data.js")).SRDP_BLOG;

const ROUTES = [
  "index.html",
  "plans.html",
  "features.html",
  "status.html",
  "blog.html",
  "faq.html",
  "about.html",
  "privacy.html",
  ...BLOG.map((p) => `blog/${p.slug}.html`),
];

function parse(html) {
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || "";
  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  const ogTitle = /property="og:title" content="[^"]*"/.test(html);
  const ogDesc = /property="og:description" content="[^"]*"/.test(html);
  const ogImage = /property="og:image" content="[^"]*"/.test(html);
  const twitter = /name="twitter:card" content="summary_large_image"/.test(html);
  const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  return { title, desc, canonical, h1s, ogTitle, ogDesc, ogImage, twitter, ldBlocks };
}

test("every route exposes a complete SEO surface", () => {
  for (const route of ROUTES) {
    const html = HTML(route);
    const s = parse(html);
    assert.ok(s.title.length >= 10 && s.title.length <= 70, `${route}: title "${s.title}" length ${s.title.length}`);
    assert.ok(s.desc.length >= 70 && s.desc.length <= 170, `${route}: description length ${s.desc.length}`);
    assert.strictEqual(s.h1s, 1, `${route}: expected exactly one H1, got ${s.h1s}`);
    assert.ok(s.canonical.startsWith("__SRDP_BASE__"), `${route}: canonical present ${s.canonical}`);
    assert.ok(s.ogTitle && s.ogDesc && s.ogImage, `${route}: OG complete`);
    assert.ok(s.twitter, `${route}: twitter card`);
    assert.ok(s.ldBlocks.length >= 1, `${route}: JSON-LD present`);
    for (const block of s.ldBlocks) {
      const parsed = JSON.parse(block); // throws if invalid
      assert.ok(parsed["@context"] === "https://schema.org", `${route}: schema.org context`);
    }
  }
});

test("homepage JSON-LD has Organization + WebSite; plans has Service offers; faq has FAQPage", () => {
  const index = parse(HTML("index.html"));
  const indexTypes = index.ldBlocks.flatMap((b) => JSON.parse(b)["@graph"] || [JSON.parse(b)]).map((x) => x["@type"]);
  assert.ok(indexTypes.includes("Organization"), "home: Organization");
  assert.ok(indexTypes.includes("WebSite"), "home: WebSite");

  const plans = parse(HTML("plans.html"));
  const plansGraph = plans.ldBlocks.flatMap((b) => JSON.parse(b)["@graph"] || [JSON.parse(b)]);
  assert.ok(plansGraph.some((x) => x["@type"] === "ItemList"), "plans: ItemList");
  const services = plansGraph.filter((x) => x["@type"] === "ItemList").flatMap((x) => x.itemListElement || []).map((i) => i.item);
  assert.ok(services.length >= 10, `plans: ${services.length} service entries`);
  const first = services[0];
  assert.ok(first["@type"] === "Service" && first.offers && first.offers.price > 0, "plans: Service with Offer");

  const faq = parse(HTML("faq.html"));
  const faqGraph = faq.ldBlocks.flatMap((b) => JSON.parse(b)["@graph"] || [JSON.parse(b)]);
  const faqPage = faqGraph.find((x) => x["@type"] === "FAQPage");
  assert.ok(faqPage && faqPage.mainEntity.length === 21, `faq: FAQPage with 21 Q&A (got ${faqPage && faqPage.mainEntity.length})`);
});

test("blog post pages carry Article JSON-LD + breadcrumbs", () => {
  for (const post of BLOG) {
    const s = parse(HTML(`blog/${post.slug}.html`));
    const graph = s.ldBlocks.flatMap((b) => JSON.parse(b)["@graph"] || [JSON.parse(b)]);
    const types = graph.map((x) => x["@type"]);
    assert.ok(types.includes("BlogPosting"), `${post.slug}: BlogPosting`);
    assert.ok(types.includes("BreadcrumbList"), `${post.slug}: BreadcrumbList`);
    const art = graph.find((x) => x["@type"] === "BlogPosting");
    assert.ok(art.headline === post.title && art.datePublished === post.date, `${post.slug}: article metadata matches`);
  }
});

test("sitemap.xml is valid XML with all routes; robots.txt allows + references it", () => {
  const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
  assert.ok(sitemap.startsWith("<?xml"), "sitemap XML declaration");
  assert.ok(sitemap.includes("<urlset"), "sitemap urlset");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.strictEqual(locs.length, ROUTES.length, `sitemap has ${ROUTES.length} URLs`);
  for (const loc of locs) assert.ok(loc.startsWith("__SRDP_BASE__/"), `sitemap absolute loc ${loc}`);
  for (const route of ROUTES) {
    const wanted = route === "index.html" ? "__SRDP_BASE__/" : `__SRDP_BASE__/${route}`;
    assert.ok(locs.includes(wanted), `sitemap includes ${wanted}`);
  }

  const robots = fs.readFileSync(path.join(ROOT, "robots.txt"), "utf8");
  assert.ok(/^User-agent: \*$/m.test(robots), "robots allows all");
  assert.ok(robots.includes("Sitemap: __SRDP_BASE__/sitemap.xml"), "robots references sitemap");
  assert.ok(robots.includes("Disallow: /api/"), "robots blocks api");
});

test("AI-readable guide exists and source templates stay free of raw infrastructure IPs", () => {
  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.startsWith("# StealthRDP"), "llms.txt heading");
  assert.ok(llms.includes("__SRDP_BASE__/plans.html"), "llms.txt links to plans");
  assert.ok(llms.includes("__SRDP_BASE__/faq.html"), "llms.txt links to FAQ");
  assert.ok(llms.includes("10,877 customers"), "llms.txt preserves approved customer claim");
  assert.ok(llms.includes("25,000+ servers"), "llms.txt preserves approved server claim");
  assert.doesNotMatch(HTML("build.mjs"), /\b(?:\d{1,3}\.){3}\d{1,3}\b/, "build template has no raw IPv4 address");
  for (const route of ROUTES) {
    assert.doesNotMatch(HTML(route), /\b(?:\d{1,3}\.){3}\d{1,3}\b/, `${route}: no raw IPv4 address`);
  }
});

test("baked content is present in raw HTML (plans, features, faq, status, blog)", () => {
  const plans = HTML("plans.html");
  assert.ok(plans.includes("Bronze USA"), "plans: baked Bronze card");
  assert.ok(plans.includes("VPS Features Comparison"), "plans: compare table");
  assert.ok((plans.match(/<article class="plan-card/g) || []).length === 6, "plans: 6 baked USA cards");

  const features = HTML("features.html");
  assert.ok(features.includes("Remote Desktop Protocol (RDP) Services"), "features: baked first feature");

  const faq = HTML("faq.html");
  assert.ok(faq.includes("What services does StealthRDP offer?"), "faq: baked first question");
  assert.strictEqual((faq.match(/<div class="faq-item/g) || []).length, 21, "faq: 21 baked items");

  const status = HTML("status.html");
  assert.ok(status.includes("Nodes online"), "status: summary baked");
  assert.ok(status.includes("node-card"), "status: node cards baked");

  const blog = HTML("blog.html");
  assert.strictEqual((blog.match(/<article class="blog-card/g) || []).length, 11, "blog: 11 baked cards");
  assert.ok(blog.includes(`/blog/${BLOG[0].slug}.html`), "blog: links to clean article URLs");
});

test("no leftover loading placeholders in raw HTML", () => {
  for (const route of ROUTES) {
    const html = HTML(route);
    assert.ok(!html.includes("Loading plans…"), `${route}: no plans loading placeholder`);
    assert.ok(!html.includes("Loading articles…"), `${route}: no blog loading placeholder`);
  }
});
