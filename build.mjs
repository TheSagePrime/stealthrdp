#!/usr/bin/env node
/**
 * StealthRDP v2 — SEO build (prerender)
 *
 * Bakes REAL API data (committed snapshots in data/*.json) into static HTML so
 * every public route exposes primary content, metadata, canonical and JSON-LD
 * in the initial response. The runtime JS still enhances (billing toggles,
 * live status refresh) but the page is crawlable without it.
 *
 * Canonical/OG URLs use the __SRDP_BASE__ token; server.js replaces it with the
 * request origin at serve time so canonicals are always host-correct (tunnel
 * today, real domain later).
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DATA = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8"));

const PRICING_CATALOG = DATA("plans.json");
const CATALOG = PRICING_CATALOG.plans;
const USA = CATALOG.filter((plan) => plan.location === "USA");
const EU = CATALOG.filter((plan) => plan.location === "EU");
const pricing = require(path.join(ROOT, "js", "pricing.js"));
const LOWEST_PLAN = CATALOG.reduce((lowest, plan) => {
  const amount = pricing.cycleEntry(plan, "monthly").amount;
  return !lowest || amount < pricing.cycleEntry(lowest, "monthly").amount ? plan : lowest;
}, null);
const STARTING_PRICE = pricing.formatAmount(pricing.cycleEntry(LOWEST_PLAN, "monthly").amount);
const FAQS = DATA("faqs.json");
const TESTIMONIALS = DATA("testimonials.json");
const REVIEWS = DATA("reviews.json");
const UPTIME = DATA("uptime.json");
const BLOG = require(path.join(ROOT, "js", "blog-data.js")).SRDP_BLOG;
const BLOG_BODIES = new Map(DATA("blog-articles.json").map((article) => [article.slug, article]));
const DOCS = DATA("docs-articles.json");

const MONITORS = (UPTIME && UPTIME.monitors) || [];
const isUp = (monitor) => monitor && (monitor.status === 2 || monitor.status === "2" || monitor.status === "up");
const UP = MONITORS.filter(isUp).length;
const TOTAL = MONITORS.length;
const ALL_UP = TOTAL > 0 && UP === TOTAL;
const DOC_BY_SLUG = new Map(DOCS.map((article) => [article.slug, article]));
const TERMS_URL = `/docs/${(DOCS.find((article) => article.slug === "1737944013-use-of-service") || DOCS.find((article) => /terms|service/i.test(article.category)) || DOCS[0]).slug}.html`;

/* ---------- helpers ---------- */
const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SEO_TITLE_LIMIT = 60;
function seoTitle(title, suffix = " — StealthRDP") {
  const value = String(title || "").trim();
  const full = `${value}${suffix}`;
  if (full.length <= SEO_TITLE_LIMIT) return full;
  const available = SEO_TITLE_LIMIT - suffix.length - 1;
  return `${value.slice(0, Math.max(1, available)).trimEnd()}…${suffix}`;
}
function seoDescription(description) {
  const value = String(description || "").trim();
  if (value.length <= 160) return value;
  const clipped = value.slice(0, 157).replace(/\s+\S*$/, "").trim();
  return `${clipped}…`;
}

const PLAN_SLUGS = {
  "Bronze USA": "bronze-usa2", "Silver USA": "silver-usa", "Gold USA": "gold-usa",
  "Platinum USA": "platinum-usa", "Diamond USA": "diamond-usa", "Emerald USA": "emerald-usa",
  "Bronze EU": "bronze-eu", "Silver EU": "silver-eu", "GOLD EU": "gold-eu",
  "Platinum EU": "platinum-eu", "Diamond EU": "diamond-eu", "Emerald EU": "emerald-eu",
};
const planUrl = (p) => {
  const slug = PLAN_SLUGS[p.name];
  if (slug) {
    const category = p.name.endsWith(" EU") ? "eu" : "standard-usa-rdp-vps";
    return "https://dash.stealthrdp.com/index.php?rp=/store/" + category + "/" + slug + "&billingcycle=monthly";
  }
  if (p.purchaseUrl) return p.purchaseUrl;
  return "https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps";
};
const planName = (p) => p.name.replace(" USA", "").replace(" EU", "");
const displayPlanName = (p) => planName(p).replace(/[A-Za-z]+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
function planSpecLine(p) {
  const specs = p.specs || {};
  return [specs.cpu, specs.ram, specs.storage].filter(Boolean).join(" · ");
}
function firstPopularName(plans) {
  const hit = plans.find((plan) => plan.popular);
  return hit ? hit.name : "";
}

const PALETTES = [
  { key: "cobalt", label: "Cobalt", accent: "#5b8cff", hover: "#7aa5ff", deep: "#3f6fe0", rgb: "91, 140, 255", ink: "#07111f" },
  { key: "gold", label: "Gold", accent: "#f5b93b", hover: "#ffc94d", deep: "#d99a24", rgb: "245, 185, 59", ink: "#171204" },
  { key: "cyan", label: "Cyan", accent: "#3dd6d0", hover: "#67e5df", deep: "#1da9a5", rgb: "61, 214, 208", ink: "#062426" },
  { key: "violet", label: "Violet", accent: "#a78bfa", hover: "#c4b5fd", deep: "#7956d8", rgb: "167, 139, 250", ink: "#160b2d" },
  { key: "coral", label: "Coral", accent: "#ff7a66", hover: "#ff9a8a", deep: "#db4d3d", rgb: "255, 122, 102", ink: "#2a0c08" },
  { key: "mint", label: "Mint", accent: "#4ade80", hover: "#72f0a0", deep: "#22a85a", rgb: "74, 222, 128", ink: "#062313" },
  { key: "rose", label: "Rose", accent: "#f472b6", hover: "#fb8ec4", deep: "#d1428d", rgb: "244, 114, 182", ink: "#2a0a1b" },
  { key: "orange", label: "Orange", accent: "#ff9f43", hover: "#ffb86b", deep: "#d87720", rgb: "255, 159, 67", ink: "#2a1304" },
  { key: "indigo", label: "Indigo", accent: "#818cf8", hover: "#a5b4fc", deep: "#5864d2", rgb: "129, 140, 248", ink: "#0d102d" },
  { key: "ice", label: "Ice", accent: "#7dd3fc", hover: "#a5e3ff", deep: "#43a8da", rgb: "125, 211, 252", ink: "#062034" },
];
const PALETTE_KEYS = PALETTES.map((palette) => palette.key);
const PALETTE_STORAGE_KEY = "stealthrdp-preview-palette";
const THEME_STORAGE_KEY = "stealthrdp-preview-theme";

const SOCIAL = [
  { href: "https://x.com/stealthrdp", label: "X / Twitter" },
  { href: "https://www.instagram.com/stealth_rdp", label: "Instagram" },
  { href: "https://discord.gg/9JJFs4DDyF", label: "Discord" },
  { href: "https://t.me/StealthRDP", label: "Telegram" },
];

/* ---------- head generator ---------- */
function head({ title, description, canonical, pageType = "website", jsonLd = [], robots = "index,follow" }) {
  const og = pageType === "article" ? "article" : "website";
  const ld = jsonLd.map((block) => `<script type="application/ld+json">${JSON.stringify(block)}</script>`).join("");
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="${robots}" />
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
  <meta http-equiv="Pragma" content="no-cache" />
  <meta http-equiv="Expires" content="0" />
  <meta name="author" content="StealthRDP" />
  <meta name="msvalidate.01" content="BC1193DFC35353EA0CED70B0E5F25F09" />
  <link rel="canonical" href="${canonical}" />
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="alternate" type="application/rss+xml" title="StealthRDP Blog" href="__SRDP_BASE__/rss.xml" />
  <meta name="theme-color" content="#07111f" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:type" content="${og}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="__SRDP_BASE__/assets/og-cover.png" />
  <meta property="og:site_name" content="StealthRDP" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@stealthrdp" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="__SRDP_BASE__/assets/og-cover.png" />
  <meta name="color-scheme" content="dark light" />
  <script>
    (function () {
      try {
        var savedTheme = window.localStorage.getItem("${THEME_STORAGE_KEY}");
        if (savedTheme === "light" || savedTheme === "dark") document.documentElement.setAttribute("data-theme", savedTheme);
      } catch (e) {}
    }());
  </script>
  <script>
    (function () {
      try {
        var host = window.location.hostname;
        var preview = host === "preview.antah.de" || host === "localhost";
        var saved = preview ? window.localStorage.getItem("${PALETTE_STORAGE_KEY}") : "";
        var allowed = ${JSON.stringify(PALETTE_KEYS)};
        if (preview && allowed.indexOf(saved) !== -1) document.documentElement.setAttribute("data-palette", saved);
      } catch (e) {}
    }());
  </script>
  <link rel="stylesheet" href="/css/style.css?v=${ASSET_STAMP}" />
  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src="https://sgtm.stealthrdp.com/2l3xebiqyzc.js?"+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','yw=Ch5ENj0vSDYwSUBGOjFcXhVHS19YRAEWXgkNFAgOERARHglfCg0I');</script>
  <!-- End Google Tag Manager -->
  <script defer data-website-id="dfid_6O4WzLRhSgrGULypBOc8I" data-domain="stealthrdp.com" src="https://datafa.st/js/script.js"></script>
  ${ld}
</head>`;
}

/* ---------- shared chrome (header + footer) ---------- */
const LOGO_DARK_URL = "https://cdn.stealthrdp.com/images/new/6.png";
const LOGO_LIGHT_URL = "https://cdn.stealthrdp.com/images/new/5.png";
const LOGO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>';
const LOGO_IMAGE_HTML = `<span class="logo-image" aria-hidden="true"><img class="logo-image-dark" src="${LOGO_DARK_URL}" alt="StealthRDP dark logo" width="700" height="170" decoding="async"><img class="logo-image-light" src="${LOGO_LIGHT_URL}" alt="StealthRDP light logo" width="700" height="170" decoding="async"></span>`;
const ARROW_SVG = '<svg class="inline-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
const EXTERNAL_SVG = '<svg class="inline-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 5h5v5"/><path d="M19 5 11 13"/><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>';
const CHEVRON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
function navHtml(active) {
  const items = [
    ["home", "/", "Home"], ["plans", "/plans.html", "Plans"],
    ["status", "/status.html", "Server Status"], ["docs", "/docs.html", "Docs"], ["blog", "/blog.html", "Blog"], ["faq", "/faq.html", "FAQ"],
  ];
  return items.map(([k, href, label]) => `<a href="${href}"${k === active ? ' class="active"' : ""}>${label}</a>`).join("");
}

function paletteLabHtml() {
  const options = PALETTES.map((palette, index) => `<button type="button" class="palette-option${index === 0 ? " active" : ""}" data-palette="${palette.key}" aria-pressed="${index === 0 ? "true" : "false"}">
      <span class="palette-swatch" style="--swatch: ${palette.accent}" aria-hidden="true"></span><span>${palette.label}</span>
    </button>`).join("");
  return `<div class="palette-lab" id="paletteLab">
      <button type="button" class="palette-trigger" id="paletteTrigger" aria-expanded="false" aria-controls="palettePanel">
        <span class="palette-trigger-swatch" id="paletteTriggerSwatch" style="--swatch: ${PALETTES[0].accent}" aria-hidden="true"></span><span>Palette</span><span class="palette-trigger-chevron" aria-hidden="true">⌄</span>
      </button>
      <div class="palette-panel" id="palettePanel" role="region" aria-label="Preview palette chooser" hidden>
        <div class="palette-panel-head"><div><span class="palette-kicker">Preview lab</span><strong>Choose an accent</strong></div><span class="palette-current" id="paletteCurrent">${PALETTES[0].label}</span></div>
        <div class="palette-options" role="group" aria-label="Accent palettes">${options}</div>
        <p class="palette-note">10 variants · saved in this browser</p>
      </div>
    </div>`;
}

function headerHtml(active, { showPalette = true } = {}) {
  return `<header class="header"><div class="container header-inner">
    <a href="/" class="logo" aria-label="StealthRDP home">
      ${LOGO_IMAGE_HTML}
    </a>
    <nav class="nav" aria-label="Main navigation">${navHtml(active)}</nav>
    <div class="header-actions">
      <button type="button" class="theme-toggle" id="themeToggle" aria-label="Use light theme" aria-pressed="false"><span class="theme-icon theme-icon-sun" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg></span><span class="theme-icon theme-icon-moon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/></svg></span></button>
${showPalette ? `      ${paletteLabHtml()}\n` : ""}      <a class="btn btn-sm btn-primary" href="https://dash.stealthrdp.com/index.php?rp=/login">Client Area</a>
      <button class="nav-toggle" id="navToggle" aria-label="Toggle menu" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
    </div>
  </div>
  <div class="mobile-nav" id="mobileNav">${navHtml(active)}<a class="btn btn-primary" href="https://dash.stealthrdp.com/index.php?rp=/login">Client Area</a></div>
  </header>`;
}

function footerHtml() {
  const social = SOCIAL.map((s) => {
    const svgs = {
      "X / Twitter": '<path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.3l7.3-8.3L2.8 2h6.4l4.4 5.9L18.9 2zm-1.1 18h1.7L7.1 3.9H5.3L17.8 20z"/>',
      Instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>',
      Discord: '<path d="M8 12h.01M12 12h.01M16 12h.01M8.5 19c-2.5-.5-4.5-2-5.5-4.5C2 10 3.5 5 8.5 4.5c.5-1 3.5-1 3.5-1s3 0 3.5 1c5 .5 6.5 5.5 6 10-1 2.5-3 4-5.5 4.5"/>',
      Telegram: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
    };
    return `<a href="${s.href}" target="_blank" rel="noopener noreferrer" aria-label="${s.label}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svgs[s.label] || ""}</svg></a>`;
  }).join("");
  return `<footer class="footer"><div class="container">
    <div class="footer-grid">
      <div class="footer-about">
        <a href="/" class="logo" aria-label="StealthRDP home">${LOGO_IMAGE_HTML}</a>
        <p>Enterprise-grade remote desktop infrastructure with unmatched security and performance.</p>
        <div class="footer-social">${social}</div>
        <div class="footer-status"><span class="dot"></span><span id="footerStatus">Checking live status…</span></div>
      </div>
      <div class="footer-col"><h2>Products</h2><ul>
        <li><a href="/plans.html">RDP Plans</a></li>
        <li><a href="/windows-vps/">Windows VPS Hosting</a></li>
        <li><a href="/linux-vps/">Linux VPS Hosting</a></li>
        <li><a href="/plans.html#build-your-own">Build Your Own VPS</a></li>
        <li><a href="/plans.html">Pricing</a></li>
      </ul></div>
      <div class="footer-col"><h2>Resources</h2><ul>
        <li><a href="/docs.html">Documentation</a></li>
        <li><a href="/blog.html">Tutorials</a></li>
        <li><a href="/faq.html">FAQ</a></li>
        <li><a href="/blog.html">Blog</a></li>
        <li><a href="/status.html">Server Status</a></li>
      </ul></div>
      <div class="footer-col"><h2>Company</h2><ul>
        <li><a href="/about.html">About Us</a></li>
        <li><a href="https://dash.stealthrdp.com/submitticket.php">Contact Support</a></li>
        <li><a href="/privacy.html">Privacy Policy</a></li>
        <li><a href="${TERMS_URL}">Terms of Service</a></li>
      </ul></div>
    </div>
    <div class="footer-mobile-nav" aria-label="Footer navigation">
      <details class="footer-mobile-group"><summary><span>Products</span><small>RDP plans · pricing</small><b aria-hidden="true">+</b></summary><ul>
        <li><a href="/plans.html">RDP Plans</a></li><li><a href="/windows-vps/">Windows VPS Hosting</a></li><li><a href="/linux-vps/">Linux VPS Hosting</a></li><li><a href="/plans.html#build-your-own">Build Your Own VPS</a></li><li><a href="/plans.html">Pricing</a></li>
      </ul></details>
      <details class="footer-mobile-group"><summary><span>Resources</span><small>Docs · blog · status</small><b aria-hidden="true">+</b></summary><ul>
        <li><a href="/docs.html">Documentation</a></li><li><a href="/blog.html">Tutorials</a></li><li><a href="/faq.html">FAQ</a></li><li><a href="/blog.html">Blog</a></li><li><a href="/status.html">Server Status</a></li>
      </ul></details>
      <details class="footer-mobile-group"><summary><span>Company</span><small>About · support · legal</small><b aria-hidden="true">+</b></summary><ul>
        <li><a href="/about.html">About Us</a></li><li><a href="https://dash.stealthrdp.com/submitticket.php">Contact Support</a></li><li><a href="/privacy.html">Privacy Policy</a></li><li><a href="${TERMS_URL}">Terms of Service</a></li>
      </ul></details>
    </div>
    <div class="footer-bottom">
      <span>© 2026 StealthRDP. All rights reserved.</span>
      <span class="links">
        <a href="/privacy.html">Privacy</a>
        <a href="${TERMS_URL}">Terms</a>
        <a href="/status.html">Status</a>
      </span>
    </div>
  </div></footer>`;
}

