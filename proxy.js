"use strict";

const { next, rewrite } = require("@vercel/functions");
const { acceptsMarkdown, safeHtmlPath } = require("./lib/markdown-routing.js");

function selectMarkdownPage(url, accept) {
  if (!acceptsMarkdown(accept)) return null;
  if (url.pathname === "/") return "index.html";
  return safeHtmlPath(url.pathname);
}

function proxy(request) {
  const page = selectMarkdownPage(new URL(request.url), request.headers.get("accept"));
  if (!page) return next({ headers: { Vary: "Accept" } });

  const destination = new URL("/api/markdown", request.url);
  destination.searchParams.set("path", page);
  return rewrite(destination);
}

module.exports = proxy;
module.exports.selectMarkdownPage = selectMarkdownPage;
