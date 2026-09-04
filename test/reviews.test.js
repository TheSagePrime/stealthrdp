"use strict";
/* Provenance and honesty checks for the curated testimonial surface. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const REVIEWS = JSON.parse(read("data/reviews.json"));
const TESTIMONIALS = JSON.parse(read("data/testimonials.json"));
const HTML = read("index.html");
const reviewById = new Map(REVIEWS.map((review) => [review.id, review]));

test("review data preserves the complete source-backed provenance snapshot", () => {
  assert.equal(REVIEWS.length, 48, "the internal provenance snapshot remains complete");
  assert.equal(new Set(REVIEWS.map((item) => item.id)).size, REVIEWS.length, "review IDs are unique");
  for (const review of REVIEWS) {
    assert.ok(review.quote && review.quote.trim(), `${review.id}: quote`);
    assert.match(review.sourceUrl, /^https:\/\//, `${review.id}: HTTPS source URL`);
  }
});

test("curated testimonials use exact trusted source records", () => {
  assert.ok(TESTIMONIALS.length >= 4 && TESTIMONIALS.length <= 6);
  for (const testimonial of TESTIMONIALS) {
    if (!testimonial.id) continue;
    const source = reviewById.get(testimonial.id);
    assert.ok(source, `${testimonial.id}: exists in the trusted review snapshot`);
    assert.equal(source.sourceCompany, "StealthRDP");
    assert.equal(source.sourceType, "third-party review");
    assert.equal(source.sentiment, "positive");
    assert.equal(testimonial.quote, source.quote);
    assert.equal(testimonial.authorName, source.authorName);
    assert.equal(testimonial.publishedOn, source.publishedOn);
  }
});

test("homepage has a static curated testimonial grid without forum content", () => {
  const section = HTML.match(/<section class="section reviews-section"[\s\S]*?<\/section>/)?.[0] || "";
  assert.match(section, /testimonial-grid/);
  assert.equal((section.match(/<article class="testimonial-card">/g) || []).length, TESTIMONIALS.length);
  assert.doesNotMatch(section, /review-wall|review-track|Community feedback|the provider/i);
  assert.doesNotMatch(section, /<a\b|https?:\/\//i, "testimonials do not expose source links");
});
