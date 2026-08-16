/* StealthRDP v2 — self-contained production server
   Serves the SEO-prerendered static site, reads public CMS data from the
   repository, and fetches UptimeRobot data server-side with redaction. */
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const querystring = require("querystring");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "127.0.0.1";
const UPTIME_API_KEY = process.env.UPTIMEROBOT_API_KEY || "";
const ALLOW_UPTIME_FIXTURE = process.env.ALLOW_UPTIME_FIXTURE === "true";
const UPTIME_CACHE_MS = 60 * 1000;
const DAILY_HISTORY_DAYS = 90;
let uptimeCache = { expiresAt: 0, result: null };
let uptimeInFlight = null;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".json": "application/json",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

function originFor(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host || "localhost:" + PORT;
  return proto + "://" + host;
}

function resolveTokens(body, origin) {
  return body.split("__SRDP_BASE__").join(origin);
}

function sendJson(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...SECURITY_HEADERS,
  });
  res.end(JSON.stringify(value));
}

function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
  } catch (_) {
    return fallback;
  }
}

function isUpStatus(status) {
  return status === "up" || status === 2 || status === "2";
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

const DAILY_HISTORY_CHUNK_SIZE = 10;
function chunkDailyRanges(query) {
  return query.split("-").reduce((chunks, range, index) => {
    const chunkIndex = Math.floor(index / DAILY_HISTORY_CHUNK_SIZE);
    chunks[chunkIndex] = chunks[chunkIndex] ? `${chunks[chunkIndex]}-${range}` : range;
    return chunks;
  }, []);
}
let DAILY_HISTORY = dailyHistoryRanges(DAILY_HISTORY_DAYS);
let DAILY_HISTORY_QUERIES = chunkDailyRanges(DAILY_HISTORY.query);

function refreshDailyHistory() {
  DAILY_HISTORY = dailyHistoryRanges(DAILY_HISTORY_DAYS);
  DAILY_HISTORY_QUERIES = chunkDailyRanges(DAILY_HISTORY.query);
}

function historyState(value) {
  if (!Number.isFinite(Number(value))) return "unknown";
  if (Number(value) >= 99) return "up";
  if (Number(value) >= 95) return "degraded";
  return "down";
}

function dailyHistorySnapshot(values, offset = 0) {
  return numberList(values).slice(0, DAILY_HISTORY_CHUNK_SIZE).map((uptime, index) => ({
    date: DAILY_HISTORY.dates[offset + index] || null,
    uptime,
    state: historyState(uptime),
  })).filter((item) => item.date);
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

function safePlan(plan) {
  return {
    name: String(plan.name || ""),
    description: String(plan.description || ""),
    monthlyPrice: Number.isFinite(Number(plan.monthlyPrice)) ? Number(plan.monthlyPrice) : 0,
    location: String(plan.location || ""),
    popular: Boolean(plan.popular),
    specs: {
      cpu: String(plan.specs && plan.specs.cpu || ""),
      ram: String(plan.specs && plan.specs.ram || ""),
      storage: String(plan.specs && plan.specs.storage || ""),
      bandwidth: String(plan.specs && plan.specs.bandwidth || ""),
    },
    billingOptions: plan.billingOptions || {},
  };
}

function localApi(pathname, url) {
  if (pathname === "/api/plans") {
    const location = String(url.searchParams.get("location") || "USA").toLowerCase() === "eu" ? "EU" : "USA";
    const file = location === "EU" ? "plans_eu.json" : "plans_usa.json";
    const data = readJson(file, []);
    return Array.isArray(data) ? data.map(safePlan) : [];
  }
  if (pathname === "/api/features") {
    const data = readJson("features.json", []);
    return Array.isArray(data) ? data.map((item) => ({
      title: String(item.title || ""),
      description: String(item.description || ""),
      iconName: String(item.iconName || "Server"),
      category: String(item.category || ""),
      displayOrder: Number(item.displayOrder || 0),
    })) : [];
  }
  if (pathname === "/api/faqs") {
    const data = readJson("faqs.json", []);
    return Array.isArray(data) ? data.filter((item) => item.isPublished !== false).map((item) => ({
      question: String(item.question || ""),
      answer: String(item.answer || ""),
      category: String(item.category || ""),
      displayOrder: Number(item.displayOrder || 0),
    })) : [];
  }
  if (pathname === "/api/testimonials") {
    const data = readJson("testimonials.json", []);
    return Array.isArray(data) ? data.map((item) => ({
      quote: String(item.quote || ""),
      authorName: String(item.authorName || ""),
      authorPosition: String(item.authorPosition || ""),
      authorCompany: String(item.authorCompany || ""),
      avatarUrl: String(item.avatarUrl || ""),
    })) : [];
  }
  return null;
}

function safeMonitorSnapshot(monitor, index) {
  const ratios = ratioValues(monitor);
  const durations = durationValues(monitor);
  return {
    label: /^\d{1,3}(?:\.\d{1,3}){3}/.test(String(monitor.label || "")) ? "Protected node " + String(index + 1).padStart(2, "0") : String(monitor.label || "Protected node " + String(index + 1).padStart(2, "0")),
    region: String(monitor.region || "Production"),
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

function fallbackUptimePayload() {
  const source = readJson("uptime.json", { stat: "error", monitors: [] });
  const monitors = Array.isArray(source.monitors) ? source.monitors.map(safeMonitorSnapshot) : [];
  return { stat: source.stat === "ok" ? "ok" : "error", checkedAt: null, monitors };
}

function safeUptimePayload(body, options = {}) {
  let source;
  try {
    source = JSON.parse(body);
  } catch (_) {
    return { stat: "error", checkedAt: null, monitors: [] };
  }

  const counters = Object.create(null);
  function regionFor(name) {
    const value = String(name || "").toLowerCase();
    if (value.includes("eu") || value.includes("nl")) return "EU / Netherlands";
    if (value.includes("management") || value.includes("portal")) return "Control plane";
    if (value.includes("website") || value.includes("backend")) return "Website";
    if (value.includes("usa") || value.includes("us")) return "USA";
    return "Production";
  }

  const monitors = Array.isArray(source.monitors) ? source.monitors.map((monitor) => {
    const region = regionFor(monitor.friendly_name);
    counters[region] = (counters[region] || 0) + 1;
    const allTime = numberList(monitor.all_time_uptime_ratio);
    const incidents = safeIncidentSummary(monitor.logs);
    const historyValues = monitor.custom_uptime_ranges || monitor.custom_uptime_ratio || monitor.custom_uptime_ratios;
    const history90 = options.includeHistory ? dailyHistorySnapshot(historyValues, options.historyOffset || 0) : null;
    return safeMonitorSnapshot({
      label: region + " Node " + String(counters[region]).padStart(2, "0"),
      region,
      status: monitor.status,
      custom_uptime_ratio: monitor.custom_uptime_ratio || monitor.custom_uptime_ratios,
      custom_down_durations: monitor.custom_down_durations,
      allTimeUptime: allTime.length ? allTime[0] : null,
      recentIncidents: incidents.recentIncidents,
      lastIncidentAt: incidents.lastIncidentAt,
      lastIncidentDuration: incidents.lastIncidentDuration,
      history90,
    });
  }) : [];

  return { stat: source.stat === "ok" ? "ok" : "error", checkedAt: source.stat === "ok" ? new Date().toISOString() : null, monitors };
}

function requestUptime(body, options = {}) {
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
      upstream.on("end", () => {
        const payload = safeUptimePayload(responseBody, options);
        resolve({
          status: upstream.statusCode === 200 && payload.stat === "ok" ? 200 : 502,
          payload,
        });
      });
    });
    request.on("timeout", () => request.destroy(new Error("uptime request timeout")));
    request.on("error", () => resolve({ status: 502, payload: { stat: "error", checkedAt: null, monitors: [] } }));
    request.write(body);
    request.end();
  });
}

