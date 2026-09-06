#!/usr/bin/env node

const expectedBase = String(process.env.SRDP_BASE || "https://www.stealthrdp.com").replace(/\/+$/, "");
process.env.SEO_AUDIT_ROOT = process.env.SEO_AUDIT_ROOT || "public";
process.env.SEO_EXPECTED_BASE = process.env.SEO_EXPECTED_BASE || expectedBase;

await import("./seo-gates.mjs");
