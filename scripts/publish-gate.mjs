#!/usr/bin/env node
/**
 * Publish gate + headless publisher (P0).
 *
 * This is the ONLY sanctioned entry point for turning a publish package into a
 * published article on this project. It runs inside the project's own gate:
 *
 *   npm run gate            (scripts/seo-gates.mjs && scripts/publish-gate.mjs)
 *   -> npm run build        (gate && node build.mjs)
 *   -> npm run build:vercel (gate && build.mjs && bake/base/markdown/stage)
 *
 * The contract (seo/article-publishing-contract.md, v2) is enforced in this
 * order, and the order is the whole point:
 *
 *   1. Every package is validated FIRST:
 *        python3 seo/validate_publish_package.py --package <pkg> --publish-root <root>
 *   2. Non-zero exit => that package publishes NOTHING. No file, no directory,
 *      no staging residue. The build exits non-zero, so nothing ships.
 *   3. Only after exit 0 does the publisher write, and it writes exactly once:
 *      a fully-built staging directory is moved into place with a single
 *      rename(2) (same filesystem => atomic; a reader sees the old state or the
 *      new one, never a half-written article).
 *   4. An existing destination is refused (unique slug), never overwritten.
 *
 * No packages present => no-op, exit 0, and python is never invoked. That keeps
 * ordinary code deploys independent of this gate.
 *
 * Publisher-side rules (stricter than the validator, which is the minimum bar):
 *   - published_path must be exactly "<slug>/index.html"; the whole article
 *     directory then publishes in one atomic rename.
 *   - The package record is written INSIDE the published directory, so the
 *     audit trail and the page land together or not at all.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const PUBLISH_ROOT = path.resolve(ROOT, process.env.PUBLISH_ROOT || "shared/blog");
const INBOX = path.resolve(ROOT, process.env.PUBLISH_INBOX || "shared/publish-inbox");
const VALIDATOR = path.resolve(
  ROOT,
  process.env.PUBLISH_VALIDATOR || path.join("seo", "validate_publish_package.py"),
);
const PYTHON = process.env.PUBLISH_PYTHON || "python3";

const args = process.argv.slice(2);

function collectPackages() {
  const explicit = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--package" && args[i + 1]) explicit.push(path.resolve(ROOT, args[i + 1]));
  }
  if (explicit.length) return explicit;
  if (!fs.existsSync(INBOX)) return [];
  return fs
    .readdirSync(INBOX)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => path.join(INBOX, name));
}

// 1. Resolve work BEFORE touching python: no packages means no-op.
const packages = collectPackages();
if (packages.length === 0) {
  process.exit(0);
}

const failures = [];

function refuse(pkgFile, reason) {
  failures.push(`${path.relative(ROOT, pkgFile)}: ${reason}`);
  console.error(`[REFUSED] ${path.relative(ROOT, pkgFile)}: ${reason}`);
}

function runValidator(pkgFile) {
  // The validator's own output is the failure evidence; keep it verbatim.
  const run = spawnSync(
    PYTHON,
    [VALIDATOR, "--package", pkgFile, "--publish-root", PUBLISH_ROOT],
    { encoding: "utf8" },
  );
  if (run.stdout) process.stdout.write(run.stdout);
  if (run.stderr) process.stderr.write(run.stderr);
  if (run.error) throw new Error(`validator could not run: ${run.error.message}`);
  if (run.status !== 0) {
    const detail = String(run.stdout || "")
      .split("\n")
      .find((line) => line.startsWith("FAIL:")) || `validator exit ${run.status}`;
    throw new Error(detail.trim());
  }
}

function stageAndPublish(pkgFile, pkg) {
  const slug = pkg.slug;
  const publishedPath = pkg.published_path;
  if (publishedPath !== `${slug}/index.html`) {
    refuse(pkgFile, `published_path must be "${slug}/index.html" (got ${JSON.stringify(publishedPath)})`);
    return;
  }

  const destDir = path.resolve(PUBLISH_ROOT, slug);
  if (!destDir.startsWith(PUBLISH_ROOT + path.sep)) {
    refuse(pkgFile, `destination escapes the publish root ${PUBLISH_ROOT}`);
    return;
  }
  if (fs.existsSync(destDir)) {
    refuse(pkgFile, `destination already exists: ${path.relative(ROOT, destDir)} (slug must be unique)`);
    return;
  }

  const html = pkg.body_html
    ? pkg.body_html
    : String(pkg.body_text || "")
        .split(/\n{2,}/)
        .filter((chunk) => chunk.trim() !== "")
        .map((chunk) => `<p>${chunk.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
        .join("\n");

  const stagingParent = path.join(PUBLISH_ROOT, ".staging");
  fs.mkdirSync(PUBLISH_ROOT, { recursive: true });
  fs.mkdirSync(stagingParent, { recursive: true });
  const staging = fs.mkdtempSync(path.join(stagingParent, `${slug}-`));
  try {
    fs.writeFileSync(path.join(staging, "index.html"), html, "utf8");
    fs.writeFileSync(
      path.join(staging, "package.json"),
      `${JSON.stringify(pkg, null, 2)}\n`,
      "utf8",
    );
    // The single atomic step: readers see either the old state or the full article.
    fs.renameSync(staging, destDir);
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    refuse(pkgFile, `atomic rename failed: ${error.message}`);
    return;
  }
  console.log(`[PUBLISHED] ${path.relative(ROOT, destDir)}/ <- ${path.relative(ROOT, pkgFile)}`);
}

for (const pkgFile of packages) {
  if (!fs.existsSync(pkgFile)) {
    refuse(pkgFile, "package file not found");
    continue;
  }
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
  } catch (error) {
    refuse(pkgFile, `package is not readable JSON: ${error.message}`);
    continue;
  }
  try {
    runValidator(pkgFile);
  } catch (error) {
    // Validator exited non-zero: publish NOTHING for this package.
    refuse(pkgFile, `validator rejected the package — ${error.message}`);
    continue;
  }
  stageAndPublish(pkgFile, pkg);
}

// Remove the staging area only when it holds no leftover work.
try {
  const stagingParent = path.join(PUBLISH_ROOT, ".staging");
  if (fs.existsSync(stagingParent) && fs.readdirSync(stagingParent).length === 0) {
    fs.rmdirSync(stagingParent);
  }
} catch {
  /* a staging directory that cannot be tidied is not a publish failure */
}

if (failures.length) {
  console.error(`\nPublish gate FAILED: ${failures.length} package(s) refused. Nothing from them was published.`);
  for (const line of failures) console.error(`- ${line}`);
  process.exit(1);
}
