/* StealthRDP v2 — main.js (page-aware enhancement)
   The site is SEO-prerendered: primary content is baked into the HTML. This
   script ENHANCES it (billing toggles, live status refresh, accordions) and
   never wipes baked content when the API is down. */
(function () {
  "use strict";

  var API = "/api"; // same-origin proxy (server.js) — no CORS dependency

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtPrice(n) {
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function hasBaked(container) {
    return container && container.querySelector("article, .faq-item, .node-card, .q-text");
  }

  /* ---------- Analytics (real GTM container from live site, no PII) ---------- */
  function dl(event, props) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: event }, props || {}));
    } catch (e) {}
  }
  document.addEventListener("click", function (e) {
    var card = e.target.closest ? e.target.closest(".plan-card") : null;
    var name = card && card.querySelector(".p-name");
    if (name) {
      dl("select_plan", { plan_name: name.textContent.trim(), location: document.body.getAttribute("data-plan-location") || "USA" });
    }
  });
  if (document.body.getAttribute("data-page") === "plans") {
    dl("view_plans", { location: "USA" });
  }

  /* ---------- Countdown (72h rolling, persisted) ---------- */
  var COUNTDOWN_MS = 72 * 60 * 60 * 1000;
  var cdEl = $("#countdown");
  if (cdEl) {
    var end;
    try { end = parseInt(localStorage.getItem("srdp_offer_end") || "0", 10); } catch (e) { end = 0; }
    if (!end || end < Date.now()) {
      end = Date.now() + COUNTDOWN_MS;
      try { localStorage.setItem("srdp_offer_end", String(end)); } catch (e) {}
    }
    function tick() {
      var diff = end - Date.now();
      if (diff <= 0) { end = Date.now() + COUNTDOWN_MS; try { localStorage.setItem("srdp_offer_end", String(end)); } catch (e) {} diff = end - Date.now(); }
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      var pad = function (n) { return n < 10 ? "0" + n : String(n); };
      cdEl.textContent = d + "d " + pad(h) + ":" + pad(m) + ":" + pad(s);
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- Mobile nav ---------- */
  var navToggle = $("#navToggle");
  var mobileNav = $("#mobileNav");
  if (navToggle && mobileNav) {
    navToggle.addEventListener("click", function () {
      var open = mobileNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---------- Live status (ticker + footer + status page) ---------- */
  var PLAN_SLUGS = {
    "Bronze USA": "bronze-usa2", "Silver USA": "silver-usa", "Gold USA": "gold-usa",
    "Platinum USA": "platinum-usa", "Diamond USA": "diamond-usa", "Emerald USA": "emerald-usa",
    "Bronze EU": "bronze-eu", "Silver EU": "silver-eu", "GOLD EU": "gold-eu",
    "Platinum EU": "platinum-eu", "Diamond EU": "diamond-eu", "Emerald EU": "emerald-eu"
  };
  var CYCLE_MULT = { monthly: 0.95, quarterly: 0.90, annual: 0.80, biannual: 0.70 };
  var CYCLE_KEY = { monthly: "monthly", quarterly: "quarterly", annual: "annually", biannual: "biannually" };

  function planUrl(plan, cycle) {
    var slug = PLAN_SLUGS[plan.name] || "";
    var cyc = CYCLE_KEY[cycle] || "monthly";
    if (slug) {
      return "https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps/" + slug + "&billingcycle=" + cyc;
    }
    if (plan.purchaseUrl) {
      return plan.purchaseUrl.replace("https://stealthrdp.com/dash", "https://dash.stealthrdp.com");
    }
    return "https://dash.stealthrdp.com/index.php?rp=/store/standard-usa-rdp-vps";
  }

  function fetchUptime() {
    fetch(API + "/uptime", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(function (r) { if (!r.ok) throw new Error("bad status"); return r.json(); })
      .then(function (d) {
        var monitors = (d && d.monitors) || [];
        var up = monitors.filter(function (m) { return m.status === "up"; }).length;
        var total = monitors.length;
        var msg = total ? "All systems operational — " + up + "/" + total + " nodes online" : "Status unavailable";
        var tickerStatus = $("#tickerStatus");
        if (tickerStatus) tickerStatus.textContent = msg;
        var footerStatus = $("#footerStatus");
        if (footerStatus) footerStatus.textContent = msg;
        var heroNodeStatus = $("#heroNodeStatus");
        if (heroNodeStatus) {
          heroNodeStatus.innerHTML = '<span class="live"></span> ' + up + "/" + total + " nodes operational";
          heroNodeStatus.style.color = total && up === total ? "var(--green)" : "var(--accent)";
        }
        renderStatusPage(d);
      })
      .catch(function () {
        // Baked status stays; only soften the ticker if the API is unreachable.
        var tickerStatus = $("#tickerStatus");
        if (tickerStatus && tickerStatus.textContent === "Checking live status…") {
          tickerStatus.textContent = "Status page available";
        }
      });
  }

  function renderStatusPage(d) {
    var nodeList = $("#nodeList");
    var summary = $("#statusSummary");
    if (!nodeList && !summary) return;
    var monitors = (d && d.monitors) || [];
    var up = monitors.filter(function (m) { return m.status === "up"; }).length;
    if (summary) {
      summary.innerHTML =
        '<div class="ss-card"><div class="ss-num ' + (up === monitors.length ? "good" : "warn") + '">' + up + "/" + monitors.length + '</div><div class="ss-lbl">Nodes online</div></div>' +
        '<div class="ss-card"><div class="ss-num ' + (up === monitors.length ? "good" : "warn") + '">' + (monitors.length ? Math.round((up / monitors.length) * 100) : 0) + '%</div><div class="ss-lbl">Current availability</div></div>' +
        '<div class="ss-card"><div class="ss-num ' + (up === monitors.length ? "good" : "warn") + '">24/7</div><div class="ss-lbl">Automated monitoring</div></div>';
    }
    if (nodeList) {
      nodeList.innerHTML = monitors.map(function (m) {
        var upNow = m.status === "up";
        return (
          '<div class="node-card">' +
            '<div class="n-left"><span class="n-dot ' + (upNow ? "up" : "down") + '"></span>' +
            "<div><div class=\"n-name\">" + esc(m.label || "Production node") + "</div>" +
            '<div class="n-target">' + esc(m.region || "Protected infrastructure") + "</div></div></div>" +
            '<div class="n-right"><div class="n-uptime">' +
              '<div class="u-val ' + (upNow ? "good" : "") + '">' + (m.uptimeRatio != null ? Number(m.uptimeRatio).toFixed(2) : "—") + '%</div>' +
              '<div class="u-lbl">90-day uptime</div></div>' +
            "</div></div>"
          );
      }).join("");
    }
  }

  /* ---------- Plans (baked cards stay; toggles re-render from cache) ---------- */
  var planGrid = $("#planGrid");
  var billingToggle = $("#billingToggle");
  var currentCycle = "monthly";
  var cachedPlans = [];
  var PLAN_LOCATION = document.body.getAttribute("data-plan-location") || "USA";
  var PLAN_LIMIT = parseInt(document.body.getAttribute("data-plan-limit") || "3", 10);

  function renderPlans(plans) {
    if (!planGrid) return;
    var mult = CYCLE_MULT[currentCycle] || 1;
    var popularIdx = -1;
    for (var i = 0; i < plans.length; i++) { if (plans[i].popular) { popularIdx = i; break; } }
    var html = plans.map(function (p, i) {
      var base = p.monthlyPrice || 0;
      var price = Math.round(base * mult * 100) / 100;
      var isPop = i === popularIdx;
      return (
        '<article class="plan-card' + (isPop ? " popular" : "") + '">' +
          (isPop ? '<span class="plan-popular">Most Popular</span>' : "") +
          '<div class="p-name">' + esc(p.name.replace(" USA", "").replace(" EU", "")) + "</div>" +
          '<div class="p-desc">' + esc(p.description || "") + "</div>" +
          '<div class="plan-price"><span class="cur">&euro;' + fmtPrice(price) + '<small>/mo</small></span>' +
          '<span class="was">&euro;' + fmtPrice(base) + "</span></div>" +
          '<div class="plan-specs">' +
            specRow("CPU", p.specs && p.specs.cpu) +
            specRow("RAM", p.specs && p.specs.ram) +
            specRow("Storage", p.specs && p.specs.storage) +
            specRow("Bandwidth", p.specs && p.specs.bandwidth) +
          "</div>" +
          '<a class="btn ' + (isPop ? "btn-primary" : "btn-ghost") + '" href="' + planUrl(p, currentCycle) + '" target="_blank" rel="noopener noreferrer">Deploy Now</a>' +
        "</article>"
      );
    }).join("");
    planGrid.innerHTML = html || '<div style="grid-column:1/-1;text-align:center;color:var(--text-dim);padding:40px">Plans are being updated — check back shortly.</div>';
  }

  function specRow(k, v) {
    if (!v) return "";
    return '<div class="plan-spec"><span class="k">' + k + '</span><span class="sep"></span><span class="v">' + esc(v) + "</span></div>";
  }

  function loadPlans() {
    if (!planGrid) return;
    fetch(API + "/plans?location=" + PLAN_LOCATION)
      .then(function (r) { if (!r.ok) throw new Error("bad status"); return r.json(); })
      .then(function (data) {
        cachedPlans = Array.isArray(data) ? data : [];
        renderPlans(cachedPlans.slice(0, PLAN_LIMIT));
      })
      .catch(function () {
        // Baked plan cards are already in the HTML — keep them.
      });
  }

  if (billingToggle) {
    billingToggle.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-cycle]");
      if (!btn) return;
      currentCycle = btn.getAttribute("data-cycle");
      $$("button", billingToggle).forEach(function (b) { b.classList.toggle("active", b === btn); });
      if (cachedPlans.length) renderPlans(cachedPlans.slice(0, PLAN_LIMIT));
    });
  }
  loadPlans();

  /* ---------- Location tabs (plans page) ---------- */
  var locTabs = $("#locationTabs");
  if (locTabs) {
    locTabs.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-location]");
      if (!btn) return;
      PLAN_LOCATION = btn.getAttribute("data-location");
      $$("button", locTabs).forEach(function (b) { b.classList.toggle("active", b === btn); });
      cachedPlans = [];
      planGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-dim);padding:40px">Loading plans…</div>';
      loadPlans();
    });
  }

  /* ---------- Compare table (plans page; baked rows stay on API failure) ---------- */
  var compareBody = $("#compareBody");
  if (compareBody && !hasBaked(compareBody)) {
    fetch(API + "/plans?location=USA")
      .then(function (r) { return r.json(); })
      .then(function (usa) {
        return fetch(API + "/plans?location=EU").then(function (r) { return r.json(); }).then(function (eu) { return { usa: usa, eu: eu }; });
      })
      .then(function (both) {
        var all = (both.usa || []).concat(both.eu || []);
        compareBody.innerHTML = all.map(function (p) {
          return (
            "<tr>" +
              "<td class=\\\"k\\\">" + esc(p.name) + "</td>" +
              '<td class="v">' + esc(p.specs && p.specs.cpu || "—") + "</td>" +
              '<td class="v">' + esc(p.specs && p.specs.ram || "—") + "</td>" +
              '<td class="v">' + esc(p.specs && p.specs.storage || "—") + "</td>" +
              '<td class="v">' + esc(p.specs && p.specs.bandwidth || "—") + "</td>" +
              '<td class="v">&euro;' + fmtPrice(p.monthlyPrice || 0) + "</td>" +
              '<td><a class="btn btn-sm ' + (p.popular ? "btn-primary" : "btn-ghost") + '" href="' + planUrl(p, "monthly") + '" target="_blank" rel="noopener noreferrer">Deploy</a></td>' +
            "</tr>"
          );
        }).join("");
      })
      .catch(function () { /* baked compare rows remain */ });
  }

  /* ---------- Testimonials (baked quote stays on API failure) ---------- */
  var testimonialQuote = $("#testimonialQuote");
  if (testimonialQuote && !hasBaked(testimonialQuote)) {
    fetch(API + "/testimonials")
      .then(function (r) { if (!r.ok) throw new Error("bad status"); return r.json(); })
      .then(function (data) {
        var list = Array.isArray(data) ? data : [];
        if (!list.length) {
          testimonialQuote.innerHTML = '<div class="quote-empty">Testimonials are being collected. Our 10,877+ customers trust us — join them today.</div>';
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

  /* ---------- FAQ accordion (baked items get handlers immediately) ---------- */
  var faqList = $("#faqList");
  function bindFaqHandlers() {
    $$(".faq-q", faqList).forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", function () {
        var item = btn.closest(".faq-item");
        var open = item.classList.toggle("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        var a = btn.nextElementSibling;
        a.style.maxHeight = open ? a.scrollHeight + "px" : "0";
      });
    });
    var first = $(".faq-item.open .faq-a", faqList);
    if (first && !first.style.maxHeight) first.style.maxHeight = first.scrollHeight + "px";
  }
  if (faqList) {
    if (hasBaked(faqList)) {
      bindFaqHandlers();
    } else {
      fetch(API + "/faqs")
        .then(function (r) { if (!r.ok) throw new Error("bad status"); return r.json(); })
        .then(function (data) {
          var list = Array.isArray(data) ? data : [];
          if (!list.length) throw new Error("empty");
          faqList.innerHTML = list.map(function (f, i) {
            return (
              '<div class="faq-item' + (i === 0 ? " open" : "") + '">' +
                '<button class="faq-q" aria-expanded="' + (i === 0 ? "true" : "false") + '">' +
                  "<span>" + esc(f.question) + '</span><span class="icon">+</span>' +
                "</button>" +
                '<div class="faq-a"><div class="faq-a-inner">' + esc(f.answer) + "</div></div>" +
              "</div>"
            );
          }).join("");
          bindFaqHandlers();
        })
        .catch(function () { /* baked FAQ remains */ });
    }
  }

  /* ---------- Features grid (baked cards stay on API failure) ---------- */
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
              "<p>" + esc((f.description || "").split("\n")[0]) + "</p>" +
            "</article>"
          );
        }).join("");
      })
      .catch(function () { /* baked features remain */ });
  }

  /* ---------- Deploy console animation (home hero) ---------- */
  var deployBar = $("#deployBar");
  var deployPct = $("#deployPct");
  var consoleOnline = $("#consoleOnline");
  if (deployBar && deployPct) {
    var pct = 0;
    var timer = setInterval(function () {
      pct = Math.min(100, pct + 3 + Math.floor(Math.random() * 7));
      deployBar.style.width = pct + "%";
      deployPct.textContent = pct + "%";
      if (pct >= 100) {
        clearInterval(timer);
        deployPct.textContent = "✓ deployed in 42s";
        if (consoleOnline) consoleOnline.style.visibility = "visible";
      }
    }, 420);
  }

  fetchUptime();
})();