const ASSET_STAMP = new Date().toISOString().replace(/[:.]/g, "-");
function scripts(extra = [], includePricing = false) {
  const pricingScript = includePricing ? `<script src="/js/pricing.js?v=${ASSET_STAMP}"></script>` : "";
  return `${pricingScript}<script src="/js/main.js?v=${ASSET_STAMP}"></script>${extra.map((s) => `<script src="${s}?v=${ASSET_STAMP}"></script>`).join("")}`;
}

/* ---------- baked content ---------- */
function planCardHtml(p, { showPopular = true, showLocation = false, ctaLabel = "Buy Now", hidden = false } = {}) {
  const isPop = showPopular && p.popular;
  const location = esc(p.location || "");
  return `<article class="plan-card${isPop ? " popular" : ""}" data-plan-location="${location}"${hidden ? " hidden" : ""}>
${isPop ? `    <span class="plan-popular">Most Popular</span>\n` : ""}    <div class="p-name">${esc(displayPlanName(p))}</div>
    <div class="p-desc">${esc(p.description || "")}</div>
${showLocation ? `    <div class="p-location">Region: ${esc(p.location || "Not listed")}</div>\n` : ""}    ${pricing.priceMarkup(p, "monthly")}
    <div class="plan-specs">
      ${specRow("CPU", p.specs && p.specs.cpu)}
      ${specRow("RAM", p.specs && p.specs.ram)}
      ${specRow("Storage", p.specs && p.specs.storage)}
      ${specRow("Bandwidth", p.specs && p.specs.bandwidth)}
    </div>
    <a class="btn btn-primary" href="${planUrl(p)}">${esc(ctaLabel)}</a>
  </article>`;
}

function osVpsCatalogHtml({ slug, label, sectionId }) {
  const usaStar = firstPopularName(USA);
  const euStar = firstPopularName(EU);
  const cards = USA.concat(EU)
    .map((p) => planCardHtml({
      ...p,
      popular: p.name === usaStar || p.name === euStar,
      description: planSpecLine(p),
    }, { showLocation: true, ctaLabel: "Choose this plan", hidden: p.location !== "USA" }))
    .join("");
  return `<section class="section os-vps-catalog"${sectionId ? ` id="${esc(sectionId)}"` : ""} aria-labelledby="${slug}-catalog-heading">
    <div class="container">
      <div class="os-vps-catalog-head">
        <div><span class="included-label">Current VPS catalog</span><h2 id="${slug}-catalog-heading">Choose your resource level</h2></div>
        <p>Compare the current displayed monthly price, CPU, RAM, NVMe storage, bandwidth, and region. Windows and Linux use this shared VPS catalog.</p>
      </div>
      <div class="os-vps-region-control">
        <div class="location-control"><span class="control-label">Deployment region</span><div id="locationTabs" class="location-tabs" role="tablist" aria-label="Deployment region">
          <button type="button" role="tab" aria-selected="true" data-location="USA" class="active">USA</button>
          <button type="button" role="tab" aria-selected="false" data-location="EU">EU</button>
        </div></div>
        <span class="os-vps-region-note" id="osVpsRegionNote">Showing ${USA.length} USA plans</span>
      </div>
      <div class="plan-grid os-vps-plan-grid" id="planGrid" aria-label="${label} VPS plan cards">${cards}</div>
    </div>
  </section>`;
}

function specRow(k, v) {
  if (!v) return "";
  return `<div class="plan-spec"><span class="k">${k}</span><span class="sep"></span><span class="v">${esc(v)}</span></div>`;
}

function compareRowHtml(p) {
  return `<tr>
    <td class="k">${esc(p.name)}</td>
    <td class="v">${esc((p.specs && p.specs.cpu) || "—")}</td>
    <td class="v">${esc((p.specs && p.specs.ram) || "—")}</td>
    <td class="v">${esc((p.specs && p.specs.storage) || "—")}</td>
    <td class="v">${esc((p.specs && p.specs.bandwidth) || "—")}</td>
    <td class="v">${pricing.tablePrice(p)}</td>
    <td><a class="btn btn-sm btn-primary" href="${planUrl(p)}">Buy Now</a></td>
  </tr>`;
}

function billingToggleHtml() {
  return Object.keys(PRICING_CATALOG.billingCycles).map((key) => pricing.cycleButtonMarkup(key, PRICING_CATALOG.billingCycles)).join("\n          ");
}

function faqItemHtml(f, i) {
  return `<div class="faq-item${i === 0 ? " open" : ""}" data-faq-category="${esc(f.category || "General")}" data-faq-question="${esc(f.question)}">
    <button class="faq-q" aria-expanded="${i === 0 ? "true" : "false"}"><span>${esc(f.question)}</span><span class="icon">+</span></button>
    <div class="faq-a"><div class="faq-a-inner">${esc(f.answer)}</div></div>
  </div>`;
}

function includedFeaturesHtml() {
  const items = [
    ["Full admin access", "Control your server from day one"],
    ["NVMe SSD storage", "Fast disk for everyday workloads"],
    ["DDoS protection", "Protection at the network edge"],
    ["Instant activation", "Ready after checkout"],
    ["24/7 support", "Help when you need it"],
  ];
  const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  return `<section class="included-rail" aria-labelledby="included-heading">
    <div class="included-copy">
      <span class="included-label">Included with every plan</span>
      <h2 id="included-heading">The essentials are already covered.</h2>
      <p>Choose a plan by resource level. These service basics stay with every server.</p>
    </div>
    <ul class="included-list">
      ${items.map(([title, description]) => `<li class="included-item"><span class="included-mark">${check}</span><span><strong>${title}</strong><small>${description}</small></span></li>`).join("")}
    </ul>
  </section>`;
}

const fmtDuration = (seconds) => {
  if (seconds == null || seconds === "" || !Number.isFinite(Number(seconds))) return "—";
  const value = Math.max(0, Math.round(Number(seconds)));
  if (value < 60) return `${value}s`;
  if (value < 3600) return `${Math.round(value / 60)}m`;
  if (value < 86400) return `${(value / 3600).toFixed(1)}h`;
  return `${(value / 86400).toFixed(1)}d`;
};

