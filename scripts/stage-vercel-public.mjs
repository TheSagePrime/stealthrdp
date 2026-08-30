/**
 * Copy the static site into public/ for Vercel.
 * Node + /api does not publish repo-root HTML when outputDirectory is ".".
 */
import fs from "fs";
import path from "path";

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/\/scripts$/, "");
const OUT = path.join(ROOT, "public");

if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const files = [
  "robots.txt",
  "sitemap.xml",
  "d6725e43a76b47b39052a3f5c4ee06bf.txt",
  "rss.xml",
  "llms.txt",
  "site.webmanifest",
  "favicon.ico",
  "favicon.svg",
];
const dirs = ["css", "js", "fonts", "assets", "blog", "docs", "data", "windows-vps", "linux-vps", ".well-known"];

for (const name of fs.readdirSync(ROOT)) {
  if (name.endsWith(".html")) files.push(name);
}

let copied = 0;
for (const rel of files) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src) || !fs.statSync(src).isFile()) continue;
  fs.copyFileSync(src, path.join(OUT, rel));
  copied += 1;
}
for (const rel of dirs) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) continue;
  fs.cpSync(src, path.join(OUT, rel), { recursive: true });
  copied += 1;
}

if (!fs.existsSync(path.join(OUT, "index.html"))) {
  console.error("stage-vercel-public: missing public/index.html");
  process.exit(1);
}
console.log(`stage-vercel-public: staged ${copied} entries into public/`);