function loadUptime() {
  refreshDailyHistory();
  if (!UPTIME_API_KEY) {
    return Promise.resolve({
      status: ALLOW_UPTIME_FIXTURE ? 200 : 503,
      payload: ALLOW_UPTIME_FIXTURE ? fallbackUptimePayload() : { stat: "error", checkedAt: null, monitors: [] },
    });
  }

  const metricsBody = querystring.stringify({
    api_key: UPTIME_API_KEY,
    format: "json",
    custom_uptime_ratios: "7-30-90",
    all_time_uptime_ratio: "1",
    logs: "1",
    logs_limit: "20",
  });
  const historyBodies = DAILY_HISTORY_QUERIES.map((query) => querystring.stringify({
    api_key: UPTIME_API_KEY,
    format: "json",
    custom_uptime_ranges: query,
  }));

  return Promise.all([
    requestUptime(metricsBody),
    ...historyBodies.map((body, index) => requestUptime(body, {
      includeHistory: true,
      historyOffset: index * DAILY_HISTORY_CHUNK_SIZE,
    })),
  ]).then(([metrics, ...histories]) => {
    if (metrics.status !== 200 || metrics.payload.stat !== "ok") return metrics;
    if (histories.some((history) => history.status !== 200 || history.payload.stat !== "ok")) return metrics;
    const historyByMonitor = metrics.payload.monitors.map((_, monitorIndex) => histories.flatMap((history) => history.payload.monitors[monitorIndex]?.history90 || []).slice(0, DAILY_HISTORY_DAYS));
    return {
      status: 200,
      payload: {
        ...metrics.payload,
        monitors: metrics.payload.monitors.map((monitor, index) => ({
          ...monitor,
          history90: historyByMonitor[index] || [],
        })),
      },
    };
  });
}

