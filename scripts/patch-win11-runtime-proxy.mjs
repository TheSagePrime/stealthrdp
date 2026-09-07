#!/usr/bin/env node
import fs from 'fs';

const file = 'server.js';
let source = fs.readFileSync(file, 'utf8');

if (source.includes('function proxyWin11Demo(')) {
  console.log('patch-win11-runtime-proxy: already applied');
  process.exit(0);
}

const marker = 'function originFor(req) {';
const insert = String.raw`
const WIN11_UPSTREAM_HOST = "win11.blueedge.me";

function rewriteWin11Text(text) {
  return String(text)
    .replaceAll('/static/', '/win11-demo/static/')
    .replaceAll('/img/', '/win11-demo/img/')
    .replaceAll('/manifest.json', '/win11-demo/manifest.json')
    .replaceAll('/favicon.ico', '/win11-demo/favicon.ico')
    .replaceAll('mailto:blueedgetechno@gmail.com', 'https://stealthrdp.com')
    .replaceAll('blueedgetechno@gmail.com', 'StealthRDP')
    .replaceAll('https://pinterest.com/blue_edge', 'https://stealthrdp.com')
    .replaceAll('https://open.spotify.com/user/62axxw0etmycj09el078cock0', 'https://stealthrdp.com')
    .replaceAll('https://twitter.com/blueedgetechno', 'https://stealthrdp.com')
    .replaceAll('https://github.com/blueedgetechno/windows11', 'https://stealthrdp.com')
    .replaceAll('https://github.com/yyqyu/win11', 'https://stealthrdp.com')
    .replaceAll('https://blueedge.me/unescape', 'https://stealthrdp.com')
    .replaceAll('https://discord.gg/Fz3Dkc4S', 'https://stealthrdp.com')
    .replaceAll('https://discord.gg/PS8rU3t3', 'https://stealthrdp.com')
    .replaceAll('blueedgetechno', 'StealthRDP')
    .replaceAll('blue_edge', 'StealthRDP')
    .replaceAll('Blue Edge', 'StealthRDP')
    .replace(/name:\s*["']Blue["']/g, 'name:"StealthRDP"')
    .replace(/name:\s*["']Unescape["']/g, 'name:"StealthRDP"');
}

function proxyWin11Demo(req, res, url) {
  let upstreamPath = url.pathname.replace(/^\/win11-demo/, '') || '/';
  if (!upstreamPath.startsWith('/')) upstreamPath = '/' + upstreamPath;
  if (url.search) upstreamPath += url.search;

  const request = https.get({
    hostname: WIN11_UPSTREAM_HOST,
    port: 443,
    path: upstreamPath,
    headers: {
      'User-Agent': 'StealthRDP-Win11-Proxy/1.0',
      'Accept': req.headers.accept || '*/*',
      'Accept-Encoding': 'identity',
    },
    timeout: 15000,
  }, (upstream) => {
    const status = upstream.statusCode || 502;
    const type = String(upstream.headers['content-type'] || 'application/octet-stream');
    const location = upstream.headers.location;

    if (location && status >= 300 && status < 400) {
      let rewritten = location;
      try {
        const parsed = new URL(location, 'https://' + WIN11_UPSTREAM_HOST);
        if (parsed.hostname === WIN11_UPSTREAM_HOST) rewritten = '/win11-demo' + parsed.pathname + parsed.search + parsed.hash;
      } catch (_) {}
      res.writeHead(status, {
        Location: rewritten,
        'Cache-Control': 'no-store',
        ...SECURITY_HEADERS,
        ...extraHeaders(req),
      });
      res.end();
      return;
    }

    const textual = /text\/(?:html|css|javascript)|application\/(?:javascript|json|manifest\+json)/i.test(type);
    const headers = {
      'Content-Type': type,
      'Cache-Control': textual ? 'public, max-age=300' : 'public, max-age=604800',
      ...SECURITY_HEADERS,
      ...extraHeaders(req),
    };

    if (!textual) {
      res.writeHead(status, headers);
      upstream.pipe(res);
      return;
    }

    const chunks = [];
    upstream.on('data', (chunk) => chunks.push(chunk));
    upstream.on('end', () => {
      const body = rewriteWin11Text(Buffer.concat(chunks).toString('utf8'));
      res.writeHead(status, headers);
      res.end(body);
    });
  });

  request.on('timeout', () => request.destroy(new Error('win11 proxy timeout')));
  request.on('error', () => {
    if (res.headersSent) return res.end();
    res.writeHead(502, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS,
      ...extraHeaders(req),
    });
    res.end('Windows demo temporarily unavailable');
  });
}

`;

if (!source.includes(marker)) throw new Error('server.js origin marker not found');
source = source.replace(marker, insert + marker);

const routeMarker = '  if (url.pathname.startsWith("/api/")) {';
const route = String.raw`  if (url.pathname === "/win11-demo" || url.pathname.startsWith("/win11-demo/")) {
    proxyWin11Demo(req, res, url);
    return;
  }

`;

if (!source.includes(routeMarker)) throw new Error('server.js route marker not found');
source = source.replace(routeMarker, route + routeMarker);

fs.writeFileSync(file, source);
console.log('patch-win11-runtime-proxy: applied');
