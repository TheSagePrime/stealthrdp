"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const HTML = read("index.html");
const CSS = read("css/style.css");

test("mobile homepage keeps compact navigation and dense plan information", () => {
  assert.match(HTML, /class="footer-mobile-nav"/);
  assert.strictEqual((HTML.match(/class="footer-mobile-group"/g) || []).length, 3);
  assert.match(HTML, /class="section section-tight usecases-section decision-entry"/);
  assert.match(HTML, /class="section plans-preview decision-surface"/);
  assert.match(HTML, /class="topic-chip active"[^>]+aria-pressed="true"/);
  assert.match(HTML, /class="usecase-rail-next"/);
  assert.match(HTML, /class="plan-rail-cue"/);
  assert.match(HTML, /class="footer-about"[\s\S]*class="footer-status"/);
  assert.match(CSS, /\.footer-mobile-group summary \{[\s\S]*min-height: 46px/);
  assert.match(CSS, /\.decision-surface \.plan-popular \{ top: 13px; \}/);
  assert.match(CSS, /\.decision-surface \.plan-specs \{ grid-template-columns: repeat\(2/);
  assert.match(CSS, /\.decision-entry \.usecase-chips \{[\s\S]*flex-wrap: nowrap/);
  assert.match(CSS, /\.plan-rail-cue \{ display: grid; grid-template-columns:/);
});
