/**
 * Vercel serverless function: /api/uptime
 *
 * Mirrors the server-side proxy in server.js so the public status page can
 * refresh live data on Vercel. The UptimeRobot API key is read ONLY from the
 * process environment (Vercel env var UPTIMEROBOT_API_KEY). Raw monitoring
 * payloads are never passed through: IPs, hostnames, monitor IDs, ports, and
 * response telemetry are stripped before the response is sent.
 */
const https = require("https");

const DAILY_HISTORY_DAYS = 90;
const DAILY_HISTORY_CHUNK_SIZE = 10;

let cache = { expiresAt: 0, result: null };

function numberList(value) {
  if (Array.isArray(value)) return value.flatMap((item) => numberList(item));
  const raw = String(value == null ? "" : value);
  if (!raw) return [];
  return raw.split(/[-,]/).map((item) => {
    const number = Number.parseFloat(item);
    return Number.isFinite(number) ? number : null;
  });
}

function dailyHistoryRanges(days) {
  const dates = [];
  const ranges = [];
  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000;
  for (let offset = days - 2; offset >= 0; offset -= 1) {
    const end = todayStart - (offset * 86400);
    const start = end - 86400;
    dates.push(new Date(start * 1000).toISOString().slice(0, 10));
    ranges.push(`${start}_${end}`);
  }
  const nowSeconds = Math.floor(now.getTime() / 1000);
  dates.push(new Date(todayStart * 1000).toISOString().slice(0, 10));
  ranges.push(`${todayStart}_${nowSeconds}`);
  return { dates, query: ranges.join("-") };
}

function chunkDailyRanges(query) {
  return query.split("-").reduce((chunks, range, index) => {
    const chunkIndex = Math.floor(index / DAILY_HISTORY_CHUNK_SIZE);
    chunks[chunkIndex] = chunks[chunkIndex] ? `${chunks[chunkIndex]}-${range}` : range;
    return chunks;
  }, []);
}

function historyState(value) {
  if (!Number.isFinite(Number(value))) return "unknown";
  if (Number(value) >= 99) return "up";
  if (Number(value) >= 95) return "degraded";
  return "down";
}

function statusKind(status) {
  const value = Number(status);
  if (value === 2 || status === "up") return "up";
  if (value === 0 || status === "paused") return "paused";
  if (value === 1 || status === "not_checked") return "pending";
  if (value === 8) return "degraded";
  if (value === 9 || status === "down") return "down";
  return "unknown";
}

function ratioValues(monitor) {
  return numberList(monitor.custom_uptime_ratio || monitor.custom_uptime_ratios);
}

function durationValues(monitor) {
  const explicit = numberList(monitor.custom_down_durations);
  if (explicit.some((value) => value !== null)) return explicit;
  return ratioValues(monitor).map((ratio, index) => {
    if (ratio === null) return null;
    const days = [7, 30, 90][index];
    return Math.round(days * 86400 * Math.max(0, 1 - (ratio / 100)));
  });
}

function safeIncidentSummary(logs) {
  const incidents = Array.isArray(logs) ? logs.filter((log) => Number(log && log.type) === 1) : [];
  const sorted = incidents.slice().sort((a, b) => Number(b.datetime || 0) - Number(a.datetime || 0));
  const latest = sorted[0];
  return {
    recentIncidents: incidents.length,
    lastIncidentAt: latest && Number.isFinite(Number(latest.datetime)) ? new Date(Number(latest.datetime) * 1000).toISOString() : null,
    lastIncidentDuration: latest && Number.isFinite(Number(latest.duration)) ? Number(latest.duration) : null,
  };
}

function dailyHistorySnapshot(values, offset, dates) {
  return numberList(values).slice(0, DAILY_HISTORY_CHUNK_SIZE).map((uptime, index) => ({
    date: dates[offset + index] || null,
    uptime,
    state: historyState(uptime),
  })).filter((item) => item.date);
}

function safeMonitorSnapshot(monitor, index, region) {
  const ratios = ratioValues(monitor);
  const durations = durationValues(monitor);
  return {
    label: region + " Node " + String(index + 1).padStart(2, "0"),
    region,
    status: statusKind(monitor.status),
    uptime7: Number.isFinite(ratios[0]) ? ratios[0] : null,
    uptime30: Number.isFinite(ratios[1]) ? ratios[1] : null,
    uptime90: Number.isFinite(ratios[2]) ? ratios[2] : (Number.isFinite(Number(monitor.uptimeRatio)) ? Number(monitor.uptimeRatio) : null),
    downtime7: Number.isFinite(durations[0]) ? durations[0] : null,
    downtime30: Number.isFinite(durations[1]) ? durations[1] : null,
    downtime90: Number.isFinite(durations[2]) ? durations[2] : null,
    allTimeUptime: monitor.allTimeUptime == null ? null : (Number.isFinite(Number(monitor.allTimeUptime)) ? Number(monitor.allTimeUptime) : null),
    recentIncidents: monitor.recentIncidents == null ? null : (Number.isFinite(Number(monitor.recentIncidents)) ? Number(monitor.recentIncidents) : null),
    lastIncidentAt: monitor.lastIncidentAt || null,
    lastIncidentDuration: monitor.lastIncidentDuration == null ? null : (Number.isFinite(Number(monitor.lastIncidentDuration)) ? Number(monitor.lastIncidentDuration) : null),
    history90: Array.isArray(monitor.history90) ? monitor.history90.slice(0, DAILY_HISTORY_DAYS) : [],
  };
}

