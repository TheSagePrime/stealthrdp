"use strict";
/* Native documentation, trust, and client-side index behaviour tests. */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HTML = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const DOCS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "docs-articles.json"), "utf8"));
const cleanSlug = (slug) => slug.replace(/^\d+-/, "").replaceAll("_", "-").toLowerCase();
const docFile = (article) => `docs/${cleanSlug(article.slug)}.html`;
const publicRoutes = [
  "index.html", "plans.html", "windows-vps/index.html", "linux-vps/index.html", "status.html", "blog.html", "faq.html", "about.html", "privacy.html", "docs.html",
  ...DOCS.map(docFile),
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
    assert.ok(html.includes(`/docs/${cleanSlug(article.slug)}`), `${article.slug}: clean native route is linked`);
  }
});

test("every native article has metadata, breadcrumbs, readable content, and support", () => {
  for (const article of DOCS) {
    const html = HTML(docFile(article));
    assert.match(html, /<main[^>]+class="docs-article-page/);
    assert.strictEqual((html.match(/<h1[\s>]/g) || []).length, 1, `${article.slug}: one H1`);
    assert.match(html, /data-docs-category="[^"]+"/);
    assert.match(html, /class="docs-breadcrumbs"/);
    assert.match(html, /class="docs-source-meta"/);
    assert.match(html, /class="docs-content"/);
    assert.match(html, /https:\/\/dash\.stealthrdp\.com\/submitticket\.php/);
    assert.ok(!html.includes("docs.stealthrdp.com"), `${article.slug}: no legacy docs host`);
    assert.ok(!html.includes("Chatwoot"), `${article.slug}: no Chatwoot reference`);
  }
});

test("docs renderer keeps commands in copyable code blocks and replaces legacy internal links", () => {
  const html = DOCS.map((article) => HTML(docFile(article))).join("\n");
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
    assert.doesNotMatch(html, /docs\.stealthrdp\.com|Chatwoot|\bWHMCS\b/i, `${route}: legacy service reference`);
    assert.doesNotMatch(html, /countdown|srdp_offer_end|72h rolling/i, `${route}: no countdown`);
  }
  const mainJs = HTML("js/main.js");
  assert.doesNotMatch(mainJs, /srdp_offer_end|COUNTDOWN_MS|setInterval\(tick/);
  const home = HTML("index.html");
  assert.match(home, /stealth deploy --plan silver-usa --region us-east/);
  assert.match(home, /installing Windows Server 2022/);
  assert.doesNotMatch(home, /server online|Live deploy console|your server is|your deployment/i);
});

test("baked status fixture renders up monitors as healthy", () => {
  const html = HTML("status.html");
  assert.match(html, /All services are online/);
  assert.match(html, /90-day availability/);
  assert.strictEqual((html.match(/n-dot up/g) || []).length, 9);
  assert.strictEqual((html.match(/n-dot down/g) || []).length, 0);
  assert.match(HTML("build.mjs"), /status === "up"/);
  assert.match(HTML("server.js"), /status === "up"/);
  assert.match(HTML("js/main.js"), /Live status unavailable/);
});

test("status rows keep the page simple and responsive", () => {
  const build = HTML("build.mjs");
  const css = HTML("css/style.css");
  assert.match(build, /class="node-list"/);
  assert.doesNotMatch(build, /status-info-grid|Recent incidents|Rolling windows/);
  assert.match(css, /\.node-card \{[\s\S]*grid-template-columns/);
  assert.match(css, /\.history-bars \{[\s\S]*grid-template-columns: repeat\(90/);
});

test("Windows ordered steps stay in one list across source blank lines", () => {
  const html = HTML("docs/how-to-re-activate-and-extend-your-180-day-windows-trial.html");
  const content = html.match(/<div class="docs-content">([\s\S]*?)<\/div><div class="docs-support">/);
  assert.ok(content, "Windows article content is present");
  assert.match(content[1], /<ol><li>Press[\s\S]*?<\/li><li>Select[\s\S]*?<\/li><\/ol>/);
  assert.doesNotMatch(content[1], /<\/ol>\s*<ol>/);
});

test("Windows evaluation article clarifies rearm vs activation on the clean route", () => {
  const html = HTML("docs/how-to-re-activate-and-extend-your-180-day-windows-trial.html");
  assert.match(html, /<h1>How to Extend the Windows Server 180-Day Evaluation Period<\/h1><aside class="docs-warning">/);
  assert.match(html, /class="docs-warning"/);
  assert.match(html, /Windows Server Evaluation Notice/);
  assert.match(html, /does not activate Windows/);
  assert.match(html, /<code>slmgr -rearm<\/code>/);
  assert.match(html, /<code>slmgr -dlv<\/code>/);
  assert.match(html, /<code>slmgr -ato<\/code>/);
  assert.match(html, /does not convert an Evaluation edition into a licensed production edition/);
  assert.match(html, /This step is not part of extending the evaluation period/);
  assert.match(html, /canonical" href="__SRDP_BASE__\/docs\/how-to-re-activate-and-extend-your-180-day-windows-trial"/);
  const visible = html.match(/<main[\s\S]*?<\/main>/)?.[0] || html;
  assert.doesNotMatch(visible, />\s*Re-activate|>\s*Re-Activate|permanently activat|indefinitely|Microsoft-approved for commercial|this makes the setup legal/i);
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
    assert.match(html, /href="\/docs"[^>]*>Documentation|href="\/docs"[^>]*>Docs/);
    assert.match(html, /href="\/docs\/use-of-service"[^>]*>Terms/);
  }
});

test("promotion chrome is stable and does not invent an expiry", () => {
  for (const route of publicRoutes) {
    assert.doesNotMatch(HTML(route), /POWER30|countdown|srdp_offer_end/i, `${route}: no unverified promotion or timer`);
  }
  assert.doesNotMatch(HTML("build.mjs"), /POWER30|srdp_offer_end|COUNTDOWN_MS/);
  assert.match(HTML("index.html"), /stealth deploy --plan silver-usa --region us-east/);
});

test("preview palette lab exposes ten named variants with persistence", () => {
  const build = HTML("build.mjs");
  const css = HTML("css/style.css");
  const mainJs = HTML("js/main.js");
  const home = HTML("index.html");
  const keys = ["cobalt", "gold", "cyan", "violet", "coral", "mint", "rose", "orange", "indigo", "ice"];
  for (const key of keys) {
    assert.match(build, new RegExp(`key: "${key}"`), `${key}: source palette`);
    assert.match(css, new RegExp(`data-palette="${key}"`), `${key}: CSS palette`);
    assert.match(home, new RegExp(`data-palette="${key}"`), `${key}: generated swatch`);
  }
  assert.match(home, /id="paletteLab"/);
  assert.match(mainJs, /stealthrdp-preview-palette/);
  assert.match(mainJs, /event\.key === "Escape"/);
});

test("Features catalog is consolidated into Plans and the old route redirects", () => {
  const build = HTML("build.mjs");
  const server = HTML("server.js");
  const home = HTML("index.html");
  const plans = HTML("plans.html");
  const sitemap = HTML("sitemap.xml");
  assert.ok(!fs.existsSync(path.join(ROOT, "features.html")), "Features page is removed from the generated surface");
  assert.doesNotMatch(build, /buildFeatures|featureCardHtml|href="\/features\.html"/);
  assert.doesNotMatch(home, /href="\/features\.html"/);
  assert.doesNotMatch(plans, /href="\/features\.html"/);
  assert.match(plans, /class="included-rail"/);
  assert.match(plans, /Included with every plan/);
  assert.match(plans, /Full admin access/);
  assert.match(plans, /NVMe SSD storage/);
  assert.match(server, /url\.pathname === "\/features\.html"/);
  assert.match(server, /Location: "\/#why"/);
  assert.doesNotMatch(sitemap, /features\.html/);
});

test("hero console shows a deploy sequence without personal account claims", () => {
  const home = HTML("index.html");
  const mainJs = HTML("js/main.js");
  assert.match(home, /stealth deploy --plan silver-usa --region us-east/);
  assert.match(home, /reserving dedicated vCPU/);
  assert.match(home, /installing Windows Server 2022/);
  assert.match(home, /Windows Server 2022 ready in 60s/);
  assert.doesNotMatch(home, /your server is|your deployment|provisioned for your account|payment verified/i);
  assert.doesNotMatch(mainJs, /deployBar|deployPct|consoleOnline|Math\\.random|setInterval/);
});
