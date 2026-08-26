"use strict";
/* Stape first-party GTM loader. GTM-NS397SS9 is mapped by the generated token. */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HTML = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const BLOG = require(path.join(ROOT, "js", "blog-data.js")).SRDP_BLOG;
const DOCS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "docs-articles.json"), "utf8"));
const STAPE_SRC = "https://sgtm.stealthrdp.com/2l3xebiqyzc.js?";
const STAPE_TOKEN = "yw=Ch5ENj0vSDYwSUBGOjFcXhVHS19YRAEWXgkNFAgOERARHglfCg0I";
const STAPE_BOOTSTRAP = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src="${STAPE_SRC}"+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${STAPE_TOKEN}');`;

const ROUTES = [
  "index.html",
  "plans.html",
  "status.html",
  "blog.html",
  "faq.html",
  "about.html",
  "privacy.html",
  "docs.html",
  "404.html",
  ...BLOG.map((p) => `blog/${p.slug}.html`),
  ...DOCS.map((p) => `docs/${p.slug}.html`),
];

test("every generated HTML page has exactly one Stape loader and no Google GTM URLs", () => {
  const build = HTML("build.mjs");
  assert.match(build, /sgtm\.stealthrdp\.com\/2l3xebiqyzc\.js\?/);
  assert.match(build, new RegExp(STAPE_TOKEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(build, /www\.googletagmanager\.com\/gtm\.js/);
  assert.doesNotMatch(build, /www\.googletagmanager\.com\/ns\.html/);
  for (const route of ROUTES) {
    const html = HTML(route);
    assert.strictEqual((html.match(/sgtm\.stealthrdp\.com\/2l3xebiqyzc\.js\?/g) || []).length, 1, `${route}: one Stape loader`);
    assert.strictEqual((html.split(STAPE_BOOTSTRAP).length - 1), 1, `${route}: exact Stape bootstrap once`);
    assert.doesNotMatch(html, /www\.googletagmanager\.com\/gtm\.js/, `${route}: no gtm.js`);
    assert.doesNotMatch(html, /www\.googletagmanager\.com\/ns\.html/, `${route}: no ns.html`);
    assert.doesNotMatch(html, /googletagmanager\.com\/gtm\.js\?id=GTM-NS397SS9/, `${route}: no standard GTM id URL`);
    assert.strictEqual((html.match(/w\[l\]=w\[l\]\|\|\[\]/g) || []).length, 1, `${route}: no duplicate GTM bootstrap`);
  }
});
