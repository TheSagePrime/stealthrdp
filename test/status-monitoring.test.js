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
  for (const label of ["7-day uptime", "30-day uptime", "90-day uptime", "Downtime / 30d", "Recent incidents", "90-day history"]) {
    assert.ok(html.includes(label), `missing ${label}`);
  }
  assert.match(server, /custom_uptime_ratios: "7-30-90"/);
  assert.match(server, /custom_down_durations: "7-30-90"/);
  assert.match(server, /custom_uptime_ranges: DAILY_HISTORY\.query/);
  assert.match(html, /IPs and monitoring targets stay on the server/);
});
