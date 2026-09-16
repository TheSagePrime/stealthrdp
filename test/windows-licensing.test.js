"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const NOTICE = "Microsoft Windows licensing is not included unless explicitly stated. Windows Server Evaluation may be provided for evaluation/testing purposes. Customers are responsible for appropriate Microsoft licensing for continued or production use.";

test("dedicated Windows licensing page states the current position", () => {
  const html = read("docs/windows-licensing.html");
  assert.match(html, /<h1>Windows licensing<\/h1>/);
  assert.match(html, /does not currently provide Microsoft Windows licences under SPLA/);
  assert.match(html, /Evaluation software/);
  assert.match(html, /not a permanently licensed Windows installation/);
  assert.match(html, /Customer-supplied licensing may be used where Microsoft/);
  assert.match(html, /does not claim that every customer can automatically use BYOL/);
  assert.doesNotMatch(html, /BYOL is included|Windows licence is included|Windows license is included/i);
  assert.match(html, /canonical" href="__SRDP_BASE__\/docs\/windows-licensing"/);
});

test("Windows, plans, FAQ, and terms surface the licensing notice", () => {
  const windows = read("windows-vps/index.html");
  const plans = read("plans.html");
  const faq = read("faq.html");
  const terms = read("docs/use-of-service.html");
  const responsibilities = read("docs/user-responsibilities.html");
  for (const [name, html] of [["windows", windows], ["plans", plans], ["faq", faq]]) {
    assert.ok(html.includes(NOTICE), `${name}: short notice`);
    assert.match(html, /href="\/docs\/windows-licensing"/);
  }
  assert.match(windows, /Is a Microsoft Windows licence included/);
  assert.match(faq, /Is Microsoft Windows licensing included/);
  assert.ok(terms.includes("does not currently provide Microsoft Windows licences under SPLA"));
  assert.match(terms, /href="\/docs\/windows-licensing"/);
  assert.match(responsibilities, /href="\/docs\/windows-licensing"/);
});

test("homepage finder does not claim a Windows licence is included", () => {
  const home = read("index.html");
  const main = read("js/main.js");
  assert.doesNotMatch(home, /any OS included on every plan/);
  assert.doesNotMatch(main, /included on every plan/);
  assert.match(main, /Windows and Linux images/);
});
