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

const USA = DATA("plans_usa.json");
const EU = DATA("plans_eu.json");
const FAQS = DATA("faqs.json");
const TESTIMONIALS = DATA("testimonials.json");
const REVIEWS = DATA("reviews.json");
const UPTIME = DATA("uptime.json");
const BLOG = require(path.join(ROOT, "js", "blog-data.js")).SRDP_BLOG;
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
const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Visible monthly price = API base * 0.95 (matches main.js CYCLE_MULT.monthly)
const MONTHLY_MULT = 0.95;
const monthlyPrice = (p) => round2((p.monthlyPrice || 0) * MONTHLY_MULT);

const PLAN_SLUGS = {
  "Bronze USA": "bronze-usa2", "Silver USA": "silver-usa", "Gold USA": "gold-usa",
  "Platinum USA": "platinum-usa", "Diamond USA": "diamond-usa", "Emerald USA": "emerald-usa",
  "Bronze EU": "bronze-eu", "Silver EU": "silver-eu", "GOLD EU": "gold-eu",
  "Platinum EU": "platinum-eu", "Diamond EU": "diamond-eu", "Emerald EU": "emerald-eu",
};
const planUrl = (p) => {
  const slug = PLAN_SLUGS[p.name];
  if (slug) return "https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps/" + slug + "&billingcycle=monthly";
  if (p.purchaseUrl) return p.purchaseUrl;
  return "https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps";
};
const planName = (p) => p.name.replace(" USA", "").replace(" EU", "");

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
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="${robots}" />
  <meta name="author" content="StealthRDP" />
  <link rel="canonical" href="${canonical}" />
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
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
  <link rel="stylesheet" href="/css/style.css?v=os-logos-1" />
  <!-- Google Tag Manager (real container from live site) -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','GTM-NS397SS9');</script>
  <!-- End Google Tag Manager -->
  ${ld}
</head>`;
}

/* ---------- shared chrome (header + footer) ---------- */
const LOGO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>';
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

function headerHtml(active) {
  return `<header class="header"><div class="container header-inner">
    <a href="/" class="logo" aria-label="StealthRDP home">
      <span class="logo-mark">${LOGO_SVG}</span><span>Stealth<em>RDP</em></span>
    </a>
    <nav class="nav" aria-label="Main navigation">${navHtml(active)}</nav>
    <div class="header-actions">
      ${paletteLabHtml()}
      <a class="btn btn-sm btn-primary" href="https://dash.stealthrdp.com/index.php?rp=/login" target="_blank" rel="noopener noreferrer">Client Area</a>
      <button class="nav-toggle" id="navToggle" aria-label="Toggle menu" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
    </div>
  </div>
  <div class="mobile-nav" id="mobileNav">${navHtml(active)}<a class="btn btn-primary" href="https://dash.stealthrdp.com/index.php?rp=/login" target="_blank" rel="noopener noreferrer">Client Area</a></div>
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
    <div class="footer-status"><span class="dot"></span><span id="footerStatus">Checking live status…</span></div>
    <div class="footer-grid">
      <div class="footer-about">
        <a href="/" class="logo" aria-label="StealthRDP home"><span class="logo-mark">${LOGO_SVG}</span><span>Stealth<em>RDP</em></span></a>
        <p>Enterprise-grade remote desktop infrastructure with unmatched security and performance.</p>
        <div class="footer-social">${social}</div>
      </div>
      <div class="footer-col"><h4>Products</h4><ul>
        <li><a href="/plans.html">RDP Plans</a></li>
        <li><a href="/plans.html#build-your-own">Build Your Own VPS</a></li>
        <li><a href="/plans.html">Pricing</a></li>
      </ul></div>
      <div class="footer-col"><h4>Resources</h4><ul>
        <li><a href="/docs.html">Documentation</a></li>
        <li><a href="/blog.html">Tutorials</a></li>
        <li><a href="/faq.html">FAQ</a></li>
        <li><a href="/blog.html">Blog</a></li>
        <li><a href="/status.html">Server Status</a></li>
      </ul></div>
      <div class="footer-col"><h4>Company</h4><ul>
        <li><a href="/about.html">About Us</a></li>
        <li><a href="https://dash.stealthrdp.com/submitticket.php" target="_blank" rel="noopener noreferrer">Contact Support</a></li>
        <li><a href="/privacy.html">Privacy Policy</a></li>
        <li><a href="${TERMS_URL}">Terms of Service</a></li>
      </ul></div>
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

function scripts(extra = []) {
  return `<script src="/js/main.js"></script>${extra.map((s) => `<script src="${s}"></script>`).join("")}`;
}

