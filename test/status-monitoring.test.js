"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

function historyFixture(overrides = {}) {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: 90 }, (_item, index) => {
    const date = new Date(today - ((89 - index) * 86400000)).toISOString().slice(0, 10);
    return { date, ratio: "100.000", label: "excellent", color: "green", ...(overrides[index] || {}) };
  });
}

function historyWithImpossibleDate() {
  const days = historyFixture();
  const index = days.findIndex((day) => {
    if (!day.date.endsWith("-01")) return false;
    const value = new Date(`${day.date}T00:00:00Z`);
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 0)).getUTCDate() < 31;
  });
  const actual = new Date(`${days[index].date}T00:00:00Z`);
  const previousMonth = new Date(Date.UTC(actual.getUTCFullYear(), actual.getUTCMonth() - 1, 1));
  const previousMonthDays = new Date(Date.UTC(actual.getUTCFullYear(), actual.getUTCMonth(), 0)).getUTCDate();
  const fakeDate = `${previousMonth.getUTCFullYear()}-${String(previousMonth.getUTCMonth() + 1).padStart(2, "0")}-${previousMonthDays + 1}`;
  days[index] = { ...days[index], date: fakeDate };
  return days;
}

function shiftedHistory(offsetDays) {
  return historyFixture().map((day) => ({
    ...day,
    date: new Date(Date.parse(`${day.date}T00:00:00Z`) + (offsetDays * 86400000)).toISOString().slice(0, 10),
  }));
}

function overlongHistory() {
  const days = historyFixture();
  const previousDate = new Date(Date.parse(`${days[0].date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  return [{ ...days[0], date: previousDate }, ...days];
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  return { status: response.status, body: await response.json() };
}

test("uptime proxy exposes rolling aggregates without monitor targets", async () => {
  const port = 19000 + (process.pid % 500);
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: { ...process.env, ALLOW_UPTIME_FIXTURE: "true", UPTIMEROBOT_API_KEY: "", HOST: "127.0.0.1", PORT: String(port) },
    stdio: "ignore",
  });
  try {
    let healthy = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        const response = await getJson(`http://127.0.0.1:${port}/healthz`);
        if (response.status === 200) { healthy = true; break; }
      } catch (_) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    assert.equal(healthy, true);
    const response = await getJson(`http://127.0.0.1:${port}/api/uptime`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.stat, "ok");
    assert.ok(Array.isArray(response.body.monitors));
    assert.deepEqual(Object.keys(response.body.monitors[0]).sort(), [
      "allTimeUptime", "downtime30", "downtime7", "downtime90", "history90", "label", "lastIncidentAt",
      "lastIncidentDuration", "recentIncidents", "region", "status", "uptime30", "uptime7", "uptime90",
    ]);
    for (const monitor of response.body.monitors) {
      for (const forbidden of ["id", "url", "friendly_name", "logs", "port", "average_response_time"]) {
        assert.equal(Object.hasOwn(monitor, forbidden), false, `leaked ${forbidden}`);
      }
    }
  } finally {
    child.kill("SIGTERM");
  }
});

test("Vercel uptime adapter preserves public 90-day history without provider identifiers", () => {
  const uptimeHandler = require(path.join(ROOT, "api", "uptime.js"));
  assert.equal(typeof uptimeHandler.safePublicStatusPayload, "function");

  const source = {
    status: "ok",
    psp: {
      totalMonitors: 1,
      monitors: [{
        monitorId: 123456,
        name: "EU production server 42",
        url: "https://private-origin.example:8443",
        statusClass: "success",
        dailyRatios: historyFixture({
          87: { ratio: "0.000", label: "black", color: "grey" },
          88: { ratio: "97.500", label: "fair", color: "yellow" },
        }),
        "30dRatio": { ratio: "99.500" },
        "90dRatio": { ratio: "99.800" },
        lastDowntime: { date: "2026-08-18 02:00:00", duration: 90, reason: "Incident detected" },
      }],
    },
  };

  const payload = uptimeHandler.safePublicStatusPayload(source);
  assert.equal(payload.stat, "ok");
  assert.equal(payload.monitors.length, 1);
  assert.equal(payload.monitors[0].label, "EU / Netherlands Node 01");
  assert.equal(payload.monitors[0].uptime90, 99.8);
  assert.deepEqual(payload.monitors[0].history90.slice(-3).map((day) => day.state), ["unknown", "degraded", "up"]);
  assert.deepEqual(
    payload.monitors[0].history90.slice(-3).map((day) => day.date),
    source.psp.monitors[0].dailyRatios.slice(-3).map((day) => day.date),
  );
  assert.equal(payload.monitors[0].history90.length, 90);
  assert.deepEqual(Object.keys(payload.monitors[0]).sort(), [
    "allTimeUptime", "downtime30", "downtime7", "downtime90", "history90", "label", "lastIncidentAt",
    "lastIncidentDuration", "recentIncidents", "region", "status", "uptime30", "uptime7", "uptime90",
  ]);
  const serialized = JSON.stringify(payload);
  for (const secret of ["monitorId", "123456", "EU production server 42", "private-origin.example", "8443"]) {
    assert.equal(serialized.includes(secret), false, `leaked ${secret}`);
  }
});

