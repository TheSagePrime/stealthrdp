"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const pricing = require(path.join(__dirname, "..", "js", "pricing.js"));
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "plans.json"), "utf8"));

const ROOT = path.join(__dirname, "..");
const HTML = (route) => fs.readFileSync(path.join(ROOT, route), "utf8");
const PRICING_ROUTES = ["index.html", "plans.html", "windows-vps/index.html", "linux-vps/index.html"];
const EXPECTED_MONTHLY = {
  "Bronze USA": 9.50,
  "Silver USA": 18.04,
  "Gold USA": 26.59,
  "Platinum USA": 33.24,
  "Diamond USA": 42.75,
  "Emerald USA": 51.30,
  "Bronze EU": 9.50,
  "Silver EU": 17.10,
  "GOLD EU": 28.49,
  "Platinum EU": 33.24,
  "Diamond EU": 37.99,
};

function cardBlock(html, displayName, location = "") {
  return [...html.matchAll(/<article class="plan-card[^>]*>[\s\S]*?<\/article>/g)]
    .map((match) => match[0])
    .find((block) => block.includes(`<div class="p-name">${displayName}</div>`)
      && (!location || block.includes(`Region: ${location}`))) || "";
}

function displayedMonthly(html, displayName, location) {
  const block = cardBlock(html, displayName, location);
  return (block.match(/<span class="cur">€([0-9]+\.[0-9]{2})<small>\/mo<\/small>/) || [])[1] || "";
}

function planFromName(name) {
  return catalog.plans.find((plan) => plan.name === name);
}

function planServices(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap((match) => {
      const block = JSON.parse(match[1]);
      return block["@graph"] || [block];
    })
    .filter((item) => item["@type"] === "ItemList")
    .flatMap((item) => item.itemListElement || [])
    .map((item) => item.item)
    .filter((item) => item && item["@type"] === "Service");
}

test("catalog is the single verified source for current monthly prices", () => {
  assert.equal(catalog.currency, "EUR");
  assert.equal(catalog.plans.length, Object.keys(EXPECTED_MONTHLY).length);
  for (const [name, expected] of Object.entries(EXPECTED_MONTHLY)) {
    const plan = planFromName(name);
    assert.ok(plan, `${name}: catalog record exists`);
    assert.equal(plan.pricing.currency, "EUR", `${name}: currency`);
    assert.equal(plan.pricing.monthly.amount, expected, `${name}: verified live monthly amount`);
    assert.match(plan.source.url, /^https:\/\/dash\.stealthrdp\.com\//, `${name}: WHMCS source`);
  }
});

test("the shared price helper renders exact monthly and cycle conditions", () => {
  for (const plan of catalog.plans) {
    const monthly = pricing.priceMarkup(plan, "monthly");
    assert.match(monthly, new RegExp(`€${plan.pricing.monthly.amount.toFixed(2)}<small>\\/mo<\\/small>`), `${plan.name}: monthly display`);
    assert.match(monthly, /Monthly · EUR/);
    for (const key of ["quarterly", "annual", "biannual"]) {
      const cycle = plan.pricing[key];
      const markup = pricing.priceMarkup(plan, key);
      if (cycle) {
        assert.match(markup, new RegExp(`€${cycle.amount.toFixed(2)}`), `${plan.name}: ${key} amount`);
        assert.match(markup, new RegExp(`billed ${cycle.periodLabel}`), `${plan.name}: ${key} period`);
      } else {
        assert.match(markup, /See checkout/);
        assert.match(markup, new RegExp(`${pricing.cycleLabel(key)} total not published`));
      }
    }
  }
});

test("all public pricing cards use identical catalog monthly displays", () => {
  for (const route of PRICING_ROUTES) {
    const html = HTML(route);
    const names = route === "index.html"
      ? ["Bronze USA", "Silver USA", "Gold USA"]
      : route === "plans.html"
        ? Object.keys(EXPECTED_MONTHLY).filter((name) => name.endsWith("USA"))
        : Object.keys(EXPECTED_MONTHLY);
    for (const name of names) {
      const expected = EXPECTED_MONTHLY[name];
      const displayName = name.replace(" USA", "").replace(" EU", "").replace(/[A-Za-z]+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
      const location = route.includes("vps/") ? (name.endsWith(" EU") ? "EU" : "USA") : "";
      assert.equal(displayedMonthly(html, displayName, location), expected.toFixed(2), `${route}: ${name}`);
    }
  }
});

test("plans JSON-LD Offers match the same catalog monthly prices", () => {
  for (const [route, expectedPlans] of [["index.html", catalog.plans.slice(0, 3)], ["plans.html", catalog.plans]]) {
    const services = planServices(HTML(route));
    assert.equal(services.length, expectedPlans.length, `${route}: structured plan count`);
    for (const service of services) {
    const plan = planFromName(service.name);
      assert.ok(expectedPlans.includes(plan), `${route}: ${service.name} exists in expected catalog slice`);
      assert.equal(service.offers.price, plan.pricing.monthly.amount, `${route}: ${service.name}: JSON-LD monthly price`);
      assert.equal(service.offers.priceCurrency, "EUR", `${route}: ${service.name}: JSON-LD currency`);
    }
  }
});

test("pricing source and runtime no longer use generic guessed multipliers", () => {
  const build = HTML("build.mjs");
  const main = HTML("js/main.js");
  assert.doesNotMatch(build, /MONTHLY_MULT|monthlyPrice\(p\)|0\.95/);
  assert.doesNotMatch(main, /CYCLE_MULT|base \* mult|0\.95|0\.90|0\.80|0\.70/);
  assert.match(build, /pricing\.priceMarkup/);
  assert.match(main, /SRDP_PRICING/);
});

test("stale Silver USA values are absent from every public pricing surface", () => {
  for (const route of PRICING_ROUTES) {
    const html = HTML(route);
    assert.doesNotMatch(html, /€18\.05|€18\.99|€19\.00/);
  }
  assert.doesNotMatch(HTML("build.mjs"), /€18\.05|€18\.99|€19\.00/);
});
