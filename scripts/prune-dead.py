"""Prune dead CSS/JS from removed sections. Each removal asserts it matched."""
from pathlib import Path

ROOT = Path("/opt/data/stealthrdp-homepage-edit")
CSS = ROOT / "css" / "style.css"
JS = ROOT / "js" / "main.js"


def prune(path, removals):
    text = path.read_text()
    for label, block in removals:
        count = text.count(block)
        if count != 1:
            raise SystemExit(f"PRUNE FAIL [{path.name}] {label}: found {count} (expected 1)")
        text = text.replace(block, "")
    path.write_text(text)
    print(f"pruned {path.name}: {len(removals)} blocks")


css_removals = [
    ("uc-block",
     """/* ---------- Use cases (numbered rows) ---------- */
.uc-list { display: grid; border-top: 1px solid var(--border); }
.uc-row {
  display: grid; grid-template-columns: 90px 1fr 1fr; gap: 24px; align-items: center;
  padding: 34px 8px; border-bottom: 1px solid var(--border);
  transition: background 0.2s;
}
.uc-row:hover { background: rgba(255,255,255,0.015); }
.uc-num { font-family: var(--font-display); font-weight: 700; font-size: 34px; color: var(--text-dim); letter-spacing: -0.02em; }
.uc-row:hover .uc-num { color: var(--accent); }
.uc-main h3 { font-size: 21px; margin-bottom: 8px; }
.uc-main p { color: var(--text-muted); font-size: 14px; max-width: 380px; }
.uc-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.uc-col { background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 18px; }
.uc-col .uc-tag { font-family: var(--font-mono); font-size: 10.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; }
.uc-col.before .uc-tag { color: var(--red); }
.uc-col.after .uc-tag { color: var(--green); }
.uc-col p { font-size: 13px; color: var(--text-muted); line-height: 1.55; }
.uc-col.after p { color: var(--text); }
@media (max-width: 860px) {
  .uc-row { grid-template-columns: 1fr; gap: 14px; padding: 26px 4px; }
  .uc-num { font-size: 24px; }
}
"""),
    ("outcome-block",
     """.outcomes-section { padding-top: 28px; }
.outcomes-head { margin-bottom: 4px; }
.outcome-panel { border-top: 1px solid var(--border-strong); }
.outcome-row { display: grid; grid-template-columns: minmax(150px, .68fr) minmax(0, 1.4fr) minmax(0, 1.4fr); gap: 24px; align-items: start; padding: 22px 0; border-bottom: 1px solid var(--border); }
.outcome-row-head { padding: 12px 0; border-bottom: 1px solid var(--border-strong); color: var(--text-dim); font: 10px var(--font-mono); letter-spacing: .1em; text-transform: uppercase; }
.outcome-name { display: flex; align-items: center; gap: 12px; color: var(--text); font: 600 16px var(--font-body); }
.outcome-no { color: var(--accent); font: 10px var(--font-mono); letter-spacing: .06em; }
.outcome-before { margin: 0; color: var(--text-dim); font-size: 14px; line-height: 1.6; }
.outcome-after { position: relative; margin: 0 0 0 16px; padding-left: 16px; color: var(--text); font-size: 14px; line-height: 1.6; border-left: 2px solid var(--accent); }
"""),
    ("outcome-mobile",
     """  .outcome-row { grid-template-columns: 1fr; gap: 6px; padding: 18px 16px; }
  .outcome-row-head { display: none; }
  .outcome-name { gap: 10px; }
  .outcome-before { padding-left: 26px; }
  .outcome-after { margin: 2px 0 0 10px; padding: 10px 0 0 14px; }
"""),
    ("page-hero-grid",
     """.page-hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(230px, .38fr); gap: 56px; align-items: end; }
.page-hero-kicker { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; }
.page-hero-meta { color: var(--text-dim); font: 10px var(--font-mono); letter-spacing: .08em; text-transform: uppercase; }
.page-hero-aside { display: grid; gap: 10px; align-content: end; padding: 18px 19px; background: linear-gradient(145deg, rgba(var(--accent-rgb), .08), var(--surface-1)); border: 1px solid var(--border-strong); border-radius: var(--radius); }
.page-hero-aside .mono, """),
    ("page-hero-aside-rest",
     """ { color: var(--accent); font: 600 10px var(--font-mono); letter-spacing: .12em; text-transform: uppercase; }
.page-hero-aside strong { color: var(--text); font: 600 16px var(--font-body); }
.page-hero-aside a { color: var(--accent); font-size: 13px; font-weight: 600; }
.page-hero-aside a:hover { color: var(--accent-hover); }
.page-hero-status .page-hero-aside, .page-hero-plans .page-hero-aside { min-height: 134px; }
"""),
    ("docs-hero-line",
     ".docs-index-hero { padding-top: 42px; }.docs-hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, .42fr); gap: 52px; align-items: end; }.docs-hero-grid h1 { margin-top: 18px; }.docs-hero-rail { display: grid; gap: 0; padding: 16px 18px; background: var(--surface-1); border: 1px solid var(--border-strong); border-radius: var(--radius); }.docs-hero-rail > .mono { padding-bottom: 10px; color: var(--accent); font: 600 10px var(--font-mono); letter-spacing: .12em; }.docs-quick-link { display: grid; grid-template-columns: 26px 1fr 18px; gap: 10px; align-items: center; padding: 12px 0; border-top: 1px solid var(--border); }.docs-quick-link span { color: var(--text-dim); font: 10px var(--font-mono); }.docs-quick-link strong { color: var(--text-muted); font: 500 12px/1.35 var(--font-body); }.docs-quick-link b { color: var(--accent); }.docs-quick-link:hover strong { color: var(--text); }\n"),
    ("docs-index-intro",
     ".docs-index-intro { top: 92px; }.docs-index-intro h2 { font-size: 28px; }"),
    ("blog-hero-aside",
     ".blog-page-hero .page-hero-aside { min-height: 154px; }.blog-hero-aside strong { line-height: 1.35; }"),
    ("media900-blog-featured",
     ".blog-card-featured { grid-column: span 1; }"),
    ("faq-hero-aside",
     ".faq-page-hero .page-hero-aside { min-height: 134px; }"),
    ("faq-aside",
     ".faq-aside { position: sticky; top: 95px; }.faq-aside h2 { margin: 15px 0 10px; font-size: 27px; }.faq-aside p { color: var(--text-muted); font-size: 13px; line-height: 1.7; }.faq-topic-list { display: grid; gap: 3px; margin-top: 24px; }.faq-topic-list button { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 11px; color: var(--text-muted); border-left: 2px solid transparent; text-align: left; font-size: 12px; }.faq-topic-list button span { color: var(--text-dim); font: 10px var(--font-mono); }.faq-topic-list button:hover, .faq-topic-list button.active { color: var(--text); background: var(--surface-1); border-left-color: var(--accent); }"),
    ("media900-faq",
     ".faq-aside { position: static; max-width: 620px; }.faq-topic-list { display: flex; flex-wrap: wrap; gap: 5px; }.faq-topic-list button { border: 1px solid var(--border); border-left-width: 1px; border-radius: 999px; }.faq-topic-list button:hover, .faq-topic-list button.active { border-color: var(--accent); }"),
    ("media620-docs",
     ".docs-hero-rail { padding: 12px 15px; }.docs-index-layout { gap: 22px; }"),
    ("media620-quicklink",
     ".docs-quick-link strong { font-size: 11.5px; }"),
    ("media620-blog-featured",
     ".blog-card-featured .bc-body { padding: 22px; }.blog-card-featured h3 { font-size: 21px; }"),
]

