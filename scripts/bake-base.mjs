/**
 * Bake __SRDP_BASE__ tokens into built files for hosts without a token
 * resolver (Vercel static). Runs ONLY on Vercel builds (VERCEL=1) or when
 * SRDP_BASE is explicitly set. Coolify keeps the tokens so its server can
 * resolve them at serve time.
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
const base = (explicit || "https://www.stealthrdp.com").replace(/\/+$/, "");

function collectFiles() {
  const out = [];
  const roots = [ROOT, path.join(ROOT, "blog"), path.join(ROOT, "docs"), path.join(ROOT, ".well-known")];
  for (const dir of roots) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (/\.(html|txt|xml|webmanifest)$/.test(name)) out.push(path.join(dir, name));
    }
  }
  return out;
}

let replaced = 0;
for (const file of collectFiles()) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes("__SRDP_BASE__")) continue;
  fs.writeFileSync(file, text.split("__SRDP_BASE__").join(base));
  replaced += 1;
}
console.log(`bake-base: replaced __SRDP_BASE__ -> ${base} in ${replaced} files`);