function fetchUptime(res) {
  const now = Date.now();
  if (uptimeCache.result && uptimeCache.expiresAt > now) {
    return sendJson(res, uptimeCache.result.status, uptimeCache.result.payload);
  }
  if (!uptimeInFlight) {
    uptimeInFlight = loadUptime().then((result) => {
      if (result.status === 200 && result.payload.stat === "ok") {
        uptimeCache = { expiresAt: Date.now() + UPTIME_CACHE_MS, result };
      }
      return result;
    }).finally(() => { uptimeInFlight = null; });
  }
  uptimeInFlight.then((result) => sendJson(res, result.status, result.payload));
}

function handleApi(req, res, url) {
  if (url.pathname === "/api/uptime") {
    return fetchUptime(res);
  }
  const data = localApi(url.pathname, url);
  if (data === null) return sendJson(res, 404, { error: "not found" });
  return sendJson(res, 200, data);
}

const BLOCKED = ["/data/", "/backups/", "/node_modules/", "/build.mjs", "/server.js", "/package.json", "/Dockerfile", "/.git/", "/og-cover.html"];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost:" + PORT);
  const origin = originFor(req);

  if (url.pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json", ...SECURITY_HEADERS });
    res.end('{"status":"ok"}');
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url);
    return;
  }

  if (url.pathname === "/blog-post.html") {
    const slug = url.searchParams.get("slug");
    const target = slug ? "/blog/" + slug + ".html" : "/blog.html";
    res.writeHead(301, { Location: target, ...SECURITY_HEADERS });
    res.end();
    return;
  }

  if (url.pathname === "/features.html") {
    res.writeHead(301, { Location: "/#why", ...SECURITY_HEADERS });
    res.end();
    return;
  }

  if (BLOCKED.some((item) => url.pathname.startsWith(item) || url.pathname === item.slice(0, -1))) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
    res.end("Not found");
    return;
  }

  const filePath = path.normalize(path.join(ROOT, url.pathname === "/" ? "index.html" : url.pathname));
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    res.writeHead(403, { "Content-Type": "text/plain", ...SECURITY_HEADERS });
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const isMarkup = ext === ".html" || ext === ".xml" || ext === ".txt";
    const cacheControl = ext === ".woff2" || ext === ".png" || ext === ".svg" || ext === ".webp" || ext === ".avif"
      ? "public, max-age=604800"
      : ext === ".css" || ext === ".js"
        ? "public, max-age=3600"
        : "no-store";
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": cacheControl,
      ...SECURITY_HEADERS,
    });
    res.end(isMarkup ? resolveTokens(data.toString(), origin) : data);
  });
});

server.listen(PORT, HOST, () => console.log("stealthrdp server listening on " + HOST + ":" + PORT));
