"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(value) {
      this.body = String(value);
      return this;
    },
    end(value = "") {
      this.body = String(value);
      return this;
    },
  };
}

async function requestMarkdown(handler, { accept = "text/markdown", method = "GET", page = "index.html" } = {}) {
  const response = responseRecorder();
  await handler({ method, headers: { accept }, query: { path: page } }, response);
  return response;
}

function loadHandler(root) {
  const handlerPath = path.join(ROOT, "api", "markdown.js");
  delete require.cache[require.resolve(handlerPath)];
  return require(handlerPath).createMarkdownHandler(root);
}

test("Markdown Accept negotiation parses ranges, quotes, case, and q values", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "srdp-markdown-accept-"));
  fs.writeFileSync(path.join(tempRoot, "index.html.md"), "# Markdown\n");

  try {
    const handler = loadHandler(tempRoot);
    for (const accept of [
      "Text/Markdown",
      "text/markdown; charset=utf-8",
      "text/html, TEXT/MARKDOWN;q=0.5",
      "text/html, TEXT/MARKDOWN;level=1;q=0.5",
      'text/markdown;profile="a;b";q=0.5',
    ]) {
      const response = await requestMarkdown(handler, { accept });
      assert.strictEqual(response.statusCode, 200, `${accept} accepts Markdown`);
    }

    for (const accept of [
      "text/markdown;q=0",
      "text/html, text/markdown; q=0",
      "text/markdown;level=1;q=0",
      "application/text/markdown",
      "text/markdownish",
      "text/markdown+json",
      "text/markdown;q=1;q=0",
      "text/markdown;q=broken",
      'text/html;profile="x,text/markdown;q=1,bar"',
      "text/html,application/xhtml+xml,*/*;q=0.8",
    ]) {
      const response = await requestMarkdown(handler, { accept });
      assert.strictEqual(response.statusCode, 406, `${accept} does not accept Markdown`);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Markdown paths reject traversal variants and repeated query values", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "srdp-markdown-paths-"));
  fs.mkdirSync(path.join(tempRoot, "docs"));
  fs.writeFileSync(path.join(tempRoot, "index.html.md"), "# Home\n");
  fs.writeFileSync(path.join(tempRoot, "docs", "guide.html.md"), "# Nested guide\n");

  try {
    const handler = loadHandler(tempRoot);
    for (const page of [
      "%2e%2e/index.html",
      "docs%2f%2e%2e%2findex.html",
      "docs%5c%2e%2e%5cindex.html",
      "docs\\..\\index.html",
      ["index.html", "../package.json"],
    ]) {
      const response = await requestMarkdown(handler, { page });
      assert.strictEqual(response.statusCode, 400, `${JSON.stringify(page)} is rejected`);
    }

    const nested = await requestMarkdown(handler, { page: "docs/guide.html" });
    assert.strictEqual(nested.statusCode, 200);
    assert.strictEqual(nested.body, "# Nested guide\n");

    const head = await requestMarkdown(handler, { method: "HEAD", page: "docs/guide.html" });
    assert.strictEqual(head.statusCode, 200);
    assert.strictEqual(head.body, "");
    assert.strictEqual(head.headers["content-type"], "text/markdown; charset=utf-8");
    assert.strictEqual(head.headers["content-signal"], "ai-train=no, search=yes, ai-input=yes");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Vercel middleware and endpoint share one Accept parser", async () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const markdownRewrites = (vercel.rewrites || []).filter((rule) => rule.destination.startsWith("/api/markdown"));
  assert.strictEqual(markdownRewrites.length, 0, "no duplicate Accept regex exists in vercel.json");
  assert.strictEqual(vercel.proxy.entrypoint, "proxy.js");

  const proxyPath = path.join(ROOT, "proxy.js");
  delete require.cache[require.resolve(proxyPath)];
  const proxy = require(proxyPath);
  const { selectMarkdownPage } = proxy;
  const select = (pathname, accept) => selectMarkdownPage(new URL(pathname, "https://www.stealthrdp.com"), accept);

  assert.strictEqual(select("/", "Text/Markdown"), "index.html");
  assert.strictEqual(select("/docs/guide.html", 'text/markdown;profile="a;b";q=0.5'), "docs/guide.html");
  assert.strictEqual(select("/", "text/markdown;q=0"), null);
  assert.strictEqual(select("/", "text/markdown;q=1;q=0"), null);
  assert.strictEqual(select("/", 'text/html;profile="x,text/markdown;q=1,bar"'), null);
  assert.strictEqual(select("/", "text/html,application/xhtml+xml,*/*;q=0.8"), null);
  assert.strictEqual(select("/assets/site.css", "text/markdown"), null);

  const htmlResponse = proxy(
    new Request("https://www.stealthrdp.com/", { headers: { Accept: "text/html,application/xhtml+xml" } }),
  );
  assert.strictEqual(htmlResponse.headers.get("vary"), "Accept", "HTML continuation varies on Accept");

  const markdownResponse = proxy(
    new Request("https://www.stealthrdp.com/docs.html", { headers: { Accept: "text/markdown" } }),
  );
  assert.match(
    markdownResponse.headers.get("x-middleware-rewrite") || "",
    /\/api\/markdown\?path=docs(?:\.html|%2Ehtml)/i,
    "Markdown requests rewrite to the Markdown function",
  );
});

test("Markdown builder fixes recursive deletion to its owned directory", async () => {
  const source = fs.readFileSync(path.join(ROOT, "scripts", "build-markdown.mjs"), "utf8");
  assert.match(source, /fileURLToPath\(import\.meta\.url\)/);
  assert.doesNotMatch(source, /SRDP_MARKDOWN_OUTPUT/);

  const builderUrl = pathToFileURL(path.join(ROOT, "scripts", "build-markdown.mjs"));
  builderUrl.searchParams.set("safety", String(Date.now()));
  const { assertSafeOutputPath, defaultOutput } = await import(builderUrl.href);
  assert.strictEqual(assertSafeOutputPath(defaultOutput), defaultOutput);
  for (const unsafe of [path.parse(ROOT).root, ROOT, os.tmpdir(), "/etc", path.join(ROOT, "sibling")]) {
    assert.throws(() => assertSafeOutputPath(unsafe), /unsafe Markdown output/i);
  }
});

test("Markdown metadata uses parsed HTML regardless of quoting or attribute order", async () => {
  const previousBase = process.env.SRDP_BASE;
  try {
    process.env.SRDP_BASE = "https://www.stealthrdp.com";
    const builderUrl = pathToFileURL(path.join(ROOT, "scripts", "build-markdown.mjs"));
    builderUrl.searchParams.set("parser", String(Date.now()));
    const { pageToMarkdown } = await import(builderUrl.href);
    const markdown = pageToMarkdown(`<!doctype html>
      <html><head>
        <title>Operator's Control Room</title>
        <meta content="It's fast &amp; reliable" data-source="test" name="description">
        <meta content="__SRDP_BASE__/images/operator's-room.webp" property="og:image">
        <script data-source="test" type="application/ld+json">{"name":"Operator's Room"}</script>
      </head><body><main><h1>Parsed body</h1></main></body></html>`);

    assert.match(markdown, /^---\ntitle: "Operator's Control Room"$/m);
    assert.match(markdown, /^description: "It's fast & reliable"$/m);
    assert.match(markdown, /^image: "https:\/\/www\.stealthrdp\.com\/images\/operator's-room\.webp"$/m);
    assert.match(markdown, /# Parsed body/);
    assert.match(markdown, /"name": "Operator's Room"/);
  } finally {
    if (previousBase === undefined) delete process.env.SRDP_BASE;
    else process.env.SRDP_BASE = previousBase;
  }
});

test("Vercel negotiates Markdown while browsers keep static HTML", async () => {
  const builder = path.join(ROOT, "scripts", "build-markdown.mjs");
  const handlerPath = path.join(ROOT, "api", "markdown.js");
  const markdownRoot = path.join(ROOT, "markdown");
  execFileSync(process.execPath, [builder], {
    cwd: ROOT,
    env: { ...process.env, SRDP_BASE: "https://www.stealthrdp.com" },
    stdio: "pipe",
  });

  const homePath = path.join(markdownRoot, "index.html.md");
  const articlePath = path.join(markdownRoot, "blog", "how-to-set-up-automated-backups-for-vps-hosting.html.md");
  assert.ok(fs.existsSync(homePath));
  assert.ok(fs.existsSync(articlePath));

  const home = fs.readFileSync(homePath, "utf8");
  assert.match(home, /^---\ntitle: /);
  assert.match(home, /# Your server\. Live in 60 seconds\./);
  assert.match(home, /```json\n[\s\S]*"@context": "https:\/\/schema\.org"/);
  assert.doesNotMatch(home, /<script|<style|site-header|site-footer/i);
  assert.strictEqual((home.match(/Works with your OS/g) || []).length, 1);
  assert.strictEqual((home.match(/great\. good supervision and techniques/g) || []).length, 1);
  assert.doesNotMatch(home, /__SRDP_BASE__/);

  delete require.cache[require.resolve(handlerPath)];
  const handler = require(handlerPath);
  const markdownResponse = await requestMarkdown(handler);
  assert.strictEqual(markdownResponse.statusCode, 200);
  assert.strictEqual(markdownResponse.headers["content-type"], "text/markdown; charset=utf-8");
  assert.strictEqual(markdownResponse.headers.vary, "Accept");
  assert.strictEqual(markdownResponse.headers["content-signal"], "ai-train=no, search=yes, ai-input=yes");
  assert.match(markdownResponse.headers["x-markdown-tokens"], /^\d+$/);
  assert.match(markdownResponse.body, /# Your server\. Live in 60 seconds\./);

  const htmlOnlyResponse = await requestMarkdown(handler, { accept: "text/html" });
  assert.strictEqual(htmlOnlyResponse.statusCode, 406, "direct function rejects non-Markdown clients");

  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.strictEqual(vercel.proxy.entrypoint, "proxy.js");
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.match(pkg.scripts["vercel-build"], /build-markdown\.mjs/);
  assert.strictEqual(pkg.dependencies.turndown, "7.2.4");
  assert.strictEqual(pkg.dependencies["@mixmark-io/domino"], "2.2.0");
  assert.strictEqual(pkg.dependencies["@vercel/functions"], "3.9.3");
});
