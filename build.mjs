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
import { OS_LIST, osMarkSvg, OS_VIEWBOX } from "./js/os-icons.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DATA = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8"));

const USA = DATA("plans_usa.json");
const EU = DATA("plans_eu.json");
const FEATURES = DATA("features.json");
const FAQS = DATA("faqs.json");
const TESTIMONIALS = DATA("testimonials.json");
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

// Visible monthly price follows the current WHMCS monthly checkout snapshot.
const MONTHLY_MULT = 0.95;

const PLAN_SLUGS = {
  "Bronze USA": "bronze-usa2", "Silver USA": "silver-usa", "Gold USA": "gold-usa",
  "Platinum USA": "platinum-usa", "Diamond USA": "diamond-usa", "Emerald USA": "emerald-usa",
  "Bronze EU": "bronze-eu", "Silver EU": "silver-eu", "GOLD EU": "gold-eu",
  "Platinum EU": "platinum-eu", "Diamond EU": "diamond-eu", "Emerald EU": "emerald-eu",
};
const CHECKOUT_MONTHLY_PRICES = {
  "Bronze USA": 9.50, "Silver USA": 18.04, "Gold USA": 26.59,
  "Platinum USA": 33.24, "Diamond USA": 42.75, "Emerald USA": 51.30,
};
const USA_CHECKOUT_AVAILABILITY = {
  "bronze-usa2": true, "silver-usa": false, "gold-usa": false,
  "platinum-usa": false, "diamond-usa": false, "emerald-usa": false,
};
const monthlyPrice = (p) => Object.prototype.hasOwnProperty.call(CHECKOUT_MONTHLY_PRICES, p.name)
  ? CHECKOUT_MONTHLY_PRICES[p.name]
  : round2((p.monthlyPrice || 0) * MONTHLY_MULT);
const planAvailable = (p) => p.location !== "USA" || USA_CHECKOUT_AVAILABILITY[PLAN_SLUGS[p.name]] === true;
const planUrl = (p) => {
  const slug = PLAN_SLUGS[p.name];
  if (slug) {
    const category = p.location === "EU" ? "eu" : "standard-usa-rdp-vps";
    return "https://dash.stealthrdp.com/index.php?rp=/store/" + category + "/" + slug + "&billingcycle=monthly";
  }
  if (p.purchaseUrl) return p.purchaseUrl;
  return "https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps";
};
const planName = (p) => p.name.replace(" USA", "").replace(" EU", "");
// Keep visible currency tied to plan location. Checkout remains authoritative.
const currencyCode = (p) => p.location === "EU" ? "EUR" : "USD";
const currencySymbol = (p) => p.location === "EU" ? "€" : "$";
const planDescription = (p) => {
  const specs = p.specs || {};
  const location = p.location ? `${p.location} ` : "";
  return `Private ${location}VPS with ${specs.cpu || "dedicated CPU"}, ${specs.ram || "scalable RAM"}, and ${specs.storage || "NVMe storage"}.`;
};

const SOCIAL = [
  { href: "https://x.com/stealthrdp", label: "X / Twitter" },
  { href: "https://www.instagram.com/stealth_rdp", label: "Instagram" },
  { href: "https://discord.gg/9JJFs4DDyF", label: "Discord" },
  { href: "https://t.me/StealthRDP", label: "Telegram" },
];

