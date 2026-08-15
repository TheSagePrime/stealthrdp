"use strict";
/* Provenance and honesty checks for the public-source review wall. */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const REVIEWS = JSON.parse(read("data/reviews.json"));


test("review data contains 40-50 unique source-backed excerpts", () => {
  assert.ok(REVIEWS.length >= 40 && REVIEWS.length <= 50, `expected 40-50 reviews, got ${REVIEWS.length}`);
  assert.strictEqual(new Set(REVIEWS.map((item) => item.id)).size, REVIEWS.length, "review IDs are unique");
  for (const review of REVIEWS) {
    assert.ok(review.quote && review.quote.trim(), `${review.id}: quote`);
    assert.ok(/^https:\/\//.test(review.sourceUrl), `${review.id}: HTTPS source URL`);
    assert.ok(review.sourceLabel && /Customer feedback|Community comment/.test(review.sourceLabel), `${review.id}: neutral source label`);
    assert.ok(review.sourceCompany, `${review.id}: named source company or topic`);
  }
});


test("generated review wall keeps provenance visible and does not imply StealthRDP customers", () => {
  const html = read("index.html");
  assert.strictEqual(html.match(/data-review-count="(\d+)"/)?.[1], String(REVIEWS.length));
  assert.match(html, /aria-label="Public community review excerpts"/);
  assert.match(html, /Community feedback, in context/);
  assert.match(html, /They describe the named provider or community topic, not StealthRDP/);
  assert.doesNotMatch(html, /aria-label="Customer reviews"|First-party customer story|StealthRDP Customer/);
  assert.strictEqual((html.match(/class="review-card /g) || []).length, REVIEWS.length * 2, "animation duplicates each source item once");
});
