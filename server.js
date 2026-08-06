/* StealthRDP v2 — production server
   Serves the SEO-prerendered static site, resolves the __SRDP_BASE__ token to
   the request origin (host-correct canonical/OG/sitemap on any domain), proxies
   /api/* to the Railway CMS API, and adds security headers. */
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const UPSTREAM = "web-production-40fb0.up.railway.app";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

/* ---------- request origin (behind proxies) ---------- */
function originFor(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host || "localhost:" + PORT;
  return proto + "://" + host;
}

function resolveTokens(body, origin) {
  return body.split("__SRDP_BASE__").join(origin);
}

/* ---------- API proxy (same-origin so the site needs no CORS) ---------- */
function proxyApi(req, res, url) {
  const opts = {
    hostname: UPSTREAM,
    port: 443,
    path: url.pathname + url.search,
    method: req.method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
  };
  const upstream = https.request(opts, (up) => {
    let body = "";
    up.on("data", (c) => (body += c));
    up.on("end", () => {
      res.writeHead(up.statusCode || 502, {
        "Content-Type": up.headers["content-type"] || "application/json",
        "Cache-Control": "no-store",
      });
      res.end(body);
    });
  });
  upstream.on("error", () => {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end('{"error":"proxy upstream failed"}');
  });
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => { upstream.write(body); upstream.end(); });
  } else {
    upstream.end();
  }
}

/* ---------- static + routing ---------- */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost:" + PORT);
  const origin = originFor(req);
  const securityHeaders = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };

  if (url.pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json", ...securityHeaders });
    res.end('{"status":"ok"}');
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    proxyApi(req, res, url);
    return;
  }

  // Legacy JS blog URL → clean static article page
  if (url.pathname === "/blog-post.html") {
    const slug = url.searchParams.get("slug");
    const target = slug ? "/blog/" + slug + ".html" : "/blog.html";
    res.writeHead(301, { Location: target, ...securityHeaders });
    res.end();
    return;
  }

  // Non-public paths: build sources, data snapshots, server internals → 404
  const BLOCKED = ["/data/", "/build.mjs", "/server.js", "/package.json", "/Dockerfile", "/.git/", "/og-cover.html"];
  if (BLOCKED.some((p) => url.pathname.startsWith(p) || url.pathname === p.slice(0, -1))) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...securityHeaders });
    res.end("Not found");
    return;
  }

  let filePath = path.normalize(path.join(ROOT, url.pathname === "/" ? "index.html" : url.pathname));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain", ...securityHeaders });
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...securityHeaders });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const isMarkup = ext === ".html" || ext === ".xml" || ext === ".txt";
    const cacheControl = ext === ".woff2" || ext === ".png" || ext === ".svg"
      ? "public, max-age=604800"
      : ext === ".css" || ext === ".js"
        ? "public, max-age=3600"
        : "no-cache";
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": cacheControl,
      ...securityHeaders,
    });
    res.end(isMarkup ? resolveTokens(data.toString(), origin) : data);
  });
});

server.listen(PORT, "0.0.0.0", () => console.log("stealthrdp server listening on :" + PORT));
