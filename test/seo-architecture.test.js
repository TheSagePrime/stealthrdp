"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const docs = JSON.parse(read("data/docs-articles.json"));
const testimonials = JSON.parse(read("data/testimonials.json"));
const vercel = JSON.parse(read("vercel.json"));
const redirects = vercel.redirects || [];
const cleanSlug = (slug) => slug.replace(/^\d+-/, "").replaceAll("_", "-").toLowerCase();
const docsMappings = docs.map((article) => [article.slug, cleanSlug(article.slug)]);
const noindexRoutes = [
  "/docs/payment-terms",
  "/docs/use-of-service",
  "/docs/termination-of-service",
  "/docs/user-responsibilities",
  "/docs/how-to-reset-server-change-or-reset-client-area-password",
  "/docs/server-stops-randomly",
  "/privacy",
];

function schemas(html) {
  return [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
}

function schemaNodes(value) {
  if (Array.isArray(value)) return value.flatMap(schemaNodes);
  if (!value || typeof value !== "object") return [];
  const nodes = [value];
  for (const child of Object.values(value)) nodes.push(...schemaNodes(child));
  return nodes;
}

test("homepage renders four to six verified testimonials without review redaction spam", () => {
  const html = read("index.html");
  const cards = [...html.matchAll(/<article class="testimonial-card"[\s\S]*?<\/article>/g)].map((match) => match[0]);
  assert.ok(cards.length >= 4 && cards.length <= 6, `expected 4-6 testimonials, found ${cards.length}`);
  assert.equal(new Set(cards).size, cards.length, "homepage testimonials must be unique");
  assert.doesNotMatch(html, /the provider/i);
  assert.doesNotMatch(html, /review-wall|data-review-count|Community feedback/i);
  assert.ok(testimonials.length >= 4 && testimonials.length <= 6, "trusted testimonial source must contain 4-6 entries");
  for (const testimonial of testimonials) {
    assert.ok(testimonial.quote && testimonial.authorName, "testimonial keeps its source quote and author label");
    assert.ok(testimonial.sourceType !== "community comment", "forum-derived comments are not eligible");
    assert.ok(html.includes(testimonial.quote.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;")), `${testimonial.id || testimonial._id}: exact quote is rendered`);
  }
  const build = read("build.mjs");
  assert.doesNotMatch(build, /DATA\("reviews\.json"\)|reviewCardHtml|reviewWallHtml|providerPattern|the provider/i);
});

test("all 22 docs slugs map once to unique clean extensionless routes", () => {
  assert.equal(docsMappings.length, 22);
  assert.equal(new Set(docsMappings.map(([, clean]) => clean)).size, 22, "clean slugs are unique");
  for (const [oldSlug, clean] of docsMappings) {
    assert.doesNotMatch(clean, /^\d{10}-|_/);
    const source = `/docs/${oldSlug}.html`;
    const matches = redirects.filter((item) => item.source === source);
    assert.equal(matches.length, 1, `${source}: one redirect`);
    assert.deepEqual(matches[0], { source, destination: `/docs/${clean}`, permanent: true });
    const html = read(`docs/${clean}.html`);
    assert.match(html, new RegExp(`<link rel="canonical" href="__SRDP_BASE__/docs/${clean}"`));
  }
  const alternate = "/docs/1737944563-how-to_re_activate-and-extend-your-180_day-windows-trial.html";
  assert.deepEqual(redirects.find((item) => item.source === alternate), {
    source: alternate,
    destination: "/docs/how-to-re-activate-and-extend-your-180-day-windows-trial",
    permanent: true,
  });
  const hub = read("docs.html");
  assert.doesNotMatch(hub, /href="\/docs\/\d{10}-/);
  assert.doesNotMatch(hub, /href="\/docs\/[^"]*_/);
});

test("permanent redirects are direct and cannot form loops or chains", () => {
  const destinationBySource = new Map(redirects.map((item) => [item.source, item.destination]));
  assert.equal(destinationBySource.size, redirects.length, "redirect sources are unique");
  for (const item of redirects) {
    assert.equal(item.permanent, true, `${item.source}: redirect is permanent`);
    const destinationPath = new URL(item.destination, "https://www.stealthrdp.com").pathname;
    assert.notEqual(destinationPath, item.source, `${item.source}: no loop`);
    assert.ok(!destinationBySource.has(destinationPath), `${item.source}: destination ${destinationPath} is not another redirect source`);
  }
});

test("root routes use extensionless canonicals and html redirects", () => {
  const roots = ["docs", "blog", "plans", "status", "faq", "about", "privacy"];
  for (const route of roots) {
    const html = read(`${route}.html`);
    assert.match(html, new RegExp(`<link rel="canonical" href="__SRDP_BASE__/${route}"`));
    assert.match(html, new RegExp(`<meta property="og:url" content="__SRDP_BASE__/${route}"`));
    assert.deepEqual(redirects.find((item) => item.source === `/${route}.html`), {
      source: `/${route}.html`,
      destination: `/${route}`,
      permanent: true,
    });
  }
  for (const htmlFile of ["index.html", "docs.html", "blog.html", "plans.html", "status.html", "faq.html", "about.html", "privacy.html", "windows-vps/index.html", "linux-vps/index.html"]) {
    const html = read(htmlFile);
    assert.doesNotMatch(html, /href="\/(?:docs|blog|plans|status|faq|about|privacy)\.html(?:[#?][^"]*)?"/, `${htmlFile}: root internal links are extensionless`);
  }
  assert.match(read("llms.txt"), /__SRDP_BASE__\/plans\)/);
  assert.doesNotMatch(read("llms.txt"), /__SRDP_BASE__\/(?:docs|blog|plans|status|faq|about|privacy)\.html/);
});

test("seven thin utility pages are noindex follow and absent from the sitemap", () => {
  for (const route of noindexRoutes) {
    const file = route === "/privacy" ? "privacy.html" : `${route.slice(1)}.html`;
    const html = read(file);
    assert.match(html, /<meta name="robots" content="noindex, follow"/i, route);
    assert.match(html, new RegExp(`<link rel="canonical" href="__SRDP_BASE__${route}"`), route);
  }
  const sitemap = read("sitemap.xml");
  for (const route of noindexRoutes) assert.ok(!sitemap.includes(`__SRDP_BASE__${route}<`), `${route}: excluded from sitemap`);
});

test("sitemap contains only clean indexable canonical routes", () => {
  const xml = read("sitemap.xml");
  const locs = [...xml.matchAll(/<loc>__SRDP_BASE__([^<]+)<\/loc>/g)].map((match) => match[1]);
  const redirectSources = new Set(redirects.map((item) => item.source));
  assert.ok(locs.length > 0);
  for (const route of locs) {
    assert.ok(!redirectSources.has(route), `${route}: sitemap route is not a redirect source`);
    assert.doesNotMatch(route, /^\/docs\/\d{10}-|^\/docs\/[^?]*_|^\/(?:docs|blog|plans|status|faq|about|privacy)\.html$/);
    const file = route === "/"
      ? "index.html"
      : route.endsWith("/")
        ? `${route.slice(1)}index.html`
        : route.endsWith(".html")
          ? route.slice(1)
          : `${route.slice(1)}.html`;
    const html = read(file);
    assert.doesNotMatch(html, /<meta name="robots" content="[^"]*noindex/i, route);
    assert.match(html, new RegExp(`<link rel="canonical" href="__SRDP_BASE__${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`), route);
  }
});

test("homepage and OS landing pages include valid Product and Offer schema", () => {
  for (const [file, canonical] of [["index.html", "/"], ["windows-vps/index.html", "/windows-vps/"], ["linux-vps/index.html", "/linux-vps/"]]) {
    const html = read(file);
    const parsed = schemas(html);
    assert.ok(parsed.length > 0, `${file}: JSON-LD parses`);
    const nodes = parsed.flatMap(schemaNodes);
    assert.ok(nodes.some((node) => node["@type"] === "Service"), `${file}: Service remains`);
    const product = nodes.find((node) => node["@type"] === "Product");
    assert.ok(product, `${file}: Product exists`);
    const offer = schemaNodes(product).find((node) => node["@type"] === "Offer");
    assert.ok(offer, `${file}: Offer exists`);
    assert.equal(offer.priceCurrency, "EUR");
    assert.equal(offer.price, 9.5);
    assert.match(offer.url, /^https:\/\/dash\.stealthrdp\.com\/index\.php\?rp=\/store\//);
    assert.ok(!("availability" in offer), `${file}: availability is not invented`);
    assert.ok(JSON.stringify(product).includes(`__SRDP_BASE__${canonical}`), `${file}: Product URL follows canonical routing`);
  }
});