/* ---------- baked content ---------- */
function planCardHtml(p, { showPopular = true } = {}) {
  const price = monthlyPrice(p);
  const isPop = showPopular && p.popular;
  return `<article class="plan-card${isPop ? " popular" : ""}">
    ${isPop ? '<span class="plan-popular">Most Popular</span>' : ""}
    <div class="p-name">${esc(planName(p))}</div>
    <div class="p-desc">${esc(p.description || "")}</div>
    <div class="plan-price"><span class="cur">&euro;${fmt(price)}<small>/mo</small></span><span class="was">&euro;${fmt(p.monthlyPrice || 0)}</span></div>
    <div class="plan-specs">
      ${specRow("CPU", p.specs && p.specs.cpu)}
      ${specRow("RAM", p.specs && p.specs.ram)}
      ${specRow("Storage", p.specs && p.specs.storage)}
      ${specRow("Bandwidth", p.specs && p.specs.bandwidth)}
    </div>
    <a class="btn ${isPop ? "btn-primary" : "btn-ghost"}" href="${planUrl(p)}" target="_blank" rel="noopener noreferrer">Deploy Now</a>
  </article>`;
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
    <td class="v">&euro;${fmt(p.monthlyPrice || 0)}</td>
    <td><a class="btn btn-sm ${p.popular ? "btn-primary" : "btn-ghost"}" href="${planUrl(p)}" target="_blank" rel="noopener noreferrer">Deploy</a></td>
  </tr>`;
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

function nodeCardHtml(m) {
  const ratios = m.custom_uptime_ranges ? m.custom_uptime_ranges.split("-") : [];
  const last = Number.isFinite(Number(m.uptimeRatio)) ? Number(m.uptimeRatio) : (ratios.length ? parseFloat(ratios[ratios.length - 1]) : null);
  const upNow = isUp(m);
  const label = m.label || m.friendly_name || "Production node";
  const region = m.region || "Protected infrastructure";
  return `<div class="node-card">
    <div class="n-left"><span class="n-dot ${upNow ? "up" : "down"}"></span>
      <div><div class="n-name">${esc(label)}</div><div class="n-target">${esc(region)}</div></div>
    </div>
    <div class="n-right"><div class="n-uptime"><div class="u-val ${upNow ? "good" : ""}">${last != null ? last.toFixed(2) : "—"}%</div><div class="u-lbl">90-day uptime</div></div></div>
  </div>`;
}

function testimonialHtml() {
  if (!TESTIMONIALS.length) {
    return '<div class="quote-empty">Testimonials are being collected. Our 10,877+ customers trust us — join them today.</div>';
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
  const authorName = (review.authorName || "").split(" · ")[0].trim();
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
  // Show the complete collected review set on the wall. Internal provenance
  // stays in data/reviews.json; cards never expose links or provider names.
  const items = REVIEWS.filter((item) => item && item.quote);
  if (!items.length) return '<div class="quote-empty">Customer and community feedback is being collected.</div>';
  const columns = [0, 1, 2].map((column) => items.filter((_, index) => index % 3 === column));
  return `<div class="review-wall" data-review-count="${items.length}" aria-label="Customer and community reviews">
    ${columns.map((column, index) => `<div class="review-column review-column-${index + 1}"><div class="review-track">${column.concat(column).map((review, reviewIndex) => reviewCardHtml(review, reviewIndex >= column.length ? " review-card-copy" : "")).join("")}</div></div>`).join("")}
  </div>
  <p class="review-disclosure">${items.length} real reviews from server owners and remote-desktop users.</p>`;
}

function blogCardHtml(p, extraClass = "") {
  return `<article class="blog-card${extraClass}" data-blog-category="${esc(p.category || "Insights")}" data-blog-title="${esc(p.title)}"><div class="bc-body">
    <span class="bc-cat">${esc(p.category)}</span>
    <h3>${esc(p.title)}</h3>
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
    const safeLevel = Math.max(2, Math.min(6, Number(level) || 2));
    const clean = rawText.replace(/\[#\]\([^)]*\)/g, "").replace(/^\*\*(.*)\*\*$/, "$1").trim();
    const idBase = slugifyHeading(clean);
    let id = idBase;
    let suffix = 2;
    while (headings.some((heading) => heading.id === id)) id = `${idBase}-${suffix++}`;
    headings.push({ id, text: clean, level: safeLevel });
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
  const quickPaths = DOCS.slice(0, 4).map((article, index) => `<a class="docs-quick-link" href="/docs/${esc(article.slug)}.html"><span>0${index + 1}</span><strong>${esc(article.title)}</strong><b aria-hidden="true">→</b></a>`).join("");
  const body = `<main class="docs-index docs-surface">
    <section class="docs-index-hero"><div class="container docs-hero-grid"><div>
      <nav class="docs-breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>Docs</span></nav>
      <div class="page-hero-kicker"><span class="eyebrow">Read / Explore</span><span class="page-hero-meta">${DOCS.length} verified guides · source-labelled</span></div><h1>Find the next safe step.</h1>
      <p>Task-focused guides for Windows, Linux, networking, panels, server management, and account questions. Search first, then follow the prerequisites and commands that fit your server.</p>
    </div><aside class="docs-hero-rail"><span class="mono">START HERE</span>${quickPaths}</aside></div></section>
    <section class="section docs-index-section"><div class="container docs-index-layout">
      <aside class="docs-index-intro"><span class="sec-index">Knowledge base</span><h2>Find the next safe step</h2><p>Browse by task or search exact terms. The articles below are preserved source material, not new product claims.</p><a class="btn btn-ghost btn-sm" href="${DOC_SUPPORT_URL}" target="_blank" rel="noopener noreferrer">Ask support</a></aside>
      <div class="docs-results"><div class="docs-controls"><label class="docs-search-label" for="docsSearch">Search guides</label><input id="docsSearch" type="search" placeholder="Try: rebuild, VPN, PowerShell…" autocomplete="off" /><label class="docs-category-label" for="docsCategory">Category</label><select id="docsCategory"><option value="all">All categories</option>${options}</select></div><div class="docs-results-bar"><span id="docsResultsCount">${DOCS.length} guides</span><span>Verified source snapshot · ${DOCS.length} articles</span></div><div class="docs-card-grid" id="docsResults" data-docs-index>${cards}</div><p class="docs-empty" id="docsEmpty" hidden>No guides match that search. Try a broader term or another category.</p></div>
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
    <article class="docs-article"><header class="docs-article-header"><span class="docs-category">${esc(article.category)}</span><h1>${esc(article.title)}</h1><p class="docs-summary">${esc(article.summary)}</p><div class="docs-source-meta">${sourceMeta}</div></header>${docsWarning(article)}<div class="docs-content">${rendered.html}</div><div class="docs-support"><div><span class="sec-index">Need a hand?</span><h2>Support is still on WHMCS</h2><p>For account or server-specific help, use the StealthRDP support portal.</p></div><a class="btn btn-primary" href="${DOC_SUPPORT_URL}" target="_blank" rel="noopener noreferrer">Contact support</a></div>${relatedHtml}</article>
  </div>${contents}</div></main>`;
  const fullTitle = `${article.title} — StealthRDP Docs`;
  const useTitle = fullTitle.length <= 70 ? fullTitle : `${article.title.slice(0, Math.max(30, 70 - " — StealthRDP".length - 1)).trim()}… — StealthRDP`;
  const jsonLd = [{ "@context": "https://schema.org", "@graph": [breadcrumbLd(article.title, [{ name: "Home", url: "__SRDP_BASE__/" }, { name: "Docs", url: "__SRDP_BASE__/docs.html" }, { name: article.category, url: `__SRDP_BASE__/docs.html?category=${encodeURIComponent(article.category)}` }, { name: article.title, url: `__SRDP_BASE__/docs/${article.slug}.html` }]), docsArticleLd(article)] }];
  return page({ active: "docs", title: useTitle, description: (article.summary.length < 70 ? `${article.summary} Read the verified guide and contact StealthRDP support when you need account-specific help.` : article.summary).slice(0, 165), canonical: `__SRDP_BASE__/docs/${article.slug}.html`, pageType: "article", jsonLd, body, extraScripts: ["/js/docs.js"] });
}

/* ---------- JSON-LD ---------- */
const ORG = {
  "@type": "Organization",
  "@id": "__SRDP_BASE__/#organization",
  name: "StealthRDP",
  url: "__SRDP_BASE__/",
  logo: "__SRDP_BASE__/assets/favicon.svg",
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
    offers: { "@type": "Offer", price: monthlyPrice(p), priceCurrency: "EUR", url: planUrl(p) },
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
    publisher: { "@type": "Organization", name: "StealthRDP", url: "__SRDP_BASE__/", logo: { "@type": "ImageObject", url: "__SRDP_BASE__/assets/favicon.svg" } },
    image: "__SRDP_BASE__/assets/og-cover.png",
    mainEntityOfPage: `__SRDP_BASE__/blog/${post.slug}.html`,
    url: `__SRDP_BASE__/blog/${post.slug}.html`,
  };
}

/* ---------- page builders ---------- */
function page({ active, title, description, canonical, pageType = "website", jsonLd = [], body, extraScripts = [], planLocation = "", planLimit = "" }) {
  const pageData = `${planLocation ? ` data-plan-location="${esc(planLocation)}"` : ""}${planLimit ? ` data-plan-limit="${esc(planLimit)}"` : ""}`;
  return `${head({ title, description, canonical, pageType, jsonLd })}
<body data-page="${active}"${pageData}>
  <!-- Google Tag Manager (noscript) -->
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NS397SS9"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
  <!-- End Google Tag Manager (noscript) -->
  ${headerHtml(active)}
  ${body}
  ${footerHtml()}
  ${scripts(extraScripts)}
</body>
</html>`;
}

/* ---------- 1. index ---------- */
function buildIndex() {
  const preview = USA.slice(0, 3).map((p) => planCardHtml(p)).join("");
  const body = `
  <!-- ============ Hero ============ -->
  <section class="hero">
    <div class="container hero-grid">
      <div class="hero-copy">
        <span class="eyebrow fade-up">Windows &amp; Linux VPS · Instant Setup</span>
        <h1 class="fade-up d1">Your server. <span class="gold">Live in 60 seconds.</span></h1>
        <p class="sub fade-up d2">High-performance remote desktop infrastructure without the complexity. Enterprise hardware, DDoS protection, and a 99.9% uptime SLA — online the moment you pay.</p>
        <div class="hero-cta fade-up d3">
          <a class="btn btn-primary" href="https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps" target="_blank" rel="noopener noreferrer">Deploy Your Server Now
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
          <a class="btn btn-ghost" href="https://dash.stealthrdp.com/submitticket.php" target="_blank" rel="noopener noreferrer">Ask a Pre-Sales Question</a>
        </div>
        <p class="hero-micro fade-up d3">Starting at only <b>$9.50/month</b> · No hidden fees · Cancel anytime · 7-day money-back</p>
        <div class="hero-stats fade-up d4">
          <div class="hero-stat"><div class="num">10,877<span class="plus">+</span></div><div class="lbl">Customers</div></div>
          <div class="hero-stat"><div class="num">25,000<span class="plus">+</span></div><div class="lbl">Servers deployed</div></div>
          <div class="hero-stat"><div class="num">99.9<span class="plus">%</span></div><div class="lbl">Uptime SLA</div></div>
        </div>
      </div>
      <div class="hero-console fade-up d2" aria-label="Deployment demonstration">
        <div class="console-card">
          <div class="console-head"><span class="c-dot r"></span><span class="c-dot y"></span><span class="c-dot g"></span><span class="c-title">stealth-deploy — demonstration</span></div>
          <div class="console-body">
            <div class="console-demo-note"><span class="warn">DEMONSTRATION</span> This is not a live deployment. No server is provisioned.</div>
            <div class="console-line"><span class="cmd">$ stealth deploy --plan bronze-usa --region us-east</span></div>
            <div class="console-line"><span class="dim">▸ plan selected for illustration</span></div>
            <div class="console-line"><span class="dim">▸ region selected for illustration</span></div>
            <div class="console-line"><span class="warn">▸ pricing and availability shown at checkout</span></div>
            <div class="console-line"><span class="dim">▸ no infrastructure request is made by this preview</span></div>
            <div class="console-progress"><div class="bar" style="width:42%"></div></div>
            <div class="console-line"><span class="pct">illustration only</span></div>
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
        <span class="marquee-item" role="listitem"><img class="os-logo" src="/assets/os-logos/debian.svg" alt="Debian" width="24" height="24" decoding="async"><span aria-hidden="true">Debian</span></span>
        <span class="marquee-item" role="listitem"><img class="os-logo" src="/assets/os-logos/centos.svg" alt="CentOS" width="24" height="24" decoding="async"><span aria-hidden="true">CentOS</span></span>
        <span class="marquee-item" role="listitem"><img class="os-logo" src="/assets/os-logos/rockylinux.svg" alt="Rocky Linux" width="24" height="24" decoding="async"><span aria-hidden="true">Rocky Linux</span></span>
        <span class="marquee-item" role="listitem"><img class="os-logo" src="/assets/os-logos/ubuntu.svg" alt="Ubuntu" width="24" height="24" decoding="async"><span aria-hidden="true">Ubuntu</span></span>
        <span class="marquee-item" role="listitem"><img class="os-logo" src="/assets/os-logos/fedora.svg" alt="Fedora" width="24" height="24" decoding="async"><span aria-hidden="true">Fedora</span></span>
        <span class="marquee-item" role="listitem"><img class="os-logo" src="/assets/os-logos/freebsd.svg" alt="FreeBSD" width="24" height="24" decoding="async"><span aria-hidden="true">FreeBSD</span></span>
        <span class="marquee-item" role="listitem"><img class="os-logo" src="/assets/os-logos/alpinelinux.svg" alt="Alpine Linux" width="24" height="24" decoding="async"><span aria-hidden="true">Alpine Linux</span></span>
        <span class="marquee-item" role="listitem"><img class="os-logo" src="/assets/os-logos/almalinux.svg" alt="AlmaLinux" width="24" height="24" decoding="async"><span aria-hidden="true">AlmaLinux</span></span>
        <span class="marquee-item" role="listitem"><img class="os-logo" src="/assets/os-logos/windows.svg" alt="Windows" width="24" height="24" decoding="async"><span aria-hidden="true">Windows</span></span>
      </div>
      <div class="marquee-set" aria-hidden="true">
        <span class="marquee-label">Works with your OS</span>
        <span class="marquee-item"><img class="os-logo" src="/assets/os-logos/debian.svg" alt="" width="24" height="24" decoding="async"><span>Debian</span></span>
        <span class="marquee-item"><img class="os-logo" src="/assets/os-logos/centos.svg" alt="" width="24" height="24" decoding="async"><span>CentOS</span></span>
        <span class="marquee-item"><img class="os-logo" src="/assets/os-logos/rockylinux.svg" alt="" width="24" height="24" decoding="async"><span>Rocky Linux</span></span>
        <span class="marquee-item"><img class="os-logo" src="/assets/os-logos/ubuntu.svg" alt="" width="24" height="24" decoding="async"><span>Ubuntu</span></span>
        <span class="marquee-item"><img class="os-logo" src="/assets/os-logos/fedora.svg" alt="" width="24" height="24" decoding="async"><span>Fedora</span></span>
        <span class="marquee-item"><img class="os-logo" src="/assets/os-logos/freebsd.svg" alt="" width="24" height="24" decoding="async"><span>FreeBSD</span></span>
        <span class="marquee-item"><img class="os-logo" src="/assets/os-logos/alpinelinux.svg" alt="" width="24" height="24" decoding="async"><span>Alpine Linux</span></span>
        <span class="marquee-item"><img class="os-logo" src="/assets/os-logos/almalinux.svg" alt="" width="24" height="24" decoding="async"><span>AlmaLinux</span></span>
        <span class="marquee-item"><img class="os-logo" src="/assets/os-logos/windows.svg" alt="" width="24" height="24" decoding="async"><span>Windows</span></span>
      </div>
    </div>
  </div>

  <!-- ============ Trust strip ============ -->
  <div class="trust-bar" style="padding:22px 0;border-bottom:1px solid var(--border)">
    <div class="container" style="display:flex;align-items:center;gap:8px 32px;flex-wrap:wrap;font-size:13.5px;color:var(--text-muted)">
      <span style="color:var(--text);font-weight:600">Trusted by</span>
      <span><b style="color:var(--text)">10,877+</b> customers</span><span style="color:var(--border-strong)">/</span>
      <span><b style="color:var(--text)">25,000+</b> servers deployed</span><span style="color:var(--border-strong)">/</span>
      <span><b style="color:var(--text)">99.9%</b> uptime SLA</span><span style="color:var(--border-strong)">/</span>
      <span>Support <b style="color:var(--text)">&lt; 2hr</b> response</span><span style="color:var(--border-strong)">/</span>
      <span><b style="color:var(--text)">7-day</b> money-back guarantee</span>
    </div>
  </div>

  <!-- ============ Section 01 — Infrastructure ============ -->
  <section class="section infrastructure-section" id="why">
    <div class="container">
      <div class="compact-section-head">
        <div><h2>Infrastructure that doesn't flinch</h2><p>Speed, protection, and visibility without the extra surface area.</p></div>
        <a class="text-link" href="/status.html">View server status ${ARROW_SVG}</a>
      </div>
      <div class="infrastructure-board">
        <div class="infrastructure-intro"><span class="infra-signal" aria-hidden="true"></span><span>Core infrastructure</span><span class="infra-count">${TOTAL || "—"} monitored nodes</span></div>
        <ul class="infra-list">
          <li><strong>NVMe SSD storage</strong><span>Fast disk I/O for applications, databases, and terminals.</span><b>Performance</b></li>
          <li><strong>DDoS protection</strong><span>Isolated VM instances and protection for production workloads.</span><b>Protection</b></li>
          <li><strong>Global network</strong><span>Strategic locations with 1Gbps network speeds.</span><b>Reach</b></li>
          <li><strong>24/7 monitoring</strong><span>Automated monitoring with a public status page.</span><b>Visibility</b></li>
        </ul>
      </div>
    </div>
  </section>

  <!-- ============ Section 02 — Use cases ============ -->
  <section class="section section-tight outcomes-section" id="usecases">
    <div class="container">
      <div class="compact-section-head">
        <div><h2>Stop struggling with server problems</h2><p>Move the workload off your laptop and into infrastructure built to stay available.</p></div>
      </div>
      <div class="outcome-list">
        <details class="outcome-row" open><summary><span class="outcome-name">Remote work</span><span class="outcome-result">Access your full desktop from anywhere</span><span class="outcome-arrow">${CHEVRON_SVG}</span></summary><div class="outcome-detail"><span>Before</span><p>Tied to one office computer.</p><span>With StealthRDP</span><p>Your files and applications stay available from any device.</p></div></details>
        <details class="outcome-row"><summary><span class="outcome-name">Web hosting</span><span class="outcome-result">Stay online through traffic spikes</span><span class="outcome-arrow">${CHEVRON_SVG}</span></summary><div class="outcome-detail"><span>Before</span><p>Traffic spikes turn into downtime and unanswered tickets.</p><span>With StealthRDP</span><p>Your site runs on dedicated VPS resources with support when needed.</p></div></details>
        <details class="outcome-row"><summary><span class="outcome-name">Automation</span><span class="outcome-result">Keep terminals, bots, and scripts running</span><span class="outcome-arrow">${CHEVRON_SVG}</span></summary><div class="outcome-detail"><span>Before</span><p>Scripts stop when your laptop sleeps or loses power.</p><span>With StealthRDP</span><p>Run your workloads continuously on a remote server.</p></div></details>
        <details class="outcome-row"><summary><span class="outcome-name">Data</span><span class="outcome-result">Keep important files available and protected</span><span class="outcome-arrow">${CHEVRON_SVG}</span></summary><div class="outcome-detail"><span>Before</span><p>Hardware failure leaves your data exposed to loss.</p><span>With StealthRDP</span><p>Keep storage on protected infrastructure with a clear recovery path.</p></div></details>
      </div>
    </div>
  </section>

  <!-- ============ Section 03 — Plans ============ -->
  <section class="section plans-preview" id="plans">
    <div class="container">
      <div class="section-head">
        <span class="sec-index fade-up">03 / Pick your power</span>
        <h2 class="fade-up d1">Select your performance level</h2>
        <p class="fade-up d2">All plans include free migration assistance, 24/7 support, and our industry-leading uptime guarantee.</p>
      </div>
      <div style="text-align:center" class="fade-up d2">
        <div class="billing-toggle" id="billingToggle" role="tablist" aria-label="Billing cycle">
          <button role="tab" data-cycle="monthly" class="active">Monthly</button>
          <button role="tab" data-cycle="quarterly">Quarterly <span class="off">−10%</span></button>
          <button role="tab" data-cycle="annual">Annual <span class="off">−20%</span></button>
          <button role="tab" data-cycle="biannual">Biannual <span class="off">−30%</span></button>
        </div>
      </div>
      <div class="plan-grid" id="planGrid" aria-live="polite">${preview}</div>
      <div class="all-link"><a class="btn btn-ghost" href="/plans.html">View All ${USA.length + EU.length} Plans</a></div>
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
        <span class="eyebrow fade-up">Join 10,877+ server owners</span>
        <h2 class="fade-up d1">Ready to stop wasting time on server management?</h2>
        <p class="fade-up d2">Deploy your high-performance VPS in the next 60 seconds and focus on what matters — your actual work.</p>
        <p class="micro fade-up d3">Starting at just <b>$9.50/month</b> · 7-day money-back guarantee · Cancel anytime</p>
      </div>
      <div class="cta-actions fade-up d3">
        <a class="btn btn-primary" href="https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps" target="_blank" rel="noopener noreferrer">Deploy Your Server Now</a>
        <a class="btn btn-ghost" href="https://dash.stealthrdp.com/submitticket.php" target="_blank" rel="noopener noreferrer">Ask a Pre-Sales Question</a>
      </div>
    </div>
  </section>`;
  const jsonLd = [{ "@context": "https://schema.org", "@graph": [ORG, websiteLd()] }];
  return page({
    active: "home",
    title: "StealthRDP — Secure Remote Desktop & VPS Infrastructure",
    description: "Deploy a Windows or Linux VPS in 60 seconds. Enterprise-grade hardware, DDoS protection, 99.9% uptime SLA and 24/7 support — from $9.50/month.",
    canonical: "__SRDP_BASE__/",
    jsonLd,
    body,
  });
}

/* ---------- 2. plans ---------- */
function buildPlans() {
  const cards = USA.map((p) => planCardHtml(p)).join("");
  const compare = USA.concat(EU).map(compareRowHtml).join("");
  const body = `
  <section class="page-hero page-hero-plans">
    <div class="container page-hero-grid"><div>
      <div class="page-hero-kicker"><span class="eyebrow">Compare / Deploy</span><span class="page-hero-meta">USA + EU locations · monthly to biannual</span></div>
      <h1>A clear path to the right server</h1><p>Compare the resource levels side by side, choose the region closest to your users, and continue to secure checkout when the fit is clear.</p>
    </div><div class="page-hero-aside" aria-label="Plan selection summary"><span class="mono">PLAN INDEX</span><strong>${USA.length} USA tiers</strong><strong>${EU.length} EU tiers</strong><a href="#plan-grid">Jump to plans <span aria-hidden="true">↓</span></a></div></div>
  </section>
  <section class="section plans-page-section" style="padding-top:0">
    <div class="container">
      <div class="plans-context"><div><span class="sec-index">01 / Choose your lane</span><h2>Start with the workload, then tune the commitment.</h2><p>Monthly is the simplest way to start. Longer cycles apply the published discount at checkout.</p></div><a class="text-link" href="#build-your-own">Need a custom shape? <span aria-hidden="true">→</span></a></div>
      <div class="plans-controls">
        <div class="billing-control"><span class="control-label">Billing cycle</span><div class="billing-toggle" id="billingToggle" role="tablist" aria-label="Billing cycle">
          <button role="tab" aria-selected="true" data-cycle="monthly" class="active">Monthly</button>
          <button role="tab" aria-selected="false" data-cycle="quarterly">Quarterly <span class="off">−10%</span></button>
          <button role="tab" aria-selected="false" data-cycle="annual">Annual <span class="off">−20%</span></button>
          <button role="tab" aria-selected="false" data-cycle="biannual">Biannual <span class="off">−30%</span></button>
        </div></div>
        <div class="location-control"><span class="control-label">Deployment region</span><div id="locationTabs" class="location-tabs" role="tablist" aria-label="Deployment region">
          <button role="tab" aria-selected="true" data-location="USA" class="active">USA</button>
          <button role="tab" aria-selected="false" data-location="EU">EU</button>
        </div></div>
        <a class="btn btn-sm btn-ghost plans-byo-link" href="https://dash.stealthrdp.com/index.php?rp=/store/build-your-own-rdp-vps" target="_blank" rel="noopener noreferrer">Build Your Own VPS</a>
      </div>
      <div class="plans-grid-head"><div><span class="mono">STANDARD PLANS</span><h2 id="plan-grid">Choose your resource level</h2></div><span id="planGridNote">6 USA plans · prices shown monthly</span></div>
      <div class="plan-grid plans-page-grid" id="planGrid" aria-live="polite">${cards}</div>
      ${includedFeaturesHtml()}
      <div id="build-your-own" class="byo-panel">
        <div><span class="included-label">For workloads between the lines</span><h2>Build a server around your exact brief.</h2><p>Choose your own CPU, RAM, storage, location, and billing cycle in the WHMCS configurator.</p></div>
        <a class="btn btn-primary" href="https://dash.stealthrdp.com/index.php?rp=/store/build-your-own-rdp-vps" target="_blank" rel="noopener noreferrer">Configure &amp; Deploy</a>
      </div>
      <div class="comparison-section">
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
        { name: "VPS Plans & Pricing", url: "__SRDP_BASE__/plans.html" },
      ]),
      { "@type": "ItemList", name: "StealthRDP VPS Plans", itemListElement: USA.concat(EU).map((p, i) => ({ "@type": "ListItem", position: i + 1, item: serviceLd(p) })) },
    ]},
  ];
  return page({
    active: "plans",
    title: "VPS Plans & Pricing — StealthRDP",
    description: "Compare StealthRDP VPS plans: USA and EU locations, NVMe storage, DDoS protection, 99.9% uptime. From $9.50/month with 7-day money-back guarantee.",
    canonical: "__SRDP_BASE__/plans.html",
    jsonLd,
    body,
    planLocation: "USA",
    planLimit: USA.length,
  });
}

/* ---------- 4. status ---------- */
function buildStatus() {
  const summary = `<div class="ss-card"><div class="ss-num ${ALL_UP ? "good" : "warn"}">${UP}/${TOTAL}</div><div class="ss-lbl">Nodes online</div></div>
    <div class="ss-card"><div class="ss-num ${ALL_UP ? "good" : "warn"}">${TOTAL ? Math.round((UP / TOTAL) * 100) : 0}%</div><div class="ss-lbl">Current availability</div></div>
    <div class="ss-card"><div class="ss-num ${ALL_UP ? "good" : "warn"}">24/7</div><div class="ss-lbl">Automated monitoring</div></div>`;
  const nodes = MONITORS.map(nodeCardHtml).join("");
  const body = `
  <section class="page-hero page-hero-status">
    <div class="container page-hero-grid"><div>
      <div class="page-hero-kicker"><span class="eyebrow">Live monitoring</span><span class="page-hero-meta">Logical nodes only · no host details exposed</span></div>
      <h1>Know what is happening before you connect.</h1><p>One calm view of the current service state, region by region. The page shows logical components and uptime history — never raw targets or management details.</p>
    </div><div class="page-hero-aside status-hero-aside" aria-label="Baked status snapshot"><span class="mono">STATUS SNAPSHOT</span><strong>${UP}/${TOTAL} nodes online</strong><span class="status-hero-state ${ALL_UP ? "healthy" : "attention"}"><span aria-hidden="true"></span>${ALL_UP ? "All systems operational" : "Attention required"}</span></div></div>
  </section>
  <section class="section status-page-section" style="padding-top:0">
    <div class="container">
      <div class="status-shell">
        <div class="status-shell-head"><div><span class="mono">OPERATIONS / CURRENT</span><h2>Current service state</h2></div><p>Live refresh is attempted on load. If the monitoring endpoint is unavailable, the verified snapshot stays visible and is labelled below.</p></div>
        <div class="status-summary" id="statusSummary" aria-live="polite">${summary}</div>
        <div class="status-meta"><p class="status-source-note" id="statusSourceNote">Baked uptime snapshot · live refresh is attempted when this page loads.</p><div class="status-legend"><span><i class="status-key healthy" aria-hidden="true"></i>Healthy</span><span><i class="status-key unknown" aria-hidden="true"></i>Unknown / attention</span></div></div>
      </div>
      <div class="status-section-head"><div><span class="mono">COMPONENTS</span><h2>Production nodes</h2></div><span class="status-count">${TOTAL} logical components</span></div>
      <div class="node-list" id="nodeList" aria-live="polite">${nodes}</div>
      <div class="status-info-grid">
        <div class="status-info-card"><span class="info-index">01</span><h3>Service level</h3><p>StealthRDP is committed to maintaining a 99.9% uptime for VPS services. Monitoring alerts the team when a component changes state.</p></div>
        <div class="status-info-card"><span class="info-index">02</span><h3>Uptime history</h3><p>The node rows show the last 90-day uptime ratio available in the monitoring snapshot. Checkout and account data remain in WHMCS.</p></div>
        <div class="status-info-card"><span class="info-index">03</span><h3>Incident response</h3><p>When a service disruption is detected, the technical team investigates and communicates through the support channel.</p></div>
      </div>
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
    description: "Real-time status of all StealthRDP server nodes. Live uptime monitoring of USA and EU infrastructure.",
    canonical: "__SRDP_BASE__/status.html",
    jsonLd,
    body,
  });
}

