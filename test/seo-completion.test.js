"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { checkAiDiscovery } = require("../lib/ai-discovery.js");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("Vercel build validates the final staged artifact", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["seo:post-build"], "node scripts/seo-post-build.mjs");
  const command = pkg.scripts["vercel-build"];
  assert.ok(command.includes("node scripts/stage-vercel-public.mjs"));
  assert.ok(command.endsWith("npm run seo:post-build"));
  assert.ok(command.indexOf("stage-vercel-public.mjs") < command.indexOf("seo:post-build"));

  const postBuild = read("scripts/seo-post-build.mjs");
  assert.match(postBuild, /SEO_AUDIT_ROOT/);
  assert.match(postBuild, /public/);
  assert.match(postBuild, /https:\/\/www\.stealthrdp\.com/);

  const gate = read("scripts/seo-gates.mjs");
  assert.match(gate, /SEO_EXPECTED_BASE/);
  assert.match(gate, /unresolved .*BASE_TOKEN/);
});

test("AI discovery validation works after the production base is baked", () => {
  const base = "https://www.stealthrdp.com";
  const llms = read("llms.txt").replaceAll("__SRDP_BASE__", base);
  const robots = read("robots.txt").replaceAll("__SRDP_BASE__", base);
  assert.deepEqual(checkAiDiscovery({ llmsText: llms, robotsText: robots, base }), []);
});

test("keyword map covers the four core commercial routes without invented keywords", () => {
  const map = JSON.parse(read("seo/keyword-map.json"));
  const routes = new Map(map.pages.map((page) => [page.path, page]));
  for (const route of ["/", "/plans", "/windows-vps/", "/linux-vps/"]) {
    assert.ok(routes.has(route), `${route}: mapped`);
    assert.equal(routes.get(route).primaryKeyword, null, `${route}: research remains evidence-driven`);
    assert.equal(routes.get(route).status, "research-needed");
  }
  assert.equal(map.researchSource, "OpenSEO/DataForSEO");
  assert.equal(map.owners.research, "Senku");
  assert.equal(map.owners.implementation, "Suho");
});

test("docs migration contract requires direct permanent redirects", () => {
  const migration = JSON.parse(read("seo/docs-migration.json"));
  assert.equal(migration.sourceOrigin, "https://docs.stealthrdp.com");
  assert.equal(migration.targetOrigin, "https://www.stealthrdp.com");
  assert.deepEqual(migration.requiredRedirectStatus, [301, 308]);
  assert.match(read("scripts/check-docs-migration.mjs"), /redirect: "manual"/);
});

test("GitHub workflow automates preview crawl, Lighthouse, and weekly production monitoring", () => {
  const workflow = read(".github/workflows/seo.yml");
  assert.match(workflow, /deployment_status:/);
  assert.match(workflow, /Automatic preview SEO and performance crawl/);
  assert.match(workflow, /treosh\/lighthouse-ci-action@v12/);
  assert.match(workflow, /Weekly production SEO and performance monitor/);
  assert.match(workflow, /npm run vercel-build/);
  assert.match(workflow, /Legacy docs migration verification/);

  const lighthouse = JSON.parse(read("lighthouserc.json"));
  const assertions = lighthouse.ci.assert.assertions;
  assert.deepEqual(assertions["cumulative-layout-shift"], ["error", { maxNumericValue: 0.1 }]);
  assert.ok(assertions["largest-contentful-paint"]);
  assert.ok(assertions["total-blocking-time"]);
});
