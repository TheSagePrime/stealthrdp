"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { legacyRedirectFor } = require("../proxy.js");

function locationFor(url) {
  const response = legacyRedirectFor(new URL(url));
  return response ? { status: response.status, location: response.headers.get("location") } : null;
}

test("legacy root entry points redirect to the canonical homepage", () => {
  assert.deepEqual(locationFor("https://stealthrdp.com/index.php"), {
    status: 308,
    location: "https://www.stealthrdp.com/",
  });
  assert.deepEqual(locationFor("https://www.stealthrdp.com/index.html"), {
    status: 308,
    location: "https://www.stealthrdp.com/",
  });
});

test("legacy dashboard login redirects to the current client area", () => {
  assert.deepEqual(locationFor("https://stealthrdp.com/dash/login.php"), {
    status: 308,
    location: "https://dash.stealthrdp.com/index.php?rp=/login",
  });
});

test("all legacy store language variants redirect to plans without query leakage", () => {
  const urls = [
    "https://stealthrdp.com/dash/index.php?rp=/store/dedicated-rdp-usa/&language=spanish",
    "https://stealthrdp.com/dash/index.php?rp=/store/eu/silver-eu&language=italian",
    "https://stealthrdp.com/dash/index.php?rp=/store/dmca-ignored/bronze-eu&language=chinese",
  ];
  for (const url of urls) {
    assert.deepEqual(locationFor(url), {
      status: 308,
      location: "https://www.stealthrdp.com/plans",
    });
  }
});

test("legacy announcements redirect to the current blog surface", () => {
  assert.deepEqual(locationFor("https://stealthrdp.com/dash/index.php?rp=/announcements/3&language=hebrew"), {
    status: 308,
    location: "https://www.stealthrdp.com/blog",
  });
});

test("legacy knowledgebase URLs redirect to the current documentation surface", () => {
  assert.deepEqual(locationFor("https://stealthrdp.com/dash/index.php?rp=/knowledgebase/1/example.html"), {
    status: 308,
    location: "https://www.stealthrdp.com/docs",
  });
});

test("legacy dashboard path variants redirect to live destinations", () => {
  const cases = [
    ["https://stealthrdp.com/dash/index.php/knowledgebase", "https://www.stealthrdp.com/docs"],
    ["https://stealthrdp.com/dash/index.php/user/password", "https://dash.stealthrdp.com/index.php?rp=/password/reset"],
    ["https://stealthrdp.com/dash/index.php?rp=/password/reset", "https://dash.stealthrdp.com/index.php?rp=/password/reset"],
  ];
  for (const [url, destination] of cases) {
    assert.deepEqual(locationFor(url), { status: 308, location: destination }, url);
  }
});

test("every screenshot URL maps to its approved canonical destination", () => {
  const cases = [
    ["https://stealthrdp.com/dash/index.php?rp=/store/dedicated-rdp-usa/&language=spanish", "https://www.stealthrdp.com/plans"],
    ["https://stealthrdp.com/dash/index.php?rp=/store/dedicated-rdp-usa/&language=croatian", "https://www.stealthrdp.com/plans"],
    ["https://stealthrdp.com/dash/index.php?rp=/store/dedicated-rdp-usa/&language=danish", "https://www.stealthrdp.com/plans"],
    ["https://stealthrdp.com/dash/index.php?rp=/store/dedicated-rdp-usa/&language=italian", "https://www.stealthrdp.com/plans"],
    ["https://stealthrdp.com/dash/index.php?rp=/store/dedicated-rdp-usa/&language=czech", "https://www.stealthrdp.com/plans"],
    ["https://stealthrdp.com/index.php", "https://www.stealthrdp.com/"],
    ["https://stealthrdp.com/index.html", "https://www.stealthrdp.com/"],
    ["https://stealthrdp.com/dash/login.php", "https://dash.stealthrdp.com/index.php?rp=/login"],
    ["https://stealthrdp.com/dash/index.php?rp=/store/eu/silver-eu&language=italian", "https://www.stealthrdp.com/plans"],
    ["https://stealthrdp.com/dash/index.php?rp=/store/eu/bronze-eu&language=english", "https://www.stealthrdp.com/plans"],
    ["https://stealthrdp.com/dash/index.php?rp=/knowledgebase/1/How-to-Install-VPS-or-RDP-After-Purchase--Step-by-Step-Guide.html", "https://www.stealthrdp.com/docs"],
    ["https://stealthrdp.com/dash/index.php?rp=/knowledgebase/5/Why-Go-Red-When-You-Can-Stay-Green-Discover-StealthRDP-and-amp039s-Anti-Red-Hosting.html", "https://www.stealthrdp.com/docs"],
    ["https://stealthrdp.com/dash/index.php?rp=/store/dmca-ignored/bronze-eu&language=chinese", "https://www.stealthrdp.com/plans"],
    ["https://stealthrdp.com/dash/index.php?rp=/store/eu/silver-eu&language=catalan", "https://www.stealthrdp.com/plans"],
    ["https://stealthrdp.com/dash/index.php?rp=/store/dedicated-rdp-usa/&language=swedish", "https://www.stealthrdp.com/plans"],
    ["https://stealthrdp.com/dash/index.php?rp=/announcements/2&language=hebrew", "https://www.stealthrdp.com/blog"],
    ["https://stealthrdp.com/dash/index.php?rp=/announcements/3&language=hebrew", "https://www.stealthrdp.com/blog"],
    ["https://stealthrdp.com/dash/index.php?rp=/announcements/3&language=german", "https://www.stealthrdp.com/blog"],
  ];

  for (const [url, destination] of cases) {
    assert.deepEqual(locationFor(url), { status: 308, location: destination }, url);
  }
});

test("unrelated dashboard routes are not redirected by the legacy cleanup", () => {
  assert.equal(locationFor("https://stealthrdp.com/dash/index.php?rp=/login"), null);
});
