"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function htmlFiles(dir = ROOT) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", ".backups", "backups", "public"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...htmlFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(full);
  }
  return files;
}

test("public HTML images have non-empty alt text", () => {
  const failures = [];
  for (const file of htmlFiles()) {
    const html = fs.readFileSync(file, "utf8");
    for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
      const tag = match[0];
      const alt = tag.match(/\balt\s*=\s*(["'])(.*?)\1/i);
      if (!alt || !alt[2].trim()) failures.push(`${path.relative(ROOT, file)}: ${tag}`);
    }
  }
  assert.deepEqual(failures, [], `image alt failures: ${failures.slice(0, 10).join(" | ")}`);
});

test("server-status legacy route redirects to the current status page", () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const redirect = config.redirects.find((item) => item.source === "/server-status");
  assert.deepEqual(redirect, {
    source: "/server-status",
    destination: "/status.html",
    permanent: true,
  });
});