js_removals = [
    ("testimonial-block",
     """  /* ---------- Testimonials (baked quote stays on API failure) ---------- */
  var testimonialQuote = $("#testimonialQuote");
  if (testimonialQuote && !hasBaked(testimonialQuote)) {
    fetch(API + "/testimonials")
      .then(function (r) { if (!r.ok) throw new Error("bad status"); return r.json(); })
      .then(function (data) {
        var list = Array.isArray(data) ? data : [];
        if (!list.length) {
          testimonialQuote.innerHTML = '<div class="quote-empty">10,000+ orders and counting. Deploy in 60 seconds.</div>';
          return;
        }
        var t = list[0];
        var name = t.authorName || t.name || t.customerName || "StealthRDP Customer";
        var role = [t.authorPosition, t.authorCompany].filter(Boolean).join(", ");
        testimonialQuote.innerHTML =
          '<div class="q-mark">“</div>' +
          '<p class="q-text">' + esc(t.quote || t.testimonial || t.content || "") + "</p>" +
          '<p class="q-who"><b>' + esc(name) + "</b>" + (role ? " · " + esc(role) : "") + "</p>";
      })
      .catch(function () { /* baked quote remains */ });
  }

"""),
    ("feature-block",
     """  /* ---------- Features grid (baked cards stay on API failure) ---------- */
  var featureGrid = $("#featureGrid");
  if (featureGrid && !hasBaked(featureGrid)) {
    fetch(API + "/features")
      .then(function (r) { if (!r.ok) throw new Error("bad status"); return r.json(); })
      .then(function (data) {
        var list = Array.isArray(data) ? data : [];
        if (!list.length) throw new Error("empty");
        featureGrid.innerHTML = list.map(function (f) {
          return (
            '<article class="bento-card bento-2">' +
              '<span class="bic">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg></span>' +
              "<h3>" + esc(f.title) + "</h3>" +
              "<p>" + esc((f.description || "").split("\\n")[0]) + "</p>" +
            "</article>"
          );
        }).join("");
      })
      .catch(function () { /* baked features remain */ });
  }

"""),
]

prune(CSS, css_removals)
prune(JS, js_removals)
print("done")
