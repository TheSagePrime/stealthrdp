"use strict";
/* Provenance and honesty checks for the public-source review wall. */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const REVIEWS = JSON.parse(read("data/reviews.json"));
const HTML = read("index.html");
const CSS = read("css/style.css");
const reviewSection = HTML.match(/<section class="section reviews-section"[\s\S]*?<\/section>/)?.[0] || "";
const verified = REVIEWS.filter((item) => item.sourceCompany === "StealthRDP" && item.sourceType === "third-party review");
const excludedCompanies = [...new Set(REVIEWS.filter((item) => item.sourceCompany !== "StealthRDP").map((item) => item.sourceCompany))];


test("review data preserves the complete source-backed provenance snapshot", () => {
  assert.strictEqual(REVIEWS.length, 48, "the internal provenance snapshot remains complete");
  assert.strictEqual(verified.length, 13, "exactly 13 verified StealthRDP reviews remain eligible");
  assert.strictEqual(new Set(REVIEWS.map((item) => item.id)).size, REVIEWS.length, "review IDs are unique");
  for (const review of REVIEWS) {
    assert.ok(review.quote && review.quote.trim(), `${review.id}: quote`);
    assert.ok(/^https:\/\//.test(review.sourceUrl), `${review.id}: HTTPS source URL`);
    assert.ok(review.sourceLabel && /Customer feedback|Community comment/.test(review.sourceLabel), `${review.id}: neutral source label`);
    assert.ok(review.sourceCompany, `${review.id}: named source company or topic`);
  }
});


test("generated review wall shows the full collected set without source links", () => {
  assert.strictEqual(reviewSection.match(/data-review-count="(\d+)"/)?.[1], String(REVIEWS.length));
  assert.match(reviewSection, /Customer and community reviews/);
  assert.match(reviewSection, /real reviews from server owners and remote-desktop users/);
  assert.doesNotMatch(reviewSection, /<a\b/i, "review section has no visible or clickable source links");
  assert.doesNotMatch(reviewSection, /https?:\/\//i, "review section has no raw source URLs");
  assert.strictEqual((reviewSection.match(/class="review-card /g) || []).length, REVIEWS.length * 2, "animation duplicates each collected source item once");
  const competitorNames = ["Linode", "DigitalOcean", "Digital Ocean", "Vultr", "Contabo", "Hetzner", "OVH", "Kimsufi", "Scaleway", "AWS", "Lightsail", "RackNerd", "BuyVM", "Leaseweb", "Rackspace", "CrystalTech", "Online.net", "RamNode", "RunAbove", "Google Compute", "LowEndBox", "S3", "Route53", "SES", "news.ycombinator", "trustpilot.com/reviews", "Hacker News"];
  for (const name of competitorNames) {
    assert.doesNotMatch(reviewSection, new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"), `${name} is not visible in the review section`);
  }
});


test("review wall keeps animation, mobile stacking, pause, and reduced-motion safeguards", () => {
  assert.match(CSS, /\.review-track \{[^}]*min-width: 0;[^}]*width: 100%;/);
  assert.match(CSS, /\.review-card \{[^}]*width: 100%;[^}]*min-width: 0;/);
  assert.match(CSS, /\.review-column:hover \.review-track, \.review-column:focus-within \.review-track \{[^}]*animation-play-state: paused;/);
  assert.match(CSS, /@media \(max-width: 700px\)[\s\S]*?\.review-wall \{[^}]*grid-template-columns: 1fr;/);
  assert.match(CSS, /@media \(max-width: 700px\)[\s\S]*?\.review-track \{ animation: none;/);
  assert.match(CSS, /@media \(max-width: 700px\)[\s\S]*?\.review-card-copy \{ display: none;/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.review-track[^}]*animation: none;/);
});
