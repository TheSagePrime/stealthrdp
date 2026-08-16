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

  function isMonitorUp(monitor) {
    var status = monitor && monitor.status;
    return status === "up" || status === 2 || status === "2";
  }

  /* ---------- Micro-interactions (shadcn-grade, no framework) ---------- */
  // Count-up hero stats when they enter the viewport.
  var countUps = $$("[data-count-up]");
  if (countUps.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        var el = entry.target;
        var target = parseFloat(el.getAttribute("data-count-up") || "0");
        var suffix = el.getAttribute("data-suffix") || "";
        var duration = 900;
        var start = performance.now();
        function tick(now) {
          var p = Math.min((now - start) / duration, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          var value = Math.round(target * eased);
          var decimals = (String(target).split(".")[1] || "").length;
          if (decimals) value = (target * eased).toFixed(decimals);
          el.textContent = value.toLocaleString("en-US") + suffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    countUps.forEach(function (el) { io.observe(el); });
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

  /* ---------- Mobile nav ---------- */
  var navToggle = $("#navToggle");
  var mobileNav = $("#mobileNav");
  if (navToggle && mobileNav) {
    navToggle.addEventListener("click", function () {
      var open = mobileNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---------- Theme toggle ---------- */
  (function initThemeToggle() {
    var toggle = $("#themeToggle");
    if (!toggle) return;
    var root = document.documentElement;
    var storageKey = "stealthrdp-preview-theme";
    function sync(theme) {
      var light = theme === "light";
      root.setAttribute("data-theme", light ? "light" : "dark");
      toggle.setAttribute("aria-pressed", light ? "true" : "false");
      toggle.setAttribute("aria-label", light ? "Use dark theme" : "Use light theme");
      toggle.setAttribute("title", light ? "Use dark theme" : "Use light theme");
    }
    sync(root.getAttribute("data-theme") === "light" ? "light" : "dark");
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      sync(next);
      try { window.localStorage.setItem(storageKey, next); } catch (e) {}
    });
  }());

  /* ---------- Preview palette lab ---------- */
  (function initPaletteLab() {
    var lab = $("#paletteLab");
    if (!lab) return;
    var host = window.location.hostname;
    var isPreview = host === "preview.antah.de" || host === "localhost";
    if (!isPreview) {
      if (lab.parentNode) lab.parentNode.removeChild(lab);
      return;
    }
    var trigger = $("#paletteTrigger", lab);
    var panel = $("#palettePanel", lab);
    var currentLabel = $("#paletteCurrent", lab);
    var triggerSwatch = $("#paletteTriggerSwatch", lab);
    var options = $$("[data-palette]", lab);
    var palettes = {
      cobalt: { label: "Cobalt", accent: "#5b8cff" },
      gold: { label: "Gold", accent: "#f5b93b" },
      cyan: { label: "Cyan", accent: "#3dd6d0" },
      violet: { label: "Violet", accent: "#a78bfa" },
      coral: { label: "Coral", accent: "#ff7a66" },
      mint: { label: "Mint", accent: "#4ade80" },
      rose: { label: "Rose", accent: "#f472b6" },
      orange: { label: "Orange", accent: "#ff9f43" },
      indigo: { label: "Indigo", accent: "#818cf8" },
      ice: { label: "Ice", accent: "#7dd3fc" }
    };
    var storageKey = "stealthrdp-preview-palette";
    var current = document.documentElement.getAttribute("data-palette") || "cobalt";
    if (!palettes[current]) current = "cobalt";

    function setPalette(key) {
      if (!palettes[key]) return;
      current = key;
      document.documentElement.setAttribute("data-palette", key);
      try { window.localStorage.setItem(storageKey, key); } catch (e) {}
      var palette = palettes[key];
      if (currentLabel) currentLabel.textContent = palette.label;
      if (triggerSwatch) triggerSwatch.style.setProperty("--swatch", palette.accent);
      options.forEach(function (option) {
        var selected = option.getAttribute("data-palette") === key;
        option.classList.toggle("active", selected);
        option.setAttribute("aria-pressed", selected ? "true" : "false");
      });
    }
    function closePanel() {
      if (!panel) return;
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      lab.classList.remove("open");
    }
    function openPanel() {
      if (!panel) return;
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      lab.classList.add("open");
    }

    setPalette(current);
    if (trigger) {
      trigger.addEventListener("click", function () {
        if (panel.hidden) openPanel(); else closePanel();
      });
    }
    options.forEach(function (option) {
      option.addEventListener("click", function () {
        setPalette(option.getAttribute("data-palette"));
      });
    });
    document.addEventListener("click", function (event) {
      if (!lab.contains(event.target)) closePanel();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && panel && !panel.hidden) {
        closePanel();
        if (trigger) trigger.focus();
      }
    });
  }());

  /* ---------- Live status (footer + status page) ---------- */
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

  function formatDuration(seconds) {
    if (seconds == null || seconds === "" || !Number.isFinite(Number(seconds))) return "—";
    var value = Math.max(0, Math.round(Number(seconds)));
    if (value < 60) return value + "s";
    if (value < 3600) return Math.round(value / 60) + "m";
    if (value < 86400) return (value / 3600).toFixed(1) + "h";
    return (value / 86400).toFixed(1) + "d";
  }
  function formatPercent(value) {
    return value == null || value === "" || !Number.isFinite(Number(value)) ? "—" : Number(value).toFixed(2) + "%";
  }
  function averageMetric(monitors, key) {
    var values = monitors.map(function (monitor) { return monitor[key]; }).filter(function (value) { return value != null && value !== "" && Number.isFinite(Number(value)); }).map(Number);
    if (!values.length) return "—";
    return (values.reduce(function (sum, value) { return sum + value; }, 0) / values.length).toFixed(2) + "%";
  }
  function totalMetric(monitors, key) {
    var values = monitors.map(function (monitor) { return monitor[key]; }).filter(function (value) { return value != null && value !== "" && Number.isFinite(Number(value)); }).map(Number);
    return values.length ? values.reduce(function (sum, value) { return sum + value; }, 0) : null;
  }
  function statusText(status) {
    return { up: "Operational", down: "Down", degraded: "Degraded", paused: "Paused", pending: "Not checked", unknown: "Unknown" }[status] || "Unknown";
  }
  function formatCheckedAt(value) {
    if (!value) return "Snapshot data · live refresh is pending";
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Live data refreshed" : "Live data refreshed " + date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }
  function formatIncident(value) {
    if (!value) return "No recent incident in returned history";
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Recent incident recorded" : "Last incident " + date.toLocaleDateString([], { dateStyle: "medium" });
  }
  function stateClass(status) {
    return ["up", "down", "degraded", "paused", "pending"].indexOf(status) !== -1 ? status : "unknown";
  }

  function setFooterStatusTone(tone) {
    var footerDot = $(".footer-status .dot");
    if (!footerDot) return;
    footerDot.classList.remove("status-healthy", "status-attention", "status-unknown");
    footerDot.classList.add("status-" + tone);
  }

  function fetchUptime() {
    fetch(API + "/uptime", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(function (r) { if (!r.ok) throw new Error("bad status"); return r.json(); })
      .then(function (d) {
        if (!d || d.stat !== "ok" || !Array.isArray(d.monitors) || !d.monitors.length) throw new Error("status unavailable");
        var monitors = (d && d.monitors) || [];
        var up = monitors.filter(isMonitorUp).length;
        var total = monitors.length;
        var msg = total && up === total ? "All systems operational — " + up + "/" + total + " nodes online" : total ? "Service state requires attention — " + up + "/" + total + " nodes online" : "Live status unavailable";
        var footerStatus = $("#footerStatus");
        if (footerStatus) footerStatus.textContent = msg;
        setFooterStatusTone(total && up === total ? "healthy" : "attention");
        var heroNodeStatus = $("#heroNodeStatus");
        if (heroNodeStatus) {
          heroNodeStatus.innerHTML = '<span class="' + (total && up === total ? "live" : "status-failed") + '"></span> ' + up + "/" + total + (total && up === total ? " nodes operational" : " nodes require attention");
          heroNodeStatus.style.color = total && up === total ? "var(--green)" : "var(--red)";
        }
        var sourceNote = $("#statusSourceNote");
        if (sourceNote) sourceNote.textContent = formatCheckedAt(d.checkedAt) + " · IPs and monitoring targets remain private.";
        renderStatusPage(d);
      })
      .catch(function () {
        // The baked snapshot remains, but a failed live call must be visibly distinct.
        var footerStatus = $("#footerStatus");
        if (footerStatus) footerStatus.textContent = "Live status unavailable";
        setFooterStatusTone("unknown");
        var heroNodeStatus = $("#heroNodeStatus");
        if (heroNodeStatus) {
          heroNodeStatus.innerHTML = '<span class="status-failed"></span> Live status unavailable';
          heroNodeStatus.style.color = "var(--red)";
        }
        renderStatusFailure();
      });
  }

  function renderStatusFailure() {
    var summary = $("#statusSummary");
    if (summary) {
      summary.innerHTML =
        '<div class="ss-card"><div class="ss-num warn">—</div><div class="ss-lbl">Live status unavailable</div></div>' +
        '<div class="ss-card"><div class="ss-num warn">—</div><div class="ss-lbl">Current availability</div></div>' +
        '<div class="ss-card"><div class="ss-num warn">—</div><div class="ss-lbl">90-day average</div></div>' +
        '<div class="ss-card"><div class="ss-num warn">—</div><div class="ss-lbl">Incident history</div></div>';
    }
    var sourceNote = $("#statusSourceNote");
    if (sourceNote) {
      sourceNote.textContent = "Live status unavailable · showing the baked uptime snapshot below.";
      sourceNote.classList.add("status-source-note-failure");
      sourceNote.setAttribute("role", "status");
    }
  }

  function renderStatusPage(d) {
    var nodeList = $("#nodeList");
    var summary = $("#statusSummary");
    if (!nodeList && !summary) return;
    var monitors = (d && d.monitors) || [];
    var up = monitors.filter(isMonitorUp).length;
    var activeIncidents = monitors.filter(function (monitor) { return ["down", "degraded"].indexOf(monitor.status) !== -1; }).length;
    var totalDowntime30 = totalMetric(monitors, "downtime30");
    if (summary) {
      summary.innerHTML =
        '<div class="ss-card"><div class="ss-num ' + (up === monitors.length ? "good" : "warn") + '">' + up + "/" + monitors.length + '</div><div class="ss-lbl">Nodes online</div></div>' +
        '<div class="ss-card"><div class="ss-num ' + (up === monitors.length ? "good" : "warn") + '">' + (monitors.length ? Math.round((up / monitors.length) * 100) : 0) + '%</div><div class="ss-lbl">Current availability</div></div>' +
        '<div class="ss-card"><div class="ss-num good">' + averageMetric(monitors, "uptime90") + '</div><div class="ss-lbl">90-day average</div></div>' +
        '<div class="ss-card"><div class="ss-num ' + (activeIncidents ? "warn" : "good") + '">' + (activeIncidents || formatDuration(totalDowntime30)) + '</div><div class="ss-lbl">' + (activeIncidents ? "Active incidents" : "Downtime / 30d") + '</div></div>';
    }
    if (nodeList) {
      nodeList.innerHTML = monitors.map(function (m) {
        var upNow = isMonitorUp(m);
        var status = m.status || (upNow ? "up" : "down");
        var cls = stateClass(status);
        var incidentCount = m.recentIncidents == null ? "—" : String(m.recentIncidents);
        return (
          '<article class="node-card node-' + cls + '">' +
            '<div class="n-left"><span class="n-dot ' + cls + '" aria-hidden="true"></span>' +
            "<div><div class=\"n-name\">" + esc(m.label || "Production node") + "</div>" +
            '<div class="n-target">' + esc(m.region || "Protected infrastructure") + "</div></div></div>" +
            '<div class="n-state"><strong>' + esc(statusText(status)) + '</strong><span>' + esc(formatIncident(m.lastIncidentAt)) + "</span></div>" +
            '<div class="node-metrics" aria-label="Availability history">' +
              '<div class="node-metric"><b>' + formatPercent(m.uptime7) + '</b><small>7-day uptime</small></div>' +
              '<div class="node-metric"><b>' + formatPercent(m.uptime30) + '</b><small>30-day uptime</small></div>' +
              '<div class="node-metric"><b>' + formatPercent(m.uptime90) + '</b><small>90-day uptime</small></div>' +
              '<div class="node-metric"><b>' + formatDuration(m.downtime30) + '</b><small>Downtime / 30d</small></div>' +
              '<div class="node-metric"><b>' + incidentCount + '</b><small>Recent incidents</small></div>' +
            "</div></article>"
          );
      }).join("");
    }
  }

  /* ---------- Homepage plan finder ---------- */
  var USE_CASE_TIERS = {
    "remote-desktop": "Bronze",
    "web-hosting": "Silver",
    "automation": "Gold",
    "trading": "Gold",
    "storage": "Silver",
  };
  var useCaseChips = $$("[data-use-case]");
  var osSelect = $("#osSelect");
  var useCaseSelect = $("#useCaseSelect");
  var finderNote = $("#finderNote");
  function currentTier() {
    if (!useCaseSelect || !USE_CASE_TIERS) return "";
    return USE_CASE_TIERS[useCaseSelect.value] || "";
  }
  function tierLabel(tier) {
    if (!tier) return "";
    return tier + (PLAN_LOCATION === "EU" ? " EU" : " USA");
  }
  function highlightRecommended(tier) {
    if (!planGrid) return;
    var target = tierLabel(tier);
    var cards = $$(".plan-card", planGrid);
    cards.forEach(function (card) {
      var name = (card.querySelector(".p-name") || {}).textContent || "";
      card.classList.toggle("recommended", !!target && name.indexOf(tier) !== -1);
    });
    if (finderNote) {
      if (tier) {
        var os = osSelect ? osSelect.value : "any";
        finderNote.textContent = "Best fit: " + target + " — " + (os === "any" ? "any OS" : os + " OS") + " included on every plan.";
      } else {
        finderNote.textContent = "Every plan supports Windows and Linux. Pick a workload to see the recommended tier.";
      }
    }
  }
  function pickUseCase(key) {
    if (useCaseSelect) useCaseSelect.value = key;
    useCaseChips.forEach(function (chip) {
      var selected = chip.getAttribute("data-use-case") === key;
      chip.classList.toggle("active", selected);
      chip.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    highlightRecommended(USE_CASE_TIERS[key] || "");
    var plansSection = $("#plans");
    if (plansSection) plansSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  useCaseChips.forEach(function (chip) {
    chip.addEventListener("click", function () { pickUseCase(chip.getAttribute("data-use-case")); });
  });
  var useCaseRail = $(".usecase-chips");
  var useCaseRailNext = $(".usecase-rail-next");
  if (useCaseRail && useCaseRailNext) {
    useCaseRailNext.addEventListener("click", function () { useCaseRail.scrollBy({ left: 180, behavior: "smooth" }); });
  }
  if (useCaseSelect) useCaseSelect.addEventListener("change", function () { pickUseCase(useCaseSelect.value); });
  if (osSelect) osSelect.addEventListener("change", function () { highlightRecommended(currentTier()); });

  /* ---------- Plans (baked cards stay; toggles re-render from cache) ---------- */
  var planGrid = $("#planGrid");
  var planRailCue = $(".plan-rail-cue");
  function syncPlanRail() {
    if (!planGrid || !planRailCue || !planGrid.children.length) return;
    var first = planGrid.children[0];
    var gap = parseFloat(getComputedStyle(planGrid).gap) || 0;
    var step = first.getBoundingClientRect().width + gap;
    var index = step ? Math.round(planGrid.scrollLeft / step) : 0;
    var total = planGrid.children.length;
    index = Math.max(0, Math.min(index, total - 1));
    var status = $("#planRailStatus");
    if (status) status.textContent = "Plan " + (index + 1) + " of " + total;
    planRailCue.style.setProperty("--plan-progress", ((index + 1) / total * 100) + "%");
  }
  if (planGrid) planGrid.addEventListener("scroll", syncPlanRail, { passive: true });
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
          '<div class="plan-price"><span class="cur">$' + fmtPrice(price) + '<small>/mo</small></span>' +
          '<span class="was">$' + fmtPrice(base) + "</span></div>" +
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
    syncPlanRail();
    var planGridNote = $("#planGridNote");
    if (planGridNote) planGridNote.textContent = plans.length + " " + PLAN_LOCATION + " plans · " + (currentCycle === "monthly" ? "prices shown monthly" : currentCycle + " discount applied");
    highlightRecommended(currentTier());
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
      $$("button", billingToggle).forEach(function (b) { var selected = b === btn; b.classList.toggle("active", selected); b.setAttribute("aria-selected", selected ? "true" : "false"); });
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
      $$("button", locTabs).forEach(function (b) { var selected = b === btn; b.classList.toggle("active", selected); b.setAttribute("aria-selected", selected ? "true" : "false"); });
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
              '<td class="v">$' + fmtPrice(p.monthlyPrice || 0) + "</td>" +
              '<td><a class="btn btn-sm ' + (p.popular ? "btn-primary" : "btn-ghost") + '" href="' + planUrl(p, "monthly") + '" target="_blank" rel="noopener noreferrer">Deploy</a></td>' +
            "</tr>"
          );
        }).join("");
      })
      .catch(function () { /* baked compare rows remain */ });
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
              '<div class="faq-item' + (i === 0 ? " open" : "") + '" data-faq-category="' + esc(f.category || "General") + '" data-faq-question="' + esc(f.question) + '">' +
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

  /* ---------- FAQ search + topic filters ---------- */
  if (faqList) {
    var faqSearch = $("#faqSearch");
    var faqCategory = $("#faqCategory");
    var faqEmpty = $("#faqEmpty");
    var faqResultsCount = $("#faqResultsCount");
    var faqTopicButtons = $$("[data-faq-topic]");
    function filterFaqs() {
      var query = faqSearch ? faqSearch.value.trim().toLowerCase() : "";
      var category = faqCategory ? faqCategory.value : "all";
      var visible = 0;
      $$(".faq-item", faqList).forEach(function (item) {
        var haystack = ((item.getAttribute("data-faq-question") || "") + " " + (item.querySelector(".faq-a-inner") || {}).textContent || "").toLowerCase();
        var matches = (!query || haystack.indexOf(query) !== -1) && (category === "all" || item.getAttribute("data-faq-category") === category);
        item.hidden = !matches;
        if (matches) visible += 1;
      });
      if (faqResultsCount) faqResultsCount.textContent = visible + " question" + (visible === 1 ? "" : "s");
      if (faqEmpty) faqEmpty.hidden = visible !== 0;
    }
    function setFaqTopic(value) {
      if (faqCategory) faqCategory.value = value;
      faqTopicButtons.forEach(function (button) { button.classList.toggle("active", button.getAttribute("data-faq-topic") === value); });
      filterFaqs();
    }
    if (faqSearch) faqSearch.addEventListener("input", filterFaqs);
    if (faqCategory) faqCategory.addEventListener("change", function () { setFaqTopic(faqCategory.value); });
    faqTopicButtons.forEach(function (button) { button.addEventListener("click", function () { setFaqTopic(button.getAttribute("data-faq-topic")); }); });
    filterFaqs();
  }

  /* ---------- Blog search + topic filters ---------- */
  var blogGrid = $("#blogGrid");
  if (blogGrid) {
    var blogSearch = $("#blogSearch");
    var blogCategory = $("#blogCategory");
    var blogEmpty = $("#blogEmpty");
    var blogResultsCount = $("#blogResultsCount");
    function filterBlog() {
      var query = blogSearch ? blogSearch.value.trim().toLowerCase() : "";
      var category = blogCategory ? blogCategory.value : "all";
      var visible = 0;
      $$(".blog-card", blogGrid).forEach(function (card) {
        var title = card.getAttribute("data-blog-title") || "";
        var text = (title + " " + (card.textContent || "")).toLowerCase();
        var matches = (!query || text.indexOf(query) !== -1) && (category === "all" || card.getAttribute("data-blog-category") === category);
        card.hidden = !matches;
        if (matches) visible += 1;
      });
      if (blogResultsCount) blogResultsCount.textContent = visible + " article" + (visible === 1 ? "" : "s");
      if (blogEmpty) blogEmpty.hidden = visible !== 0;
    }
    if (blogSearch) blogSearch.addEventListener("input", filterBlog);
    if (blogCategory) blogCategory.addEventListener("change", filterBlog);
    var blogTopicButtons = $$("[data-blog-topic]");
    blogTopicButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        if (blogCategory) blogCategory.value = button.getAttribute("data-blog-topic");
        blogTopicButtons.forEach(function (b) { b.classList.toggle("active", b === button); });
        filterBlog();
      });
    });
    filterBlog();
  }

  /* ---------- Static deployment demonstration ---------- */
  // The hero console is intentionally static. It never claims that a server
  // was provisioned and does not simulate progress or completion.

  fetchUptime();
})();
