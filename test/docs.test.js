"use strict";
/* Native documentation, trust, and client-side index behaviour tests. */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HTML = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const DOCS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "docs-articles.json"), "utf8"));
const publicRoutes = [
  "index.html", "plans.html", "features.html", "status.html", "blog.html", "faq.html", "about.html", "privacy.html", "docs.html",
  ...DOCS.map((article) => `docs/${article.slug}.html`),
  ...fs.readdirSync(path.join(ROOT, "blog")).map((file) => `blog/${file}`),
];

test("docs index is crawlable and includes every verified article", () => {
  const html = HTML("docs.html");
  assert.match(html, /<main[^>]+class="docs-index/);
  assert.match(html, /<input[^>]+id="docsSearch"/);
  assert.match(html, /<select[^>]+id="docsCategory"/);
  assert.match(html, /data-docs-index/);
  for (const article of DOCS) {
    assert.ok(html.includes(article.title), `${article.slug}: title is baked into docs index`);
    assert.ok(html.includes(`/docs/${article.slug}.html`), `${article.slug}: native route is linked`);
  }
});

test("every native article has metadata, breadcrumbs, readable content, and WHMCS support", () => {
  for (const article of DOCS) {
    const html = HTML(`docs/${article.slug}.html`);
    assert.match(html, /<main[^>]+class="docs-article-page/);
    assert.strictEqual((html.match(/<h1[\s>]/g) || []).length, 1, `${article.slug}: one H1`);
    assert.match(html, /data-docs-category="[^"]+"/);
    assert.match(html, /class="docs-breadcrumbs"/);
    assert.match(html, /class="docs-source-meta"/);
    assert.match(html, /class="docs-content"/);
    assert.match(html, /https:\/\/dash\.stealthrdp\.com\/index\.php\?rp=\/login/);
    assert.ok(!html.includes("docs.stealthrdp.com"), `${article.slug}: no legacy docs host`);
    assert.ok(!html.includes("Chatwoot"), `${article.slug}: no Chatwoot reference`);
  }
});

test("docs renderer keeps commands in copyable code blocks and replaces legacy internal links", () => {
  const html = DOCS.map((article) => HTML(`docs/${article.slug}.html`)).join("\n");
  assert.match(html, /class="docs-code"/);
  assert.match(html, /class="docs-copy"[^>]+data-copy-target/);
  assert.match(html, /slmgr -rearm|systemctl|apt-get|winrm/i);
  assert.doesNotMatch(html, /https?:\/\/docs\.stealthrdp\.com/i);
  assert.doesNotMatch(html, /\b(?:\d{1,3}\.){3}\d{1,3}\b/);
});

test("docs search and category filtering are client-side and testable without a backend", () => {
  const docsJs = HTML("js/docs.js");
  assert.match(docsJs, /filterItems/);
  assert.match(docsJs, /addEventListener\("input"/);
  assert.match(docsJs, /addEventListener\("change"/);
  assert.match(docsJs, /navigator\.clipboard/);
  assert.match(docsJs, /createElement\("textarea"\)/);
  const { filterItems } = require(path.join(ROOT, "js", "docs.js"));
  const items = [
    { title: "Reset Windows password", summary: "Client area steps", category: "Windows", slug: "windows" },
    { title: "Install OpenVPN", summary: "Linux networking", category: "VPN and networking", slug: "vpn" },
  ];
  assert.deepStrictEqual(filterItems(items, "windows", "all").map((item) => item.slug), ["windows"]);
  assert.deepStrictEqual(filterItems(items, "", "VPN and networking").map((item) => item.slug), ["vpn"]);
  assert.deepStrictEqual(filterItems(items, "install", "Windows"), []);
});

test("public chrome has no legacy docs host, countdown, or fake live deployment wording", () => {
  for (const route of publicRoutes) {
    const html = HTML(route);
    assert.doesNotMatch(html, /docs\.stealthrdp\.com|Chatwoot/i, `${route}: legacy documentation reference`);
    assert.doesNotMatch(html, /countdown|srdp_offer_end|72h rolling/i, `${route}: no countdown`);
  }
  const mainJs = HTML("js/main.js");
  assert.doesNotMatch(mainJs, /srdp_offer_end|COUNTDOWN_MS|setInterval\(tick/);
  const home = HTML("index.html");
  assert.match(home, /Choose a server/);
  assert.doesNotMatch(home, /WHMCS/i);
  assert.doesNotMatch(home, /server online|Live deploy console|fake provisioning/i);
});

test("status page fails closed when the live feed is unavailable", () => {
  const html = HTML("status.html");
  assert.match(html, /Live status unavailable/);
  assert.match(html, /class="status-empty"/);
  assert.doesNotMatch(html, />9\/9<\/div>|>100%<\/div>/);
  assert.strictEqual((html.match(/n-dot up/g) || []).length, 0);
  assert.strictEqual((html.match(/n-dot down/g) || []).length, 0);
  assert.match(HTML("build.mjs"), /status === "up"/);
  assert.match(HTML("server.js"), /status === "up"/);
  assert.match(HTML("js/main.js"), /Live status unavailable/);
});

test("status information cards use a responsive semantic grid", () => {
  const build = HTML("build.mjs");
  const css = HTML("css/style.css");
  assert.match(build, /<div class="status-info-grid">/);
  assert.doesNotMatch(build, /style="margin-top:64px;display:grid;grid-template-columns:repeat\(3,1fr\);gap:20px"/);
  assert.match(css, /\.status-info-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\s*\)/);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.status-info-grid\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
});

test("Windows ordered steps stay in one list across source blank lines", () => {
  const html = HTML("docs/1737944563-how-to-re_activate-and-extend-your-180_day-windows-trial.html");
  const content = html.match(/<div class="docs-content">([\s\S]*?)<\/div><div class="docs-support">/);
  assert.ok(content, "Windows article content is present");
  assert.match(content[1], /<ol><li>Press[\s\S]*?<\/li><li>Select[\s\S]*?<\/li><\/ol>/);
  assert.doesNotMatch(content[1], /<\/ol>\s*<ol>/);
});

test("the docs artifact is source-labelled and sanitised before rendering", () => {
  assert.ok(DOCS.length > 0, "verified docs artifact is non-empty");
  for (const article of DOCS) {
    assert.ok(article.migration && article.migration.source, `${article.slug}: migration source`);
    assert.ok(article.migration && article.migration.date, `${article.slug}: migration date`);
    assert.doesNotMatch(article.content, /docs\\.stealthrdp\\.com|Chatwoot|123\\.456\\.78\\.9/i, `${article.slug}: sanitised content`);
    assert.doesNotMatch(JSON.stringify(article.migration), /123\\.456\\.78\\.9/, `${article.slug}: no raw example IP in metadata`);
  }
  assert.match(HTML("scripts/import-docs.mjs"), /MIGRATION_DATE/);
  assert.match(HTML("scripts/import-docs.mjs"), /sanitizeContent/);
});

test("native documentation is present in shared navigation and terms links", () => {
  for (const route of publicRoutes) {
    const html = HTML(route);
    assert.match(html, /href="\/docs\.html"[^>]*>Documentation|href="\/docs\.html"[^>]*>Docs/);
    assert.match(html, /href="\/docs\/1737944013-use-of-service\.html"[^>]*>Terms/);
  }
});

test("promotion chrome is stable and does not invent an expiry", () => {
  for (const route of publicRoutes) {
    assert.doesNotMatch(HTML(route), /POWER30|countdown|srdp_offer_end/i, `${route}: no unverified promotion or timer`);
  }
  assert.doesNotMatch(HTML("build.mjs"), /POWER30|srdp_offer_end|COUNTDOWN_MS/);
  assert.match(HTML("index.html"), /Prices and stock are shown on the order page/i);
});

test("homepage plan handoff is an honest handoff without fake completion state", () => {
  const home = HTML("index.html");
  const mainJs = HTML("js/main.js");
  assert.match(home, /premium-detail-foot/);
  assert.match(home, /Prices and stock are shown on the order page/i);
  assert.doesNotMatch(home, /server online|deployed in \\d+s|demo complete|provisioning virtual machine[^<]*ok/i);
  assert.doesNotMatch(mainJs, /deployBar|deployPct|consoleOnline|Math\\.random|setInterval/);
});

test("homepage uses the premium technical-editorial composition", () => {
  const home = HTML("index.html");
  assert.match(home, /class="cq-home(?:\s|["])/);
  assert.match(home, /class="cq-hero(?:\s|["])/);
  assert.match(home, /class="cq-machines(?:\s|["])/);
  assert.match(home, /class="cq-machine-list"/);
  assert.match(home, /class="cq-detail-card(?:\s|["])/);
  assert.match(home, /class="cq-plan-row"/);
  assert.match(home, /id="selectorCta"/);
  assert.match(home, /id="selectedName"/);
  assert.doesNotMatch(home, /id="testimonials"|class="quote-block"/);
  assert.match(home, /Prices and stock are shown on the order page/i);
  assert.doesNotMatch(home, /WHMCS/i);
});

test("homepage follows the premium technical-editorial brand contract", () => {
  const home = HTML("index.html");
  assert.match(home, /Choose a server/);
  assert.match(home, /cq-machine/);
  assert.match(home, /Windows \+ Linux/i);
  assert.match(home, /NVMe storage/i);
  assert.match(home, /Full admin rights/i);
  assert.match(home, /theme-toggle|themeToggle/i);
  assert.doesNotMatch(home, /<div class="ticker"/);
  assert.doesNotMatch(home, /artifact-annotation|desk-proof-panel|monitoring snapshot/i);
  assert.match(home, /href="https:\/\/dash\.stealthrdp\.com\/index\.php\?rp=\/store\/standard-usa-rdp-vps\//);
});
