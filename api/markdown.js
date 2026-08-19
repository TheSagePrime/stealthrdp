"use strict";

const fs = require("fs");
const path = require("path");
const { acceptsMarkdown, safeHtmlPath } = require("../lib/markdown-routing.js");

const CONTENT_SIGNAL = "ai-train=no, search=yes, ai-input=yes";
const AGENT_DESCRIPTION_LINK = '</llms.txt>; rel="describedby"; type="text/plain"';
const DEFAULT_MARKDOWN_ROOT = path.resolve(process.cwd(), "markdown");

function send(res, status, body) {
  res.statusCode = status;
  if (typeof res.status === "function") res.status(status);
  if (typeof res.send === "function") return res.send(body);
  return res.end(body);
}

function createMarkdownHandler(markdownRoot = DEFAULT_MARKDOWN_ROOT) {
  const root = path.resolve(markdownRoot);

  return async function markdownHandler(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      return send(res, 405, "Method Not Allowed\n");
    }

    if (!acceptsMarkdown(req.headers.accept)) {
      return send(res, 406, "Not Acceptable\n");
    }

    const htmlPath = safeHtmlPath(req.query.path);
    if (!htmlPath) return send(res, 400, "Invalid page path\n");

    const file = path.resolve(root, `${htmlPath}.md`);
    if (!file.startsWith(`${root}${path.sep}`)) return send(res, 400, "Invalid page path\n");
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, "Markdown page not found\n");

    const markdown = fs.readFileSync(file, "utf8");
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Vary", "Accept");
    res.setHeader("Content-Signal", CONTENT_SIGNAL);
    if (htmlPath === "index.html") res.setHeader("Link", AGENT_DESCRIPTION_LINK);
    res.setHeader("X-Markdown-Tokens", String(Math.max(1, Math.ceil(markdown.length / 4))));
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
    return send(res, 200, req.method === "HEAD" ? "" : markdown);
  };
}

module.exports = createMarkdownHandler();
module.exports.createMarkdownHandler = createMarkdownHandler;
