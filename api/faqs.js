/**
 * Vercel serverless function: /api/faqs
 */
const fs = require("fs");
const path = require("path");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "faqs.json"), "utf8"));
    const list = Array.isArray(data) ? data.filter((item) => item.isPublished !== false).map((item) => ({
      question: String(item.question || ""),
      answer: String(item.answer || ""),
      category: String(item.category || ""),
      displayOrder: Number(item.displayOrder || 0),
    })) : [];
    res.status(200).json(list);
  } catch (_) {
    res.status(500).json([]);
  }
};