function formatHistoryDate(value) {
  if (!value) return "Unknown date";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function historyBarHtml(history) {
  if (!Array.isArray(history) || !history.length) {
    return `<div class="node-history node-history-empty"><span>90-day history unavailable.</span></div>`;
  }
  const bars = history.map((item) => {
    const uptime = Number.isFinite(Number(item.uptime)) ? Number(item.uptime).toFixed(2) + "% uptime" : "No data";
    const state = item.state || "unknown";
    const date = formatHistoryDate(item.date);
    const tooltip = `${date} · ${state === "up" ? "Operational" : state === "down" ? "Downtime" : "Partial availability"} · ${uptime}`;
    return `<span class="history-bar history-${esc(state)}" title="${esc(tooltip)}" data-tooltip="${esc(tooltip)}" aria-label="${esc(tooltip)}"></span>`;
  }).join("");
  const available = history.filter((item) => item && item.state !== "unknown").length;
  return `<div class="node-history"><div class="history-bars" role="img" aria-label="90-day uptime history with ${available} days of returned data">${bars}</div><div class="history-axis"><span>90 days ago</span><span>Today</span></div></div>`;
}

function nodeCardHtml(m) {
  const uptime90 = Number.isFinite(Number(m.uptime90)) ? Number(m.uptime90) : null;
  const status = m.status || (isUp(m) ? "up" : "down");
  const statusLabel = { up: "Operational", down: "Down", degraded: "Degraded", paused: "Paused", pending: "Not checked", unknown: "Unknown" }[status] || "Unknown";
  const statusClass = ["up", "down", "degraded", "paused", "pending"].includes(status) ? status : "unknown";
  const label = m.label || m.friendly_name || "Production node";
  const region = m.region || "Protected infrastructure";
  const uptime = uptime90 == null ? "—" : uptime90.toFixed(3) + "% uptime";
  return `<article class="node-card node-${statusClass}">
    <div class="n-left"><span class="n-dot ${statusClass}" aria-hidden="true"></span>
      <div><div class="n-name">${esc(label)}</div><div class="n-target">${esc(region)}</div></div>
    </div>
    <div class="n-state"><strong>${statusLabel}</strong></div>
    <div class="n-uptime"><b>${uptime}</b><small>90-day availability</small></div>
    ${historyBarHtml(m.history90)}
  </article>`;
}

function testimonialHtml() {
  if (!TESTIMONIALS.length) {
    return '<div class="quote-empty">10,000+ orders and counting. Deploy in 60 seconds.</div>';
  }
  const t = TESTIMONIALS[0];
  const name = t.authorName || t.name || t.customerName || "StealthRDP Customer";
  const role = [t.authorPosition, t.authorCompany].filter(Boolean).join(", ");
  return `<div class="q-mark">“</div><p class="q-text">${esc(t.quote || t.testimonial || t.content || "")}</p><p class="q-who"><b>${esc(name)}</b>${role ? " · " + esc(role) : ""}</p>`;
}

function reviewCardHtml(review, extraClass = "") {
  // Keep source URLs in the data snapshot for internal provenance only. Review
  // cards must not expose clickable links, raw source URLs, or provider names.
  const neutralLabel = review.sourceType === "third-party review" ? "Customer feedback" : "Community feedback";
  const source = `<span>${neutralLabel}</span>`;
  const authorName = (review.authorName || "").split(" · ")[0].trim().replace(/Trustpilot reviewer/i, "Verified customer");
  let quote = review.quote || "";
  // Strip competitor/provider names and stray URLs from the visible wording.
  const providerPattern = /\b(?:Linode|DigitalOcean|Digital Ocean|Vultr|Contabo|Hetzner|Kimsufi|Scaleway|Lightsail|RackNerd|BuyVM|RamNode|Leaseweb|Rackspace|CrystalTech|Online\.net|RunAbove|Google Compute Engine|GCE|LowEndBox|LowEnd Talk|KS-1|Amazon Web Services|AWS)\b/gi;
  quote = quote.replace(providerPattern, "the provider");
  quote = quote.replace(/\bOVH\b/gi, "a provider");
  quote = quote.replace(/\bDO\b/gi, "the provider");
  quote = quote.replace(/\bS3\b|\bRoute53\b|\bSES\b|\bEC2\b|\bGCP\b/gi, "cloud services");
  quote = quote.replace(/https?:\/\/\S+/g, "");
  quote = quote.replace(/\b[A-Za-z0-9][A-Za-z0-9-]*\.(?:com|de|net|io|org|co|dev|cloud|app)\b(?:\/\S*)?/g, "");
  quote = quote.replace(/\s{2,}/g, " ").trim();
  quote = quote.replace(/\bthe provider\b/g, "the provider");
  return `<article class="review-card review-${esc(review.sentiment || "neutral")}${extraClass}">
    <div class="review-card-meta"><span class="review-mark" aria-hidden="true">“</span><span class="review-source">${source}</span></div>
    <blockquote>${esc(quote)}</blockquote>
    <footer>${authorName ? `<b>${esc(authorName)}</b>` : ""}<time>${esc(review.publishedOn || "")}</time></footer>
  </article>`;
}

function reviewWallHtml() {
  // Show the collected positive and neutral reviews on the wall. Critical
  // entries stay in the data snapshot but are not surfaced. Internal
  // provenance stays in data/reviews.json; cards never expose links or provider names.
  const items = REVIEWS.filter((item) => item && item.quote && item.sentiment !== "critical");
  if (!items.length) return '<div class="quote-empty">Customer and community feedback is being collected.</div>';
  const columns = [0, 1, 2].map((column) => items.filter((_, index) => index % 3 === column));
  const mobileItems = items.concat(items);
  return `<div class="review-wall" data-review-count="${items.length}" aria-label="Customer and community reviews">
    ${columns.map((column, index) => `<div class="review-column review-column-${index + 1}"><div class="review-track">${column.concat(column).map((review, reviewIndex) => reviewCardHtml(review, reviewIndex >= column.length ? " review-card-copy" : "")).join("")}</div></div>`).join("")}
    <div class="review-mobile-column"><div class="review-mobile-track">${mobileItems.map((review, reviewIndex) => reviewCardHtml(review, reviewIndex >= items.length ? " review-card-copy" : "")).join("")}</div></div>
  </div>
  <p class="review-disclosure">${items.length} real reviews from server owners and remote-desktop users.</p>`;
}

function blogCardHtml(p, extraClass = "") {
  return `<article class="blog-card${extraClass}" data-blog-category="${esc(p.category || "Insights")}" data-blog-title="${esc(p.title)}"><div class="bc-body">
    <span class="bc-cat">${esc(p.category)}</span>
    <h2>${esc(p.title)}</h2>
    <p>${esc(p.excerpt || "")}</p>
    <div class="bc-meta"><span>${esc(p.author)}</span><span>${esc(p.date)}</span></div>
    <a class="bc-link" href="/blog/${esc(p.slug)}.html">Read article →</a>
  </div></article>`;
}

/* ---------- native documentation ---------- */
const DOC_SUPPORT_URL = "https://dash.stealthrdp.com/submitticket.php";

function redactPublic(value) {
  return String(value == null ? "" : value)
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[redacted address]")
    .replace(/docs\.stealthrdp\.com/gi, "the documentation source")
    .replace(/Chatwoot/gi, "the support platform");
}

function slugifyHeading(value) {
  const slug = redactPublic(value).toLowerCase().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "section";
}

function safeDocHref(rawHref) {
  const original = String(rawHref || "").trim().replace(/[.,;:!?]+$/, "");
  if (!original) return "";
  const hashIndex = original.indexOf("#");
  const base = hashIndex >= 0 ? original.slice(0, hashIndex) : original;
  const hash = hashIndex >= 0 ? original.slice(hashIndex) : "";
  for (const article of DOCS) {
    if (base === article.sourceUrl || base.startsWith(article.sourceUrl + "?")) {
      return `/docs/${article.slug}.html${hash}`;
    }
  }
  if (/^https?:\/\/docs\.stealthrdp\.com/i.test(base)) return "/docs.html";
  if (/^(?:javascript|data):/i.test(original)) return "";
  if (/^https?:\/\//i.test(original) || original.startsWith("/")) return redactPublic(original);
  if (original.startsWith("#")) return original;
  return "";
}

function inlineDocHtml(value) {
  let source = String(value == null ? "" : value);
  const tokens = [];
  const token = (html) => {
    const key = `\u0000DOC${tokens.length}\u0000`;
    tokens.push(html);
    return key;
  };
  source = source.replace(/`([^`]+)`/g, (_, code) => token(`<code>${esc(redactPublic(code))}</code>`));
  source = source.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+["'][^)]*["'])?\)/g, (_, label, href) => {
    const safeHref = safeDocHref(href);
    return safeHref
      ? token(`<a href="${esc(safeHref)}">${inlineDocHtml(label)}</a>`)
      : inlineDocHtml(label);
  });
  let output = esc(source)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");
  output = output.replace(/https?:\/\/[^\s<]+/g, (href) => {
    const trailing = href.match(/[)\],.!?]+$/);
    const suffix = trailing ? trailing[0] : "";
    const clean = trailing ? href.slice(0, -suffix.length) : href;
    const safeHref = safeDocHref(clean);
    return safeHref ? `<a href="${esc(safeHref)}">${esc(redactPublic(clean))}</a>${esc(suffix)}` : esc(redactPublic(clean)) + esc(suffix);
  });
  return redactPublic(output).replace(/\u0000DOC(\d+)\u0000/g, (_, index) => tokens[Number(index)] || "");
}

function docCodeBlock(lines, counter) {
  const id = `docs-code-${counter.value++}`;
  const code = redactPublic(lines.join("\n"));
  return `<div class="docs-code-wrap"><div class="docs-code-tools"><span class="mono">Command</span><button class="docs-copy" type="button" data-copy-target="${id}">Copy</button></div><pre class="docs-code" id="${id}"><code>${esc(code)}</code></pre></div>`;
}

function looksLikeDocCode(line) {
  const value = String(line || "").trim();
  return /^(?:\$\s+|sudo\s|apt(?:-get)?\s|yum\s|dnf\s|systemctl\s|service\s|mkdir\s|mknod\s|chmod\s|wget\s|curl\s|bash\s|sh\s|winrm\s|slmgr\s|docker\s|python\s|Rewrite(?:Engine|Cond|Rule)\b|apt-get\s)/i.test(value);
}

function articleBodyLines(article) {
  const lines = String(article.content || "").replace(/\r/g, "").split("\n");
  const updatedIndex = lines.findIndex((line) => /^\s*Last updated on\b/i.test(line));
  return updatedIndex >= 0 ? lines.slice(updatedIndex + 1) : lines;
}

function renderDocMarkdown(article) {
  const lines = articleBodyLines(article);
  const html = [];
  const headings = [];
  const counter = { value: 1 };
  let paragraph = [];
  let list = null;
  let code = [];
  let fence = null;
  let previousHeadingLevel = 1;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    if (text) html.push(`<p>${inlineDocHtml(text)}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const tag = list.ordered ? "ol" : "ul";
    html.push(`<${tag}>${list.items.map((item) => `<li>${inlineDocHtml(item)}</li>`).join("")}</${tag}>`);
    list = null;
  };
  const flushCode = () => {
    if (!code.length) return;
    html.push(docCodeBlock(code, counter));
    code = [];
  };
  const addHeading = (rawText, level) => {
    flushParagraph();
    flushList();
    flushCode();
    const requestedLevel = Math.max(2, Math.min(6, Number(level) || 2));
    const safeLevel = Math.min(requestedLevel, previousHeadingLevel + 1);
    const clean = rawText.replace(/\[#\]\([^)]*\)/g, "").replace(/^\*\*(.*)\*\*$/, "$1").trim();
    const idBase = slugifyHeading(clean);
    let id = idBase;
    let suffix = 2;
    while (headings.some((heading) => heading.id === id)) id = `${idBase}-${suffix++}`;
    headings.push({ id, text: clean, level: safeLevel });
    previousHeadingLevel = safeLevel;
    html.push(`<h${safeLevel} id="${id}">${inlineDocHtml(clean)}</h${safeLevel}>`);
  };
  const addRule = () => {
    flushParagraph();
    flushList();
    flushCode();
    html.push("<hr />");
  };

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const next = lines[i + 1] ? lines[i + 1].trim() : "";

    if (fence) {
      const closing = new RegExp(`^\\s{0,3}${fence.char}{${fence.length},}\\s*$`);
      if (closing.test(raw)) {
        flushCode();
        fence = null;
      } else {
        code.push(raw.replace(/^\s{0,3}/, ""));
      }
      continue;
    }

    const fenceStart = raw.match(/^\s{0,3}(`{3,}|~{3,})(?:\s*.*)?$/);
    if (fenceStart) {
      flushParagraph();
      flushList();
      flushCode();
      fence = { char: fenceStart[1][0], length: fenceStart[1].length };
      continue;
    }
    if (!trimmed) {
      flushParagraph();
      if (!(list && /^\d+[.)]\s+/.test(next) || /^(?:[-*+]\s+|[–~]\s*)/.test(next))) flushList();
      flushCode();
      continue;
    }

    const atx = trimmed.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (atx) {
      // The article title is rendered by the page shell as the only H1.
      addHeading(atx[2], Math.max(2, Math.min(6, atx[1].length)));
      continue;
    }
    if (/^(?:=+|-+)\s*$/.test(next) && trimmed.length > 1) {
      addHeading(trimmed, next[0] === "=" ? 2 : 3);
      i += 1;
      continue;
    }
    if (/^(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(trimmed)) {
      addRule();
      continue;
    }

    if (/^\s{4}/.test(raw)) {
      flushParagraph();
      flushList();
      code.push(raw.replace(/^\s{4}/, ""));
      continue;
    }

    const ordered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    const unordered = trimmed.match(/^(?:[-*+]\s+|[–~]\s*)(.*)$/);
    if (ordered || unordered) {
      flushParagraph();
      flushCode();
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push((ordered || unordered)[1]);
      continue;
    }
    if (list && /^\s{2,}\S/.test(raw)) {
      list.items[list.items.length - 1] += ` ${trimmed}`;
      continue;
    }
    if (looksLikeDocCode(trimmed) && !paragraph.length) {
      flushList();
      code.push(trimmed);
      continue;
    }
    if (code.length) flushCode();
    if (list) flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();
  flushCode();
  return { html: html.join("\n"), headings };
}

function docDateIso(dateText) {
  const timestamp = Date.parse(dateText || "");
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : "";
}

function docsWarning(article) {
  if (article.slug === "1737944563-how-to-re_activate-and-extend-your-180_day-windows-trial") {
    return `<aside class="docs-warning"><strong>Windows Server Evaluation Notice</strong> Windows Server Evaluation editions are intended solely for testing, evaluation, and demonstration purposes. They are not licensed for production or commercial workloads. The <code>slmgr /rearm</code> procedure described in this guide only extends the Microsoft evaluation period where permitted by the installed evaluation edition; it does not activate Windows, provide a commercial license, or replace a valid Microsoft Windows Server license. Users requiring Windows Server for production use must obtain appropriate Microsoft licensing.</aside>`;
  }
  if (!/(fresh(?:ly)? installed|reinstall|reformat|no uninstaller|rebuild|terminate|deleted|without backups)/i.test(article.content || "")) return "";
  return `<aside class="docs-warning"><strong>Read before acting.</strong> The verified source content mentions a fresh operating system or an irreversible server change. Confirm prerequisites and backups before continuing.</aside>`;
}

function docCardHtml(article) {
  return `<article class="docs-card" data-doc-title="${esc(article.title)}" data-doc-summary="${esc(article.summary)}" data-doc-category="${esc(article.category)}">
    <div class="docs-card-meta"><span class="docs-category">${esc(article.category)}</span><time>${esc(article.date)}</time></div>
    <h2><a href="/docs/${esc(article.slug)}.html">${esc(article.title)}</a></h2>
    <p>${esc(article.summary)}</p>
    <a class="docs-card-link" href="/docs/${esc(article.slug)}.html">Read guide <span aria-hidden="true">→</span></a>
  </article>`;
}

function docsArticleLd(article) {
  const iso = docDateIso(article.date);
  const value = {
    "@type": "TechArticle",
    headline: article.title,
    description: article.summary,
    author: { "@type": "Organization", name: "StealthRDP" },
    publisher: { "@type": "Organization", name: "StealthRDP", url: "__SRDP_BASE__/" },
    mainEntityOfPage: `__SRDP_BASE__/docs/${article.slug}.html`,
    url: `__SRDP_BASE__/docs/${article.slug}.html`,
    articleSection: article.category,
  };
  if (iso) value.dateModified = iso;
  return value;
}

function docsIndexDescription() {
  return "Read verified StealthRDP guides for Windows, Linux, networking, panels, server management, and account questions. Search the native documentation index.";
}

function buildDocsIndex() {
  const categories = [...new Set(DOCS.map((article) => article.category))].sort((a, b) => a.localeCompare(b));
  const options = categories.map((category) => `<option value="${esc(category)}">${esc(category)}</option>`).join("");
  const cards = DOCS.map(docCardHtml).join("");
  const topicChips = `<button type="button" class="topic-chip active" data-docs-topic="all">All<span>${DOCS.length}</span></button>` + categories.map((category) => `<button type="button" class="topic-chip" data-docs-topic="${esc(category)}">${esc(category)}<span>${DOCS.filter((article) => article.category === category).length}</span></button>`).join("");
  const groupedCards = categories.map((category) => `<div class="docs-group" data-docs-group="${esc(category)}"><div class="docs-group-head"><h2>${esc(category)}</h2><span>${DOCS.filter((article) => article.category === category).length} guides</span></div><div class="docs-group-grid">${DOCS.filter((article) => article.category === category).map(docCardHtml).join("")}</div></div>`).join("");
  const body = `<main class="docs-index docs-surface">
    <section class="page-head docs-page-head">
      <div class="container">
        <nav class="docs-breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>Docs</span></nav>
        <span class="eyebrow">Documentation</span><h1>Find the next safe step</h1>
        <p>Task-focused guides for Windows, Linux, networking, panels, and server management. Search first, then follow the prerequisites that fit your server.</p>
      </div>
    </section>
    <section class="section docs-index-section"><div class="container">
      <div class="docs-results">
        <div class="docs-controls"><label class="docs-search-label" for="docsSearch">Search guides</label><input id="docsSearch" type="search" placeholder="Try: rebuild, VPN, PowerShell…" autocomplete="off" /><select id="docsCategory" hidden><option value="all">All categories</option>${options}</select></div>
        <div class="topic-chips docs-topics" role="group" aria-label="Filter by category">${topicChips}</div>
        <div class="docs-results-bar"><span id="docsResultsCount">${DOCS.length} guides</span><span>Verified source snapshot · ${DOCS.length} articles</span></div>
        <div class="docs-card-grid" id="docsResults" data-docs-index>${groupedCards}</div><p class="docs-empty" id="docsEmpty" hidden>No guides match that search. Try a broader term or another category.</p>
      </div>
    </div></section>
  </main>`;
  const jsonLd = [{ "@context": "https://schema.org", "@graph": [breadcrumbLd("Docs", [{ name: "Home", url: "__SRDP_BASE__/" }, { name: "Docs", url: "__SRDP_BASE__/docs.html" }]), { "@type": "ItemList", name: "StealthRDP Documentation", itemListElement: DOCS.map((article, index) => ({ "@type": "ListItem", position: index + 1, item: { "@type": "TechArticle", headline: article.title, url: `__SRDP_BASE__/docs/${article.slug}.html` } })) }] }];
  return page({ active: "docs", title: "Documentation — StealthRDP", description: docsIndexDescription(), canonical: "__SRDP_BASE__/docs.html", jsonLd, body, extraScripts: ["/js/docs.js"] });
}

function buildDocArticle(article, index) {
  const rendered = renderDocMarkdown(article);
  const contents = rendered.headings.length ? `<aside class="docs-toc" aria-label="On this page"><span class="docs-toc-title">On this page</span><ol>${rendered.headings.map((heading) => `<li class="toc-level-${heading.level}"><a href="#${esc(heading.id)}">${esc(heading.text)}</a></li>`).join("")}</ol></aside>` : "";
  const related = article.relatedSlugs.map((slug) => DOC_BY_SLUG.get(slug)).filter(Boolean);
  const next = DOCS[index + 1] && DOCS[index + 1].slug !== article.slug ? DOCS[index + 1] : null;
  const links = [...related, ...(next && !related.some((item) => item.slug === next.slug) ? [next] : [])].slice(0, 3);
  const relatedHtml = links.length ? `<nav class="docs-related" aria-label="Related guides"><div class="docs-related-head"><span class="sec-index">Continue exploring</span><h2>Related guides</h2></div><div class="docs-related-grid">${links.map((item) => `<a class="docs-related-link" href="/docs/${esc(item.slug)}.html"><span class="docs-category">${esc(item.category)}</span><strong>${esc(item.title)}</strong><span>Read guide →</span></a>`).join("")}</div></nav>` : "";
  const dateIso = docDateIso(article.date);
  const time = dateIso ? `<span>Source date: <time datetime="${dateIso}">${esc(article.date)}</time></span>` : `<span>Source date: ${esc(article.date)}</span>`;
  const migration = article.migration || {};
  const sourceLabel = migration.source || "Verified StealthRDP documentation snapshot";
  const migrationDate = migration.date ? `Migrated ${migration.date}` : "Migration date not provided";
  const redactionLabel = Array.isArray(migration.redactions) && migration.redactions.length ? "Public examples redacted" : "No public redactions recorded";
  const sourceMeta = `<span>Source: ${esc(sourceLabel)}</span>${time}<span>${esc(migrationDate)}</span><span>${redactionLabel}</span>`;
  const body = `<main class="docs-article-page docs-surface" data-docs-category="${esc(article.category)}" data-doc-slug="${esc(article.slug)}"><div class="container docs-article-layout"><div class="docs-article-column">
    <nav class="docs-breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/docs.html">Docs</a><span aria-hidden="true">/</span><span>${esc(article.category)}</span></nav>
    <article class="docs-article"><header class="docs-article-header"><span class="docs-category">${esc(article.category)}</span><h1>${esc(article.title)}</h1>${docsWarning(article)}<p class="docs-summary">${esc(article.summary)}</p><div class="docs-source-meta">${sourceMeta}</div></header><div class="docs-content">${rendered.html}</div><div class="docs-support"><div><span class="sec-index">Need a hand?</span><h2>Need account or server support?</h2><p>For account or server-specific help, use the StealthRDP support portal.</p></div><a class="btn btn-primary" href="${DOC_SUPPORT_URL}">Contact support</a></div>${relatedHtml}</article>
  </div>${contents}</div></main>`;
  const fullTitle = `${article.title} — StealthRDP Docs`;
  const useTitle = fullTitle.length <= SEO_TITLE_LIMIT ? fullTitle : seoTitle(article.title);
  const jsonLd = [{ "@context": "https://schema.org", "@graph": [breadcrumbLd(article.title, [{ name: "Home", url: "__SRDP_BASE__/" }, { name: "Docs", url: "__SRDP_BASE__/docs.html" }, { name: article.category, url: `__SRDP_BASE__/docs.html?category=${encodeURIComponent(article.category)}` }, { name: article.title, url: `__SRDP_BASE__/docs/${article.slug}.html` }]), docsArticleLd(article)] }];
  return page({ active: "docs", title: useTitle, description: seoDescription(article.summary.length < 70 ? `${article.summary} Read the verified guide and contact StealthRDP support when you need account-specific help.` : article.summary), canonical: `__SRDP_BASE__/docs/${article.slug}.html`, pageType: "article", jsonLd, body, extraScripts: ["/js/docs.js"] });
}

/* ---------- JSON-LD ---------- */
const ORG = {
  "@type": "Organization",
  "@id": "__SRDP_BASE__/#organization",
  name: "StealthRDP",
  url: "__SRDP_BASE__/",
  logo: LOGO_DARK_URL,
  description: "Windows and Linux remote desktop infrastructure and VPS hosting with DDoS protection, full administrative access, live status monitoring, and a 99.9% uptime SLA.",
  sameAs: SOCIAL.map((s) => s.href),
};

function websiteLd() {
  return {
    "@type": "WebSite",
    "@id": "__SRDP_BASE__/#website",
    name: "StealthRDP",
    url: "__SRDP_BASE__/",
    publisher: { "@id": "__SRDP_BASE__/#organization" },
  };
}

function breadcrumbLd(name, crumbs) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })),
  };
}

function serviceLd(p) {
  return {
    "@type": "Service",
    name: p.name,
    description: p.description || `${p.name} — ${(p.specs && p.specs.cpu) || ""} CPU, ${(p.specs && p.specs.ram) || ""} RAM, ${(p.specs && p.specs.storage) || ""} NVMe`,
    url: planUrl(p),
    provider: { "@type": "Organization", name: "StealthRDP", url: "__SRDP_BASE__/" },
    offers: { "@type": "Offer", price: pricing.cycleEntry(p, "monthly").amount, priceCurrency: p.pricing.currency, url: planUrl(p), description: "Monthly billing" },
  };
}

function faqLd() {
  return {
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

function articleLd(post) {
  return {
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || "",
    datePublished: post.date,
    author: { "@type": "Organization", name: post.author || "StealthRDP Team", url: "__SRDP_BASE__/about.html" },
    publisher: { "@type": "Organization", name: "StealthRDP", url: "__SRDP_BASE__/", logo: { "@type": "ImageObject", url: LOGO_DARK_URL } },
    image: "__SRDP_BASE__/assets/og-cover.png",
    mainEntityOfPage: `__SRDP_BASE__/blog/${post.slug}.html`,
    url: `__SRDP_BASE__/blog/${post.slug}.html`,
  };
}

function howToLd(post, headings) {
  if (!/how to|tips|checklist|signs|ways/i.test(post.title || "")) return null;
  const steps = (headings || []).filter((heading) => heading.level === 2).slice(0, 12);
  if (steps.length < 3) return null;
  return {
    "@type": "HowTo",
    name: post.title,
    description: post.excerpt || post.title,
    step: steps.map((heading, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: heading.text,
      url: `__SRDP_BASE__/blog/${post.slug}.html#${heading.id}`,
    })),
  };
}

/* ---------- page builders ---------- */
function page({ active, title, description, canonical, pageType = "website", jsonLd = [], body, extraScripts = [], planLocation = "", planLimit = "", robots = "index,follow", showPalette = true, includePricing = false }) {
  const pageData = `${planLocation ? ` data-plan-location="${esc(planLocation)}"` : ""}${planLimit ? ` data-plan-limit="${esc(planLimit)}"` : ""}`;
  return `${head({ title, description, canonical, pageType, jsonLd, robots })}
<body data-page="${active}"${pageData}>
  ${headerHtml(active, { showPalette })}
  ${body}
  ${footerHtml()}
  ${scripts(extraScripts, includePricing)}
</body>
</html>`;
}

