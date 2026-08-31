/**
 * Vercel serverless function: /api/plans?location=USA|EU
 * Reads the committed plan data (same contract as server.js localApi).
 */
const fs = require("fs");
const path = require("path");

function safePlan(plan) {
  const pricing = plan.pricing || {};
  const monthly = pricing.monthly || {};
  return {
    name: String(plan.name || ""),
    description: String(plan.description || ""),
    monthlyPrice: Number.isFinite(Number(monthly.amount)) ? Number(monthly.amount) : 0,
    location: String(plan.location || ""),
    popular: Boolean(plan.popular),
    specs: {
      cpu: String(plan.specs && plan.specs.cpu || ""),
      ram: String(plan.specs && plan.specs.ram || ""),
      storage: String(plan.specs && plan.specs.storage || ""),
      bandwidth: String(plan.specs && plan.specs.bandwidth || ""),
    },
    pricing,
    source: plan.source || {},
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const url = new URL(req.url, "http://localhost");
  const location = String(url.searchParams.get("location") || "USA").toLowerCase() === "eu" ? "EU" : "USA";
  try {
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "plans.json"), "utf8"));
    const data = Array.isArray(catalog.plans) ? catalog.plans.filter((plan) => plan.location === location) : [];
    res.status(200).json(data.map(safePlan));
  } catch (_) {
    res.status(500).json([]);
  }
};
