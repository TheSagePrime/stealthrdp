"use strict";

/**
 * Vercel serverless function: /api/uptime
 *
 * The public status page already exposes the approved monitor set and 90 daily
 * ratios in one request. This adapter reduces that payload to anonymous node
 * labels and removes provider IDs, names, URLs, ports, and raw telemetry.
 */
const https = require("https");

const DAILY_HISTORY_DAYS = 90;
const PUBLIC_STATUS_HOST = "stats.uptimerobot.com";
const PUBLIC_STATUS_PATH = "/api/getMonitorList/yvnV3u7x00?page=1";
const CACHE_MS = 60000;

let cache = { expiresAt: 0, result: null };

function finiteNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function historyState(value) {
  if (!Number.isFinite(Number(value))) return "unknown";
  if (Number(value) >= 99) return "up";
  if (Number(value) >= 95) return "degraded";
  return "down";
}

function publicStatusKind(statusClass) {
  const value = String(statusClass || "").toLowerCase();
  if (value === "success" || value === "up") return "up";
  if (value === "warning" || value === "degraded" || value === "looks_down") return "degraded";
  if (value === "danger" || value === "down") return "down";
  if (value === "black" || value === "paused") return "paused";
  return "unknown";
}

function regionFor(name) {
  const value = String(name || "").toLowerCase();
  if (value.includes("eu") || value.includes("nl")) return "EU / Netherlands";
  if (value.includes("management") || value.includes("portal")) return "Control Panel";
  if (value.includes("website") || value.includes("backend")) return "Website";
  if (value.includes("usa") || value.includes("us")) return "USA";
  return "Production";
}

function nestedRatio(monitor, key) {
  const value = monitor && monitor[key];
  return finiteNumber(value && typeof value === "object" ? value.ratio : value);
}

function dateTimestamp(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  return new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}

function safeHistory(days) {
  if (!Array.isArray(days)) return [];
  return days.slice(-DAILY_HISTORY_DAYS).flatMap((day) => {
    const date = String(day && day.date || "");
    if (dateTimestamp(date) === null) return [];
    const unavailable = String(day.label || "").toLowerCase() === "black"
      || String(day.color || "").toLowerCase() === "grey";
    const uptime = unavailable ? null : finiteNumber(day.ratio);
    return [{
      date,
      ...(uptime === null ? {} : { uptime }),
      state: uptime === null ? "unknown" : historyState(uptime),
    }];
  });
}

function hasCompleteHistory(days) {
  const history = safeHistory(days);
  if (history.length !== DAILY_HISTORY_DAYS) return false;
  const timestamps = history.map((day) => dateTimestamp(day.date));
  if (timestamps.some((value) => value === null)) return false;
  if (timestamps.some((value, index) => index > 0 && value - timestamps[index - 1] !== 86400000)) return false;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.abs(timestamps[timestamps.length - 1] - today) <= 86400000;
}

function safePublicStatusPayload(source) {
  if (!source || source.status !== "ok" || !source.psp || !Array.isArray(source.psp.monitors)) {
    return { stat: "error", checkedAt: null, monitors: [] };
  }

  const sourceMonitors = source.psp.monitors;
  const totalMonitors = finiteNumber(source.psp.totalMonitors);
  if (!sourceMonitors.length
    || (totalMonitors !== null && totalMonitors !== sourceMonitors.length)
    || sourceMonitors.some((monitor) => !monitor || typeof monitor !== "object" || !hasCompleteHistory(monitor.dailyRatios))) {
    return { stat: "error", checkedAt: null, monitors: [] };
  }

  const counters = Object.create(null);
  const monitors = sourceMonitors.map((monitor) => {
    const region = regionFor(monitor && monitor.name);
    counters[region] = (counters[region] || 0) + 1;
    const uptime30 = nestedRatio(monitor, "30dRatio");
    const uptime90 = nestedRatio(monitor, "90dRatio");
    const lastDuration = finiteNumber(monitor && monitor.lastDowntime && monitor.lastDowntime.duration);
    return {
      label: `${region} Node ${String(counters[region]).padStart(2, "0")}`,
      region,
      status: publicStatusKind(monitor && monitor.statusClass),
      uptime7: null,
      uptime30,
      uptime90,
      downtime7: null,
      downtime30: null,
      downtime90: null,
      allTimeUptime: null,
      recentIncidents: null,
      lastIncidentAt: null,
      lastIncidentDuration: lastDuration,
      history90: safeHistory(monitor && monitor.dailyRatios),
    };
  });

  return { stat: "ok", checkedAt: new Date().toISOString(), monitors };
}

function fetchPublicStatus() {
  return new Promise((resolve) => {
    const errorResult = { status: 502, payload: { stat: "error", checkedAt: null, monitors: [] } };
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    let request;
    request = https.get({
      hostname: PUBLIC_STATUS_HOST,
      port: 443,
      path: PUBLIC_STATUS_PATH,
      timeout: 15000,
      headers: { Accept: "application/json", "User-Agent": "StealthRDP-Status/1.0" },
    }, (upstream) => {
      let body = "";
      upstream.on("data", (chunk) => {
        body += chunk;
        if (body.length > 2_000_000) request.destroy(new Error("status payload too large"));
      });
      upstream.on("aborted", () => finish(errorResult));
      upstream.on("error", () => finish(errorResult));
      upstream.on("close", () => {
        if (!upstream.complete) finish(errorResult);
      });
      upstream.on("end", () => {
        if (upstream.statusCode !== 200) {
          finish(errorResult);
          return;
        }
        try {
          const payload = safePublicStatusPayload(JSON.parse(body));
          finish({ status: payload.stat === "ok" ? 200 : 502, payload });
        } catch (_) {
          finish(errorResult);
        }
      });
    });
    request.on("timeout", () => request.destroy(new Error("status request timeout")));
    request.on("error", () => finish(errorResult));
  });
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const now = Date.now();
  if (cache.result && cache.expiresAt > now) {
    return res.status(cache.result.status).json(cache.result.payload);
  }
  const result = await fetchPublicStatus();
  cache = { expiresAt: Date.now() + (result.status === 200 ? CACHE_MS : 10000), result };
  return res.status(result.status).json(result.payload);
}

module.exports = handler;
module.exports.safePublicStatusPayload = safePublicStatusPayload;
module.exports.fetchPublicStatus = fetchPublicStatus;
