"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

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

test("status page documents detailed monitoring windows and privacy", () => {
  const html = fs.readFileSync(path.join(ROOT, "status.html"), "utf8");
  const server = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
  for (const label of ["All services are online", "90-day uptime", "90-day history", "Operational", "servers"]) {
    assert.ok(html.includes(label), `missing ${label}`);
  }
  assert.match(html, /status-summary/);
  assert.match(html, /<b>\d+<\/b> servers/);
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
  assert.match(css, /history-bar\.history-up[\s\S]*var\(--green\)/);
  assert.match(css, /history-bar\.history-degraded[\s\S]*var\(--red\)/);
  assert.match(css, /history-bar\.history-down[\s\S]*var\(--red\)/);
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
  assert.match(fs.readFileSync(path.join(ROOT, "server.js"), "utf8"), /: "no-store";/);
  const main = fs.readFileSync(path.join(ROOT, "js/main.js"), "utf8");
  assert.doesNotMatch(main, /Deploy Now/);
  assert.doesNotMatch(main, /"btn-ghost"/);
  assert.match(main, />Buy Now<\/a>/);
  assert.match(main, /indexOf\(" EU"\) !== -1 \? "eu"/);
});