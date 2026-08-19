"use strict";

const { next, rewrite } = require("@vercel/functions");
const { acceptsMarkdown, safeHtmlPath } = require("./lib/markdown-routing.js");

const AGENT_DESCRIPTION_LINK = '</llms.txt>; rel="describedby"; type="text/plain"';

function selectMarkdownPage(url, accept) {
  if (!acceptsMarkdown(accept)) return null;
  if (url.pathname === "/") return "index.html";
  return safeHtmlPath(url.pathname);
}

function proxy(request) {
  const url = new URL(request.url);
  const page = selectMarkdownPage(url, request.headers.get("accept"));
  if (!page) {
    const headers = { Vary: "Accept" };
    if (url.pathname === "/") headers.Link = AGENT_DESCRIPTION_LINK;
    return next({ headers });
  }

  const destination = new URL("/api/markdown", url);
  destination.searchParams.set("path", page);
  return rewrite(destination);
}

module.exports = proxy;
module.exports.selectMarkdownPage = selectMarkdownPage;
