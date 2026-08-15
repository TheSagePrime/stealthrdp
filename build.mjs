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
  <link rel="stylesheet" href="/css/style.css" />
  <meta name="theme-color" content="#08090c" />
  <script>(function(){try{var t=localStorage.getItem('srdp-theme');if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();</script>
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
    <span class="left"><span class="dot" id="tickerDot"></span><span id="tickerStatus">Checking live status…</span></span>
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
  return `${tickerHtml()}
  <header class="header"><div class="container header-inner">
    <a href="/" class="logo" aria-label="StealthRDP home">
      <span class="logo-mark">${LOGO_SVG}</span><span>Stealth<em>RDP</em></span>
    </a>
    <nav class="nav" aria-label="Main navigation">${navHtml(active)}</nav>
    <div class="header-actions">
      <button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle dark and light theme" aria-pressed="false"><svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/></svg><svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 14.2A8.3 8.3 0 0 1 9.8 3.6 8.3 8.3 0 1 0 20.4 14.2Z"/></svg></button>
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
        <li><a href="/features.html">Features</a></li>
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
    return '<div class="quote-empty">Testimonials are being collected. Our 10,877+ customers trust us — join them today.</div>';
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
function page({ active, title, description, canonical, pageType = "website", jsonLd = [], body, extraScripts = [] }) {
  return `${head({ title, description, canonical, pageType, jsonLd })}
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
  <div class="marquee">
    <div class="marquee-track" id="osTrack">
      <span class="marquee-label">Works with your OS</span>
      <span class="marquee-item">Debian</span><span class="marquee-item">CentOS</span><span class="marquee-item">Rocky Linux</span><span class="marquee-item">Ubuntu</span><span class="marquee-item">Fedora</span><span class="marquee-item">FreeBSD</span><span class="marquee-item">Alpine Linux</span><span class="marquee-item">AlmaLinux</span><span class="marquee-item">Windows</span>
      <span class="marquee-label">Works with your OS</span>
      <span class="marquee-item">Debian</span><span class="marquee-item">CentOS</span><span class="marquee-item">Rocky Linux</span><span class="marquee-item">Ubuntu</span><span class="marquee-item">Fedora</span><span class="marquee-item">FreeBSD</span><span class="marquee-item">Alpine Linux</span><span class="marquee-item">AlmaLinux</span><span class="marquee-item">Windows</span>
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

  <!-- ============ Section 01 — Why (bento) ============ -->
  <section class="section" id="why">
    <div class="container">
      <div class="section-head">
        <span class="sec-index fade-up">01 / Why StealthRDP</span>
        <h2 class="fade-up d1">Infrastructure that doesn't flinch</h2>
        <p class="fade-up d2">Built for speed, secured for production, and priced for growth.</p>
      </div>
      <div class="bento">
        <article class="bento-card bento-2"><span class="bic">${LOGO_SVG}</span><h3>NVMe SSD Storage</h3><p>6x faster than traditional SSDs. Applications, databases, and trading terminals load instantly — no waiting on slow disk I/O.</p></article>
        <article class="bento-card bento-2"><span class="bic">${LOGO_SVG}</span><h3>Enterprise-Grade Security</h3><p>DDoS protection and isolated VM instances for maximum privacy. Your infrastructure stays up even while others are under attack.</p></article>
        <article class="bento-card bento-2"><span class="bic">${LOGO_SVG}</span><h3>Global Network</h3><p>Strategically located data centers with 1Gbps network speeds — deploy close to your users, anywhere in the world.</p></article>
        <article class="bento-card bento-wide">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap">
            <div><h3>Live-monitored, always-on</h3><p style="max-width:560px">Every node is watched 24/7 by automated monitors. See the current state of all ${TOTAL} production nodes in real time — transparency you can verify, not just claim.</p></div>
            <a class="btn btn-ghost btn-sm" href="/status.html">View live status</a>
          </div>
        </article>
      </div>
    </div>
  </section>

  <!-- ============ Section 02 — Use cases ============ -->
  <section class="section section-tight" id="usecases">
    <div class="container">
      <div class="section-head">
        <span class="sec-index fade-up">02 / Who it's for</span>
        <h2 class="fade-up d1">Stop struggling with server problems</h2>
        <p class="fade-up d2">Our customers come to us when traditional hosting limits their work. Here's how StealthRDP changes that.</p>
      </div>
      <div class="uc-list">
        <div class="uc-row fade-up"><div class="uc-num">01</div><div class="uc-main"><h3>Remote Work Freedom</h3><p>Your full desktop, from any device, anywhere.</p></div><div class="uc-cols"><div class="uc-col before"><div class="uc-tag">Before</div><p>"I'm tied to my office computer and can't access my work when traveling or at home."</p></div><div class="uc-col after"><div class="uc-tag">With StealthRDP</div><p>"I access my full desktop from any device — with all my files and applications."</p></div></div></div>
        <div class="uc-row fade-up d1"><div class="uc-num">02</div><div class="uc-main"><h3>Reliable Web Hosting</h3><p>Stay up under traffic spikes, get real support.</p></div><div class="uc-cols"><div class="uc-col before"><div class="uc-tag">Before</div><p>"My website keeps going down during traffic spikes and support tickets go unanswered."</p></div><div class="uc-col after"><div class="uc-tag">With StealthRDP</div><p>"My site stays up under heavy traffic, and support responds within 2 hours."</p></div></div></div>
        <div class="uc-row fade-up d2"><div class="uc-num">03</div><div class="uc-main"><h3>Trading &amp; Automation</h3><p>24/7 uptime for terminals, bots, and scripts.</p></div><div class="uc-cols"><div class="uc-col before"><div class="uc-tag">Before</div><p>"My automation scripts only run when my laptop is on, and they're unreliable."</p></div><div class="uc-col after"><div class="uc-tag">With StealthRDP</div><p>"My scripts and trading terminals run 24/7 on low-latency infrastructure."</p></div></div></div>
        <div class="uc-row fade-up d3"><div class="uc-num">04</div><div class="uc-main"><h3>Secure Data Storage</h3><p>Backed up, protected, and always available.</p></div><div class="uc-cols"><div class="uc-col before"><div class="uc-tag">Before</div><p>"I worry about data loss from hardware failures and have no reliable backup system."</p></div><div class="uc-col after"><div class="uc-tag">With StealthRDP</div><p>"My data is securely backed up with automated disaster recovery on enterprise hardware."</p></div></div></div>
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

  <!-- ============ Testimonial ============ -->
  <section class="section" id="testimonials">
    <div class="container">
      <div class="section-head center"><span class="sec-index" style="justify-content:center">04 / Customer stories</span><h2 class="fade-up d1">Trusted by server owners</h2></div>
      <div id="testimonialQuote" class="quote-block" aria-live="polite">${testimonialHtml()}</div>
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
  <section class="page-hero">
    <div class="container"><span class="eyebrow">Pricing</span><h1>StealthRDP VPS Plans</h1><p>High-performance virtual private servers with unparalleled speed, security, and reliability. Choose the plan that fits your needs.</p></div>
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
    description: "Compare StealthRDP VPS plans: USA and EU locations, NVMe storage, DDoS protection, 99.9% uptime. From $9.50/month with 7-day money-back guarantee.",
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
    <div class="container"><span class="eyebrow">Capabilities</span><h1>Everything your workload needs</h1><p>From instant activation to enterprise-grade protection — every StealthRDP server ships with the features that matter.</p></div>
  </section>
  <section class="section" style="padding-top:0">
    <div class="container"><div class="bento" id="featureGrid">${grid}</div></div>
  </section>
  <section class="cta-band">
    <div class="container cta-grid">
      <div class="cta-copy"><span class="eyebrow">Ready when you are</span><h2>Put these features to work</h2><p>Deploy a server in 60 seconds and get full admin access, DDoS protection, and 24/7 support from day one.</p></div>
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
    description: "Explore StealthRDP features: NVMe storage, DDoS protection, instant activation, 24/7 support, trading-ready low latency, and more.",
    canonical: "__SRDP_BASE__/features.html",
    jsonLd,
    body,
  });
}