function regionFor(name) {
  const value = String(name || "").toLowerCase();
  if (value.includes("eu") || value.includes("nl")) return "EU / Netherlands";
  if (value.includes("management") || value.includes("portal")) return "Control plane";
  if (value.includes("website") || value.includes("backend")) return "Website";
  if (value.includes("usa") || value.includes("us")) return "USA";
  return "Production";
}

function postForm(body) {
  return new Promise((resolve) => {
    const request = https.request({
      hostname: "api.uptimerobot.com",
      port: 443,
      path: "/v2/getMonitors",
      method: "POST",
      timeout: 15000,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
        Accept: "application/json",
      },
    }, (upstream) => {
      let responseBody = "";
      upstream.on("data", (chunk) => { responseBody += chunk; });
      upstream.on("end", () => resolve({ status: upstream.statusCode, body: responseBody }));
    });
    request.on("timeout", () => request.destroy(new Error("uptime request timeout")));
    request.on("error", () => resolve({ status: 502, body: "" }));
    request.write(body);
    request.end();
  });
}

function safeUptimePayload(source, dates, regionCounters) {
  const monitors = Array.isArray(source.monitors) ? source.monitors.map((monitor, index) => {
    const region = regionFor(monitor.friendly_name);
    regionCounters[region] = (regionCounters[region] || 0) + 1;
    const allTime = numberList(monitor.all_time_uptime_ratio);
    const incidents = safeIncidentSummary(monitor.logs);
    return safeMonitorSnapshot({
      region,
      status: monitor.status,
      custom_uptime_ratio: monitor.custom_uptime_ratio || monitor.custom_uptime_ratios,
      custom_down_durations: monitor.custom_down_durations,
      allTimeUptime: allTime.length ? allTime[0] : null,
      recentIncidents: incidents.recentIncidents,
      lastIncidentAt: incidents.lastIncidentAt,
      lastIncidentDuration: incidents.lastIncidentDuration,
      history90: [],
    }, regionCounters[region] - 1, region);
  }) : [];
  return { stat: source.stat === "ok" ? "ok" : "error", checkedAt: source.stat === "ok" ? new Date().toISOString() : null, monitors };
}

async function loadUptime() {
  const apiKey = process.env.UPTIMEROBOT_API_KEY || "";
  if (!apiKey) {
    return { status: 503, payload: { stat: "error", checkedAt: null, monitors: [] } };
  }
  const history = dailyHistoryRanges(DAILY_HISTORY_DAYS);
  const queries = chunkDailyRanges(history.query);
  const qs = (params) => Object.keys(params).map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join("&");
  const metricsBody = qs({
    api_key: apiKey, format: "json",
    custom_uptime_ratios: "7-30-90", all_time_uptime_ratio: "1", logs: "1", logs_limit: "20",
  });
  const historyBodies = queries.map((query) => qs({ api_key: apiKey, format: "json", custom_uptime_ranges: query }));

  const responses = await Promise.all([postForm(metricsBody), ...historyBodies.map((body) => postForm(body))]);
  const parse = (res) => {
    try { return { status: res.status, payload: JSON.parse(res.body) }; } catch (_) { return { status: res.status, payload: null }; }
  };
  const parsed = responses.map(parse);
  const metrics = parsed[0];
  const histories = parsed.slice(1);
  if (metrics.status !== 200 || !metrics.payload || metrics.payload.stat !== "ok") {
    return { status: metrics.status === 200 ? 502 : metrics.status, payload: { stat: "error", checkedAt: null, monitors: [] } };
  }
  if (histories.some((h) => h.status !== 200 || !h.payload || h.payload.stat !== "ok")) {
    const regionCounters = Object.create(null);
    return { status: 200, payload: safeUptimePayload(metrics.payload, history.dates, regionCounters) };
  }
  const regionCounters = Object.create(null);
  const payload = safeUptimePayload(metrics.payload, history.dates, regionCounters);
  const historyByMonitor = payload.monitors.map((_, monitorIndex) => histories.flatMap((h) => {
    const mon = h.payload.monitors && h.payload.monitors[monitorIndex];
    return mon && Array.isArray(mon.custom_uptime_ranges) ? numberList(mon.custom_uptime_ranges) : [];
  }).slice(0, DAILY_HISTORY_DAYS));
  payload.monitors = payload.monitors.map((monitor, index) => {
    const h = historyByMonitor[index] || [];
    return { ...monitor, history90: h.map((uptime, i) => ({ date: history.dates[i] || null, uptime, state: historyState(uptime) })).filter((item) => item.date) };
  });
  return { status: 200, payload };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const now = Date.now();
  if (cache.result && cache.expiresAt > now) {
    return res.status(cache.result.status).json(cache.result.payload);
  }
  try {
    const result = await loadUptime();
    cache = { expiresAt: Date.now() + 60000, result };
    return res.status(result.status).json(result.payload);
  } catch (_) {
    return res.status(502).json({ stat: "error", checkedAt: null, monitors: [] });
  }
};