test("Vercel uptime adapter keeps missing values unknown and does not invent downtime", () => {
  const uptimeHandler = require(path.join(ROOT, "api", "uptime.js"));
  const payload = uptimeHandler.safePublicStatusPayload({
    status: "ok",
    psp: {
      totalMonitors: 1,
      monitors: [{
        name: "New USA server",
        statusClass: "success",
        dailyRatios: historyFixture(Object.fromEntries([
          ...Array.from({ length: 87 }, (_item, index) => [index, { ratio: null, label: "black", color: "grey" }]),
          [87, { ratio: null, label: "", color: "" }],
          [88, { ratio: "", label: "black", color: "grey" }],
        ])),
        "30dRatio": { ratio: null },
        "90dRatio": { ratio: "" },
        lastDowntime: null,
      }],
    },
  });

  const monitor = payload.monitors[0];
  assert.equal(monitor.uptime30, null);
  assert.equal(monitor.uptime90, null);
  assert.equal(monitor.downtime30, null);
  assert.equal(monitor.downtime90, null);
  assert.equal(monitor.lastIncidentDuration, null);
  assert.deepEqual(monitor.history90.slice(-3).map((day) => day.state), ["unknown", "unknown", "up"]);
  assert.equal(monitor.history90.length, 90);
  assert.equal("uptime" in monitor.history90[0], false);
});

test("Vercel uptime adapter rejects empty, partial, and malformed status pages", () => {
  const uptimeHandler = require(path.join(ROOT, "api", "uptime.js"));
  const monitor = {
    name: "USA server",
    statusClass: "success",
    dailyRatios: historyFixture(),
    "30dRatio": { ratio: "100" },
    "90dRatio": { ratio: "100" },
  };
  const statusPage = (monitors, totalMonitors = monitors.length) => ({ status: "ok", psp: { monitors, totalMonitors } });
  const payloads = [
    statusPage([]),
    statusPage([null]),
    statusPage([{ ...monitor, dailyRatios: monitor.dailyRatios.slice(1) }]),
    statusPage([{ ...monitor, dailyRatios: monitor.dailyRatios.map((day, index) => index === 45 ? monitor.dailyRatios[44] : day) }]),
    statusPage([{ ...monitor, dailyRatios: historyWithImpossibleDate() }]),
    statusPage([{ ...monitor, dailyRatios: shiftedHistory(-1) }]),
    statusPage([{ ...monitor, dailyRatios: shiftedHistory(1) }]),
    statusPage([{ ...monitor, dailyRatios: overlongHistory() }]),
    statusPage([{ ...monitor, dailyRatios: historyFixture({ 89: { ratio: -1 } }) }]),
    statusPage([{ ...monitor, dailyRatios: historyFixture({ 89: { ratio: 101 } }) }]),
    statusPage([{ ...monitor, dailyRatios: historyFixture({ 89: { ratio: true } }) }]),
    ...[101, -1, "NaN", true, {}, [], "1e2"].map((ratio) => statusPage([{
      ...monitor,
      dailyRatios: historyFixture({ 89: { ratio, label: "black", color: "grey" } }),
    }])),
    statusPage([{ ...monitor, "30dRatio": { ratio: 101 } }]),
    statusPage([monitor], 2),
  ];

  for (const source of payloads) {
    assert.deepEqual(uptimeHandler.safePublicStatusPayload(source), { stat: "error", checkedAt: null, monitors: [] });
  }
});

test("Vercel uptime adapter resolves failed upstream response streams", async () => {
  const https = require("node:https");
  const { EventEmitter } = require("node:events");
  const uptimeHandler = require(path.join(ROOT, "api", "uptime.js"));
  const originalGet = https.get;

  try {
    for (const eventName of ["aborted", "error", "close"]) {
      https.get = (_options, callback) => {
        const request = new EventEmitter();
        request.destroy = (error) => request.emit("error", error);
        process.nextTick(() => {
          const upstream = new EventEmitter();
          upstream.statusCode = 200;
          upstream.complete = false;
          callback(upstream);
          process.nextTick(() => upstream.emit(eventName, eventName === "error" ? new Error("stream failed") : undefined));
        });
        return request;
      };

      const result = await Promise.race([
        uptimeHandler.fetchPublicStatus(),
        new Promise((resolve) => setTimeout(() => resolve({ status: "timeout" }), 100)),
      ]);
      assert.deepEqual(result, { status: 502, payload: { stat: "error", checkedAt: null, monitors: [] } }, eventName);
    }
  } finally {
    https.get = originalGet;
  }
});

