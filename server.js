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
const ALLOW_UPTIME_FIXTURE = process.env.ALLOW_UPTIME_FIXTURE === "true" || process.env.NODE_ENV !== "production";

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

function fallbackUptimePayload() {
  const source = readJson("uptime.json", { stat: "error", monitors: [] });
  const monitors = Array.isArray(source.monitors) ? source.monitors.map((monitor, index) => ({
    label: /^\d{1,3}(?:\.\d{1,3}){3}/.test(String(monitor.label || "")) ? "Protected node " + String(index + 1).padStart(2, "0") : String(monitor.label || "Protected node " + String(index + 1).padStart(2, "0")),
    region: String(monitor.region || "Production"),
    status: monitor.status === "up" ? "up" : "down",
    uptimeRatio: Number.isFinite(Number(monitor.uptimeRatio)) ? Number(monitor.uptimeRatio) : null,
  })) : [];
  return { stat: source.stat === "ok" ? "ok" : "error", monitors };
}

function safeUptimePayload(body) {
  let source;
  try {
    source = JSON.parse(body);
  } catch (_) {
    return { stat: "error", monitors: [] };
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
    const ratios = String(monitor.custom_uptime_ratio || "").split("-").filter(Boolean);
    const uptimeRatio = ratios.length ? Number.parseFloat(ratios[ratios.length - 1]) : null;
    return {
      label: region + " Node " + String(counters[region]).padStart(2, "0"),
      region,
      status: monitor.status === 2 || monitor.status === "2" ? "up" : "down",
      uptimeRatio: Number.isFinite(uptimeRatio) ? uptimeRatio : null,
    };
  }) : [];

  return { stat: source.stat === "ok" ? "ok" : "error", monitors };
}

function fetchUptime(res) {
  if (!UPTIME_API_KEY) {
    if (ALLOW_UPTIME_FIXTURE) return sendJson(res, 200, fallbackUptimePayload());
    return sendJson(res, 503, { stat: "error", monitors: [] });
  }

  const body = querystring.stringify({
    api_key: UPTIME_API_KEY,
    format: "json",
    custom_uptime_ratios: "90",
  });
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
      const payload = safeUptimePayload(responseBody);
      sendJson(res, upstream.statusCode === 200 ? 200 : 502, payload);
    });
  });
  request.on("timeout", () => request.destroy(new Error("uptime request timeout")));
  request.on("error", () => sendJson(res, 502, { stat: "error", monitors: [] }));
  request.write(body);
  request.end();
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
        : "no-cache";
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": cacheControl,
      ...SECURITY_HEADERS,
    });
    res.end(isMarkup ? resolveTokens(data.toString(), origin) : data);
  });
});

server.listen(PORT, HOST, () => console.log("stealthrdp server listening on " + HOST + ":" + PORT));
