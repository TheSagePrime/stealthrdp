"use strict";

function splitHeaderValue(value, separator) {
  const parts = [];
  let start = 0;
  let quoted = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
    } else if (quoted && character === "\\") {
      escaped = true;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && character === separator) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

function acceptsMarkdown(value) {
  return splitHeaderValue(String(value || ""), ",").some((range) => {
    const [mediaType, ...parameters] = splitHeaderValue(range, ";").map((part) => part.trim());
    if (mediaType.toLowerCase() !== "text/markdown") return false;

    let quality = 1;
    let qualitySeen = false;
    for (const parameter of parameters) {
      const equals = parameter.indexOf("=");
      if (equals < 0 || parameter.slice(0, equals).trim().toLowerCase() !== "q") continue;
      if (qualitySeen) return false;
      qualitySeen = true;
      const q = parameter.slice(equals + 1).trim();
      if (!/^(?:0(?:\.\d{1,3})?|1(?:\.0{1,3})?)$/.test(q)) return false;
      quality = Number(q);
    }
    return quality > 0;
  });
}

function safeHtmlPath(value) {
  if (Array.isArray(value) || typeof value !== "string" || !value) return null;
  if (/\\|%(?:2f|5c)/i.test(value)) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(value).replace(/^\/+/, "");
  } catch {
    return null;
  }
  if (!decoded.endsWith(".html")) return null;
  if (decoded.split("/").some((part) => !part || part === "." || part === "..")) return null;
  if (!/^[a-zA-Z0-9_./-]+\.html$/.test(decoded)) return null;
  return decoded;
}

module.exports = { acceptsMarkdown, safeHtmlPath, splitHeaderValue };
