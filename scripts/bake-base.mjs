/**
 * Bake __SRDP_BASE__ tokens into the built HTML for hosts without a token
 * resolver (Vercel static). Runs ONLY on Vercel builds (VERCEL=1) or when
 * SRDP_BASE is explicitly set. Coolify keeps the tokens so its server can
 * resolve them per-origin at serve time.
 */
import fs from "fs";
import path from "path";

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/\/scripts$/, "");
const isVercel = process.env.VERCEL === "1";
const explicit = process.env.SRDP_BASE;
if (!isVercel && !explicit) {
  console.log("bake-base: skipped (no VERCEL env and SRDP_BASE unset)");
  process.exit(0);
}
const base = (explicit || "https://stealthrdp.com").replace(/\/+$/, "");
const targets = ["*.html", "blog/*.html", "docs/*.html"].flatMap((glob) => {
  const dir = path.join(ROOT, path.dirname(glob));
  const pattern = path.basename(glob);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith(".html")).map((name) => path.join(dir, name)) : [];
});
let replaced = 0;
for (const file of targets) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes("__SRDP_BASE__")) continue;
  fs.writeFileSync(file, text.split("__SRDP_BASE__").join(base));
  replaced += 1;
}
console.log(`bake-base: replaced __SRDP_BASE__ -> ${base} in ${replaced} files`);
