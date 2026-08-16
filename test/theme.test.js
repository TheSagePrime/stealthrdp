"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const HTML = read("index.html");
const CSS = read("css/style.css");
const JS = read("js/main.js");

test("theme toggle ships a light token layer without replacing accent palettes", () => {
  assert.match(HTML, /data-theme="dark"/);
  assert.match(HTML, /id="themeToggle"/);
  assert.match(HTML, /meta name="color-scheme" content="dark light"/);
  assert.match(HTML, /stealthrdp-preview-theme/);
  assert.match(JS, /localStorage\.setItem\(storageKey, next\)/);
  assert.match(JS, /aria-label\", light \? \"Use dark theme\" : \"Use light theme\"/);
  assert.match(CSS, /html\[data-theme="light"\]\s*\{[\s\S]*--bg: #f7f4ee/);
  assert.match(CSS, /html\[data-theme="light"\] \.header/);
  for (const key of ["cobalt", "gold", "cyan", "violet", "coral", "mint", "rose", "orange", "indigo", "ice"]) {
    assert.match(CSS + HTML, new RegExp(`data-palette="${key}"`));
  }
});
