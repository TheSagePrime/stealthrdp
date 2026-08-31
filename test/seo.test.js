"use strict";
/* StealthRDP v2 — SEO surface tests (node --test)
   Asserts every public route has: title, meta description, one H1, canonical,
   OG/Twitter, parseable JSON-LD, and that sitemap/robots are valid. */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HTML = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const BLOG = require(path.join(ROOT, "js", "blog-data.js")).SRDP_BLOG;
const DOCS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "docs-articles.json"), "utf8"));
const { APPROVED_INDEXABLE_COMMERCIAL_PAGES, checkAiDiscovery } = require(path.join(ROOT, "lib", "ai-discovery.js"));
const OS_ROUTES = ["windows-vps/index.html", "linux-vps/index.html"];

const ROUTES = [
  "index.html",
  "plans.html",
  ...OS_ROUTES,
  "status.html",
  "blog.html",
  "faq.html",
  "about.html",
  "privacy.html",
  ...BLOG.map((p) => `blog/${p.slug}.html`),
  "docs.html",
  ...DOCS.map((p) => `docs/${p.slug}.html`),
];

function parse(html) {
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || "";
  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  const ogTitle = /property="og:title" content="[^"]*"/.test(html);
  const ogDesc = /property="og:description" content="[^"]*"/.test(html);
  const ogImage = /property="og:image" content="[^"]*"/.test(html);
  const twitter = /name="twitter:card" content="summary_large_image"/.test(html);
  const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  return { title, desc, canonical, h1s, ogTitle, ogDesc, ogImage, twitter, ldBlocks };
}

test("every route exposes a complete SEO surface", () => {
  for (const route of ROUTES) {
    const html = HTML(route);
    const s = parse(html);
    assert.ok(s.title.length >= 10 && s.title.length <= 70, `${route}: title "${s.title}" length ${s.title.length}`);
    assert.ok(s.desc.length >= 70 && s.desc.length <= 170, `${route}: description length ${s.desc.length}`);
    assert.strictEqual(s.h1s, 1, `${route}: expected exactly one H1, got ${s.h1s}`);
    assert.ok(s.canonical.startsWith("__SRDP_BASE__"), `${route}: canonical present ${s.canonical}`);
    assert.ok(s.ogTitle && s.ogDesc && s.ogImage, `${route}: OG complete`);
    assert.ok(s.twitter, `${route}: twitter card`);
    assert.ok(s.ldBlocks.length >= 1, `${route}: JSON-LD present`);
    assert.strictEqual((html.match(/<script defer data-website-id="dfid_6O4WzLRhSgrGULypBOc8I" data-domain="stealthrdp\.com" src="https:\/\/datafa\.st\/js\/script\.js"><\/script>/g) || []).length, 1, `${route}: DataFast script`);
    for (const block of s.ldBlocks) {
      const parsed = JSON.parse(block); // throws if invalid
      assert.ok(parsed["@context"] === "https://schema.org", `${route}: schema.org context`);
    }
  }
});

test("homepage JSON-LD has Organization + WebSite; plans has Service offers; faq has FAQPage", () => {
  const index = parse(HTML("index.html"));
  const indexTypes = index.ldBlocks.flatMap((b) => JSON.parse(b)["@graph"] || [JSON.parse(b)]).map((x) => x["@type"]);
  assert.ok(indexTypes.includes("Organization"), "home: Organization");
  assert.ok(indexTypes.includes("WebSite"), "home: WebSite");

  const plans = parse(HTML("plans.html"));
  const plansGraph = plans.ldBlocks.flatMap((b) => JSON.parse(b)["@graph"] || [JSON.parse(b)]);
  assert.ok(plansGraph.some((x) => x["@type"] === "ItemList"), "plans: ItemList");
  const services = plansGraph.filter((x) => x["@type"] === "ItemList").flatMap((x) => x.itemListElement || []).map((i) => i.item);
  assert.ok(services.length >= 10, `plans: ${services.length} service entries`);
  const first = services[0];
  assert.ok(first["@type"] === "Service" && first.offers && first.offers.price > 0, "plans: Service with Offer");

  const faq = parse(HTML("faq.html"));
  const faqGraph = faq.ldBlocks.flatMap((b) => JSON.parse(b)["@graph"] || [JSON.parse(b)]);
  const faqPage = faqGraph.find((x) => x["@type"] === "FAQPage");
  assert.ok(faqPage && faqPage.mainEntity.length === 21, `faq: FAQPage with 21 Q&A (got ${faqPage && faqPage.mainEntity.length})`);
});

