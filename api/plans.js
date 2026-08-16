/**
 * Vercel serverless function: /api/plans?location=USA|EU
 * Reads the committed plan data (same contract as server.js localApi).
 */
const fs = require("fs");
const path = require("path");

function safePlan(plan) {
  return {
    name: String(plan.name || ""),
    description: String(plan.description || ""),
    monthlyPrice: Number.isFinite(Number(plan.monthlyPrice)) ? Number(plan.monthlyPrice) : 0,
    location: String(plan.location || ""),
    popular: Boolean(plan.popular),
    specs: {
      cpu: String(plan.specs && plan.specs.cpu || ""),
      ram: String(plan.specs && plan.specs.ram || ""),
      storage: String(plan.specs && plan.specs.storage || ""),
      bandwidth: String(plan.specs && plan.specs.bandwidth || ""),
    },
    billingOptions: plan.billingOptions || {},
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const url = new URL(req.url, "http://localhost");
  const location = String(url.searchParams.get("location") || "USA").toLowerCase() === "eu" ? "EU" : "USA";
  const file = location === "EU" ? "plans_eu.json" : "plans_usa.json";
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", file), "utf8"));
    res.status(200).json(Array.isArray(data) ? data.map(safePlan) : []);
  } catch (_) {
    res.status(500).json([]);
  }
};