/* ---------- 1. 404 ---------- */
function build404() {
  const body = `<main class="error-page">
    <section class="page-head">
      <div class="container"><span class="eyebrow">Error 404</span><h1>That page is not here.</h1><p>The address may be outdated or the page may have moved. Use one of these paths to continue.</p></div>
    </section>
    <section class="section section-tight" style="padding-top:0">
      <div class="container"><div class="section-head center"><span class="section-label">Find your way back</span><h2>Start from a trusted StealthRDP page.</h2><p>These links help people and agents recover without guessing the next URL.</p><div class="error-actions"><a class="btn btn-primary" href="/">Return home</a><a class="btn btn-ghost" href="/docs.html">Open documentation</a><a class="btn btn-ghost" href="/sitemap.xml">View sitemap</a><a class="btn btn-ghost" href="/llms.txt">Agent guide</a></div></div></div>
    </section>
  </main>`;
  return page({ active: "404", title: "Page not found — StealthRDP", description: "The requested StealthRDP page could not be found. Return home or use the documentation, sitemap, and agent guide.", canonical: "__SRDP_BASE__/404.html", robots: "noindex,follow", body });
}

/* ---------- 2. index ---------- */
function buildIndex() {
  const preview = USA.slice(0, 3).map((p) => planCardHtml(p)).join("");
  const useCases = [
    { key: "remote-desktop", label: "Remote desktop", tier: "Bronze" },
    { key: "web-hosting", label: "Web hosting", tier: "Silver" },
    { key: "automation", label: "Automation & bots", tier: "Gold" },
    { key: "trading", label: "Trading", tier: "Gold" },
    { key: "storage", label: "Storage & backups", tier: "Silver" },
  ];
  const useCaseChips = useCases.map((u, i) => `<button type="button" class="topic-chip${i === 0 ? " active" : ""}" data-use-case="${u.key}" data-tier="${u.tier}" aria-pressed="${i === 0 ? "true" : "false"}">${u.label}</button>`).join("");
  const body = `
  <!-- ============ Hero ============ -->
  <section class="hero">
    <div class="container hero-grid">
      <div class="hero-copy">
        <span class="eyebrow fade-up">Windows &amp; Linux VPS · Instant Setup</span>
        <h1 class="fade-up d1">Your server. <span class="gold">Live in 60 seconds.</span></h1>
        <p class="sub fade-up d2">High-performance remote desktop infrastructure without the complexity. Enterprise hardware, DDoS protection, and a 99.9% uptime SLA — online the moment you pay.</p>
        <div class="hero-cta fade-up d3">
          <a class="btn btn-primary" href="https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps">Deploy Your Server Now
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
          <a class="btn btn-ghost" href="https://dash.stealthrdp.com/submitticket.php">Ask a Pre-Sales Question</a>
        </div>
        <p class="hero-micro fade-up d3">Starting at only <b>€9.50/month</b> · No hidden fees · Cancel anytime · 7-day money-back</p>
        <div class="hero-stats fade-up d4">
          <div class="hero-stat"><div class="num"><b data-count-up="10000">10,000</b><span class="plus">+</span></div><div class="lbl">Orders</div></div>
          <div class="hero-stat"><div class="num"><b data-count-up="60">60</b><span class="plus">s</span></div><div class="lbl">Average deploy</div></div>
          <div class="hero-stat"><div class="num"><b data-count-up="99.9">99.9</b><span class="plus">%</span></div><div class="lbl">Uptime SLA</div></div>
        </div>
      </div>
      <div class="hero-console fade-up d2" aria-label="Deployment showcase">
        <div class="console-card">
          <div class="console-head"><span class="c-dot r"></span><span class="c-dot y"></span><span class="c-dot g"></span><span class="c-title">stealth deploy</span></div>
          <div class="console-body">
            <div class="console-line"><span class="cmd">$ stealth deploy --plan silver-usa --region us-east</span></div>
            <div class="console-line con-1"><span class="dim">▸ reserving dedicated vCPU</span></div>
            <div class="console-line con-2"><span class="dim">▸ provisioning NVMe storage</span></div>
            <div class="console-line con-3"><span class="dim">▸ installing Windows Server 2022</span></div>
            <div class="console-line con-4"><span class="dim">▸ applying DDoS protection rules</span></div>
            <div class="console-progress"><div class="bar" data-con-bar></div></div>
            <div class="console-line con-5"><span class="ok">✓ Windows Server 2022 ready in 60s</span></div>
          </div>
          <div class="console-foot"><span class="chip">2 <b>vCPU</b></span><span class="chip">4 <b>GB RAM</b></span><span class="chip">60 <b>GB NVMe</b></span><span class="chip">1 <b>Gbps</b></span></div>
        </div>
      </div>
    </div>
  </section>

  <!-- ============ OS marquee ============ -->
  <div class="marquee" role="region" aria-label="Supported operating systems">
    <div class="marquee-track" id="osTrack">
      <div class="marquee-set" role="list" aria-label="Supported operating systems">
        <span class="marquee-label" aria-hidden="true">Works with your OS</span>
        <span class="marquee-item" role="listitem"><img class="os-logo" src="/assets/os-logos/debian.svg" alt="Debian" width="24" height="24" decoding="async" loading="lazy"><span aria-hidden="true">Debian</span></span>
        <span class="marquee-item" role="listitem"><img class="os-logo" src="/assets/os-logos/centos.svg" alt="CentOS" width="24" height="24" decoding="async" loading="lazy"><span aria-hidden="true">CentOS</span></span>
        <span class="marquee-item" role="listitem"><img class="os-logo" src="/assets/os-logos/rockylinux.svg" alt="Rocky Linux" width="24" height="24" decoding="async" loading="lazy"><span aria-hidden="true">Rocky Linux</span></span>
        <span class="marquee-item" role="listitem"><img class="os-logo" src="/assets/os-logos/ubuntu.svg" alt="Ubuntu" width="24" height="24" decoding="async" loading="lazy"><span aria-hidden="true">Ubuntu</span></span>
        <span class="marquee-item" role="listitem"><img class="os-logo" src="/assets/os-logos/fedora.svg" alt="Fedora" width="24" height="24" decoding="async" loading="lazy"><span aria-hidden="true">Fedora</span></span>
        <span class="marquee-item" role="listitem"><img class="os-logo" src="/assets/os-logos/freebsd.svg" alt="FreeBSD" width="24" height="24" decoding="async" loading="lazy"><span aria-hidden="true">FreeBSD</span></span>
        <span class="marquee-item" role="listitem"><img class="os-logo" src="/assets/os-logos/alpinelinux.svg" alt="Alpine Linux" width="24" height="24" decoding="async" loading="lazy"><span aria-hidden="true">Alpine Linux</span></span>
        <span class="marquee-item" role="listitem"><img class="os-logo" src="/assets/os-logos/almalinux.svg" alt="AlmaLinux" width="24" height="24" decoding="async" loading="lazy"><span aria-hidden="true">AlmaLinux</span></span>
        <span class="marquee-item" role="listitem"><img class="os-logo" src="/assets/os-logos/windows.svg" alt="Windows" width="24" height="24" decoding="async" loading="lazy"><span aria-hidden="true">Windows</span></span>
      </div>
      <div class="marquee-set" aria-hidden="true">
        <span class="marquee-label">Works with your OS</span>
        <span class="marquee-item"><img class="os-logo" src="/assets/os-logos/debian.svg" alt="Debian" width="24" height="24" decoding="async" loading="lazy"><span>Debian</span></span>
        <span class="marquee-item"><img class="os-logo" src="/assets/os-logos/centos.svg" alt="CentOS" width="24" height="24" decoding="async" loading="lazy"><span>CentOS</span></span>
        <span class="marquee-item"><img class="os-logo" src="/assets/os-logos/rockylinux.svg" alt="Rocky Linux" width="24" height="24" decoding="async" loading="lazy"><span>Rocky Linux</span></span>
        <span class="marquee-item"><img class="os-logo" src="/assets/os-logos/ubuntu.svg" alt="Ubuntu" width="24" height="24" decoding="async" loading="lazy"><span>Ubuntu</span></span>
        <span class="marquee-item"><img class="os-logo" src="/assets/os-logos/fedora.svg" alt="Fedora" width="24" height="24" decoding="async" loading="lazy"><span>Fedora</span></span>
        <span class="marquee-item"><img class="os-logo" src="/assets/os-logos/freebsd.svg" alt="FreeBSD" width="24" height="24" decoding="async" loading="lazy"><span>FreeBSD</span></span>
        <span class="marquee-item"><img class="os-logo" src="/assets/os-logos/alpinelinux.svg" alt="Alpine Linux" width="24" height="24" decoding="async" loading="lazy"><span>Alpine Linux</span></span>
        <span class="marquee-item"><img class="os-logo" src="/assets/os-logos/almalinux.svg" alt="AlmaLinux" width="24" height="24" decoding="async" loading="lazy"><span>AlmaLinux</span></span>
        <span class="marquee-item"><img class="os-logo" src="/assets/os-logos/windows.svg" alt="Windows" width="24" height="24" decoding="async" loading="lazy"><span>Windows</span></span>
      </div>
    </div>
  </div>

  <!-- ============ Trust row (3 items) ============ -->
  <div class="trust-bar" style="padding:22px 0;border-bottom:1px solid var(--border)">
    <div class="container" style="display:flex;align-items:center;gap:8px 32px;flex-wrap:wrap;font-size:13.5px;color:var(--text-muted)">
      <span class="trust-heading" style="color:var(--text);font-weight:600">By the numbers</span>
      <span class="trust-item"><b style="color:var(--text)">10,000+</b> orders</span><span class="trust-divider" style="color:var(--border-strong)">/</span>
      <span class="trust-item"><b style="color:var(--text)">USA + EU</b> locations</span><span class="trust-divider" style="color:var(--border-strong)">/</span>
      <span class="trust-item"><b style="color:var(--text)">60-second</b> setup</span>
    </div>
  </div>

  <!-- ============ Workload-led pricing decision ============ -->
  <section class="section plans-preview decision-surface decision-combined" id="plans">
    <div class="container">
      <div class="decision-header">
        <div class="decision-title">
          <span class="sec-index fade-up">Choose a workload</span>
          <h2 class="fade-up d1">Plans priced for the work</h2>
        </div>
        <p class="fade-up d2">Pick a workload to highlight the plan that fits. All plans include free migration assistance, 24/7 support, and our industry-leading uptime guarantee.</p>
      </div>
      <div class="decision-workload" id="usecases">
        <div class="usecase-rail">
          <div class="topic-chips usecase-chips" role="group" aria-label="Choose a workload">${useCaseChips}</div>
          <button type="button" class="usecase-rail-next" aria-label="Show more workloads"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>
        </div>
      </div>
      <div class="plan-finder" aria-label="Plan finder">
        <div class="location-control"><span class="control-label">Region</span><div id="locationTabs" class="location-tabs" role="tablist" aria-label="Deployment region">
          <button role="tab" aria-selected="true" data-location="USA" class="active">USA</button>
          <button role="tab" aria-selected="false" data-location="EU">EU</button>
        </div></div>
        <div class="finder-field"><span class="control-label">Operating system</span><select id="osSelect" aria-label="Operating system"><option value="any">Any OS</option><option value="windows">Windows</option><option value="linux">Linux</option></select></div>
        <div class="finder-field"><span class="control-label">Use case</span><select id="useCaseSelect" aria-label="Use case"><option value="remote-desktop">Remote desktop</option><option value="web-hosting">Web hosting</option><option value="automation">Automation &amp; bots</option><option value="trading">Trading</option><option value="storage">Storage &amp; backups</option></select></div>
        <p class="finder-note" id="finderNote">Best fit: Bronze USA — any OS included on every plan.</p>
        <div class="all-link os-links" aria-label="Browse VPS operating system plans"><a class="btn btn-ghost btn-sm" href="/windows-vps/">Windows VPS hosting</a><a class="btn btn-ghost btn-sm" href="/linux-vps/">Linux VPS hosting</a><a class="btn btn-ghost btn-sm" href="/plans.html#windows-vps">Windows VPS</a><a class="btn btn-ghost btn-sm" href="/plans.html#linux-vps">Linux VPS</a><a class="btn btn-ghost btn-sm" href="/plans.html#comparison">Compare VPS resources</a></div>
      </div>
      <div class="billing-wrap fade-up d2">
        <div class="billing-toggle" id="billingToggle" role="tablist" aria-label="Billing cycle">${billingToggleHtml()}</div>
      </div>
      <div class="plan-grid" id="planGrid" aria-live="polite">${preview}</div>
      <div class="plan-rail-cue" aria-live="polite"><span id="planRailStatus">Plan 1 of 3</span><span class="plan-rail-line" aria-hidden="true"><i></i></span><span>Swipe to compare plans</span></div>
      <div class="all-link"><a class="btn btn-ghost" href="/plans.html">View All ${USA.length + EU.length} Plans</a></div>
    </div>
  </section>

  <!-- ============ Infrastructure / Why ============ -->
  <section class="section infrastructure-section" id="why">
    <div class="container">
      <div class="compact-section-head">
        <div><h2>Infrastructure that doesn't flinch</h2><p>Speed, protection, and visibility without the extra surface area.</p></div>
        <a class="text-link" href="/status.html">View server status ${ARROW_SVG}</a>
      </div>
      <div class="infrastructure-board">
        <div class="infrastructure-intro"><span class="infra-signal" aria-hidden="true"></span><span>Core infrastructure</span><span class="infra-count">Live monitoring</span></div>
        <ul class="infra-list">
          <li><strong>NVMe SSD storage</strong><span>Fast disk I/O for applications, databases, and terminals.</span><b>Performance</b></li>
          <li><strong>DDoS protection</strong><span>Isolated VM instances and protection for production workloads.</span><b>Protection</b></li>
          <li><strong>Global network</strong><span>Strategic locations with 1Gbps network speeds.</span><b>Reach</b></li>
          <li><strong>24/7 monitoring</strong><span>Automated monitoring with a public status page.</span><b>Visibility</b></li>
        </ul>
      </div>
    </div>
  </section>

  <!-- ============ Reviews ============ -->
  <section class="section reviews-section" id="testimonials">
    <div class="container">
      <div class="compact-section-head reviews-head">
        <div><h2>Customer and community reviews</h2><p>Real feedback from server owners and remote-desktop users. Clean cards, no links, no noise.</p></div>
      </div>
      ${reviewWallHtml()}
    </div>
  </section>

  <!-- ============ CTA band ============ -->
  <section class="cta-band">
    <div class="container cta-grid">
      <div class="cta-copy">
        <span class="eyebrow fade-up">Backed by 10,000+ orders</span>
        <h2 class="fade-up d1">Ready to stop wasting time on server management?</h2>
        <p class="fade-up d2">Deploy your high-performance VPS in the next 60 seconds and focus on what matters — your actual work.</p>
        <p class="micro fade-up d3">Starting at just <b>€${STARTING_PRICE}/month</b> · 7-day money-back guarantee · Cancel anytime</p>
      </div>
      <div class="cta-actions fade-up d3">
        <a class="btn btn-primary" href="https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps">Deploy Your Server Now</a>
        <a class="btn btn-ghost" href="https://dash.stealthrdp.com/submitticket.php">Ask a Pre-Sales Question</a>
      </div>
    </div>
  </section>`;
  const jsonLd = [{ "@context": "https://schema.org", "@graph": [
    ORG,
    websiteLd(),
    { "@type": "ItemList", name: "StealthRDP featured USA VPS plans", itemListElement: USA.slice(0, 3).map((p, i) => ({ "@type": "ListItem", position: i + 1, item: serviceLd(p) })) },
  ] }];
  return page({
    active: "home",
    title: "StealthRDP — Secure Remote Desktop & VPS Infrastructure",
    description: `Deploy a Windows or Linux VPS in 60 seconds. Enterprise-grade hardware, DDoS protection, 99.9% uptime SLA and 24/7 support — from €${STARTING_PRICE}/month.`,
    canonical: "__SRDP_BASE__/",
    jsonLd,
    body,
    includePricing: true,
  });
}