const HOME_FAQS = [
  { question: "What exactly am I renting?", answer: "A private Windows or Linux VPS in a USA location — dedicated CPU, NVMe storage, unlimited bandwidth, and full admin rights on your own machine." },
  { question: "Do I really get full admin rights?", answer: "Yes. Windows machines give you administrator access and Linux machines give you root. You install and configure what the work needs." },
  { question: "Which operating systems are available?", answer: "Windows Server plus the main Linux families — Ubuntu, Debian, CentOS, Rocky Linux, AlmaLinux, Fedora, FreeBSD, and Alpine Linux. The machine is yours to configure after setup." },
  { question: "How does checkout and delivery work?", answer: "You continue to WHMCS for secure checkout. Pricing and availability are confirmed there. Credentials and account access come from the client area after the order." },
  { question: "Can I upgrade later?", answer: "Plans are listed on this page, and the client area is the place to manage services and billing. Pricing and availability are confirmed at checkout." },
  { question: "Where are the servers located?", answer: "This page shows the USA range. Additional locations can be added as the range expands." },
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
  <meta name="theme-color" content="#08090c" />
  <link rel="canonical" href="${canonical}" />
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:type" content="${og}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:image" content="__SRDP_BASE__/assets/og-cover.png" />
  <meta property="og:site_name" content="StealthRDP" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@stealthrdp" />
  <meta name="twitter:url" content="${canonical}" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="__SRDP_BASE__/assets/og-cover.png" />
  <link rel="stylesheet" href="/css/style.css" />
  <script>(function(){try{document.documentElement.classList.add('js');var t=localStorage.getItem('srdp-theme');if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.classList.add('js');document.documentElement.setAttribute('data-theme','dark')}})();</script>
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

/* ---------- shared chrome (header + footer + ticker) ---------- */
const LOGO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>';

function tickerHtml() {
  return `<div class="ticker"><div class="ticker-inner">
    <span class="left"><span class="dot dim" id="tickerDot"></span><span id="tickerStatus">Checking live status…</span></span>
    <span class="right"><span class="promotion-note">Pricing and availability shown at checkout</span></span>
  </div></div>`;
}

function navHtml(active) {
  const items = [
    ["home", "/", "Home"], ["plans", "/plans.html", "Plans"], ["features", "/features.html", "Features"],
    ["status", "/status.html", "Server Status"], ["docs", "/docs.html", "Docs"], ["blog", "/blog.html", "Blog"], ["faq", "/faq.html", "FAQ"],
  ];
  return items.map(([k, href, label]) => `<a href="${href}"${k === active ? ' class="active"' : ""}>${label}</a>`).join("");
}

function headerHtml(active) {
  const ticker = active === "home" ? "" : `${tickerHtml()}\n  `;
  return `${ticker}<header class="header"><div class="container header-inner">
    <a href="/" class="logo" aria-label="StealthRDP home">
      <span class="logo-mark">${LOGO_SVG}</span><span>Stealth<em>RDP</em></span>
    </a>
    <nav class="nav" aria-label="Main navigation">${navHtml(active)}</nav>
    <div class="header-actions">
      <button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle dark and light theme" aria-pressed="false"><svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/></svg><svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 14.2A8.3 8.3 0 0 1 9.8 3.6 8.3 8.3 0 1 0 20.4 14.2Z"/></svg></button>
      <a class="btn btn-sm btn-primary" href="https://dash.stealthrdp.com/index.php?rp=/login" target="_blank" rel="noopener noreferrer">Client Area</a>
      <button class="nav-toggle" id="navToggle" type="button" aria-label="Toggle menu" aria-controls="mobileNav" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
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
    <div class="footer-status"><span class="dot dim"></span><span id="footerStatus">Checking live status…</span></div>
    <div class="footer-grid">
      <div class="footer-about">
        <a href="/" class="logo" aria-label="StealthRDP home"><span class="logo-mark">${LOGO_SVG}</span><span>Stealth<em>RDP</em></span></a>
        <p>Windows and Linux VPS infrastructure for remote access, automation, and development.</p>
        <div class="footer-social">${social}</div>
      </div>
      <div class="footer-col"><h3>Products</h3><ul>
        <li><a href="/plans.html">RDP Plans</a></li>
        <li><a href="/features.html">Features</a></li>
        <li><a href="/plans.html#build-your-own">Build Your Own VPS</a></li>
        <li><a href="/plans.html">Pricing</a></li>
      </ul></div>
      <div class="footer-col"><h3>Resources</h3><ul>
        <li><a href="/docs.html">Documentation</a></li>
        <li><a href="/blog.html">Tutorials</a></li>
        <li><a href="/faq.html">FAQ</a></li>
        <li><a href="/blog.html">Blog</a></li>
        <li><a href="/status.html">Server Status</a></li>
      </ul></div>
      <div class="footer-col"><h3>Company</h3><ul>
        <li><a href="/about.html">About Us</a></li>
        <li><a href="https://dash.stealthrdp.com/index.php?rp=/login" target="_blank" rel="noopener noreferrer">Open Client Area</a></li>
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
  const available = planAvailable(p);
  const isPop = showPopular && p.popular && available;
  return `<article class="plan-card${isPop ? " popular" : ""}">
    ${isPop ? '<span class="plan-popular">Most Popular</span>\n    ' : ""}<div class="p-name">${esc(planName(p))}</div>
    <div class="p-desc">${esc(planDescription(p))}</div>
    <div class="plan-price"><span class="cur">${currencySymbol(p)}${fmt(price)}<small>/mo</small></span><span class="was">${currencySymbol(p)}${fmt(p.monthlyPrice || 0)}</span></div>
    <div class="plan-specs">
      ${specRow("CPU", p.specs && p.specs.cpu)}
      ${specRow("RAM", p.specs && p.specs.ram)}
      ${specRow("Storage", p.specs && p.specs.storage)}
      ${specRow("Bandwidth", p.specs && p.specs.bandwidth)}
    </div>
    ${available ? `<a class="btn ${isPop ? "btn-primary" : "btn-ghost"}" href="${planUrl(p)}" target="_blank" rel="noopener noreferrer">Deploy Now</a>` : '<span class="plan-unavailable" role="status">Unavailable at checkout</span>'}
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
    <td class="v">${currencySymbol(p)}${fmt(monthlyPrice(p))}</td>
    <td>${planAvailable(p) ? `<a class="btn btn-sm ${p.popular ? "btn-primary" : "btn-ghost"}" href="${planUrl(p)}" target="_blank" rel="noopener noreferrer">Deploy</a>` : '<span class="plan-unavailable" role="status">Unavailable</span>'}</td>
  </tr>`;
}

function faqItemHtml(f, i) {
  return `<div class="faq-item${i === 0 ? " open" : ""}">
    <button class="faq-q" aria-expanded="${i === 0 ? "true" : "false"}"><span>${esc(f.question)}</span><span class="icon">+</span></button>
    <div class="faq-a"><div class="faq-a-inner">${esc(f.answer)}</div></div>
  </div>`;
}

function featureCardHtml(f) {
  return `<article class="bento-card bento-2">
    <span class="bic">${LOGO_SVG}</span>
    <h3>${esc(f.title)}</h3>
    <p>${esc((f.description || "").split("\n")[0])}</p>
  </article>`;
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
    return '<div class="quote-empty">Verified customer stories will appear here after approval.</div>';
  }
  const t = TESTIMONIALS[0];
  const name = t.authorName || t.name || t.customerName || "StealthRDP Customer";
  const role = [t.authorPosition, t.authorCompany].filter(Boolean).join(", ");
  return `<div class="q-mark">“</div><p class="q-text">${esc(t.quote || t.testimonial || t.content || "")}</p><p class="q-who"><b>${esc(name)}</b>${role ? " · " + esc(role) : ""}</p>`;
}

function blogCardHtml(p) {
  return `<article class="blog-card"><div class="bc-body">
    <span class="bc-cat">${esc(p.category)}</span>
    <h3>${esc(p.title)}</h3>
    <p>${esc(p.excerpt || "")}</p>
    <div class="bc-meta"><span>${esc(p.author)}</span><span>${esc(p.date)}</span></div>
    <a class="bc-link" href="/blog/${esc(p.slug)}.html">Read article →</a>
  </div></article>`;
}

/* ---------- native documentation ---------- */
const DOC_SUPPORT_URL = "https://dash.stealthrdp.com/index.php?rp=/login";

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
  const body = `<main class="docs-index docs-surface">
    <section class="docs-index-hero"><div class="container">
      <nav class="docs-breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>Docs</span></nav>
      <span class="eyebrow">Read / Explore</span><h1>StealthRDP Documentation</h1>
      <p>Task-focused guides from the verified StealthRDP documentation snapshot. Search first, then follow the prerequisites and commands that fit your server.</p>
    </div></section>
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
    <article class="docs-article"><header class="docs-article-header"><span class="docs-category">${esc(article.category)}</span><h1>${esc(article.title)}</h1><p class="docs-summary">${esc(article.summary)}</p><div class="docs-source-meta">${sourceMeta}</div></header>${docsWarning(article)}<div class="docs-content">${rendered.html}</div><div class="docs-support"><div><span class="sec-index">Need a hand?</span><h2>Support is still on WHMCS</h2><p>For account or server-specific help, open the StealthRDP client area.</p></div><a class="btn btn-primary" href="${DOC_SUPPORT_URL}" target="_blank" rel="noopener noreferrer">Open client area</a></div>${relatedHtml}</article>
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
  description: "Windows and Linux VPS hosting for remote work, remote access, automation, and development with full administrative access.",
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
    description: planDescription(p),
    url: planUrl(p),
    provider: { "@type": "Organization", name: "StealthRDP", url: "__SRDP_BASE__/" },
    offers: { "@type": "Offer", price: monthlyPrice(p), priceCurrency: currencyCode(p), url: planUrl(p) },
  };
}

