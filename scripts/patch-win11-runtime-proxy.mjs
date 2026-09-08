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

const WIN11_RUNTIME_CLEANUP = '<script>(function(){' +
  'const banned=/blueedge|blue@win11react\\.com|win11react\\.com|buymeacoffee|buy me a coffee|ko-fi|discord\\.gg|twitter\\.com|pinterest\\.com|github\\.com\\/[^\\s]*win11/i;' +
  'function hide(el){if(!el)return;el.style.setProperty("display","none","important");el.setAttribute("aria-hidden","true");}' +
  'function clean(){' +
    'document.querySelectorAll("a,button,[role=button],[role=menuitem]").forEach(function(el){const t=(el.textContent||"").trim();const h=(el.getAttribute("href")||"").trim();if(/^(about|github|buy me a coffee)$/i.test(t)||/buy me a coffee/i.test(t)||banned.test(h)){hide(el.closest("li,[role=menuitem],.menu-item,.app-item,.item")||el);}});' +
    'const buttons=Array.from(document.querySelectorAll("button"));const ok=buttons.find(function(b){return /ok,? i understand/i.test((b.textContent||"").trim());});if(ok){let p=ok;for(let i=0;i<8&&p;i++,p=p.parentElement){const txt=(p.textContent||"");if(/Win11React is an open source project/i.test(txt)||/contact\\s*:\\s*blue@win11react\\.com/i.test(txt)){hide(p);break;}}}' +
    'const walker=document.createTreeWalker(document.body||document.documentElement,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(function(n){let v=n.nodeValue||"";if(!v)return;v=v.replace(/blue@win11react\\.com/gi,"").replace(/blueedgetechno/gi,"StealthRDP").replace(/Blue Edge/gi,"StealthRDP").replace(/Win11React/gi,"StealthRDP").replace(/https?:\\/\\/github\\.com\\/[^\\s<]*win11[^\\s<]*/gi,"").replace(/https?:\\/\\/[^\\s<]*blueedge[^\\s<]*/gi,"");if(v!==n.nodeValue)n.nodeValue=v;});' +
  '}' +
  'document.addEventListener("click",function(e){const a=e.target&&e.target.closest?e.target.closest("a"):null;if(a&&banned.test(a.href||"")){e.preventDefault();e.stopImmediatePropagation();}},true);' +
  'const mo=new MutationObserver(clean);mo.observe(document.documentElement,{subtree:true,childList:true});' +
  'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",clean,{once:true});else clean();' +
'})();</script>';

function rewriteWin11Paths(text, type) {
  let body = String(text)
    .replaceAll('/static/', '/win11-demo/static/')
    .replaceAll('/img/', '/win11-demo/img/')
    .replaceAll('/manifest.json', '/win11-demo/manifest.json')
    .replaceAll('/favicon.ico', '/win11-demo/favicon.ico');

  // Do not rewrite names, links, or arbitrary strings inside the compiled React bundle.
  // Creator-facing cleanup is performed in the DOM after React renders.
  if (/text\/html/i.test(type)) {
    body = body.replace('</head>', '<meta name="robots" content="noindex,nofollow"><style>html,body,#root{width:100%;height:100%;margin:0;overflow:hidden}</style></head>');
    body = body.replace('</body>', WIN11_RUNTIME_CLEANUP + '</body>');
  }
  return body;
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
      'User-Agent': 'Mozilla/5.0 StealthRDP-Win11-Demo',
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
      'Cache-Control': textual ? 'no-store' : 'public, max-age=604800',
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
      const body = rewriteWin11Paths(Buffer.concat(chunks).toString('utf8'), type);
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
console.log('patch-win11-runtime-proxy: applied safe runtime cleanup');