test("blog post pages carry Article JSON-LD + breadcrumbs", () => {
  for (const post of BLOG) {
    const s = parse(HTML(`blog/${post.slug}.html`));
    const graph = s.ldBlocks.flatMap((b) => JSON.parse(b)["@graph"] || [JSON.parse(b)]);
    const types = graph.map((x) => x["@type"]);
    assert.ok(types.includes("BlogPosting"), `${post.slug}: BlogPosting`);
    assert.ok(types.includes("BreadcrumbList"), `${post.slug}: BreadcrumbList`);
    const art = graph.find((x) => x["@type"] === "BlogPosting");
    assert.ok(art.headline === post.title && art.datePublished === post.date, `${post.slug}: article metadata matches`);
  }
});

test("sitemap.xml is valid XML with all routes; robots.txt allows + references it", () => {
  const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
  assert.ok(sitemap.startsWith("<?xml"), "sitemap XML declaration");
  assert.ok(sitemap.includes("<urlset"), "sitemap urlset");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.strictEqual(locs.length, ROUTES.length, `sitemap has ${ROUTES.length} URLs`);
  for (const loc of locs) assert.ok(loc.startsWith("__SRDP_BASE__/"), `sitemap absolute loc ${loc}`);
  for (const route of ROUTES) {
    const sitemapRoute = route === "index.html"
      ? ""
      : route.endsWith("/index.html")
        ? route.slice(0, -"index.html".length)
        : route;
    const wanted = `__SRDP_BASE__/${sitemapRoute}`;
    assert.ok(locs.includes(wanted), `sitemap includes ${wanted}`);
  }

  const robots = fs.readFileSync(path.join(ROOT, "robots.txt"), "utf8");
  assert.ok(/^User-agent: \*$/m.test(robots), "robots allows all");
  assert.ok(
    /^Content-Signal: ai-train=no, search=yes, ai-input=yes$/m.test(robots),
    "robots permits search and AI answers but reserves model-training rights",
  );
  assert.ok(robots.includes("Sitemap: __SRDP_BASE__/sitemap.xml"), "robots references sitemap");
  assert.ok(
    robots.includes("# AI guide: __SRDP_BASE__/llms.txt"),
    "robots references llms.txt with a valid comment",
  );
  assert.ok(!/^llms\.txt$/m.test(robots), "robots has no malformed bare llms.txt line");
  assert.ok(robots.includes("Disallow: /api/"), "robots blocks api");

  const indexNowKey = fs.readFileSync(
    path.join(ROOT, "d6725e43a76b47b39052a3f5c4ee06bf.txt"),
    "utf8",
  );
  assert.strictEqual(indexNowKey.trim(), "d6725e43a76b47b39052a3f5c4ee06bf", "IndexNow key file");
});

test("AI-readable guide exists and source templates stay free of raw infrastructure IPs", () => {
  const llms = fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  assert.ok(llms.startsWith("# StealthRDP"), "llms.txt heading");
  assert.ok(llms.includes("__SRDP_BASE__/plans.html"), "llms.txt links to plans");
  assert.ok(llms.includes("__SRDP_BASE__/faq.html"), "llms.txt links to FAQ");
  assert.ok(llms.includes("10,000+ orders processed"), "llms.txt matches homepage order proof");
  assert.ok(!llms.includes("10,877"), "llms.txt has no old customer count");
  assert.ok(!llms.includes("25,000+ servers"), "llms.txt has no server-count claim");
  assert.doesNotMatch(HTML("build.mjs"), /\b(?:\d{1,3}\.){3}\d{1,3}\b/, "build template has no raw IPv4 address");
  for (const route of ROUTES) {
    if (route.startsWith("blog/")) continue;
    assert.doesNotMatch(HTML(route), /\b(?:\d{1,3}\.){3}\d{1,3}\b/, `${route}: no raw IPv4 address`);
  }
});