/* ---------- 2. plans ---------- */
function buildPlans() {
  const cards = USA.map((p) => planCardHtml(p)).join("");
  const compare = USA.concat(EU).map(compareRowHtml).join("");
  const body = `
  <section class="page-head">
    <div class="container"><span class="eyebrow">Windows and Linux VPS</span><h1>Windows &amp; Linux VPS Hosting Plans</h1><p>Compare Windows and Linux VPS hosting plans in one place. Choose a resource level, region, and billing cycle before the checkout.</p></div>
  </section>
  <section class="section plans-page-section" style="padding-top:0">
    <div class="container">
      <div class="plans-controls">
        <div class="billing-control"><span class="control-label">Billing cycle</span><div class="billing-toggle" id="billingToggle" role="tablist" aria-label="Billing cycle">${billingToggleHtml()}</div></div>
        <div class="location-control"><span class="control-label">Deployment region</span><div id="locationTabs" class="location-tabs" role="tablist" aria-label="Deployment region">
          <button role="tab" aria-selected="true" data-location="USA" class="active">USA</button>
          <button role="tab" aria-selected="false" data-location="EU">EU</button>
        </div></div>
        <a class="btn btn-sm btn-ghost plans-byo-link" href="https://dash.stealthrdp.com/index.php?rp=/store/build-your-own-rdp-vps">Build Your Own VPS</a>
      </div>
      <div class="plans-grid-head"><div><span class="mono">STANDARD PLANS</span><h2 id="plan-grid">Choose your resource level</h2></div><span id="planGridNote">6 USA plans · prices shown monthly</span></div>
      <div class="plan-grid plans-page-grid" id="planGrid" aria-live="polite">${cards}</div>
      <section class="os-choice-section" aria-labelledby="os-choice-heading">
        <div class="plans-context">
          <div><span class="sec-index">01 / Choose an operating system</span><h2 id="os-choice-heading">Pick the VPS environment that fits your work.</h2></div>
          <p>Windows and Linux VPS plans use the same resource comparison. Select the operating system that matches your software, administration, and remote-access needs during checkout.</p>
        </div>
        <article class="byo-panel" id="windows-vps">
          <div><span class="included-label">Windows VPS</span><h2>Windows VPS for graphical remote access.</h2><p>Choose Windows when your workflow needs a graphical desktop or Microsoft-compatible software. Compare CPU, RAM, NVMe storage, bandwidth, region, and billing cycle above. <a href="/windows-vps/">Read the Windows VPS hosting guide</a>.</p></div>
          <a class="btn btn-ghost" href="#plan-grid">Compare Windows VPS resources</a>
        </article>
        <article class="byo-panel" id="linux-vps">
          <div><span class="included-label">Linux VPS</span><h2>Linux VPS for server and open-source workloads.</h2><p>Choose Linux for command-line administration, web hosting, open-source applications, and server tooling. Compare the same resource levels before you continue to the checkout. <a href="/linux-vps/">Read the Linux VPS hosting guide</a>.</p></div>
          <a class="btn btn-ghost" href="#plan-grid">Compare Linux VPS resources</a>
        </article>
      </section>
      ${includedFeaturesHtml()}
      <div id="build-your-own" class="byo-panel">
        <div><span class="included-label">For workloads between the lines</span><h2>Build a server around your exact brief.</h2><p>Choose your own CPU, RAM, storage, location, and billing cycle in the server configurator.</p></div>
        <a class="btn btn-primary" href="https://dash.stealthrdp.com/index.php?rp=/store/build-your-own-rdp-vps">Configure &amp; Deploy</a>
      </div>
      <div class="comparison-section" id="comparison">
        <div class="comparison-head"><div><span class="sec-index">02 / Compare precisely</span><h2>See the difference in one view. <span class="visually-hidden">VPS Features Comparison</span></h2></div><p>Use this table for a quick resource check. Checkout confirms the current price and availability.</p></div>
        <div class="compare-wrap">
          <table class="compare-table">
            <thead><tr><th>Plan</th><th>CPU</th><th>RAM</th><th>Storage</th><th>Bandwidth</th><th>Price/mo</th><th></th></tr></thead>
            <tbody id="compareBody">${compare}</tbody>
          </table>
        </div>
      </div>
    </div>
  </section>`;
  const jsonLd = [
    { "@context": "https://schema.org", "@graph": [
      breadcrumbLd("Plans", [
        { name: "Home", url: "__SRDP_BASE__/" },
        { name: "Windows & Linux VPS Hosting", url: "__SRDP_BASE__/plans.html" },
      ]),
      { "@type": "ItemList", name: "StealthRDP VPS Plans", itemListElement: USA.concat(EU).map((p, i) => ({ "@type": "ListItem", position: i + 1, item: serviceLd(p) })) },
    ]},
  ];
  return page({
    active: "plans",
    title: "Windows & Linux VPS Hosting | USA & EU | StealthRDP",
    description: "Compare Windows and Linux VPS hosting plans from StealthRDP with USA and EU locations, NVMe storage, flexible billing, and checkout.",
    canonical: "__SRDP_BASE__/plans.html",
    jsonLd,
    body,
    planLocation: "USA",
    planLimit: USA.length,
    includePricing: true,
  });
}

function osVpsPageLd({ slug, title, description, serviceName, serviceType }) {
  return {
    "@type": "WebPage",
    "@id": `__SRDP_BASE__/${slug}/#webpage`,
    url: `__SRDP_BASE__/${slug}/`,
    name: title,
    description,
    isPartOf: { "@id": "__SRDP_BASE__/#website" },
    about: {
      "@type": "Service",
      name: serviceName,
      serviceType,
      provider: { "@id": "__SRDP_BASE__/#organization" },
      areaServed: ["USA", "EU"],
    },
  };
}

function buildOsVpsPage({
  slug,
  label,
  title,
  description,
  serviceName,
  serviceType,
  logo,
  logoAlt,
  h1,
  intro,
  planHref,
  planLabel,
  contentHtml,
  landingHtml,
}) {
  const body = landingHtml || `<main class="os-vps-page">
    <section class="page-head">
      <div class="container">
        <nav class="docs-breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/plans.html">VPS Plans</a><span aria-hidden="true">/</span><span>${label} VPS</span></nav>
        <span class="eyebrow">${label} VPS hosting</span>
        <h1>${h1}</h1>
        <p>${intro}</p>
        <div class="os-vps-intro">
          <img class="os-vps-logo" src="${logo}" alt="${logoAlt}" width="64" height="64" decoding="async">
          <div><strong>${serviceName}</strong><span>Choose resources, region, and operating system through the existing checkout.</span></div>
        </div>
        <div class="os-vps-links"><a class="btn btn-primary" href="${planHref}">${planLabel}</a><a class="btn btn-ghost" href="https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps">Continue to checkout</a></div>
      </div>
    </section>
    ${osVpsCatalogHtml({ slug, label })}
    <section class="section os-vps-checkout-note" aria-labelledby="${slug}-checkout-heading">
      <div class="container">
        <div class="byo-panel">
          <div><span class="included-label">Next step</span><h2 id="${slug}-checkout-heading">Choose the plan first. Select Windows or Linux in checkout.</h2><p>The buyer chooses the resource plan and region on this page. The existing checkout then provides the operating-system selector before payment.</p></div>
          <a class="btn btn-ghost" href="https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps">Configure this VPS</a>
        </div>
      </div>
    </section>
    <section class="section os-vps-guide" style="padding-top:0">
      <div class="container os-vps-guide-container">${contentHtml}</div>
    </section>
    <section class="cta-band">
      <div class="container cta-grid">
        <div class="cta-copy"><span class="eyebrow">${label} VPS plans</span><h2>${planLabel}</h2></div>
        <div class="cta-actions"><a class="btn btn-primary" href="${planHref}">${planLabel}</a><a class="btn btn-ghost" href="https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps">Open checkout</a></div>
      </div>
    </section>
  </main>`;
  // Build FAQ schema based on page type
  const faqSchema = slug === 'windows-vps' ? {
      "@type": "FAQPage",
      "mainEntity": [
        {"@type": "Question", "name": "Can I use familiar Windows software?", "acceptedAnswer": {"@type": "Answer", "text": "A Windows VPS provides a Windows environment for compatible software. Check each application's system requirements before ordering."}},
        {"@type": "Question", "name": "Do Windows VPS plans include Administrator access?", "acceptedAnswer": {"@type": "Answer", "text": "Yes. The FAQ states that VPS plans include full Administrator access."}},
        {"@type": "Question", "name": "Which Windows versions are listed?", "acceptedAnswer": {"@type": "Answer", "text": "Windows Server 2019, 2022, and 2025."}},
        {"@type": "Question", "name": "When will my Windows VPS be activated?", "acceptedAnswer": {"@type": "Answer", "text": "Standard installations are typically activated within 5 minutes. Most services are activated within 5–10 minutes after payment confirmation."}},
        {"@type": "Question", "name": "How will I receive my credentials?", "acceptedAnswer": {"@type": "Answer", "text": "StealthRDP sends service credentials by email after payment confirmation."}},
        {"@type": "Question", "name": "How do I choose CPU, RAM, and storage?", "acceptedAnswer": {"@type": "Answer", "text": "Use your software requirements, user count, processing needs, and data size. Then use the plan comparison to compare the available configurations."}},
        {"@type": "Question", "name": "Where can I get support?", "acceptedAnswer": {"@type": "Answer", "text": "Use the client-area ticketing system or support email. The FAQ provides the current support details."}},
        {"@type": "Question", "name": "Can I run any workload?", "acceptedAnswer": {"@type": "Answer", "text": "No. Use must remain lawful and must follow the Use of Service terms."}}
      ]
    } : {
      "@type": "FAQPage",
      "mainEntity": [
        {"@type": "Question", "name": "Can I order a cheap Linux VPS?", "acceptedAnswer": {"@type": "Answer", "text": "You can compare current Linux plan prices on the catalog, including Bronze at €9.50/month on the live plans page. Confirm the live price. We do not claim to be the cheapest host."}},
        {"@type": "Question", "name": "Which Linux distributions can I run?", "acceptedAnswer": {"@type": "Answer", "text": "AlmaLinux 8, 9, and 10; Alpine Linux 3.15, 3.19, and 3.23; CentOS 7, Stream 8, and Stream 9; Debian 10, 11, 12, and 13; Fedora 37 through 44; FreeBSD 13.2 through 15.0; Rocky Linux 8, 9, and 10; Ubuntu 18.04 LTS, 20.04 LTS, 22.04 LTS, 24.04 LTS, and 26.04 LTS; openSUSE Leap 15; CloudLinux 9; Arch Linux Latest; and Oracle Linux 8 and 9."}},
        {"@type": "Question", "name": "Can I run Ubuntu?", "acceptedAnswer": {"@type": "Answer", "text": "Yes. Ubuntu 18.04 LTS, 20.04 LTS, 22.04 LTS, 24.04 LTS, and 26.04 LTS."}},
        {"@type": "Question", "name": "Do plans include Root?", "acceptedAnswer": {"@type": "Answer", "text": "Yes. The FAQ states that VPS plans include full Root access."}},
        {"@type": "Question", "name": "Are USA and EU Linux plans available?", "acceptedAnswer": {"@type": "Answer", "text": "Yes. Both appear in the public catalog. Confirm the region at checkout."}},
        {"@type": "Question", "name": "When is it activated?", "acceptedAnswer": {"@type": "Answer", "text": "Typically within 5 minutes for standard installs. Most services within 5–10 minutes after payment confirmation."}},
        {"@type": "Question", "name": "How do I get credentials?", "acceptedAnswer": {"@type": "Answer", "text": "By email after payment confirmation."}},
        {"@type": "Question", "name": "Need Windows instead?", "acceptedAnswer": {"@type": "Answer", "text": "For familiar Windows software and remote Windows desktop or server access, see the Windows VPS hosting page."}}
      ]
    };
  
  const jsonLd = [{ "@context": "https://schema.org", "@graph": [
    breadcrumbLd(`${label} VPS`, [
      { name: "Home", url: "__SRDP_BASE__/" },
      { name: "VPS Plans", url: "__SRDP_BASE__/plans.html" },
      { name: `${label} VPS`, url: `__SRDP_BASE__/${slug}/` },
    ]),
    osVpsPageLd({ slug, title, description, serviceName, serviceType }),
    faqSchema,
  ] }];
  return page({ active: "plans", title, description, canonical: `__SRDP_BASE__/${slug}/`, jsonLd, body, showPalette: false });
}

