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
  assert.match(CSS, /\.footer-mobile-group summary \{[\s\S]*min-height: 46px/);
  assert.match(CSS, /\.plans-preview \.plan-specs \{ grid-template-columns: repeat\(2/);
  assert.match(CSS, /\.usecase-chips \{[\s\S]*flex-wrap: nowrap/);
});