test("AI discovery gate covers every approved commercial page", () => {
  const llms = HTML("llms.txt");
  const robots = HTML("robots.txt");
  assert.deepStrictEqual(checkAiDiscovery({ root: ROOT }), [], "source AI discovery surface passes");
  for (const page of APPROVED_INDEXABLE_COMMERCIAL_PAGES) {
    assert.match(llms, new RegExp(`__SRDP_BASE__${page.path.replaceAll("/", "\\/")}`), `${page.label}: llms entry`);
  }
  assert.match(llms, /Windows VPS hosting].*plans\.html#windows-vps.*dash\.stealthrdp\.com\/index\.php\?rp=\/store\/standard-usa-rdp-vps/);
  assert.match(llms, /Linux VPS hosting].*plans\.html#linux-vps.*dash\.stealthrdp\.com\/index\.php\?rp=\/store\/standard-usa-rdp-vps/);
  assert.match(robots, /# AI guide: __SRDP_BASE__\/llms\.txt/);

  const withoutWindows = llms.replace(/^- \[Windows VPS hosting\].*\n/m, "");
  assert.match(
    checkAiDiscovery({ llmsText: withoutWindows, robotsText: robots }).join("\n"),
    /approved commercial page missing __SRDP_BASE__\/windows-vps\//,
    "missing commercial entry fails the gate",
  );
});

test("baked content is present in raw HTML (plans, faq, status, blog)", () => {
  const plans = HTML("plans.html");
  assert.ok(plans.includes("Bronze USA"), "plans: baked Bronze card");
  assert.ok(plans.includes("VPS Features Comparison"), "plans: compare table");
  assert.ok(plans.includes("Included with every plan"), "plans: included essentials rail");
  assert.ok((plans.match(/<article class="plan-card/g) || []).length === 6, "plans: 6 baked USA cards");

  const faq = HTML("faq.html");
  assert.ok(faq.includes("What services does StealthRDP offer?"), "faq: baked first question");
  assert.strictEqual((faq.match(/<div class="faq-item/g) || []).length, 21, "faq: 21 baked items");

  const status = HTML("status.html");
  assert.ok(status.includes("All services are online"), "status: service heading baked");
  assert.ok(status.includes("node-card"), "status: node cards baked");

  const blog = HTML("blog.html");
  assert.strictEqual((blog.match(/<article class="blog-card/g) || []).length, 11, "blog: 11 baked cards");
  assert.ok(blog.includes(`/blog/${BLOG[0].slug}.html`), "blog: links to clean article URLs");

  for (const post of BLOG) {
    const article = HTML(`blog/${post.slug}.html`);
    assert.ok(!article.includes("Full article content is managed"), `${post.slug}: no placeholder`);
    assert.ok(!article.includes("app.seobotai.com/banner"), `${post.slug}: no seobot banner`);
    assert.ok(article.includes("docs-content"), `${post.slug}: uses structured article layout`);
    assert.ok(article.includes("docs-toc"), `${post.slug}: has on-this-page TOC`);
    assert.ok(article.includes('href="/plans.html"'), `${post.slug}: links to plans`);
    assert.ok((article.match(/<h2 /g) || []).length >= 2, `${post.slug}: has section headings`);
    assert.ok(article.length > 8000, `${post.slug}: full body baked (${article.length})`);
  }
});

test("no leftover loading placeholders in raw HTML", () => {
  for (const route of ROUTES) {
    const html = HTML(route);
    assert.ok(!html.includes("Loading plans…"), `${route}: no plans loading placeholder`);
    assert.ok(!html.includes("Loading articles…"), `${route}: no blog loading placeholder`);
  }
});

test("VPS SEO hub keeps OS anchors, selector, internal links, and checkout paths", () => {
  const home = HTML("index.html");
  const plans = HTML("plans.html");
  assert.match(plans, /<title>Windows &amp; Linux VPS Hosting \| USA &amp; EU \| StealthRDP<\/title>/);
  assert.match(plans, /<meta name="description" content="Compare Windows and Linux VPS hosting plans from StealthRDP/);
  assert.strictEqual((plans.match(/<h1[\s>]/g) || []).length, 1, "plans: one H1");
  assert.match(plans, /<h1>Windows &amp; Linux VPS Hosting Plans<\/h1>/);
  assert.match(plans, /id="windows-vps"/);
  assert.match(plans, /id="linux-vps"/);
  assert.match(plans, /id="comparison"/);
  assert.match(home, /id="osSelect"[\s\S]*value="windows"[\s\S]*value="linux"/);
  assert.match(home, /href="\/plans\.html#windows-vps">Windows VPS<\/a>/);
  assert.match(home, /href="\/plans\.html#linux-vps">Linux VPS<\/a>/);
  assert.match(home, /href="\/plans\.html#comparison">Compare VPS resources<\/a>/);

  const checkoutPaths = [
    "standard-usa-rdp-vps/bronze-usa2",
    "standard-usa-rdp-vps/silver-usa",
    "standard-usa-rdp-vps/gold-usa",
    "standard-usa-rdp-vps/platinum-usa",
    "standard-usa-rdp-vps/diamond-usa",
    "standard-usa-rdp-vps/emerald-usa",
    "eu/bronze-eu",
    "eu/silver-eu",
    "eu/gold-eu",
    "eu/platinum-eu",
    "eu/diamond-eu",
  ];
  for (const checkoutPath of checkoutPaths) {
    const escapedPath = checkoutPath.replace("/", "\\/");
    assert.match(plans, new RegExp(`https://dash\\.stealthrdp\\.com/index\\.php\\?rp=/store/${escapedPath}&billingcycle=monthly`), `${checkoutPath}: shared WHMCS path`);
  }

  assert.match(HTML("blog/windows-vs-linux-vps-which-os-best-fits-your-business.html"), /href="\/plans\.html#windows-vps"/);
  assert.match(HTML("blog/windows-vs-linux-vps-which-os-best-fits-your-business.html"), /href="\/plans\.html#linux-vps"/);
  assert.match(HTML("blog/5-ways-to-optimize-your-rdp-performance-for-remote-work.html"), /href="\/plans\.html#windows-vps"/);
  assert.match(HTML("blog/8-signs-you-need-to-upgrade-your-vps-resources.html"), /href="\/plans\.html#comparison"/);
  assert.match(HTML("blog/common-vps-hosting-issues-and-their-solutions.html"), /href="\/plans\.html#linux-vps"/);
});

test("OS landing pages have separate commercial intent, page schema, and shared checkout", () => {
  const windows = HTML("windows-vps/index.html");
  const linux = HTML("linux-vps/index.html");
  assert.match(windows, /<title>Windows VPS Hosting \| USA &amp; EU Plans \| StealthRDP<\/title>/);
  assert.match(linux, /<title>Linux VPS Hosting \| USA &amp; EU Plans \| StealthRDP<\/title>/);
  assert.match(windows, /canonical" href="__SRDP_BASE__\/windows-vps\//);
  assert.match(linux, /canonical" href="__SRDP_BASE__\/linux-vps\//);
  assert.match(windows, /<h1>Windows VPS hosting for work that belongs on Windows<\/h1>/);
  assert.match(linux, /<h1>Linux VPS hosting for the stack you need to run<\/h1>/);
  assert.strictEqual((windows.match(/<h1[\s>]/g) || []).length, 1);
  assert.strictEqual((linux.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(windows, /windows-vps\/.*Windows VPS|Windows VPS.*windows-vps\//s);
  assert.match(linux, /linux-vps\/.*Linux VPS|Linux VPS.*linux-vps\//s);
  assert.match(windows, /href="\/plans\.html#windows-vps"/);
  assert.match(linux, /href="\/plans\.html#linux-vps"/);
  assert.match(windows, /href="\/plans\.html#comparison"/);
  assert.match(linux, /href="\/plans\.html#comparison"/);
  assert.match(windows, /alt="Windows operating system logo"/);
  assert.match(linux, /alt="Linux operating system logo"/);
  for (const html of [windows, linux]) {
    const graph = parse(html).ldBlocks.flatMap((b) => JSON.parse(b)["@graph"] || [JSON.parse(b)]);
    assert.ok(graph.some((item) => item["@type"] === "BreadcrumbList"), "OS page: BreadcrumbList");
    assert.ok(graph.some((item) => item["@type"] === "WebPage"), "OS page: WebPage");
    assert.match(html, /https:\/\/dash\.stealthrdp\.com\/index\.php\?rp=\/store\/standard-usa-rdp-vps/);
    assert.doesNotMatch(html, /TODO|TBD|PLACEHOLDER|LOREM IPSUM/i);
  }
  assert.notStrictEqual(windows, linux, "OS pages are not duplicate HTML");
});

test("OS landing pages use the approved copy and preserve current Bronze pricing", () => {
  const windows = HTML("windows-vps/index.html");
  const linux = HTML("linux-vps/index.html");
  assert.match(windows, /Keep your Windows workflow in reach/);
  assert.match(windows, /Windows Server 2016/);
  assert.match(windows, /Administrator access for hands-on control/);
  assert.match(windows, /Bronze USA at <strong>€9\.50\/month<\/strong>/);
  assert.match(windows, /Need Linux instead\?/);
  assert.doesNotMatch(windows, /Choose a Windows VPS by workload/);
  assert.match(linux, /Start with the stack, not the plan name/);
  assert.match(linux, /Ubuntu 18\.04/);
  assert.match(linux, /Root access for server administration/);
  assert.match(linux, /Bronze EU is also <strong>€9\.50\/month<\/strong>/);
  assert.match(linux, /Need Windows instead\?/);
  assert.doesNotMatch(linux, /Linux VPS Hosting Plans/);
});

test("OS landing page heroes use the colored vendor logo variants", () => {
  const windows = HTML("windows-vps/index.html");
  const linux = HTML("linux-vps/index.html");
  assert.match(windows, /class="os-vps-logo" src="\/assets\/os-logos\/windows-colored\.svg"/);
  assert.match(linux, /class="os-vps-logo" src="\/assets\/os-logos\/linux-colored\.svg"/);
  assert.match(fs.readFileSync(path.join(ROOT, "assets", "os-logos", "windows-colored.svg"), "utf8"), /fill="#00A4EF"/);
  assert.match(fs.readFileSync(path.join(ROOT, "assets", "os-logos", "linux-colored.svg"), "utf8"), /fill="#FCC624"/);
});

test("OS landing pages are linked from the approved site context", () => {
  assert.match(HTML("index.html"), /href="\/windows-vps\/"/);
  assert.match(HTML("index.html"), /href="\/linux-vps\/"/);
  assert.match(HTML("plans.html"), /href="\/windows-vps\/"/);
  assert.match(HTML("plans.html"), /href="\/linux-vps\/"/);
  for (const route of [
    "blog/windows-vs-linux-vps-which-os-best-fits-your-business.html",
    "blog/5-ways-to-optimize-your-rdp-performance-for-remote-work.html",
    "blog/8-signs-you-need-to-upgrade-your-vps-resources.html",
  ]) {
    const html = HTML(route);
    assert.match(html, /href="\/windows-vps\/"/);
    if (route.includes("windows-vs-linux") || route.includes("8-signs")) assert.match(html, /href="\/linux-vps\/"/);
  }
  const windows = HTML("windows-vps/index.html");
  const linux = HTML("linux-vps/index.html");
  assert.match(windows, /Products<\/h4>[\s\S]*href="\/linux-vps\/"/);
  assert.match(linux, /Products<\/h4>[\s\S]*href="\/windows-vps\/"/);
});

test("rss, security.txt, HowTo schema, and checkout events exist", () => {
  const rss = fs.readFileSync(path.join(ROOT, "rss.xml"), "utf8");
  assert.ok(rss.includes("<rss"), "rss feed");
  assert.ok(rss.includes("__SRDP_BASE__/blog/"), "rss uses host token");
  assert.strictEqual((rss.match(/<item>/g) || []).length, BLOG.length, "rss has every post");

  const security = fs.readFileSync(path.join(ROOT, ".well-known/security.txt"), "utf8");
  assert.ok(security.includes("mailto:support@stealthrdp.com"), "security contact");

  const howtoPost = HTML("blog/how-to-set-up-automated-backups-for-vps-hosting.html");
  assert.ok(howtoPost.includes('"@type":"HowTo"'), "tutorial post has HowTo schema");

  const main = fs.readFileSync(path.join(ROOT, "js/main.js"), "utf8");
  assert.ok(main.includes('dl("begin_checkout"'), "begin_checkout event");
  assert.ok(main.includes('dl("view_plans"'), "view_plans event");

  const bake = fs.readFileSync(path.join(ROOT, "scripts/bake-base.mjs"), "utf8");
  assert.ok(bake.includes("https://www.stealthrdp.com"), "Vercel bake defaults to www");
});

test("Vercel bake includes nested OS landing pages", () => {
  const bake = fs.readFileSync(path.join(ROOT, "scripts/bake-base.mjs"), "utf8");
  assert.match(bake, /path\.join\(ROOT, "windows-vps"\)/);
  assert.match(bake, /path\.join\(ROOT, "linux-vps"\)/);
});