function windowsLandingHtml() {
  return `<main class="os-vps-page os-vps-landing">
    <section class="page-head os-vps-hero" id="top">
      <div class="container hero-grid">
        <div class="hero-copy">
          <nav class="docs-breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/plans.html">VPS Plans</a><span aria-hidden="true">/</span><span>Windows VPS</span></nav>
          <img class="os-vps-logo" src="/assets/os-logos/windows-colored.svg" alt="Windows operating system logo" width="64" height="64" decoding="async">
          <span class="eyebrow">Windows VPS hosting</span>
          <h1>Windows VPS hosting for work that belongs on Windows</h1>
          <p class="sub">Use remote Windows access for familiar software, administration, and business workflows. Choose your operating system, compare the resources, and order the configuration that fits the job.</p>
          <p class="sub">StealthRDP sells Windows VPS plans in USA and EU regions. Compare the live catalog, then continue to the existing checkout.</p>
          <div class="hero-cta">
            <a class="btn btn-primary" href="#windows-plans">Compare Windows VPS plans</a>
            <a class="btn btn-ghost" href="#windows-versions">Windows versions</a>
          </div>
          <div class="os-hero-chips" aria-label="Listed Windows families">
            <span class="os-hero-chip"><img src="/assets/os-logos/windows-colored.svg" alt="Windows Server 2019" width="18" height="18" decoding="async">Server 2019</span>
            <span class="os-hero-chip"><img src="/assets/os-logos/windows-colored.svg" alt="Windows Server 2022" width="18" height="18" decoding="async">Server 2022</span>
            <span class="os-hero-chip"><img src="/assets/os-logos/windows-colored.svg" alt="Windows Server 2025" width="18" height="18" decoding="async">Server 2025</span>
          </div>
        </div>
        <aside class="hero-console" aria-label="Windows VPS deployment showcase">
          <div class="console-card">
            <div class="console-head"><span class="c-dot r"></span><span class="c-dot y"></span><span class="c-dot g"></span><span class="c-title">Windows VPS</span></div>
            <div class="console-body">
              <div class="console-line"><span class="cmd">$ stealth deploy --os windows --region us</span></div>
              <div class="console-line"><span class="dim">region USA / EU</span></div>
              <div class="console-line"><span class="dim">image Server 2019 / 2022 / 2025</span></div>
              <div class="console-line"><span class="dim">storage NVMe</span></div>
              <div class="console-line"><span class="ok">✓ confirm image during checkout</span></div>
            </div>
            <div class="console-foot"><span class="chip">€9.50 <b>Bronze / mo</b></span><span class="chip">Admin <b>included</b></span><span class="chip">5–10m <b>after payment</b></span></div>
          </div>
        </aside>
      </div>
    </section>
    ${osVpsCatalogHtml({ slug: "windows-vps", label: "Windows", sectionId: "windows-plans" })}
    <section class="section os-vps-checkout-note" aria-labelledby="windows-vps-checkout-heading">
      <div class="container">
        <div class="byo-panel">
          <div><span class="included-label">Next step</span><h2 id="windows-vps-checkout-heading">Choose the plan first. Select Windows or Linux in checkout.</h2><p>The buyer chooses the resource plan and region on this page. The existing checkout then provides the operating-system selector before payment.</p></div>
          <a class="btn btn-ghost" href="https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps">Configure this VPS</a>
        </div>
      </div>
    </section>
    <section class="section os-vps-cheap" id="windows-workflow">
      <div class="container">
        <div class="os-vps-guide-intro">
          <span class="included-label">Windows VPS guide</span>
          <h2>Keep your Windows workflow in reach</h2>
        </div>
        <div class="os-content-card">
          <p>A Windows VPS gives you a remote Windows environment for software, testing, administration, and business workflows. It can also suit users who need access to a Windows desktop or server without keeping the machine on site.</p>
          <p>Start with the software and users. A plan that fits one application may not fit several concurrent sessions or a larger installation.</p>
          <div class="os-vps-links"><a class="btn btn-primary" href="/plans.html#windows-vps">Windows VPS catalog</a><a class="btn btn-ghost" href="/plans.html#comparison">Plan comparison</a></div>
        </div>
      </div>
    </section>
    <section class="section os-vps-distros" id="windows-versions">
      <div class="container">
        <div class="os-vps-guide-intro">
          <span class="included-label">Environment</span>
          <h2>Choose the Windows version your software needs</h2>
          <p>The Services &amp; Plans FAQ lists these Windows options. Confirm the operating-system option during ordering.</p>
        </div>
        <div class="os-distro-wrap">
          <span class="os-distro-label" id="windows-version-label">Windows version</span>
          <div class="os-distro-tabs os-distro-tabs-3" role="tablist" aria-labelledby="windows-version-label">
            <button class="os-distro-tab" id="tab-server-2019" type="button" role="tab" aria-selected="true" aria-controls="panel-server-2019"><img src="/assets/os-logos/windows-colored.svg" alt="Windows Server 2019" width="32" height="32" decoding="async"><span><strong>Server 2019</strong><small>2019</small></span></button>
            <button class="os-distro-tab" id="tab-server-2022" type="button" role="tab" aria-selected="false" aria-controls="panel-server-2022"><img src="/assets/os-logos/windows-colored.svg" alt="Windows Server 2022" width="32" height="32" decoding="async"><span><strong>Server 2022</strong><small>2022</small></span></button>
            <button class="os-distro-tab" id="tab-server-2025" type="button" role="tab" aria-selected="false" aria-controls="panel-server-2025"><img src="/assets/os-logos/windows-colored.svg" alt="Windows Server 2025" width="32" height="32" decoding="async"><span><strong>Server 2025</strong><small>2025</small></span></button>
          </div>
          <div class="os-distro-panels">
            <article class="os-distro-panel" id="panel-server-2019" role="tabpanel" aria-labelledby="tab-server-2019">
              <h3>Windows Server 2019</h3>
              <div class="os-distro-versions"><span>2019</span></div>
              <p>Use when the software or workflow asks for Windows Server 2019.</p>
            </article>
            <article class="os-distro-panel" id="panel-server-2022" role="tabpanel" aria-labelledby="tab-server-2022" hidden>
              <h3>Windows Server 2022</h3>
              <div class="os-distro-versions"><span>2022</span></div>
              <p>Use when the software or workflow asks for Windows Server 2022.</p>
            </article>
            <article class="os-distro-panel" id="panel-server-2025" role="tabpanel" aria-labelledby="tab-server-2025" hidden>
              <h3>Windows Server 2025</h3>
              <div class="os-distro-versions"><span>2025</span></div>
              <p>Use when the software or workflow asks for Windows Server 2025.</p>
            </article>
          </div>
          <a class="os-related-link" href="/docs/1737945157-how-do-i-log-into-windows.html">How do I log into Windows?</a>
        </div>
      </div>
    </section>
    <section class="section os-vps-root" id="admin-access">
      <div class="container">
        <div class="os-vps-guide-intro"><span class="included-label">Control</span><h2>Administrator access for hands-on control</h2></div>
        <div class="os-content-card">
          <p>VPS plans include full Windows Administrator access. That gives you control over the Windows environment and the software you install. You are responsible for regular backups of important data.</p>
          <p>For the remote sign-in process, see <a href="/docs/1737945157-how-do-i-log-into-windows.html">How do I log into Windows?</a> StealthRDP sends service credentials by email after payment confirmation.</p>
        </div>
      </div>
    </section>
    <section class="section os-vps-size" id="size">
      <div class="container">
        <div class="os-vps-guide-intro">
          <span class="included-label">Resource fit</span>
          <h2>Size the machine to the stack</h2>
          <p>Count what runs at the same time: Windows, applications, users, files, and future additions.</p>
        </div>
        <div class="os-mini-grid">
          <article class="os-mini-card"><span class="os-mini-kicker">01 / CPU</span><h3>Concurrent work</h3><p>Match active processing and concurrent tasks.</p></article>
          <article class="os-mini-card"><span class="os-mini-kicker">02 / RAM</span><h3>Active services</h3><p>Allow for Windows, applications, and users running at the same time.</p></article>
          <article class="os-mini-card"><span class="os-mini-kicker">03 / NVMe</span><h3>Files and data</h3><p>Include the operating system, installed software, files, and future additions.</p></article>
        </div>
      </div>
    </section>
    <section class="section os-vps-regions" id="regions">
      <div class="container">
        <div class="os-vps-guide-intro"><span class="included-label">Regions</span><h2>USA or EU</h2></div>
        <div class="os-two-col">
          <article class="os-content-card"><h3>USA</h3><p>StealthRDP lists Windows VPS options for USA regions. Compare the region and resources in the catalog.</p></article>
          <article class="os-content-card"><h3>EU</h3><p>EU Windows VPS options also appear in the public catalog. Confirm the region and current configuration in checkout.</p></article>
        </div>
      </div>
    </section>
    <section class="section os-vps-activation" id="activation">
      <div class="container">
        <div class="os-vps-guide-intro"><span class="included-label">Before you order</span><h2>After payment</h2></div>
        <div class="os-content-card"><p>Standard Windows and Linux installations are typically activated within 5 minutes. Most services are activated within 5–10 minutes after payment confirmation. StealthRDP sends your service credentials by email after payment confirmation.</p></div>
      </div>
    </section>
    <section class="section os-vps-support" id="support">
      <div class="container">
        <div class="os-vps-guide-intro"><span class="included-label">Support and limits</span><h2>Support and limits</h2></div>
        <div class="os-content-card">
          <p>Support is available through the client-area ticketing system and support email. Review the <a href="/faq.html">FAQ</a> for support information and the <a href="/docs/1737944013-use-of-service.html">Use of Service terms</a> before you order.</p>
          <ul class="os-vps-check-list">
            <li>Use the client-area ticket system for service support.</li>
            <li>Follow the published Use of Service terms.</li>
            <li>The terms require lawful use. They prohibit abuse, scanning, hacking, spam, botnets, and similar misuse.</li>
          </ul>
        </div>
      </div>
    </section>
    <section class="section os-vps-order" id="order">
      <div class="container">
        <div class="os-vps-guide-intro"><span class="included-label">Order steps</span><h2>Order your Windows VPS</h2><p>Use these steps to move from workload requirements to a selected plan.</p></div>
        <ol class="os-order-list">
          <li>Open the Windows VPS catalog.</li>
          <li>Check the Windows version and required software.</li>
          <li>Compare CPU, RAM, NVMe storage, bandwidth, and region.</li>
          <li>Review the live order details and price, then confirm the purchase through StealthRDP.</li>
        </ol>
        <div class="os-vps-links"><a class="btn btn-primary" href="/plans.html#windows-vps">Compare Windows VPS plans</a></div>
      </div>
    </section>
    <section class="os-vps-faq" id="faq" aria-labelledby="windows-vps-faq-heading">
      <div class="container">
        <div class="os-vps-faq-head"><span class="included-label">Common questions</span><h2 id="windows-vps-faq-heading">Windows VPS questions</h2><p>Quick answers for software, access, activation, and support.</p></div>
        <div class="os-vps-faq-grid">
          <details class="os-vps-faq-item" open><summary>Can I use familiar Windows software?</summary><p>A Windows VPS provides a Windows environment for compatible software. Check each application's system requirements before ordering.</p></details>
          <details class="os-vps-faq-item"><summary>Do Windows VPS plans include Administrator access?</summary><p>Yes. The FAQ states that VPS plans include full Administrator access.</p></details>
          <details class="os-vps-faq-item"><summary>Which Windows versions are listed?</summary><p>Windows Server 2019, 2022, and 2025.</p></details>
          <details class="os-vps-faq-item"><summary>When will my Windows VPS be activated?</summary><p>Standard installations are typically activated within 5 minutes. Most services are activated within 5–10 minutes after payment confirmation.</p></details>
          <details class="os-vps-faq-item"><summary>How will I receive my credentials?</summary><p>StealthRDP sends service credentials by email after payment confirmation.</p></details>
          <details class="os-vps-faq-item"><summary>How do I choose CPU, RAM, and storage?</summary><p>Use your software requirements, user count, processing needs, and data size. Then use the <a href="/plans.html#comparison">plan comparison</a> to compare the available configurations.</p></details>
          <details class="os-vps-faq-item"><summary>Where can I get support?</summary><p>Use the client-area ticketing system or support email. The <a href="/faq.html">FAQ</a> provides the current support details.</p></details>
          <details class="os-vps-faq-item"><summary>Can I run any workload?</summary><p>No. Use must remain lawful and must follow the <a href="/docs/1737944013-use-of-service.html">Use of Service terms</a>.</p></details>
        </div>
        <section class="os-vps-next"><span class="included-label">Choose another environment</span><h2>Need Linux instead?</h2><p>For websites, applications, databases, or development stacks, see <a href="/linux-vps/">Linux VPS hosting</a>.</p></section>
      </div>
    </section>
    <section class="cta-band">
      <div class="container cta-grid">
        <div class="cta-copy"><span class="eyebrow">Windows VPS plans</span><h2>Compare Windows VPS plans</h2></div>
        <div class="cta-actions"><a class="btn btn-primary" href="/plans.html#windows-vps">Compare Windows VPS plans</a><a class="btn btn-ghost" href="https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps">Continue to checkout</a></div>
      </div>
    </section>
  </main>`;
}

function buildWindowsVps() {
  return buildOsVpsPage({
    slug: "windows-vps",
    label: "Windows",
    title: "Windows VPS Hosting | Compare USA and EU Plans | StealthRDP",
    description: "Compare Windows VPS hosting plans with full Administrator access, multiple OS versions, and flexible resources. Choose USA or EU regions and deploy fast.",
    serviceName: "StealthRDP Windows VPS hosting",
    serviceType: "Windows VPS hosting",
    logo: "/assets/os-logos/windows-colored.svg",
    logoAlt: "Windows operating system logo",
    h1: "Windows VPS hosting for work that belongs on Windows",
    intro: "Use remote Windows access for familiar software, administration, and business workflows. Choose your operating system, compare the resources, and order the configuration that fits the job.",
    planHref: "/plans.html#windows-vps",
    planLabel: "Compare Windows VPS plans",
    contentHtml: "",
    landingHtml: windowsLandingHtml(),
  });
}