function faqLdFrom(list) {
  return {
    "@type": "FAQPage",
    mainEntity: list.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

function faqLd() {
  return faqLdFrom(FAQS);
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
function page({ active, title, description, canonical, pageType = "website", jsonLd = [], body, extraScripts = [], robots = "index,follow" }) {
  return `${head({ title, description, canonical, pageType, jsonLd, robots })}
<body data-page="${active}">
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
  const plans = USA; /* real USA plans from data/plans_usa.json */
  const initial = plans.find((p) => planAvailable(p)) || plans[0]; /* First orderable plan by default */
  const planRows = plans.map((p, i) => {
    const name = esc(planName(p));
    const desc = esc(planDescription(p));
    const cpu = esc(p.specs && p.specs.cpu || "");
    const ram = esc(p.specs && p.specs.ram || "");
    const storage = esc(p.specs && p.specs.storage || "");
    const price = currencySymbol(p) + monthlyPrice(p).toFixed(2);
    const url = esc(planUrl(p));
    const selected = p === initial ? "true" : "false";
    const available = planAvailable(p);
    const status = available ? esc(p.specs && p.specs.bandwidth || "Unlimited bandwidth") : "Unavailable at checkout";
    return `<button type="button" class="cq-plan-row" aria-pressed="${selected}" aria-disabled="${available ? "false" : "true"}"${available ? "" : " disabled"} data-available="${available ? "true" : "false"}" data-name="${name}" data-price="${price}" data-cpu="${cpu}" data-ram="${ram}" data-storage="${storage}" data-url="${url}" data-desc="${desc}" data-badge="${p.popular && available ? "Recommended" : available ? "Available" : "Unavailable at checkout"}"><span class="cq-plan-name">${name}<small>${status}</small></span><span class="cq-plan-spec">${cpu}</span><span class="cq-plan-spec">${ram}</span><span class="cq-plan-price">${price}<small>/mo</small></span><span class="cq-plan-arrow" aria-hidden="true">${available ? "→" : "—"}</span></button>`;
  }).join("");
  const initialUrl = esc(planUrl(initial));
  const initialName = esc(planName(initial));
  const initialPrice = currencySymbol(initial) + monthlyPrice(initial).toFixed(2);
  const initialCpu = esc(initial.specs && initial.specs.cpu || "");
  const initialRam = esc(initial.specs && initial.specs.ram || "");
  const initialStorage = esc(initial.specs && initial.specs.storage || "");
  const consoleChips = [
    [initialCpu.replace(" Core", ""), "Core"],
    [initialRam.replace(" GB", ""), "GB RAM"],
    [initialStorage.replace(" GB NVMe", "").replace(" GB", ""), "GB NVMe"],
    ["Unlimited", "BW"],
  ].map(([v, l]) => `<span class="cq-chip">${esc(v)} <b>${esc(l)}</b></span>`).join("");
  const consoleHtml = `<div class="cq-console-card" role="group" aria-labelledby="console-title">
    <div class="cq-console-bar"><span class="cq-cdot r" aria-hidden="true"></span><span class="cq-cdot y" aria-hidden="true"></span><span class="cq-cdot g" aria-hidden="true"></span><span class="cq-console-title" id="console-title">stealth-deploy — demonstration</span></div>
    <div class="cq-console-body">
      <div class="cq-cline cq-demo-note"><span class="cq-warn">DEMO</span> No live deployment. Nothing is provisioned.</div>
      <div class="cq-cline cq-cmdline"><span class="cq-cmd">$ stealth deploy --plan ${initialName.toLowerCase()} --region us-east</span><span class="cq-cursor" aria-hidden="true"></span></div>
      <div class="cq-cline"><span class="cq-dim">▸ plan selected for illustration</span></div>
      <div class="cq-cline"><span class="cq-dim">▸ region selected for illustration</span></div>
      <div class="cq-cline"><span class="cq-warn">▸ checkout confirms price and availability</span></div>
      <div class="cq-cline"><span class="cq-dim">▸ no infrastructure request is made</span></div>
      <div class="cq-progress"><div class="cq-bar"></div></div>
      <div class="cq-cline"><span class="cq-pct">illustration only</span></div>
    </div>
    <div class="cq-console-foot">${consoleChips}</div>
  </div>`;
  const reviewCardHtml = (t, clone = false) => {
    const verified = !String(t._id || "").startsWith("inv");
    const name = verified ? esc(t.authorName || t.name || t.customerName || "Verified customer") : "Illustrative workflow";
    const role = verified ? esc([t.authorPosition, t.authorCompany].filter(Boolean).join(" · ")) : "Example only · not a customer testimonial";
    const quote = esc(t.quote || t.testimonial || t.content || "");
    const title = esc(t.title || "");
    const initials = verified ? name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "EX";
    const marker = verified ? '<div class="cq-review-stars" aria-label="Verified customer review"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div>' : '<div class="cq-review-label">Illustrative example</div>';
    const hidden = clone ? ' aria-hidden="true" tabindex="-1"' : "";
    return `<article class="cq-review-card${verified ? "" : " cq-review-illustrative"}"${hidden}>${marker}${title ? `<h3 class="cq-review-title">${title}</h3>` : ""}<p class="cq-review-quote">“${quote}”</p><div class="cq-review-who"><span class="cq-review-avatar" aria-hidden="true">${esc(initials)}</span><span class="cq-review-name"><b>${name}</b><small>${role}</small></span></div></article>`;
  };
  /* Three scrolling columns, each a duplicated list for a seamless loop. */
  const perCol = Math.ceil(TESTIMONIALS.length / 3);
  const reviewCols = [0, 1, 2].map((col) => {
    const slice = TESTIMONIALS.slice(col * perCol, col * perCol + perCol);
    const inner = slice.map((t) => reviewCardHtml(t)).join("");
    const clone = slice.map((t) => reviewCardHtml(t, true)).join("");
    return `<div class="cq-review-col" data-col="${col}">${inner}${clone}</div>`;
  }).join("");
  const machineSvg = `<svg class="cq-machine" viewBox="0 0 540 400" role="img" aria-label="A clean private server with gold and green status lights">      <defs><linearGradient id="cq-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--machine-body-a)"/><stop offset="1" stop-color="var(--machine-body-b)"/></linearGradient></defs>
      <ellipse cx="270" cy="368" rx="200" ry="18" fill="#000" opacity=".4"/>
      <rect x="90" y="60" width="360" height="280" rx="22" fill="url(#cq-body)" stroke="var(--machine-stroke)" stroke-width="2"/>
      <rect x="90" y="60" width="360" height="66" rx="22" fill="var(--machine-band)"/>
      <rect x="90" y="92" width="360" height="34" fill="var(--machine-band)"/>
      <circle cx="122" cy="109" r="6" fill="var(--accent)"/><circle cx="142" cy="109" r="6" fill="var(--green)"/>
      <rect x="170" y="101" width="128" height="16" rx="8" fill="var(--accent)" opacity=".85"/>
      <rect x="122" y="148" width="296" height="10" rx="5" fill="var(--machine-vent)"/>
      <rect x="122" y="172" width="296" height="10" rx="5" fill="var(--machine-vent)"/>
      <rect x="122" y="196" width="296" height="10" rx="5" fill="var(--machine-vent)"/>
      <rect x="122" y="220" width="180" height="10" rx="5" fill="var(--machine-vent)"/>
      <rect x="318" y="220" width="100" height="10" rx="5" fill="var(--machine-fill2)"/>
      <circle cx="150" cy="258" r="7" fill="var(--green)"/><circle cx="178" cy="258" r="7" fill="var(--accent)"/><circle cx="206" cy="258" r="7" fill="var(--machine-dot3)"/>
      <path d="M122 296 h296" stroke="var(--machine-line)" stroke-width="2"/>
      <text x="122" y="326" font-family="monospace" font-size="12" fill="var(--machine-text)">WINDOWS · LINUX · NVMe · FULL ADMIN</text>
    </svg>`;
  const body = `
  <main class="cq-home">
    <div class="cq-wrap">
      <section class="cq-hero" aria-labelledby="home-title">
        <div class="cq-hero-grid">
          <div class="cq-hero-copy">
            <div class="cq-eyebrow">Private compute / USA</div>
            <h1 id="home-title">Make room for the work.</h1>
            <p class="cq-lede">A private Windows or Linux VPS for work that needs its own machine — remote access, automation, development, and everything between.</p>
            <div class="cq-hero-actions"><a class="btn btn-primary" href="#machines">Choose a machine <span aria-hidden="true">→</span></a><a class="btn btn-ghost" href="#why">See why it works <span aria-hidden="true">↓</span></a></div>
            <div class="cq-hero-caption"><span class="cq-signal" aria-hidden="true"></span>USA location · pricing confirmed at checkout</div>
          </div>
          <div class="cq-hero-art">
            <div class="cq-art-index"><strong>01</strong> / the machine</div>
            ${consoleHtml}
            <div class="cq-art-note"><span aria-hidden="true"></span><div><b>Order to machine, in plain view.</b>&nbsp;<span>An honest demonstration — nothing is provisioned.</span></div></div>
          </div>
        </div>
      </section>
      <section class="cq-proof cq-reveal" aria-label="Included with every machine">
        <span class="cq-proof-item">Windows + Linux</span><span class="cq-proof-item">NVMe storage</span><span class="cq-proof-item">Full admin rights</span><span class="cq-proof-item">Unlimited bandwidth</span>
      </section>
      <section class="cq-journey cq-reveal" aria-labelledby="journey-title">
        <div class="cq-journey-head"><div class="cq-eyebrow">One machine, end to end</div><h2 id="journey-title">From choose to connected, in three honest steps.</h2></div>
        <ol class="cq-journey-steps">
          <li class="cq-journey-step"><span class="cq-journey-num">01</span><div><h3>Choose</h3><p>Pick the machine that fits the work — a real USA plan with actual resources.</p></div><a class="cq-journey-link" href="#machines">Choose a machine <span aria-hidden="true">→</span></a></li>
          <li class="cq-journey-step"><span class="cq-journey-num">02</span><div><h3>Checkout</h3><p>Continue to WHMCS for secure checkout. Pricing and availability are confirmed there.</p></div><a class="cq-journey-link" href="https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps" target="_blank" rel="noopener noreferrer">See checkout <span aria-hidden="true">↗</span></a></li>
          <li class="cq-journey-step"><span class="cq-journey-num">03</span><div><h3>Connect</h3><p>Use your credentials with a Windows or Linux desktop client, with full admin rights.</p></div><a class="cq-journey-link" href="/docs.html">Read the guide <span aria-hidden="true">→</span></a></li>
        </ol>
      </section>
      <section class="cq-machines cq-reveal" id="machines" aria-labelledby="machines-title">
        <div class="cq-head">
          <h2 id="machines-title">Choose the headroom you need.</h2>
          <p class="cq-head-note">Start with a real configuration. Change it when your work changes. Every USA plan below is shown with its monthly price and actual resources.</p>
        </div>
        <div class="cq-machine-layout">
          <div>
            <div class="cq-machine-list" role="group" aria-label="USA VPS plans">${planRows}</div>
            <div class="cq-list-note"><span>Every plan includes 100% dedicated CPU resources.</span><span>Storage: NVMe · Bandwidth: Unlimited</span></div>
          </div>
          <aside class="cq-detail-card" aria-live="polite" aria-label="Selected plan summary">
            <div class="cq-detail-top"><span class="cq-mono">Selected machine</span><span class="cq-detail-badge" id="selectedBadge">${initial.popular ? "Recommended" : "Available"}</span></div>
            <h3 class="cq-detail-title" id="selectedName">${initialName}</h3>
            <p class="cq-detail-desc" id="selectedDesc">${esc(initial.description || "Private Windows or Linux VPS")}</p>
            <div class="cq-detail-price"><span id="selectedPrice">${initialPrice}</span><small>per month · USA</small></div>
            <div class="cq-detail-bars">
              <div class="cq-bar-row"><span>CPU</span><div class="cq-bar-track"><div class="cq-bar-fill" id="barCpu" style="width:50%"></div></div><strong id="selectedCpu">${initialCpu}</strong></div>
              <div class="cq-bar-row"><span>Memory</span><div class="cq-bar-track"><div class="cq-bar-fill" id="barRam" style="width:50%"></div></div><strong id="selectedRam">${initialRam}</strong></div>
              <div class="cq-bar-row"><span>Storage</span><div class="cq-bar-track"><div class="cq-bar-fill" id="barStorage" style="width:67%"></div></div><strong id="selectedStorage">${initialStorage}</strong></div>
            </div>
            <div class="cq-detail-cta"><a class="btn btn-primary" id="selectorCta" href="${initialUrl}" target="_blank" rel="noopener noreferrer"><span id="selectorCtaLabel">Continue with ${initialName}</span> <span aria-hidden="true">→</span></a></div>
            <p class="cq-detail-foot">Windows or Linux · full admin rights · checkout confirms pricing and availability.</p>
          </aside>
        </div>
        <p class="cq-handoff"><span class="cq-handoff-mark" aria-hidden="true">↳</span><span>Checkout, billing, and account access happen on WHMCS. Pricing and availability are confirmed there.</span></p>
      </section>
      <section class="cq-story cq-reveal" id="why" aria-labelledby="why-title">
        <div class="cq-story-head"><div class="cq-eyebrow">Why a private machine</div><h2 id="why-title">Your work gets a room of its own.</h2><p>Not another tab. Not another shared surface. A machine with its own resources, its own access, and a clear job.</p></div>
        <div class="cq-story-layout">
          <div class="cq-story-visual">${machineSvg}<div class="cq-art-note"><span aria-hidden="true"></span><div><b>One private machine.</b>&nbsp;<span>Yours to configure and run.</span></div></div></div>
          <div class="cq-story-list">
            <article class="cq-story-item"><span class="cq-story-num">01</span><div><h3>Remote work that stays together.</h3><p>Keep the desktop, tools, files, and routine in one place you can reach from anywhere.</p></div></article>
            <article class="cq-story-item"><span class="cq-story-num">02</span><div><h3>Automation with somewhere to run.</h3><p>Give services, scheduled jobs, and development environments a machine instead of your laptop.</p></div></article>
            <article class="cq-story-item"><span class="cq-story-num">03</span><div><h3>Control that does not disappear.</h3><p>Full administrative rights let you configure the operating system around the work you actually do.</p></div></article>
          </div>
        </div>
      </section>
      <section class="cq-details cq-reveal" aria-labelledby="details-title">
        <div class="cq-details-head"><div><div class="cq-eyebrow">The useful details</div><h2 id="details-title">Simple on purpose.</h2></div><p>The important parts are visible before checkout. The billing system confirms price and availability when you continue.</p></div>
        <div class="cq-detail-rows">
          <div class="cq-detail-row"><span class="cq-mono">Operating system</span><strong>Windows or Linux</strong><p>Choose the environment that matches your work. The machine is yours to configure.</p></div>
          <div class="cq-detail-row"><span class="cq-mono">Resources</span><strong>2–8 cores · 4–32 GB RAM</strong><p>Plans scale from a focused workspace to a high-headroom machine, with NVMe storage on every USA plan.</p></div>
          <div class="cq-detail-row"><span class="cq-mono">Access</span><strong>Full admin rights</strong><p>Install the tools you need, shape the environment, and keep the operating boundary clear.</p></div>
          <div class="cq-detail-row"><span class="cq-mono">Support</span><strong>Pre-sales and client area</strong><p>Ask a question before checkout, or manage your account and services in the client area.</p></div>
        </div>
      </section>
      <section class="cq-os cq-reveal" aria-labelledby="os-title">
        <div class="cq-os-head"><div><div class="cq-eyebrow">Works with your operating system</div><h2 id="os-title">Windows or Linux. Your choice.</h2></div><p>Every machine runs with full admin rights, so the operating system is the starting point — not the ceiling.</p></div>
        <div class="cq-os-grid">
          ${OS_LIST.map((os, i) => {
            const mark = osMarkSvg(os).replace(/(<svg[^>]*viewBox=")[^"]*(")/, `$1${OS_VIEWBOX[os]}$2`);
            return `<div class="cq-os-tile" data-reveal="${i % 3}">${mark}<span class="cq-os-name">${esc(os)}</span></div>`;
          }).join("")}
        </div>
      </section>
      <section class="cq-faq cq-reveal" aria-labelledby="faq-title">
        <div class="cq-faq-head"><div><div class="cq-eyebrow">Before you ask</div><h2 id="faq-title">Straight answers.</h2></div><p>No runaround. If a detail matters, it is stated here or confirmed at checkout.</p></div>
        <div class="cq-faq-list">
          ${HOME_FAQS.map((f, i) => `<details class="cq-faq-item"${i === 0 ? " open" : ""}><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`).join("")}
        </div>
      </section>
      <section class="cq-live cq-reveal" aria-labelledby="live-title">
        <div class="cq-live-grid">
          <div class="cq-live-copy"><div class="cq-eyebrow">Live service state</div><h2 id="live-title">Proof you can check.</h2><p>Every production node is watched by automated monitors. This card reads the same live feed as the public status page — and says so when the feed cannot be reached.</p><a class="cq-live-link" href="/status.html">Open the full status page <span aria-hidden="true">→</span></a></div>
          <div class="cq-live-card" aria-live="polite">
            <div class="cq-live-head"><span class="cq-mono">StealthRDP · production</span><span class="cq-live-dot" id="homeStatusDot"></span></div>
            <div id="homeStatusSummary" class="cq-live-summary"><div class="cq-live-slot"><strong>—</strong><span>Nodes online</span></div><div class="cq-live-slot"><strong>—</strong><span>Current availability</span></div><div class="cq-live-slot"><strong>—</strong><span>Monitoring feed</span></div></div>
            <p class="cq-live-note" id="homeStatusNote">Live status unavailable · showing nothing until the feed responds.</p>
          </div>
        </div>
      </section>
      <section class="cq-reviews cq-reveal" aria-labelledby="reviews-title">
        <div class="cq-reviews-head"><div class="cq-eyebrow">Customer proof, clearly marked</div><h2 id="reviews-title">What the work looks like.</h2><p>One verified customer review appears with attribution. Other cards are illustrative workflow examples until consented stories are approved.</p></div>
        <div class="cq-review-viewport">
          <div class="cq-review-grid">${reviewCols}</div>
        </div>
        <div class="cq-review-invite">Run on StealthRDP? <a href="${DOC_SUPPORT_URL}" target="_blank" rel="noopener noreferrer">Share your experience <span aria-hidden="true">→</span></a></div>
      </section>
      <section class="cq-close cq-reveal" aria-labelledby="close-title">
        <div class="cq-close-grid">
          <div><div class="cq-eyebrow">Start with the machine</div><h2 id="close-title">Leave the noise outside.</h2><a class="btn btn-primary cq-close-cta" href="#machines">Choose your machine <span aria-hidden="true">→</span></a></div>
          <p>Pick a plan above, then continue to secure checkout. Pricing and availability are confirmed there.</p>
        </div>
      </section>
    </div>
  </main>`;
  const jsonLd = [{ "@context": "https://schema.org", "@graph": [
    ORG,
    websiteLd(),
    {
      "@type": "WebPage",
      "@id": "__SRDP_BASE__/#webpage",
      name: "Windows and Linux VPS hosting in the USA",
      url: "__SRDP_BASE__/",
      description: "Private Windows and Linux VPS hosting in the USA for remote access, automation, and development.",
      isPartOf: { "@id": "__SRDP_BASE__/#website" },
      about: { "@id": "__SRDP_BASE__/#service" },
    },
    {
      "@type": "Service",
      "@id": "__SRDP_BASE__/#service",
      name: "USA Windows and Linux VPS hosting",
      serviceType: "Windows and Linux VPS hosting",
      description: "Private USA VPS plans with dedicated CPU resources, NVMe storage, unlimited bandwidth, and full administrative access.",
      provider: { "@id": "__SRDP_BASE__/#organization" },
      areaServed: { "@type": "Country", name: "United States" },
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "USA VPS plans",
        itemListElement: plans.map(serviceLd),
      },
    },
    faqLdFrom(HOME_FAQS),
  ] }];
  return page({ active: "home", title: "Windows & Linux VPS Hosting in the USA | StealthRDP", description: "Private Windows and Linux VPS hosting in the USA with NVMe storage, dedicated CPU resources, full admin rights, and secure checkout.", canonical: "__SRDP_BASE__/", jsonLd, body });
}

/* ---------- 2. plans ---------- */
function buildPlans() {
  const cards = USA.map((p) => planCardHtml(p)).join("");
  const compare = USA.concat(EU).map(compareRowHtml).join("");
  const body = `
  <section class="page-hero">
    <div class="container"><span class="eyebrow">Pricing</span><h1>StealthRDP VPS Plans</h1><p>Compare current Windows and Linux VPS resources by location, then confirm price and availability at checkout.</p></div>
  </section>
  <section class="section" style="padding-top:0">
    <div class="container">
      <div style="display:flex;justify-content:center;margin-bottom:42px" class="billing-toggle" id="billingToggle" role="tablist" aria-label="Billing cycle">
        <button role="tab" data-cycle="monthly" class="active">Monthly</button>
        <button role="tab" data-cycle="quarterly">Quarterly <span class="off">−10%</span></button>
        <button role="tab" data-cycle="annual">Annual <span class="off">−20%</span></button>
        <button role="tab" data-cycle="biannual">Biannual <span class="off">−30%</span></button>
      </div>
      <div id="locationTabs" style="display:flex;justify-content:center;gap:8px;margin-bottom:38px;flex-wrap:wrap">
        <button data-location="USA" class="btn btn-sm btn-primary">USA Plans</button>
        <button data-location="EU" class="btn btn-sm btn-ghost">EU Plans</button>
        <a class="btn btn-sm btn-ghost" href="https://dash.stealthrdp.com/index.php?rp=/store/build-your-own-rdp-vps" target="_blank" rel="noopener noreferrer">Build Your Own VPS</a>
      </div>
      <div class="plan-grid" id="planGrid" aria-live="polite">${cards}</div>
      <div id="build-your-own" style="margin-top:64px;background:linear-gradient(180deg,var(--surface-1),var(--bg-elev));border:1px solid var(--border);border-radius:var(--radius-lg);padding:40px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap">
        <div><h2 style="font-size:24px;margin-bottom:8px">Need something custom?</h2><p style="color:var(--text-muted);max-width:520px">Build a tailor-made VPS with flexible resources to match your exact requirements — CPU, RAM, storage, location, and more.</p></div>
        <a class="btn btn-primary" href="https://dash.stealthrdp.com/index.php?rp=/store/build-your-own-rdp-vps" target="_blank" rel="noopener noreferrer">Configure &amp; Deploy</a>
      </div>
      <div style="margin-top:72px">
        <h2 style="font-size:clamp(24px,3vw,32px);margin-bottom:24px">VPS Features Comparison</h2>
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
    description: "Compare StealthRDP VPS plans in USA and EU locations with NVMe storage, dedicated CPU resources, full admin access, and checkout-confirmed pricing.",
    canonical: "__SRDP_BASE__/plans.html",
    jsonLd,
    body,
  });
}

/* ---------- 3. features ---------- */
function buildFeatures() {
  const grid = FEATURES.map(featureCardHtml).join("");
  const body = `
  <section class="page-hero">
    <div class="container"><span class="eyebrow">Capabilities</span><h1>Everything your workload needs</h1><p>See the resources and access included with each StealthRDP VPS. Checkout confirms current product availability.</p></div>
  </section>
  <section class="section" style="padding-top:0">
    <div class="container"><div class="bento" id="featureGrid">${grid}</div></div>
  </section>
  <section class="cta-band">
    <div class="container cta-grid">
      <div class="cta-copy"><span class="eyebrow">Ready when you are</span><h2>Put these features to work</h2><p>Choose a Windows or Linux VPS, review the current terms, and continue to secure checkout when the right plan is available.</p></div>
      <div class="cta-actions"><a class="btn btn-primary" href="https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps" target="_blank" rel="noopener noreferrer">Deploy Your Server Now</a><a class="btn btn-ghost" href="/plans.html">Compare Plans</a></div>
    </div>
  </section>`;
  const jsonLd = [{ "@context": "https://schema.org", "@graph": [
    breadcrumbLd("Features", [
      { name: "Home", url: "__SRDP_BASE__/" },
      { name: "Features", url: "__SRDP_BASE__/features.html" },
    ]),
  ]}];
  return page({
    active: "features",
    title: "Features — StealthRDP",
    description: "Explore StealthRDP VPS features: NVMe storage, network protection, full admin access, operating-system choice, and resource options.",
    canonical: "__SRDP_BASE__/features.html",
    jsonLd,
    body,
  });
}

/* ---------- 4. status ---------- */
function buildStatus() {
  const summary = '<div class="ss-card"><div class="ss-num warn">—</div><div class="ss-lbl">Live status unavailable</div></div>' +
    '<div class="ss-card"><div class="ss-num warn">—</div><div class="ss-lbl">Current availability</div></div>' +
    '<div class="ss-card"><div class="ss-num warn">—</div><div class="ss-lbl">Check again shortly</div></div>';
  const nodes = '<div class="status-empty">Live status is unavailable until the monitoring feed responds.</div>';
  const body = `
  <section class="page-hero">
    <div class="container"><span class="eyebrow">Live Monitoring</span><h1>StealthRDP Server Status</h1><p>Check current service state when the monitoring feed is available. The page does not show a substitute snapshot.</p></div>
  </section>
  <section class="section" style="padding-top:0">
    <div class="container">
      <div class="status-summary" id="statusSummary" aria-live="polite">${summary}</div>
      <p class="status-source-note" id="statusSourceNote">Live status unavailable · no snapshot is shown.</p>
      <h2 style="font-size:22px;margin-bottom:18px">Production nodes</h2>
      <div class="node-list" id="nodeList" aria-live="polite">${nodes}</div>
      <div class="status-info-grid">
        <div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--radius-lg);padding:26px"><h3 style="font-size:18px;margin-bottom:10px">Service terms</h3><p style="color:var(--text-muted);font-size:14px">Any service levels or remedies are defined in the current Terms of Service. Review those terms before ordering.</p></div>
        <div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--radius-lg);padding:26px"><h3 style="font-size:18px;margin-bottom:10px">Live data only</h3><p style="color:var(--text-muted);font-size:14px">This page shows monitoring data only when the live feed responds. It does not replace the service terms or a verified incident notice.</p></div>
        <div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--radius-lg);padding:26px"><h3 style="font-size:18px;margin-bottom:10px">Need help?</h3><p style="color:var(--text-muted);font-size:14px">Use the client-area support portal for account or service questions. Current support terms apply.</p></div>
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
    description: "Check StealthRDP service status when the live monitoring feed is available. No substitute snapshot is shown.",
    canonical: "__SRDP_BASE__/status.html",
    jsonLd,
    body,
  });
}

/* ---------- 5. blog index ---------- */
function buildBlog() {
  const cards = BLOG.map(blogCardHtml).join("");
  const body = `
  <section class="page-hero">
    <div class="container"><span class="eyebrow">Insights &amp; Tutorials</span><h1>StealthRDP Blog</h1><p>Expert insights, tutorials, and updates on remote desktop security and management.</p></div>
  </section>
  <section class="section" style="padding-top:0">
    <div class="container"><div class="blog-grid" id="blogGrid">${cards}</div></div>
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
  <section class="section" style="padding-top:72px">
    <div class="container">
      <article class="prose" id="blogPost">
        <span class="bc-cat">${esc(post.category)}</span>
        <h1 style="font-size:clamp(28px,4vw,40px);margin:14px 0">${esc(post.title)}</h1>
        <div class="bc-meta" style="margin-bottom:26px"><span>${esc(post.author)}</span><span>${esc(post.date)}</span></div>
        <p>${esc(post.excerpt || "")}</p>
        <div class="note">This article is not published yet. Return to the Blog when the complete guide is available. Need help now? <a href="${DOC_SUPPORT_URL}" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">Open the client area</a>.</div>
        <p><a href="/blog.html" style="color:var(--accent)">← Back to blog</a></p>
      </article>
    </div>
  </section>`;
  const jsonLd = [{ "@context": "https://schema.org", "@graph": [
    breadcrumbLd(post.title, [
      { name: "Home", url: "__SRDP_BASE__/" },
      { name: "Blog", url: "__SRDP_BASE__/blog.html" },
      { name: post.title, url: `__SRDP_BASE__/blog/${post.slug}.html` },
    ]),
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
    robots: "noindex,follow",
    body,
  });
}

/* ---------- 7. faq ---------- */
function buildFaq() {
  const items = FAQS.map(faqItemHtml).join("");
  const body = `
  <section class="page-hero">
    <div class="container"><span class="eyebrow">Support</span><h1>Frequently Asked Questions</h1><p>Read the service, setup, billing, access, and support answers before you choose a server.</p></div>
  </section>
  <section class="section" style="padding-top:0">
    <div class="container">
      <div class="faq-list" id="faqList" aria-live="polite">${items}</div>
      <div style="margin-top:56px;text-align:center">
        <h2 style="font-size:22px;margin-bottom:10px">Still have questions?</h2>
        <p style="color:var(--text-muted);margin-bottom:22px">For account or server-specific questions, use the support portal linked below.</p>
        <a class="btn btn-primary" href="${DOC_SUPPORT_URL}" target="_blank" rel="noopener noreferrer">Open Client Area</a>
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
    <div class="container"><span class="eyebrow">Who we are</span><h1>Built for people who need their own machine</h1><p>StealthRDP provides Windows and Linux VPS infrastructure for remote access, automation, development, and other always-on workloads.</p></div>
  </section>
  <section class="section" style="padding-top:0">
    <div class="container prose">
      <h2>What we do</h2>
      <p>We provide Windows and Linux VPS infrastructure with the resources shown on each plan, NVMe storage, full administrative access, and checkout-confirmed product details.</p>
      <h2>Why people choose us</h2>
      <ul>
        <li><strong>Clear resources</strong> — CPU, memory, storage, bandwidth, and location are shown before checkout.</li>
        <li><strong>Administrative control</strong> — configure the Windows or Linux environment around the work.</li>
        <li><strong>Transparent status</strong> — the status page shows live data when the monitoring feed responds.</li>
        <li><strong>Direct support path</strong> — use the client area for account or server-specific questions.</li>
        <li><strong>Flexible plans</strong> — USA and EU locations, monthly to biannual billing, and a build-your-own configurator.</li>
      </ul>
      <h2>What the service supports</h2>
      <p>StealthRDP supports remote work, web hosting, development, and always-on automation. Current pricing, availability, service terms, and support details are confirmed through the linked pages and checkout.</p>
      <div class="note">Questions about our infrastructure? <a href="${DOC_SUPPORT_URL}" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">Open the client area</a> for the verified support path.</div>
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
    description: "StealthRDP provides Windows and Linux VPS infrastructure for remote access, automation, development, and always-on workloads.",
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
    ["/features.html", "2026-08-06"],
    ["/status.html", "2026-08-06"],
    ["/blog.html", "2026-08-06"],
    ["/faq.html", "2026-08-06"],
    ["/about.html", "2026-08-06"],
    ["/privacy.html", "2026-08-06"],
    ["/docs.html", "2026-08-13"],
  ];
  const docRoutes = DOCS.map((article) => [`/docs/${article.slug}.html`, docDateIso(article.date) || "2026-08-13"]);
  const urls = staticRoutes.concat(docRoutes);
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
  "features.html": buildFeatures(),
  "status.html": buildStatus(),
  "blog.html": buildBlog(),
  "faq.html": buildFaq(),
  "about.html": buildAbout(),
  "privacy.html": buildPrivacy(),
  "docs.html": buildDocsIndex(),
  "robots.txt": buildRobots(),
  "sitemap.xml": buildSitemap(),
};

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
