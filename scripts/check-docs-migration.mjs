#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, "seo", "docs-migration.json"), "utf8"));
const docs = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "docs-articles.json"), "utf8"));
const sourceOrigin = String(process.env.DOCS_SOURCE_ORIGIN || contract.sourceOrigin).replace(/\/+$/, "");
const targetOrigin = String(process.env.DOCS_TARGET_ORIGIN || contract.targetOrigin).replace(/\/+$/, "");
const allowedStatus = new Set(contract.requiredRedirectStatus || [301, 308]);
const cleanSlug = (slug) => slug.replace(/^\d+-/, "").replaceAll("_", "-").toLowerCase();
const failures = [];

for (const article of docs) {
  const sourcePath = contract.sourceArticlePattern.replace("{legacySlug}", article.slug);
  const targetPath = contract.targetArticlePattern.replace("{cleanSlug}", cleanSlug(article.slug));
  const sourceUrl = new URL(sourcePath, `${sourceOrigin}/`);
  const expectedUrl = new URL(targetPath, `${targetOrigin}/`).href;

  let response;
  try {
    response = await fetch(sourceUrl, { redirect: "manual" });
  } catch (error) {
    failures.push(`${sourceUrl.href}: request failed (${error.message})`);
    continue;
  }

  if (!allowedStatus.has(response.status)) {
    failures.push(`${sourceUrl.href}: expected 301/308, received ${response.status}`);
    continue;
  }

  const location = response.headers.get("location");
  if (!location) {
    failures.push(`${sourceUrl.href}: redirect missing Location header`);
    continue;
  }

  const actualUrl = new URL(location, sourceUrl).href;
  if (actualUrl !== expectedUrl) failures.push(`${sourceUrl.href}: redirects to ${actualUrl}, expected ${expectedUrl}`);
}

if (failures.length) {
  console.error(`Docs migration check failed with ${failures.length} issue(s):`);
  for (const issue of failures) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Docs migration passed for ${docs.length} legacy article URLs.`);
