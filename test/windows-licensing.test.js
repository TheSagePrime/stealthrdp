"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const NOTICE = "StealthRDP provides the infrastructure only. Microsoft Windows licensing is not included and is not supplied by StealthRDP. Customers using Windows are responsible for their own licensing compliance.";

test("dedicated Windows licensing page states the current position", () => {
  const html = read("docs/windows-licensing.html");
  assert.match(html, /<h1>Windows licensing<\/h1>/);
  assert.match(html, /StealthRDP provides the infrastructure only/);
  assert.match(html, /not included and is not supplied by StealthRDP/);
  assert.match(html, /SPLA licences, RDS licences, activation keys/);
  assert.match(html, /even if requested/);
  assert.match(html, /Evaluation software/);
  assert.match(html, /not a permanently licensed Windows installation/);
  assert.match(html, /Customers may use their own eligible Microsoft licences/);
  assert.match(html, /responsible for determining whether their licence is valid/);
  assert.doesNotMatch(html, /BYOL is available to everyone|Customers use BYOL/i);
  assert.doesNotMatch(html, /Contact us for a Windows licence|Licensing available on request|We can provide a licence if required/i);
  assert.doesNotMatch(html, /docs-source-meta|Source date:|Migrated \d{4}-\d{2}-\d{2}|No public redactions recorded/);
  assert.match(html, /canonical" href="__SRDP_BASE__\/docs\/windows-licensing"/);
});

test("Windows, plans, FAQ, and terms surface the licensing notice", () => {
  const windows = read("windows-vps/index.html");
  const plans = read("plans.html");
  const faq = read("faq.html");
  const terms = read("docs/use-of-service.html");
  const responsibilities = read("docs/user-responsibilities.html");
  const evaluationGuide = read("docs/how-to-re-activate-and-extend-your-180-day-windows-trial.html");
  const stopsGuide = read("docs/server-stops-randomly.html");
  for (const [name, html] of [["windows", windows], ["plans", plans], ["faq", faq]]) {
    assert.ok(html.includes(NOTICE), `${name}: short notice`);
    assert.match(html, /href="\/docs\/windows-licensing"/);
  }
  assert.match(windows, /Is a Microsoft Windows licence included/);
  assert.match(faq, /Is Microsoft Windows licensing included/);
  assert.match(faq, /even if requested/);
  assert.ok(terms.includes("not included and is not supplied by StealthRDP"));
  assert.match(terms, /href="\/docs\/windows-licensing"/);
  assert.match(responsibilities, /href="\/docs\/windows-licensing"/);
  assert.match(evaluationGuide, /StealthRDP does not supply Microsoft Windows licences, SPLA licences, RDS licences, or activation keys/);
  assert.match(stopsGuide, /customers may use their own eligible Microsoft licences/i);
  assert.match(stopsGuide, /not included and is not supplied by StealthRDP/);
  assert.doesNotMatch(stopsGuide, /your windows license expired|apply appropriate Microsoft licensing that you supply/i);
});

test("public pages do not expose internal provenance labels", () => {
  assert.doesNotMatch(read("docs.html"), /Verified source snapshot|class="docs-card-meta">[^<]*<time>/);
  assert.doesNotMatch(read("faq.html"), /Source-backed answers|site snapshot/);
  assert.doesNotMatch(read("js/main.js"), /verified snapshot/);
  assert.doesNotMatch(read("docs/how-to-rebuild-a-server.html"), /verified source content/);
  assert.match(read("blog/windows-vs-linux-vps-which-os-best-fits-your-business.html"), /class="article-meta"/);
});

test("homepage finder does not claim a Windows licence is included", () => {
  const home = read("index.html");
  const main = read("js/main.js");
  assert.doesNotMatch(home, /any OS included on every plan/);
  assert.doesNotMatch(main, /included on every plan/);
  assert.match(main, /Windows and Linux images/);
});
