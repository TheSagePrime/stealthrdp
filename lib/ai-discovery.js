"use strict";

const fs = require("node:fs");
const path = require("node:path");

const BASE_TOKEN = "__SRDP_BASE__";
const APPROVED_INDEXABLE_COMMERCIAL_PAGES = Object.freeze([
  { path: "/plans.html", label: "Plans" },
  { path: "/windows-vps/", label: "Windows VPS hosting" },
  { path: "/linux-vps/", label: "Linux VPS hosting" },
]);
const ROBOTS_LLMS_REFERENCE = `# AI guide: ${BASE_TOKEN}/llms.txt`;

function readIfMissing(value, file) {
  return value == null ? fs.readFileSync(file, "utf8") : value;
}

function checkAiDiscovery({ root = process.cwd(), llmsText, robotsText } = {}) {
  const llmsFile = path.join(root, "llms.txt");
  const robotsFile = path.join(root, "robots.txt");
  const llms = readIfMissing(llmsText, llmsFile);
  const robots = readIfMissing(robotsText, robotsFile);
  const failures = [];

  if (!/^## Primary pages$/m.test(llms)) failures.push("llms.txt: Primary pages section missing");
  for (const page of APPROVED_INDEXABLE_COMMERCIAL_PAGES) {
    const entry = `- [${page.label}](${BASE_TOKEN}${page.path}):`;
    if (!llms.includes(entry)) failures.push(`llms.txt: approved commercial page missing ${BASE_TOKEN}${page.path}`);
  }
  if (!robots.includes(ROBOTS_LLMS_REFERENCE)) failures.push("robots.txt: llms.txt reference missing");
  return failures;
}

module.exports = {
  APPROVED_INDEXABLE_COMMERCIAL_PAGES,
  BASE_TOKEN,
  ROBOTS_LLMS_REFERENCE,
  checkAiDiscovery,
};