function linuxLandingHtml() {
  return `<main class="os-vps-page os-vps-landing">
    <section class="page-head os-vps-hero" id="top">
      <div class="container hero-grid">
        <div class="hero-copy">
          <nav class="docs-breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/plans.html">VPS Plans</a><span aria-hidden="true">/</span><span>Linux VPS</span></nav>
          <img class="os-vps-logo" src="/assets/os-logos/linux-colored.svg" alt="Linux operating system logo" width="64" height="64" decoding="async">
          <span class="eyebrow">Linux VPS hosting</span>
          <h1>Linux VPS hosting with Root access and a distro you can confirm</h1>
          <p class="sub">You need a Linux server you can administer as root. That can be Ubuntu, Debian, CentOS, or another listed image. You also need a price you can verify before you pay.</p>
          <p class="sub">StealthRDP sells Linux VPS plans in USA and EU regions. Compare the live catalog, then continue to the existing checkout.</p>
          <div class="hero-cta">
            <a class="btn btn-primary" href="#linux-plans">Compare Linux VPS plans</a>
            <a class="btn btn-ghost" href="#linux-distros">Linux distributions</a>
          </div>
          <div class="os-hero-chips" aria-label="Listed Linux families">
            <span class="os-hero-chip"><img src="/assets/os-logos/ubuntu.svg" alt="Ubuntu" width="18" height="18" decoding="async">Ubuntu</span>
            <span class="os-hero-chip"><img src="/assets/os-logos/debian.svg" alt="Debian" width="18" height="18" decoding="async">Debian</span>
            <span class="os-hero-chip"><img src="/assets/os-logos/centos.svg" alt="CentOS" width="18" height="18" decoding="async">CentOS</span>
          </div>
        </div>
        <aside class="hero-console" aria-label="Linux VPS deployment showcase">
          <div class="console-card">
            <div class="console-head"><span class="c-dot r"></span><span class="c-dot y"></span><span class="c-dot g"></span><span class="c-title">Linux VPS</span></div>
            <div class="console-body">
              <div class="console-line"><span class="cmd">$ stealth deploy --os ubuntu --region us</span></div>
              <div class="console-line"><span class="dim">region USA / EU</span></div>
              <div class="console-line"><span class="dim">image Ubuntu / Debian / CentOS</span></div>
              <div class="console-line"><span class="dim">storage NVMe</span></div>
              <div class="console-line"><span class="ok">✓ confirm image during checkout</span></div>
            </div>
            <div class="console-foot"><span class="chip">€9.50 <b>Bronze / mo</b></span><span class="chip">Root <b>included</b></span><span class="chip">5–10m <b>after payment</b></span></div>
          </div>
        </aside>
      </div>
    </section>
    ${osVpsCatalogHtml({ slug: "linux-vps", label: "Linux", sectionId: "linux-plans" })}
    <section class="section os-vps-checkout-note" aria-labelledby="linux-vps-checkout-heading">
      <div class="container">
        <div class="byo-panel">
          <div><span class="included-label">Next step</span><h2 id="linux-vps-checkout-heading">Choose the plan first. Select Windows or Linux in checkout.</h2><p>The buyer chooses the resource plan and region on this page. The existing checkout then provides the operating-system selector before payment.</p></div>
          <a class="btn btn-ghost" href="https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps">Configure this VPS</a>
        </div>
      </div>
    </section>
    <section class="section os-vps-cheap" id="cheap-linux-vps">
      <div class="container">
        <div class="os-vps-guide-intro">
          <span class="included-label">Linux VPS guide</span>
          <h2>If you searched for cheap Linux VPS</h2>
        </div>
        <div class="os-content-card">
          <p>If you searched for cheap Linux VPS: “Cheap” here means see the current catalog, including Bronze at <strong>€9.50/month</strong> on the live plans page (from a €10.00 base). It does not mean we are the cheapest provider on the internet. We do not claim that.</p>
          <p>Bronze USA lists 2 Core, 4 GB RAM, 60 GB NVMe, and Unlimited bandwidth. Bronze EU lists 2 Core, 4 GB RAM, 40 GB NVMe, and Unlimited bandwidth. Confirm the live row before you order. Prices and stock can change.</p>
          <div class="os-vps-links"><a class="btn btn-primary" href="/plans.html#linux-vps">Linux VPS catalog</a><a class="btn btn-ghost" href="/plans.html#comparison">Plan comparison</a></div>
        </div>
      </div>
    </section>
    <section class="section os-vps-distros" id="linux-distros">
      <div class="container">
        <div class="os-vps-guide-intro">
          <span class="included-label">Environment</span>
          <h2>Linux distributions you can run</h2>
          <p>Choose the operating-system family your stack needs, then confirm the exact image and version during checkout.</p>
        </div>
        <div class="os-distro-wrap">
          <span class="os-distro-label" id="linux-distro-label">Linux distribution</span>
                    <div class="os-distro-tabs" role="tablist" aria-labelledby="linux-distro-label">
            <button class="os-distro-tab" id="tab-ubuntu" type="button" role="tab" aria-selected="true" aria-controls="panel-ubuntu"><img src="/assets/os-logos/ubuntu.svg" alt="Ubuntu" width="32" height="32" decoding="async"><span><strong>Ubuntu</strong><small>18.04–26.04 LTS</small></span></button><button class="os-distro-tab" id="tab-debian" type="button" role="tab" aria-selected="false" aria-controls="panel-debian"><img src="/assets/os-logos/debian.svg" alt="Debian" width="32" height="32" decoding="async"><span><strong>Debian</strong><small>10 / 11 / 12 / 13</small></span></button><button class="os-distro-tab" id="tab-centos" type="button" role="tab" aria-selected="false" aria-controls="panel-centos"><img src="/assets/os-logos/centos.svg" alt="CentOS" width="32" height="32" decoding="async"><span><strong>CentOS</strong><small>7 / Stream 8 / 9</small></span></button><button class="os-distro-tab" id="tab-alma" type="button" role="tab" aria-selected="false" aria-controls="panel-alma"><img src="/assets/os-logos/almalinux.svg" alt="AlmaLinux" width="32" height="32" decoding="async"><span><strong>AlmaLinux</strong><small>8 / 9 / 10</small></span></button><button class="os-distro-tab" id="tab-rocky" type="button" role="tab" aria-selected="false" aria-controls="panel-rocky"><img src="/assets/os-logos/rockylinux.svg" alt="Rocky Linux" width="32" height="32" decoding="async"><span><strong>Rocky Linux</strong><small>8 / 9 / 10</small></span></button><button class="os-distro-tab" id="tab-fedora" type="button" role="tab" aria-selected="false" aria-controls="panel-fedora"><img src="/assets/os-logos/fedora.svg" alt="Fedora" width="32" height="32" decoding="async"><span><strong>Fedora</strong><small>37–44</small></span></button><button class="os-distro-tab" id="tab-alpine" type="button" role="tab" aria-selected="false" aria-controls="panel-alpine"><img src="/assets/os-logos/alpinelinux.svg" alt="Alpine Linux" width="32" height="32" decoding="async"><span><strong>Alpine Linux</strong><small>3.15 / 3.19 / 3.23</small></span></button><button class="os-distro-tab" id="tab-freebsd" type="button" role="tab" aria-selected="false" aria-controls="panel-freebsd"><img src="/assets/os-logos/freebsd.svg" alt="FreeBSD" width="32" height="32" decoding="async"><span><strong>FreeBSD</strong><small>13.2–15.0</small></span></button><button class="os-distro-tab" id="tab-opensuse" type="button" role="tab" aria-selected="false" aria-controls="panel-opensuse"><img src="/assets/os-logos/opensuse.svg" alt="openSUSE" width="32" height="32" decoding="async"><span><strong>openSUSE</strong><small>Leap 15</small></span></button><button class="os-distro-tab" id="tab-cloudlinux" type="button" role="tab" aria-selected="false" aria-controls="panel-cloudlinux"><img src="/assets/os-logos/cloudlinux.svg" alt="CloudLinux" width="32" height="32" decoding="async"><span><strong>CloudLinux</strong><small>9</small></span></button><button class="os-distro-tab" id="tab-arch" type="button" role="tab" aria-selected="false" aria-controls="panel-arch"><img src="/assets/os-logos/archlinux.svg" alt="Arch Linux" width="32" height="32" decoding="async"><span><strong>Arch Linux</strong><small>Latest</small></span></button><button class="os-distro-tab" id="tab-oracle" type="button" role="tab" aria-selected="false" aria-controls="panel-oracle"><img src="/assets/os-logos/oraclelinux.svg" alt="Oracle Linux" width="32" height="32" decoding="async"><span><strong>Oracle Linux</strong><small>8 / 9</small></span></button>
          </div>
          <div class="os-distro-panels">
            <article class="os-distro-panel" id="panel-ubuntu" role="tabpanel" aria-labelledby="tab-ubuntu"><h3>Ubuntu</h3><div class="os-distro-versions"><span>18.04 LTS</span><span>20.04 LTS</span><span>22.04 LTS</span><span>24.04 LTS</span><span>26.04 LTS</span></div><p>Fits many websites, panels, and development stacks.</p></article><article class="os-distro-panel" id="panel-debian" role="tabpanel" aria-labelledby="tab-debian" hidden><h3>Debian</h3><div class="os-distro-versions"><span>10</span><span>11</span><span>12</span><span>13</span></div><p>Use when the stack asks for Debian.</p></article><article class="os-distro-panel" id="panel-centos" role="tabpanel" aria-labelledby="tab-centos" hidden><h3>CentOS</h3><div class="os-distro-versions"><span>7</span><span>Stream 8</span><span>Stream 9</span></div><p>Use when the stack asks for CentOS.</p></article><article class="os-distro-panel" id="panel-alma" role="tabpanel" aria-labelledby="tab-alma" hidden><h3>AlmaLinux</h3><div class="os-distro-versions"><span>8</span><span>9</span><span>10</span></div><p>Use when the stack asks for AlmaLinux.</p></article><article class="os-distro-panel" id="panel-rocky" role="tabpanel" aria-labelledby="tab-rocky" hidden><h3>Rocky Linux</h3><div class="os-distro-versions"><span>8</span><span>9</span><span>10</span></div><p>Use when the stack asks for Rocky Linux.</p></article><article class="os-distro-panel" id="panel-fedora" role="tabpanel" aria-labelledby="tab-fedora" hidden><h3>Fedora</h3><div class="os-distro-versions"><span>37</span><span>38</span><span>39</span><span>40</span><span>41</span><span>42</span><span>43</span><span>44</span></div><p>Use when the stack asks for Fedora.</p></article><article class="os-distro-panel" id="panel-alpine" role="tabpanel" aria-labelledby="tab-alpine" hidden><h3>Alpine Linux</h3><div class="os-distro-versions"><span>3.15</span><span>3.19</span><span>3.23</span></div><p>Use when the stack asks for Alpine Linux.</p></article><article class="os-distro-panel" id="panel-freebsd" role="tabpanel" aria-labelledby="tab-freebsd" hidden><h3>FreeBSD</h3><div class="os-distro-versions"><span>13.2</span><span>13.3</span><span>14.0</span><span>14.1</span><span>14.2</span><span>14.3</span><span>15.0</span></div><p>Use when the stack asks for FreeBSD.</p></article><article class="os-distro-panel" id="panel-opensuse" role="tabpanel" aria-labelledby="tab-opensuse" hidden><h3>openSUSE</h3><div class="os-distro-versions"><span>Leap 15</span></div><p>Use when the stack asks for openSUSE Leap 15.</p></article><article class="os-distro-panel" id="panel-cloudlinux" role="tabpanel" aria-labelledby="tab-cloudlinux" hidden><h3>CloudLinux</h3><div class="os-distro-versions"><span>9</span></div><p>Use when the stack asks for CloudLinux 9.</p></article><article class="os-distro-panel" id="panel-arch" role="tabpanel" aria-labelledby="tab-arch" hidden><h3>Arch Linux</h3><div class="os-distro-versions"><span>Latest</span></div><p>Use when the stack asks for Arch Linux.</p></article><article class="os-distro-panel" id="panel-oracle" role="tabpanel" aria-labelledby="tab-oracle" hidden><h3>Oracle Linux</h3><div class="os-distro-versions"><span>8</span><span>9</span></div><p>Use when the stack asks for Oracle Linux.</p></article>
          </div>
          <a class="os-related-link" href="/docs/1737946490-how-to-install-direct-admin-in-a-linux-server.html">How to install DirectAdmin in a Linux server</a>
        </div>
      </div>
    </section>
    <section class="section os-vps-root" id="root-access">
      <div class="container">
        <div class="os-vps-guide-intro"><span class="included-label">Control</span><h2>Root access</h2></div>
        <div class="os-content-card"><p>VPS plans include full Root access. You administer the server. You keep backups. You stay inside the <a href="/docs/1737944013-use-of-service.html">Use of Service terms</a>.</p></div>
      </div>
    </section>
    <section class="section os-vps-size" id="size">
      <div class="container">
        <div class="os-vps-guide-intro">
          <span class="included-label">Resource fit</span>
          <h2>Size the machine to the stack</h2>
          <p>Count what runs at the same time: OS, web server, app, database, jobs, files.</p>
        </div>
        <div class="os-mini-grid">
          <article class="os-mini-card"><span class="os-mini-kicker">01 / CPU</span><h3>Concurrent work</h3><p>Compare CPU against the application, services, workers, and expected load.</p></article>
          <article class="os-mini-card"><span class="os-mini-kicker">02 / RAM</span><h3>Active services</h3><p>Size memory for the OS plus web server, app processes, databases, panels, and jobs.</p></article>
          <article class="os-mini-card"><span class="os-mini-kicker">03 / NVMe</span><h3>Files and data</h3><p>Compare NVMe storage, bandwidth, region, and billing cycle on the live catalog.</p></article>
        </div>
      </div>
    </section>
    <section class="section os-vps-regions" id="regions">
      <div class="container">
        <div class="os-vps-guide-intro"><span class="included-label">Regions</span><h2>USA or EU</h2></div>
        <div class="os-two-col">
          <article class="os-content-card"><h3>USA</h3><p>Choose the region that matches your users and your own location. USA Linux plans appear in the public catalog.</p></article>
          <article class="os-content-card"><h3>EU</h3><p>EU Linux plans also appear in the public catalog. Confirm the region and current configuration in checkout.</p></article>
        </div>
      </div>
    </section>
    <section class="section os-vps-activation" id="activation">
      <div class="container">
        <div class="os-vps-guide-intro"><span class="included-label">Before you order</span><h2>After payment</h2></div>
        <div class="os-content-card"><p>Standard Linux installations are typically activated within 5 minutes. Most services are activated within 5–10 minutes after payment confirmation. Credentials arrive by email after payment confirmation.</p></div>
      </div>
    </section>
    <section class="section os-vps-support" id="support">
      <div class="container">
        <div class="os-vps-guide-intro"><span class="included-label">Support and limits</span><h2>Support and limits</h2></div>
        <div class="os-content-card">
          <p>Support is the client-area ticket system and support email. See the <a href="/faq.html">FAQ</a>.</p>
          <ul class="os-vps-check-list">
            <li>Use the client-area ticket system for service support.</li>
            <li>Follow the published Use of Service terms.</li>
            <li>Unlawful use, scanning, hacking, spam, and botnets are prohibited.</li>
          </ul>
        </div>
      </div>
    </section>
    <section class="section os-vps-order" id="order">
      <div class="container">
        <div class="os-vps-guide-intro"><span class="included-label">Order steps</span><h2>Order a Linux VPS</h2><p>Move from your requirements to checkout.</p></div>
        <ol class="os-order-list">
          <li>Write down the listed Linux image you need, plus the services you will run.</li>
          <li>Open the <a href="/plans.html#linux-vps">Linux VPS catalog</a>.</li>
          <li>Compare CPU, RAM, disk, region, and the price on the page.</li>
          <li>Continue to checkout. Select Linux there.</li>
        </ol>
        <div class="os-vps-links"><a class="btn btn-primary" href="/plans.html#linux-vps">Compare Linux VPS plans</a></div>
      </div>
    </section>
    <section class="os-vps-faq" id="faq" aria-labelledby="linux-vps-faq-heading">
      <div class="container">
        <div class="os-vps-faq-head"><span class="included-label">Common questions</span><h2 id="linux-vps-faq-heading">Linux VPS questions</h2><p>Quick answers for price, Ubuntu, access, regions, and activation.</p></div>
        <div class="os-vps-faq-grid">
          <details class="os-vps-faq-item" open><summary>Can I order a cheap Linux VPS?</summary><p>You can compare current Linux plan prices on the catalog, including Bronze at €9.50/month on the live plans page. Confirm the live price. We do not claim to be the cheapest host.</p></details>
          <details class="os-vps-faq-item"><summary>Which Linux distributions can I run?</summary><p>AlmaLinux 8, 9, and 10; Alpine Linux 3.15, 3.19, and 3.23; CentOS 7, Stream 8, and Stream 9; Debian 10, 11, 12, and 13; Fedora 37 through 44; FreeBSD 13.2 through 15.0; Rocky Linux 8, 9, and 10; Ubuntu 18.04 LTS, 20.04 LTS, 22.04 LTS, 24.04 LTS, and 26.04 LTS; openSUSE Leap 15; CloudLinux 9; Arch Linux Latest; and Oracle Linux 8 and 9.</p></details>
          <details class="os-vps-faq-item"><summary>Can I run Ubuntu?</summary><p>Yes. Ubuntu 18.04 LTS, 20.04 LTS, 22.04 LTS, 24.04 LTS, and 26.04 LTS.</p></details>
          <details class="os-vps-faq-item"><summary>Do plans include Root?</summary><p>Yes. The FAQ states that VPS plans include full Root access.</p></details>
          <details class="os-vps-faq-item"><summary>Are USA and EU Linux plans available?</summary><p>Yes. Both appear in the public catalog. Confirm the region at checkout.</p></details>
          <details class="os-vps-faq-item"><summary>When is it activated?</summary><p>Typically within 5 minutes for standard installs. Most services within 5–10 minutes after payment confirmation.</p></details>
          <details class="os-vps-faq-item"><summary>How do I get credentials?</summary><p>By email after payment confirmation.</p></details>
          <details class="os-vps-faq-item"><summary>Need Windows instead?</summary><p>For familiar Windows software and remote Windows desktop or server access, see the <a href="/windows-vps/">Windows VPS hosting page</a>.</p></details>
        </div>
        <section class="os-vps-next"><span class="included-label">Choose another environment</span><h2>Need Windows instead?</h2><p>For familiar Windows software and remote Windows desktop or server access, see <a href="/windows-vps/">Windows VPS hosting</a>.</p></section>
      </div>
    </section>
    <section class="cta-band">
      <div class="container cta-grid">
        <div class="cta-copy"><span class="eyebrow">Linux VPS plans</span><h2>Compare Linux VPS plans</h2><p>Check the current plan, region, and displayed price, then confirm Linux and the exact image in checkout.</p></div>
        <div class="cta-actions"><a class="btn btn-primary" href="/plans.html#linux-vps">Compare Linux VPS plans</a><a class="btn btn-ghost" href="https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps">Continue to checkout</a></div>
      </div>
    </section>
  </main>`;
}

function buildLinuxVps() {
  return buildOsVpsPage({
    slug: "linux-vps",
    label: "Linux",
    title: "Linux VPS Hosting | Ubuntu, Debian, CentOS | StealthRDP",
    description: "Compare cheap Linux VPS plans with Ubuntu, Debian, or CentOS, Root access, and USA or EU regions. Check live catalog prices, then continue to checkout.",
    serviceName: "StealthRDP Linux VPS hosting",
    serviceType: "Linux VPS hosting",
    logo: "/assets/os-logos/linux-colored.svg",
    logoAlt: "Linux operating system logo",
    h1: "Linux VPS hosting with Root access and a distro you can confirm",
    intro: "You need a Linux server you can administer as root. That can be Ubuntu, Debian, CentOS, or another listed image. You also need a price you can verify before you pay.",
    planHref: "/plans.html#linux-vps",
    planLabel: "Compare Linux VPS plans",
    contentHtml: "",
    landingHtml: linuxLandingHtml(),
  });
}

/* ---------- 4. status ---------- */
function buildStatus() {
  const headline = ALL_UP ? "All services are online" : "Service status needs attention";
  const nodes = MONITORS.map(nodeCardHtml).join("");
  const body = `
  <section class="page-head">
    <div class="container"><span class="eyebrow">Server status</span><h1>${headline}</h1><p>Live service status and 90-day uptime history.</p></div>
  </section>
  <section class="section status-page-section" style="padding-top:0">
    <div class="container">
      <div class="status-meta-row">
        <span class="status-count-pill" id="statusCountTotal"><b>${TOTAL}</b> services</span>
        <span class="status-source-note" id="statusSourceNote">Live refresh is attempted when this page loads.</span>
        <span class="status-legend"><span><i class="status-key healthy" aria-hidden="true"></i>Operational</span><span><i class="status-key degraded" aria-hidden="true"></i>Partial availability</span><span><i class="status-key unknown" aria-hidden="true"></i>Downtime / unknown</span></span>
      </div>
      <div class="status-section-head"><div><span class="mono">SERVICES</span><h2>Service components</h2></div></div>
      <div class="node-list" id="nodeList" aria-live="polite">${nodes}</div>
    </div>
  </section>`;
  const jsonLd = [{ "@context": "https://schema.org", "@graph": [
    breadcrumbLd("Server Status", [
      { name: "Home", url: "__SRDP_BASE__/" },
      { name: "Server Status", url: "__SRDP_BASE__/status.html" },
    ]),
  ]}];
  return page({
    active: "status",
    title: "Server Status — StealthRDP",
    description: "Live StealthRDP service status, current availability, and 90-day uptime history for protected service components.",
    canonical: "__SRDP_BASE__/status.html",
    jsonLd,
    body,
  });
}

/* ---------- 5. blog index ---------- */
function buildBlog() {
  const cards = BLOG.map((post) => blogCardHtml(post)).join("");
  const categories = [...new Set(BLOG.map((post) => post.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const categoryOptions = categories.map((category) => `<option value="${esc(category)}">${esc(category)}</option>`).join("");
  const topicChips = `<button type="button" class="topic-chip active" data-blog-topic="all">All<span>${BLOG.length}</span></button>` + categories.map((category) => `<button type="button" class="topic-chip" data-blog-topic="${esc(category)}">${esc(category)}<span>${BLOG.filter((post) => post.category === category).length}</span></button>`).join("");
  const body = `
  <section class="page-head blog-page-head">
    <div class="container"><span class="eyebrow">Blog</span><h1>Field notes for servers in motion</h1><p>Practical guidance for remote desktops, VPS workloads, and the systems around them.</p></div>
  </section>
  <section class="section blog-index-section" style="padding-top:0">
    <div class="container">
      <div class="blog-toolbar"><div class="blog-filters"><label for="blogSearch">Search articles</label><input id="blogSearch" type="search" placeholder="Try: backups, RDP, uptime…" autocomplete="off" /><select id="blogCategory" hidden><option value="all">All topics</option>${categoryOptions}</select></div></div>
      <div class="topic-chips blog-topics" role="group" aria-label="Filter by topic">${topicChips}</div>
      <div class="blog-results-bar"><span id="blogResultsCount">${BLOG.length} articles</span><span>Guides · tutorials · infrastructure notes</span></div>
      <div class="blog-grid" id="blogGrid">${cards}</div><p class="blog-empty" id="blogEmpty" hidden>No articles match that search. Try a broader topic.</p>
    </div>
  </section>`;
  const jsonLd = [{ "@context": "https://schema.org", "@graph": [
    breadcrumbLd("Blog", [
      { name: "Home", url: "__SRDP_BASE__/" },
      { name: "Blog", url: "__SRDP_BASE__/blog.html" },
    ]),
    { "@type": "ItemList", name: "StealthRDP Blog", itemListElement: BLOG.map((p, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "BlogPosting", headline: p.title, datePublished: p.date, author: { "@type": "Organization", name: p.author || "StealthRDP Team" }, url: `__SRDP_BASE__/blog/${p.slug}.html` } })) },
  ]}];
  return page({
    active: "blog",
    title: "Blog — StealthRDP",
    description: "Expert insights, tutorials, and updates on remote desktop security, VPS management, and server infrastructure.",
    canonical: "__SRDP_BASE__/blog.html",
    jsonLd,
    body,
  });
}

/* ---------- 6. blog post ---------- */
function structureBlogHtml(html) {
  if (!html) return { html: "", headings: [] };
  let out = String(html)
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\sstyle="[^"]*"/gi, "")
    .replace(/\sclass="[^"]*"/gi, "")
    .replace(/<h6[\s\S]*?<\/h6>/gi, "");
  const headings = [];
  let previousHeadingLevel = 1;
  out = out.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_, level, attrs, inner) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    const id = ((attrs.match(/\sid="([^"]+)"/) || [])[1] || slugifyHeading(text));
    const requestedLevel = Number(level);
    const safeLevel = Math.min(requestedLevel, previousHeadingLevel + 1);
    previousHeadingLevel = safeLevel;
    headings.push({ level: safeLevel, id, text });
    return `<h${safeLevel} id="${esc(id)}">${inner}</h${safeLevel}>`;
  });
  out = out.replace(/https:\/\/stealthrdp\.com\/dash\/login\.php/gi, "https://dash.stealthrdp.com/index.php?rp=/login");
  out = out.replace(/<table[\s\S]*?<\/table>/gi, (table) => `<div class="docs-table-wrap">${table}</div>`);
  out = out.replace(/<img([^>]*)>/gi, (_, attrs) => {
    const src = (attrs.match(/\ssrc="([^"]+)"/) || [])[1] || "";
    const alt = (attrs.match(/\salt="([^"]*)"/) || [])[1] || "";
    if (!src) return "";
    return `<figure class="blog-figure"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" /></figure>`;
  });
  return { html: out, headings };
}

