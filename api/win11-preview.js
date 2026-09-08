const https = require('https');

const UPSTREAM_HOST = 'win11.blueedge.me';
const SELF = '/api/win11-preview?path=';

const CLEANUP = '<script>(function(){' +
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

function fetchUpstream(upstreamPath, accept) {
  return new Promise((resolve, reject) => {
    const request = https.get({
      hostname: UPSTREAM_HOST,
      port: 443,
      path: upstreamPath,
      headers: {
        'User-Agent': 'Mozilla/5.0 StealthRDP-Win11-Preview',
        'Accept': accept || '*/*',
        'Accept-Encoding': 'identity',
      },
      timeout: 15000,
    }, (upstream) => {
      const chunks = [];
      upstream.on('data', (chunk) => chunks.push(chunk));
      upstream.on('end', () => resolve({
        status: upstream.statusCode || 502,
        headers: upstream.headers,
        body: Buffer.concat(chunks),
      }));
    });
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', reject);
  });
}

function rewrite(text, type) {
  let body = String(text)
    .replaceAll('/static/', SELF + '/static/')
    .replaceAll('/img/', SELF + '/img/')
    .replaceAll('/manifest.json', SELF + '/manifest.json')
    .replaceAll('/favicon.ico', SELF + '/favicon.ico');
  if (/text\/html/i.test(type)) {
    body = body.replace('</head>', '<meta name="robots" content="noindex,nofollow"><style>html,body,#root{width:100%;height:100%;margin:0;overflow:hidden}</style></head>');
    body = body.replace('</body>', CLEANUP + '</body>');
  }
  return body;
}

module.exports = async function handler(req, res) {
  let p = req.query.path;
  if (Array.isArray(p)) p = p.join('/');
  p = String(p || '/');
  if (!p.startsWith('/')) p = '/' + p;

  try {
    const upstream = await fetchUpstream(p, req.headers.accept);
    const type = String(upstream.headers['content-type'] || 'application/octet-stream');
    const textual = /text\/(?:html|css|javascript)|application\/(?:javascript|json|manifest\+json)/i.test(type);

    res.statusCode = upstream.status;
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');

    if (upstream.headers.location && upstream.status >= 300 && upstream.status < 400) {
      const target = new URL(upstream.headers.location, 'https://' + UPSTREAM_HOST);
      if (target.hostname === UPSTREAM_HOST) {
        res.setHeader('Location', SELF + target.pathname + target.search);
      } else {
        res.setHeader('Location', upstream.headers.location);
      }
      res.end();
      return;
    }

    if (textual) res.end(rewrite(upstream.body.toString('utf8'), type));
    else res.end(upstream.body);
  } catch (_) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Windows demo temporarily unavailable');
  }
};
