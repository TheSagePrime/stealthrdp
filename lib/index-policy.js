"use strict";

const PUBLIC_INDEX_HOSTS = new Set(["www.stealthrdp.com", "stealthrdp.com"]);
const PUBLIC_CANONICAL_ORIGIN = "https://www.stealthrdp.com";

function hostname(hostHeader) {
  return String(hostHeader || "").split(":")[0].toLowerCase();
}

function isPublicIndexHost(hostHeader) {
  return PUBLIC_INDEX_HOSTS.has(hostname(hostHeader));
}

function previewRobotsTxt() {
  return "User-agent: *\nDisallow: /\n";
}

function applyPreviewHtml(html) {
  return String(html).replace(/content="index,follow"/g, 'content="noindex,nofollow"');
}

module.exports = {
  PUBLIC_INDEX_HOSTS,
  PUBLIC_CANONICAL_ORIGIN,
  hostname,
  isPublicIndexHost,
  previewRobotsTxt,
  applyPreviewHtml,
};