const ARTICLE_PLAN_LINKS = {
  "windows-vs-linux-vps-which-os-best-fits-your-business": [
    ["/windows-vps/", "Explore Windows VPS hosting"],
    ["/linux-vps/", "Explore Linux VPS hosting"],
    ["/plans.html#windows-vps", "Compare Windows VPS plans"],
    ["/plans.html#linux-vps", "Compare Linux VPS plans"],
  ],
  "5-ways-to-optimize-your-rdp-performance-for-remote-work": [
    ["/windows-vps/", "Explore Windows VPS hosting"],
    ["/plans.html#windows-vps", "Compare Windows VPS plans"],
  ],
  "8-signs-you-need-to-upgrade-your-vps-resources": [
    ["/windows-vps/", "Review Windows VPS resources"],
    ["/linux-vps/", "Review Linux VPS resources"],
    ["/plans.html#comparison", "Compare VPS resources"],
  ],
  "common-vps-performance-bottlenecks": [
    ["/plans.html#comparison", "Compare VPS resources"],
  ],
  "common-vps-hosting-issues-and-their-solutions": [
    ["/plans.html#linux-vps", "Compare Linux VPS plans"],
  ],
  "top-6-vps-management-tools-for-small-businesses": [
    ["/plans.html#linux-vps", "Compare Linux VPS plans"],
  ],
};

function articlePlanLinksHtml(post) {
  const links = ARTICLE_PLAN_LINKS[post.slug] || [];
  if (!links.length) return "";
  return `<p class="article-plan-links"><strong>Continue your VPS research:</strong> ${links.map(([href, label]) => `<a href="${href}">${label}</a>`).join(" · ")}</p>`;
}

function buildBlogPost(post) {
  const article = BLOG_BODIES.get(post.slug) || {};
  const rendered = structureBlogHtml(article.html || "");
  const toc = rendered.headings.length
    ? `<aside class="docs-toc" aria-label="On this page"><span class="docs-toc-title">On this page</span><ol>${rendered.headings.map((heading) => `<li class="toc-level-${heading.level}"><a href="#${esc(heading.id)}">${esc(heading.text)}</a></li>`).join("")}</ol></aside>`
    : "";
  const body = `
  <main class="docs-article-page blog-article-page"><div class="container"><div class="docs-article-layout">
    <article class="docs-article-column" id="blogPost">
      <nav class="docs-breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/blog.html">Blog</a><span aria-hidden="true">/</span><span>${esc(post.category)}</span></nav>
      <header class="docs-article-header"><span class="docs-category">${esc(post.category)}</span><h1>${esc(post.title)}</h1><p class="docs-summary">${esc(post.excerpt || "")}</p><div class="docs-source-meta"><span>${esc(post.author)}</span><span>${esc(post.date)}</span></div></header>
      <div class="docs-content blog-article-body">${rendered.html || `<p>${esc(post.excerpt || "")}</p>`}${articlePlanLinksHtml(post)}</div>
      <footer class="blog-article-footer"><a href="/blog.html">← Back to all articles</a><span class="blog-article-actions"><a class="btn btn-ghost btn-sm" href="/plans.html">View plans</a><a class="btn btn-primary btn-sm" href="https://dash.stealthrdp.com/submitticket.php">Ask support</a></span></footer>
    </article>
    ${toc}
  </div></div></main>`;
  const howto = howToLd(post, rendered.headings);
  const jsonLd = [{ "@context": "https://schema.org", "@graph": [
    breadcrumbLd(post.title, [
      { name: "Home", url: "__SRDP_BASE__/" },
      { name: "Blog", url: "__SRDP_BASE__/blog.html" },
      { name: post.title, url: `__SRDP_BASE__/blog/${post.slug}.html` },
    ]),
    articleLd(post),
    ...(howto ? [howto] : []),
  ]}];
  const fullTitle = `${post.title} — StealthRDP Blog`;
  const useTitle = fullTitle.length <= SEO_TITLE_LIMIT ? fullTitle : seoTitle(post.title);
  return page({
    active: "blog",
    title: useTitle,
    description: (post.excerpt || "").slice(0, 155) || `StealthRDP article: ${post.title}`,
    canonical: `__SRDP_BASE__/blog/${post.slug}.html`,
    pageType: "article",
    jsonLd,
    body,
  });
}

/* ---------- 7. faq ---------- */
function buildFaq() {
  const items = FAQS.map(faqItemHtml).join("");
  const categories = [...new Set(FAQS.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const categoryOptions = categories.map((category) => `<option value="${esc(category)}">${esc(category)}</option>`).join("");
  const topicChips = `<button type="button" class="topic-chip active" data-faq-topic="all">All<span>${FAQS.length}</span></button>` + categories.map((category) => `<button type="button" class="topic-chip" data-faq-topic="${esc(category)}">${esc(category)}<span>${FAQS.filter((item) => item.category === category).length}</span></button>`).join("");
  const body = `
  <section class="page-head">
    <div class="container"><span class="eyebrow">FAQ</span><h1>Answers before you deploy</h1><p>Plans, setup, billing, security, and support — search or browse by topic below.</p></div>
  </section>
  <section class="section faq-page-section" style="padding-top:0">
    <div class="container faq-layout">
      <div class="faq-results">
        <div class="faq-controls"><label for="faqSearch">Search questions</label><input id="faqSearch" type="search" placeholder="Try: refund, Windows, upgrade…" autocomplete="off" /><select id="faqCategory" hidden><option value="all">All topics</option>${categoryOptions}</select></div>
        <div class="topic-chips faq-topics" role="group" aria-label="Filter by topic">${topicChips}</div>
        <div class="faq-results-bar"><span id="faqResultsCount">${FAQS.length} questions</span><span>Source-backed answers · updated with the site snapshot</span></div>
        <div class="faq-list" id="faqList" aria-live="polite">${items}</div><p class="faq-empty" id="faqEmpty" hidden>No questions match that search. Try another phrase or choose all topics.</p>
        <div class="faq-support"><div><span class="sec-index">Still need a hand?</span><h2>Take the question to support.</h2><p>Account, billing, and server-specific requests are handled in the client portal.</p></div><a class="btn btn-primary" href="${DOC_SUPPORT_URL}">Contact support</a></div>
      </div>
    </div>
  </section>`;
  const jsonLd = [{ "@context": "https://schema.org", "@graph": [
    breadcrumbLd("FAQ", [
      { name: "Home", url: "__SRDP_BASE__/" },
      { name: "FAQ", url: "__SRDP_BASE__/faq.html" },
    ]),
    faqLd(),
  ]}];
  return page({
    active: "faq",
    title: "FAQ — StealthRDP",
    description: "Frequently asked questions about StealthRDP VPS hosting: setup, operating systems, upgrades, refunds, and more.",
    canonical: "__SRDP_BASE__/faq.html",
    jsonLd,
    body,
  });
}

/* ---------- 8. about ---------- */
function buildAbout() {
  const body = `
  <section class="page-hero">
    <div class="container"><span class="eyebrow">Who we are</span><h1>Built for people who need servers that just work</h1><p>StealthRDP exists to remove the friction from remote infrastructure — deploy in 60 seconds, get full control, and never worry about the hardware again.</p></div>
  </section>
  <section class="section" style="padding-top:0">
    <div class="container prose">
      <h2>What we do</h2>
      <p>We provide high-performance remote desktop and virtual private server infrastructure. Every StealthRDP server ships with NVMe storage, DDoS protection, dedicated IPs, and 1Gbps network connectivity — online the moment you pay.</p>
      <h2>Why people choose us</h2>
      <ul>
        <li><strong>Speed of deployment</strong> — full server access within 60 seconds of purchase. No waiting, no manual provisioning.</li>
        <li><strong>Enterprise-grade hardware</strong> — NVMe storage, isolated VM instances, and DDoS-protected infrastructure.</li>
        <li><strong>Transparent operations</strong> — live status page showing every production node, monitored 24/7.</li>
        <li><strong>Support that answers</strong> — 24/7 technical assistance with an average response under 2 hours.</li>
        <li><strong>Flexible plans</strong> — USA and EU locations, monthly to biannual billing, and a build-your-own configurator.</li>
      </ul>
      <h2>Trusted at scale</h2>
      <p>10,000+ orders and counting for remote work, web hosting, trading infrastructure, and always-on automation. Every new server is backed by our 99.9% uptime SLA and a 7-day money-back guarantee.</p>
      <div class="note">Questions about our infrastructure? <a href="https://dash.stealthrdp.com/submitticket.php" style="color:var(--accent)">Talk to our team</a> — we respond within 2 hours, 24/7.</div>
    </div>
  </section>`;
  const jsonLd = [{ "@context": "https://schema.org", "@graph": [
    ORG,
    breadcrumbLd("About", [
      { name: "Home", url: "__SRDP_BASE__/" },
      { name: "About Us", url: "__SRDP_BASE__/about.html" },
    ]),
  ]}];
  return page({
    active: "about",
    title: "About Us — StealthRDP",
    description: "StealthRDP provides high-performance remote desktop and VPS infrastructure with 10,000+ orders worldwide.",
    canonical: "__SRDP_BASE__/about.html",
    jsonLd,
    body,
  });
}

/* ---------- 9. privacy ---------- */
function buildPrivacy() {
  const body = `
  <section class="page-hero">
    <div class="container"><span class="eyebrow">Legal</span><h1>Privacy Policy</h1><p>Last updated: August 2026</p></div>
  </section>
  <section class="section" style="padding-top:0">
    <div class="container prose">
      <h2>1. Information we collect</h2>
      <p>We collect information you provide directly when you create an account, place an order, or contact support: your name, email address, billing information, and any details you share in support requests. We also collect basic technical data — IP address, browser type, and pages visited — to operate and improve our services.</p>
      <h2>2. How we use your information</h2>
      <ul>
        <li>Providing, maintaining, and securing your servers and account</li>
        <li>Processing payments and preventing fraud</li>
        <li>Responding to support requests and troubleshooting</li>
        <li>Sending service notices, updates, and transactional communications</li>
        <li>Improving our website, services, and customer experience</li>
      </ul>
      <h2>3. Payments</h2>
      <p>Payments are processed through our secure billing provider using bank-level encryption. We do not store full payment card details on our servers.</p>
      <h2>4. Data sharing</h2>
      <p>We do not sell your personal data. We share information only with service providers who help us operate our business (payment processing, infrastructure, support tools) and only to the extent necessary to provide our services or as required by law.</p>
      <h2>5. Data retention &amp; security</h2>
      <p>We retain account and billing records as required for business and legal purposes. We apply appropriate technical and organizational measures — including isolated infrastructure, restricted access, and DDoS protection — to safeguard your data.</p>
      <h2>6. Your rights</h2>
      <p>You may request access to, correction of, or deletion of your personal data at any time by contacting our support team. We respond to all privacy requests promptly.</p>
      <h2>7. Contact</h2>
      <p>For privacy questions, contact us at <a href="mailto:support@stealthrdp.com" style="color:var(--accent)">support@stealthrdp.com</a> or via our support portal. Our terms of service are available in our documentation center.</p>
      <div class="note">This policy is a working document and may be updated as our services evolve. Significant changes will be communicated to account holders.</div>
    </div>
  </section>`;
  const jsonLd = [{ "@context": "https://schema.org", "@graph": [
    breadcrumbLd("Privacy Policy", [
      { name: "Home", url: "__SRDP_BASE__/" },
      { name: "Privacy Policy", url: "__SRDP_BASE__/privacy.html" },
    ]),
  ]}];
  return page({
    active: "privacy",
    title: "Privacy Policy — StealthRDP",
    description: "StealthRDP privacy policy — how we collect, use, and protect your information.",
    canonical: "__SRDP_BASE__/privacy.html",
    jsonLd,
    body,
  });
}

/* ---------- robots + sitemap ---------- */
function buildRobots() {
  return `User-agent: *
Content-Signal: ai-train=no, search=yes, ai-input=yes
Allow: /
Disallow: /api/
Disallow: /blog-post.html

Sitemap: __SRDP_BASE__/sitemap.xml
# AI guide: __SRDP_BASE__/llms.txt
`;
}

function buildRss() {
  const items = BLOG.map((post) => `    <item>
      <title>${esc(post.title)}</title>
      <link>__SRDP_BASE__/blog/${post.slug}.html</link>
      <guid>__SRDP_BASE__/blog/${post.slug}.html</guid>
      <pubDate>${new Date(post.date + "T00:00:00Z").toUTCString()}</pubDate>
      <description>${esc(post.excerpt || "")}</description>
    </item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>StealthRDP Blog</title>
    <link>__SRDP_BASE__/blog.html</link>
    <description>VPS, RDP, and server operations articles from StealthRDP.</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
}

function buildSitemap() {
  const staticRoutes = [
    ["/", "2026-08-31"],
    ["/plans.html", "2026-08-31"],
    ["/windows-vps/", "2026-09-02"],
    ["/linux-vps/", "2026-09-02"],
    ["/status.html", "2026-08-31"],
    ["/blog.html", "2026-08-31"],
    ["/faq.html", "2026-08-31"],
    ["/about.html", "2026-08-31"],
    ["/privacy.html", "2026-08-31"],
    ["/docs.html", "2026-08-31"],
  ];
  const blogRoutes = BLOG.map((p) => [`/blog/${p.slug}.html`, p.date]);
  const docRoutes = DOCS.map((article) => [`/docs/${article.slug}.html`, docDateIso(article.date) || "2026-08-13"]);
  const urls = staticRoutes.concat(blogRoutes, docRoutes);
  const items = urls
    .map(([loc, lastmod]) => `  <url>\n    <loc>__SRDP_BASE__${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>
`;
}

/* ---------- write ---------- */
fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });
const OUT = {
  "404.html": build404(),
  "index.html": buildIndex(),
  "plans.html": buildPlans(),
  "windows-vps/index.html": buildWindowsVps(),
  "linux-vps/index.html": buildLinuxVps(),
  "status.html": buildStatus(),
  "blog.html": buildBlog(),
  "faq.html": buildFaq(),
  "about.html": buildAbout(),
  "privacy.html": buildPrivacy(),
  "docs.html": buildDocsIndex(),
  "robots.txt": buildRobots(),
  "sitemap.xml": buildSitemap(),
  "rss.xml": buildRss(),
};

fs.rmSync(path.join(ROOT, "features.html"), { force: true });

fs.mkdirSync(path.join(ROOT, "blog"), { recursive: true });
for (const post of BLOG) {
  OUT[`blog/${post.slug}.html`] = buildBlogPost(post);
}
for (const [index, article] of DOCS.entries()) {
  OUT[`docs/${article.slug}.html`] = buildDocArticle(article, index);
}
const windowsEvalArticle = DOCS.find((article) => article.slug === "1737944563-how-to-re_activate-and-extend-your-180_day-windows-trial");
if (windowsEvalArticle) {
  OUT[`docs/${windowsEvalArticle.slug.replace("how-to-", "how-to_")}.html`] = buildDocArticle(windowsEvalArticle, DOCS.indexOf(windowsEvalArticle));
}

for (const [file, content] of Object.entries(OUT)) {
  fs.mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, file), content);
  console.log("wrote", file, (content.length / 1024).toFixed(1) + "KB");
}
console.log("build complete:", Object.keys(OUT).length, "files");
