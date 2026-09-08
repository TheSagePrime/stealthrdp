"use strict";
/* Blog index: filtering must actually hide cards visually. */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const CSS = read("css/style.css");
const HTML = read("blog.html");
const BLOG = require(path.join(ROOT, "js", "blog-data.js")).SRDP_BLOG;

test("blog data and generated cards are newest first", () => {
  const timestamps = BLOG.map((post) => {
    const value = Date.parse(`${post.date || ""}T00:00:00Z`);
    return Number.isFinite(value) ? value : 0;
  });
  assert.deepStrictEqual(timestamps, [...timestamps].sort((left, right) => right - left));
  assert.strictEqual(BLOG[0].slug, "vps-hosting-minecraft");
  const firstCard = HTML.match(/<article class="blog-card"[^>]*data-blog-title="([^"]+)"/);
  assert.ok(firstCard, "blog index has a first card");
  assert.strictEqual(firstCard[1], BLOG[0].title);
});

test("blog index ships topic chips, filterable cards, and visible hiding rules", () => {
  assert.match(HTML, /data-blog-topic=/);
  assert.match(HTML, /data-blog-category=/);
  assert.match(HTML, /id="blogSearch"/);
  assert.match(CSS, /\.blog-card\[hidden\]\s*\{\s*display:\s*none;\s*\}/, "hidden blog cards must be visually removed");
  assert.match(CSS, /\.docs-group\[hidden\]\s*\{\s*display:\s*none;\s*\}/, "hidden docs groups must be visually removed");
  assert.match(HTML, /class="page-head blog-page-head"/);
  assert.match(CSS, /@media \(max-width: 768px\)[\s\S]*?\.blog-index-section \.blog-grid \{ grid-template-columns: 1fr;/, "mobile blog cards must use one readable column");
  assert.match(CSS, /@media \(max-width: 768px\)[\s\S]*?\.blog-index-section \.blog-topics \{ flex-wrap: nowrap;/, "mobile blog topics must stay in a swipeable rail");
});