/* ---------- 4. status ---------- */
function buildStatus() {
  const summary = `<div class="ss-card"><div class="ss-num ${ALL_UP ? "good" : "warn"}">${UP}/${TOTAL}</div><div class="ss-lbl">Nodes online</div></div>
    <div class="ss-card"><div class="ss-num ${ALL_UP ? "good" : "warn"}">${TOTAL ? Math.round((UP / TOTAL) * 100) : 0}%</div><div class="ss-lbl">Current availability</div></div>
    <div class="ss-card"><div class="ss-num ${ALL_UP ? "good" : "warn"}">24/7</div><div class="ss-lbl">Automated monitoring</div></div>`;
  const nodes = MONITORS.map(nodeCardHtml).join("");
  const body = `
  <section class="page-hero">
    <div class="container"><span class="eyebrow">Live Monitoring</span><h1>StealthRDP Server Status</h1><p>Real-time monitoring of our server infrastructure. Check the current status and historical uptime of all StealthRDP services.</p></div>
  </section>
  <section class="section" style="padding-top:0">
    <div class="container">
      <div class="status-summary" id="statusSummary" aria-live="polite">${summary}</div>
      <p class="status-source-note" id="statusSourceNote">Baked uptime snapshot · live refresh is attempted when this page loads.</p>
      <h2 style="font-size:22px;margin-bottom:18px">Production nodes</h2>
      <div class="node-list" id="nodeList" aria-live="polite">${nodes}</div>
      <div class="status-info-grid">
        <div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--radius-lg);padding:26px"><h3 style="font-size:18px;margin-bottom:10px">Service Level Agreement</h3><p style="color:var(--text-muted);font-size:14px">StealthRDP is committed to maintaining a 99.9% uptime for all our VPS services. Our monitoring system alerts us instantly of any service disruptions.</p></div>
        <div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--radius-lg);padding:26px"><h3 style="font-size:18px;margin-bottom:10px">Uptime Guarantee</h3><p style="color:var(--text-muted);font-size:14px">We offer compensation credits for any monthly uptime percentage below our guaranteed 99.9%. The real-time data above shows our actual performance.</p></div>
        <div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--radius-lg);padding:26px"><h3 style="font-size:18px;margin-bottom:10px">Incident Response</h3><p style="color:var(--text-muted);font-size:14px">Our technical team is available 24/7 to respond to service disruptions. Most issues are detected and resolved before they affect your experience.</p></div>
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
        <div class="note">Full article content is managed by our content pipeline and will appear here automatically. Need help now? <a href="https://dash.stealthrdp.com/submitticket.php" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">Contact support</a>.</div>
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
  const body = `
  <section class="page-hero">
    <div class="container"><span class="eyebrow">Support</span><h1>Frequently Asked Questions</h1><p>Everything you need to know before deploying your server. Can't find an answer? Our team responds within 2 hours.</p></div>
  </section>
  <section class="section" style="padding-top:0">
    <div class="container">
      <div class="faq-list" id="faqList" aria-live="polite">${items}</div>
      <div style="margin-top:56px;text-align:center">
        <h2 style="font-size:22px;margin-bottom:10px">Still have questions?</h2>
        <p style="color:var(--text-muted);margin-bottom:22px">Our support team is available 24/7 with an average response under 2 hours.</p>
        <a class="btn btn-primary" href="https://dash.stealthrdp.com/submitticket.php" target="_blank" rel="noopener noreferrer">Contact Support</a>
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
    ["/features.html", "2026-08-06"],
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
