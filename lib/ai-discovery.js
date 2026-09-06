"use strict";

const fs = require("node:fs");
const path = require("node:path");

const BASE_TOKEN = "__SRDP_BASE__";
const APPROVED_INDEXABLE_COMMERCIAL_PAGES = Object.freeze([
  { path: "/plans", label: "Plans" },
  { path: "/windows-vps/", label: "Windows VPS hosting" },
  { path: "/linux-vps/", label: "Linux VPS hosting" },
]);
const ROBOTS_LLMS_REFERENCE = `# AI guide: ${BASE_TOKEN}/llms.txt`;

function readIfMissing(value, file) {
  return value == null ? fs.readFileSync(file, "utf8") : value;
}

function normalizeBase(base) {
  return String(base || BASE_TOKEN).replace(/\/+$/, "");
}

function checkAiDiscovery({ root = process.cwd(), llmsText, robotsText, base = BASE_TOKEN } = {}) {
  const llmsFile = path.join(root, "llms.txt");
  const robotsFile = path.join(root, "robots.txt");
  const llms = readIfMissing(llmsText, llmsFile);
  const robots = readIfMissing(robotsText, robotsFile);
  const linkBase = normalizeBase(base);
  const failures = [];

  if (!/^## Primary pages$/m.test(llms)) failures.push("llms.txt: Primary pages section missing");
  for (const page of APPROVED_INDEXABLE_COMMERCIAL_PAGES) {
    const entry = `- [${page.label}](${linkBase}${page.path}):`;
    if (!llms.includes(entry)) failures.push(`llms.txt: approved commercial page missing ${linkBase}${page.path}`);
  }
  if (!robots.includes(`# AI guide: ${linkBase}/llms.txt`)) failures.push("robots.txt: llms.txt reference missing");
  return failures;
}

module.exports = {
  APPROVED_INDEXABLE_COMMERCIAL_PAGES,
  BASE_TOKEN,
  ROBOTS_LLMS_REFERENCE,
  checkAiDiscovery,
};
