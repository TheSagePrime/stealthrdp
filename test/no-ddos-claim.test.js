"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

const MARKETING = [
  "index.html",
  "about.html",
  "plans.html",
  "faq.html",
  "privacy.html",
  "llms.txt",
  "windows-vps/index.html",
  "linux-vps/index.html",
];

test("marketing pages do not claim StealthRDP includes DDoS protection", () => {
  for (const file of MARKETING) {
    const html = read(file);
    const cleaned = html.replace(/StealthRDP does not include DDoS protection\.?/gi, "");
    assert.doesNotMatch(cleaned, /DDoS protection|DDoS-protected|applying DDoS/i, file);
  }
  const home = read("index.html");
  assert.doesNotMatch(home, /Is DDoS protection included/i);
  const faq = read("faq.html");
  assert.doesNotMatch(faq, /Is DDoS protection included/i);
  assert.doesNotMatch(faq, /10Gbps|50Gbps|100Gbps/);
});

test("terms still prohibit launching DDoS attacks", () => {
  const terms = read("docs/use-of-service.html");
  assert.match(terms, /initiating DDoS attacks/);
  assert.match(terms, /DDoS\/DoS attacks/);
});
