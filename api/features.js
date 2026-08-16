/**
 * Vercel serverless function: /api/features
 */
const fs = require("fs");
const path = require("path");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "features.json"), "utf8"));
    const list = Array.isArray(data) ? data.map((item) => ({
      title: String(item.title || ""),
      description: String(item.description || ""),
      iconName: String(item.iconName || "Server"),
      category: String(item.category || ""),
      displayOrder: Number(item.displayOrder || 0),
    })) : [];
    res.status(200).json(list);
  } catch (_) {
    res.status(500).json([]);
  }
};