/* ---------- 5. blog index ---------- */
function buildBlog() {
  const cards = BLOG.map((post, index) => blogCardHtml(post, index === 0 ? " blog-card-featured" : "")).join("");
  const categories = [...new Set(BLOG.map((post) => post.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const categoryOptions = categories.map((category) => `<option value="${esc(category)}">${esc(category)}</option>`).join("");
  const body = `
  <section class="page-hero blog-page-hero">
    <div class="container page-hero-grid"><div>
      <div class="page-hero-kicker"><span class="eyebrow">Read / Operate</span><span class="page-hero-meta">${BLOG.length} field notes · updated from the content pipeline</span></div>
      <h1>Practical notes for servers in motion.</h1><p>Short, useful guidance for running remote desktops, VPS workloads, and the systems around them. Start with a topic, then take the next safe step.</p>
    </div><div class="page-hero-aside blog-hero-aside"><span class="mono">LATEST NOTE</span><strong>${esc(BLOG[0].title)}</strong><a href="/blog/${esc(BLOG[0].slug)}.html">Read the latest <span aria-hidden="true">→</span></a></div></div>
  </section>
  <section class="section blog-index-section" style="padding-top:0">
    <div class="container">
      <div class="blog-toolbar"><div><span class="sec-index">Browse the library</span><h2>Find the note that matches the work.</h2></div><div class="blog-filters"><label for="blogSearch">Search articles</label><input id="blogSearch" type="search" placeholder="Try: backups, RDP, uptime…" autocomplete="off" /><label for="blogCategory">Topic</label><select id="blogCategory"><option value="all">All topics</option>${categoryOptions}</select></div></div>
      <div class="blog-results-bar"><span id="blogResultsCount">${BLOG.length} articles</span><span>Technical guides · tutorials · infrastructure notes</span></div>
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
function buildBlogPost(post) {
  const body = `
  <main class="blog-article-page"><div class="container"><article class="blog-article" id="blogPost">
    <nav class="docs-breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/blog.html">Blog</a><span aria-hidden="true">/</span><span>${esc(post.category)}</span></nav>
    <header class="blog-article-header"><span class="bc-cat">${esc(post.category)}</span><h1>${esc(post.title)}</h1><div class="bc-meta"><span>${esc(post.author)}</span><span>${esc(post.date)}</span></div></header>
    <div class="blog-article-body"><p class="blog-lede">${esc(post.excerpt || "")}</p><div class="note">Full article content is managed by our content pipeline and will appear here automatically. Need help now? <a href="https://dash.stealthrdp.com/submitticket.php" target="_blank" rel="noopener noreferrer">Contact support</a>.</div></div>
    <footer class="blog-article-footer"><a href="/blog.html">← Back to all articles</a><a class="btn btn-primary btn-sm" href="https://dash.stealthrdp.com/submitticket.php" target="_blank" rel="noopener noreferrer">Ask support</a></footer>
  </article></div></main>`;
  const jsonLd = [{ "@context": "https://schema.org", "@graph": [
    breadcrumbLd(post.title, [
      { name: "Home", url: "__SRDP_BASE__/" },
      { name: "Blog", url: "__SRDP_BASE__/blog.html" },
      { name: post.title, url: `__SRDP_BASE__/blog/${post.slug}.html` },
    ]),
    articleLd(post),
  ]}];
  const fullTitle = `${post.title} — StealthRDP Blog`;
  const shortTitle = `${post.title} — StealthRDP`;
  const useTitle = fullTitle.length <= 65 ? fullTitle : shortTitle;
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
  const body = `
  <section class="page-hero faq-page-hero">
    <div class="container page-hero-grid"><div>
      <div class="page-hero-kicker"><span class="eyebrow">Support / Answers</span><span class="page-hero-meta">${FAQS.length} verified questions · quick to scan</span></div>
      <h1>Good answers before you deploy.</h1><p>Start with a question or browse by topic. For account-specific help, move directly to the support portal without losing your place.</p>
    </div><div class="page-hero-aside faq-hero-aside"><span class="mono">NEED A HUMAN?</span><strong>Support is available 24/7</strong><a href="${DOC_SUPPORT_URL}" target="_blank" rel="noopener noreferrer">Open support <span aria-hidden="true">↗</span></a></div></div>
  </section>
  <section class="section faq-page-section" style="padding-top:0">
    <div class="container faq-layout">
      <aside class="faq-aside"><span class="sec-index">Browse by topic</span><h2>Make the next decision with confidence.</h2><p>These answers cover plans, setup, billing, access, security, and support. Search works across questions and answers.</p><div class="faq-topic-list">${categories.map((category) => `<button type="button" data-faq-topic="${esc(category)}">${esc(category)}<span>${FAQS.filter((item) => item.category === category).length}</span></button>`).join("")}<button type="button" data-faq-topic="all" class="active">All questions<span>${FAQS.length}</span></button></div></aside>
      <div class="faq-results"><div class="faq-controls"><label for="faqSearch">Search questions</label><input id="faqSearch" type="search" placeholder="Try: refund, Windows, upgrade…" autocomplete="off" /><label for="faqCategory">Topic</label><select id="faqCategory"><option value="all">All topics</option>${categoryOptions}</select></div><div class="faq-results-bar"><span id="faqResultsCount">${FAQS.length} questions</span><span>Source-backed answers · updated with the site snapshot</span></div><div class="faq-list" id="faqList" aria-live="polite">${items}</div><p class="faq-empty" id="faqEmpty" hidden>No questions match that search. Try another phrase or choose all topics.</p><div class="faq-support"><div><span class="sec-index">Still need a hand?</span><h2>Take the question to support.</h2><p>Account, billing, and server-specific requests are handled in the client portal.</p></div><a class="btn btn-primary" href="${DOC_SUPPORT_URL}" target="_blank" rel="noopener noreferrer">Contact support</a></div></div>
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
      <p>10,877+ customers and 25,000+ deployed servers rely on StealthRDP for remote work, web hosting, trading infrastructure, and always-on automation. Every new server is backed by our 99.9% uptime SLA and a 7-day money-back guarantee.</p>
      <div class="note">Questions about our infrastructure? <a href="https://dash.stealthrdp.com/submitticket.php" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">Talk to our team</a> — we respond within 2 hours, 24/7.</div>
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
    description: "StealthRDP provides high-performance remote desktop and VPS infrastructure trusted by 10,877+ customers worldwide.",
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
Allow: /
Disallow: /api/
Disallow: /blog-post.html

Sitemap: __SRDP_BASE__/sitemap.xml
`;
}

function buildSitemap() {
  const staticRoutes = [
    ["/", "2026-08-06"],
    ["/plans.html", "2026-08-06"],
    ["/status.html", "2026-08-06"],
    ["/blog.html", "2026-08-06"],
    ["/faq.html", "2026-08-06"],
    ["/about.html", "2026-08-06"],
    ["/privacy.html", "2026-08-06"],
    ["/docs.html", "2026-08-13"],
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
  "index.html": buildIndex(),
  "plans.html": buildPlans(),
  "status.html": buildStatus(),
  "blog.html": buildBlog(),
  "faq.html": buildFaq(),
  "about.html": buildAbout(),
  "privacy.html": buildPrivacy(),
  "docs.html": buildDocsIndex(),
  "robots.txt": buildRobots(),
  "sitemap.xml": buildSitemap(),
};

fs.rmSync(path.join(ROOT, "features.html"), { force: true });

fs.mkdirSync(path.join(ROOT, "blog"), { recursive: true });
for (const post of BLOG) {
  OUT[`blog/${post.slug}.html`] = buildBlogPost(post);
}
for (const [index, article] of DOCS.entries()) {
  OUT[`docs/${article.slug}.html`] = buildDocArticle(article, index);
}

for (const [file, content] of Object.entries(OUT)) {
  fs.writeFileSync(path.join(ROOT, file), content);
  console.log("wrote", file, (content.length / 1024).toFixed(1) + "KB");
}
console.log("build complete:", Object.keys(OUT).length, "files");