test("status page documents detailed monitoring windows and privacy", () => {
  const html = fs.readFileSync(path.join(ROOT, "status.html"), "utf8");
  const server = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
  for (const label of ["All services are online", "90-day uptime", "90-day history", "Operational", "services"]) {
    assert.ok(html.includes(label), `missing ${label}`);
  }
  assert.doesNotMatch(html, /status-summary/);
  assert.doesNotMatch(html, /LIVE STATUS/);
  assert.match(html, /status-meta-row/);
  assert.match(html, /<b>\d+<\/b> services/);
  assert.match(html, /Control Panel Node 01/);
  assert.doesNotMatch(html, /Control plane Node 01/);
  assert.doesNotMatch(html, /Recent incidents|Rolling windows|Incident context|Downtime \/ 30d/);
  assert.match(server, /custom_uptime_ratios: "7-30-90"/);
  assert.match(server, /function durationValues\(monitor\)/);
  assert.doesNotMatch(server, /custom_down_durations: "7-30-90"/);
  assert.match(server, /custom_uptime_ranges: query/);
  assert.match(server, /DAILY_HISTORY_CHUNK_SIZE = 10/);
  assert.match(server, /todayStart}_/);
  assert.match(server, /function refreshDailyHistory/);
  assert.match(server, /const metricsBody = querystring\.stringify/);
  assert.match(server, /const historyBodies = DAILY_HISTORY_QUERIES\.map/);
  const css = fs.readFileSync(path.join(ROOT, "css/style.css"), "utf8");
  assert.match(css, /html\[data-theme="light"\] \.btn-primary/);
  assert.match(css, /background: #07111f/);
  assert.match(css, /html\[data-theme="light"\] \.eyebrow/);
  assert.match(css, /html\[data-theme="light"\] \.billing-toggle button\.active/);
  assert.match(css, /decision-entry \.usecase-chips \.topic-chip\.active/);
  assert.match(css, /history-bar\.history-up[\s\S]*var\(--green\)/);
  assert.match(css, /history-bar\.history-degraded[\s\S]*var\(--orange\)/);
  assert.match(css, /history-bar\.history-down[\s\S]*var\(--red\)/);
  assert.match(server, /Number\(value\) >= 99\) return "up"/);
  assert.match(server, /Number\(value\) >= 95\) return "degraded"/);
  assert.match(server, /safeMonitorSnapshot/);
  assert.match(css, /history-bar:hover::after/);
  assert.match(fs.readFileSync(path.join(ROOT, "build.mjs"), "utf8"), /data-tooltip/);
  assert.match(fs.readFileSync(path.join(ROOT, "js/main.js"), "utf8"), /formatHistoryDate/);
  const build = fs.readFileSync(path.join(ROOT, "build.mjs"), "utf8");
  assert.match(build, /const category = p\.name\.endsWith\(" EU"\) \? "eu"/);
  assert.match(build, /category \+ "\/" \+ slug/);
  assert.match(build, /rp=\/store\/standard-usa-rdp-vps/);
  assert.match(build, /rp=\/store\/build-your-own-rdp-vps/);
  assert.doesNotMatch(build, /cart\.php\?a=view/);
  assert.doesNotMatch(build, /store-category-links/);
  assert.doesNotMatch(build, /class=\\"btn \$\{isPop \? \\"btn-primary\\" : \\"btn-ghost\\"\}/);
  assert.doesNotMatch(build, /class=\\"btn btn-sm \$\{p\.popular \? \\"btn-primary\\" : \\"btn-ghost\\"\}/);
  assert.match(build, />Buy Now<\/a>/);
  assert.doesNotMatch(build, />Deploy Now<\/a>/);
  assert.match(build, /€\$\{fmt\(price\)\}/);
  assert.doesNotMatch(build, /<span class="cur">\$/);
  assert.match(fs.readFileSync(path.join(ROOT, "server.js"), "utf8"), /: "no-store";/);
  const main = fs.readFileSync(path.join(ROOT, "js/main.js"), "utf8");
  assert.match(main, /cur">€'/);
  assert.doesNotMatch(main, /Deploy Now/);
  assert.match(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"), /vercel-build/);
  assert.match(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"), /"outputDirectory": "public"/);
  assert.match(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"), /stage-vercel-public/);
  const stageScript = fs.readFileSync(path.join(ROOT, "scripts/stage-vercel-public.mjs"), "utf8");
  assert.match(stageScript, /const dirs = \[.*"fonts"/);
  const uptimeFn = fs.readFileSync(path.join(ROOT, "api/uptime.js"), "utf8");
  assert.match(uptimeFn, /stats\.uptimerobot\.com/);
  assert.match(uptimeFn, /getMonitorList/);
  assert.doesNotMatch(uptimeFn, /UPTIMEROBOT_API_KEY|custom_uptime_ranges/);
  assert.doesNotMatch(uptimeFn, /monitor\.url|monitorId/);
  assert.match(uptimeFn, /if \(number >= 99\) return "up"/);
  assert.match(uptimeFn, /if \(number >= 95\) return "degraded"/);
  assert.match(uptimeFn, /number >= 0 && number <= 100/);
  assert.match(fs.readFileSync(path.join(ROOT, "scripts/bake-base.mjs"), "utf8"), /__SRDP_BASE__/);
  assert.doesNotMatch(main, /"btn-ghost"/);
  assert.match(main, />Buy Now<\/a>/);
  assert.match(main, /indexOf\(" EU"\) !== -1 \? "eu"/);
});