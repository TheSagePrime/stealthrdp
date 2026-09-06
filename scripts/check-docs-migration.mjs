#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, "seo", "docs-migration.json"), "utf8"));
const docs = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "docs-articles.json"), "utf8"));
const sourceOrigin = String(process.env.DOCS_SOURCE_ORIGIN || contract.sourceOrigin).replace(/\/+$/, "");
const targetOrigin = String(process.env.DOCS_TARGET_ORIGIN || contract.targetOrigin).replace(/\/+$/, "");
const inactiveStatus = new Set(contract.acceptedInactiveStatus || [404, 410]);
const redirectStatus = new Set(contract.acceptedRedirectStatus || [301, 308]);
const cleanSlug = (slug) => slug.replace(/^\d+-/, "").replaceAll("_", "-").toLowerCase();
const failures = [];
const notes = [];

async function verifyLegacySurface(sourcePath, targetPath) {
  const sourceUrl = new URL(sourcePath, `${sourceOrigin}/`);
  const expectedUrl = new URL(targetPath, `${targetOrigin}/`).href;

  let response;
  try {
    response = await fetch(sourceUrl, { redirect: "manual" });
  } catch (error) {
    notes.push(`${sourceUrl.href}: legacy host unreachable (${error.message})`);
    return;
  }

  if (inactiveStatus.has(response.status)) {
    notes.push(`${sourceUrl.href}: retired with HTTP ${response.status}`);
    return;
  }

  if (redirectStatus.has(response.status)) {
    const location = response.headers.get("location");
    if (!location) {
      failures.push(`${sourceUrl.href}: redirect missing Location header`);
      return;
    }
    const actualUrl = new URL(location, sourceUrl).href;
    if (actualUrl !== expectedUrl) {
      failures.push(`${sourceUrl.href}: redirects to ${actualUrl}, expected ${expectedUrl}`);
      return;
    }
    notes.push(`${sourceUrl.href}: permanently redirects to ${expectedUrl}`);
    return;
  }

  if (response.status >= 200 && response.status < 300) {
    failures.push(`${sourceUrl.href}: retired docs host is serving HTTP ${response.status}; this can recreate duplicate/indexable documentation`);
    return;
  }

  failures.push(`${sourceUrl.href}: unexpected HTTP ${response.status}; expected unreachable, 404/410, or direct 301/308 to ${expectedUrl}`);
}

await verifyLegacySurface(contract.sourceHubPath, contract.targetHubPath);

for (const article of docs) {
  const sourcePath = contract.sourceArticlePattern.replace("{legacySlug}", article.slug);
  const targetPath = contract.targetArticlePattern.replace("{cleanSlug}", cleanSlug(article.slug));
  await verifyLegacySurface(sourcePath, targetPath);
}

if (failures.length) {
  console.error(`Legacy docs host safety check failed with ${failures.length} issue(s):`);
  for (const issue of failures) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Legacy docs host is safely retired for the hub and ${docs.length} historical article URLs.`);
for (const note of notes) console.log(`- ${note}`);
