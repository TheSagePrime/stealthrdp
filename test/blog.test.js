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

test("blog index ships topic chips, filterable cards, and visible hiding rules", () => {
  assert.match(HTML, /data-blog-topic=/);
  assert.match(HTML, /data-blog-category=/);
  assert.match(HTML, /id="blogSearch"/);
  assert.match(CSS, /\.blog-card\[hidden\]\s*\{\s*display:\s*none;\s*\}/, "hidden blog cards must be visually removed");
  assert.match(CSS, /\.docs-group\[hidden\]\s*\{\s*display:\s*none;\s*\}/, "hidden docs groups must be visually removed");
});
