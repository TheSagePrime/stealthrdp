/**
 * Vercel serverless function: /api/testimonials
 */
const fs = require("fs");
const path = require("path");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "testimonials.json"), "utf8"));
    const list = Array.isArray(data) ? data.map((item) => ({
      quote: String(item.quote || ""),
      authorName: String(item.authorName || ""),
      authorPosition: String(item.authorPosition || ""),
      authorCompany: String(item.authorCompany || ""),
      avatarUrl: String(item.avatarUrl || ""),
    })) : [];
    res.status(200).json(list);
  } catch (_) {
    res.status(500).json([]);
  }
};
