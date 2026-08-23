"use strict";

const { next, rewrite } = require("@vercel/functions");
const { acceptsMarkdown, safeHtmlPath } = require("./lib/markdown-routing.js");

const AGENT_DESCRIPTION_LINK = '</llms.txt>; rel="describedby"; type="text/plain"';

function selectMarkdownPage(url, accept) {
  if (!acceptsMarkdown(accept)) return null;
  if (url.pathname === "/") return "index.html";
  return safeHtmlPath(url.pathname);
}

function legacyRedirectFor(url) {
  if (url.pathname === "/index.php" || url.pathname === "/index.html") {
    return new Response(null, {
      status: 308,
      headers: { Location: "https://www.stealthrdp.com/" },
    });
  }

  if (url.pathname === "/dash/login.php") {
    return new Response(null, {
      status: 308,
      headers: { Location: "https://dash.stealthrdp.com/index.php?rp=/login" },
    });
  }

  if (url.pathname.startsWith("/dash/index.php/")) {
    const legacyPath = url.pathname.slice("/dash/index.php".length);
    const destination = legacyPath.startsWith("/knowledgebase")
      ? "https://www.stealthrdp.com/docs.html"
      : legacyPath.startsWith("/user/password")
        ? "https://dash.stealthrdp.com/index.php?rp=/password/reset"
        : null;

    if (!destination) return null;
    return new Response(null, {
      status: 308,
      headers: { Location: destination },
    });
  }

  if (url.pathname !== "/dash/index.php") return null;

  const route = url.searchParams.get("rp") || "";
  const destination = route.startsWith("/store/")
    ? "https://www.stealthrdp.com/plans.html"
    : route.startsWith("/announcements/")
      ? "https://www.stealthrdp.com/blog.html"
      : route.startsWith("/knowledgebase/")
        ? "https://www.stealthrdp.com/docs.html"
        : route.startsWith("/password/reset")
          ? "https://dash.stealthrdp.com/index.php?rp=/password/reset"
          : null;

  if (!destination) return null;
  return new Response(null, {
    status: 308,
    headers: { Location: destination },
  });
}

function proxy(request) {
  const url = new URL(request.url);
  const legacyRedirect = legacyRedirectFor(url);
  if (legacyRedirect) return legacyRedirect;

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
module.exports.legacyRedirectFor = legacyRedirectFor;
