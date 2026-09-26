"use strict";
/*
 * Publish gate (P0): an unsigned package must be refused by the publisher, and
 * a refused package must leave the publish root completely untouched.
 *
 * The publisher is exercised as a real child process against a throwaway
 * sandbox root, because the contract is about process exit codes and writes on
 * disk, not about an imported function's return value.
 */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const PUBLISHER = path.join(ROOT, "scripts", "publish-gate.mjs");
const VALIDATOR = path.join(ROOT, "seo", "validate_publish_package.py");

// Deterministic 400-word body: 10 words repeated 40 times.
const WORDS = "alpha beta gamma delta epsilon zeta eta theta iota kappa".split(" ");
const BODY_WORDS = WORDS.length * 40;
const BODY_HTML = `<article><p>${Array.from({ length: 40 }, () => WORDS.join(" ")).join("</p><p>")}</p></article>`;

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "publish-gate-test-"));
  fs.mkdirSync(path.join(dir, "inbox"), { recursive: true });
  fs.mkdirSync(path.join(dir, "blog"), { recursive: true });
  return dir;
}

function signedPackage(slug) {
  return {
    slug,
    title: "Signed publish package",
    meta_description: "A package that carries a named human sign-off.",
    canonical_url: `https://www.stealthrdp.com/blog/${slug}`,
    author: {
      name: "Bhuvan",
      url: "https://www.stealthrdp.com/about",
      person_id: "https://www.stealthrdp.com/#person-bhuvan",
    },
    content_hash: "0".repeat(64),
    cta_paths: ["/plans"],
    published_path: `${slug}/index.html`,
    body_words: BODY_WORDS,
    body_html: BODY_HTML,
    human_signoff: {
      name: "Bhuvan",
      datetime: "2026-09-01T10:00:00Z",
      scope: "editorial approval of body, metadata, and CTA",
    },
  };
}

function run(dir, overrides = {}) {
  return spawnSync(process.execPath, [PUBLISHER], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      PUBLISH_ROOT: path.join(dir, "blog"),
      PUBLISH_INBOX: path.join(dir, "inbox"),
      PUBLISH_VALIDATOR: VALIDATOR,
      ...overrides,
    },
  });
}

function writePackage(dir, name, pkg) {
  const file = path.join(dir, "inbox", name);
  fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return file;
}

test("no packages in the inbox is a silent no-op that never invokes python", () => {
  const dir = sandbox();
  const result = run(dir, { PUBLISH_PYTHON: path.join(dir, "no-such-python") });
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(result.stdout, "");
  assert.deepStrictEqual(fs.readdirSync(path.join(dir, "blog")), []);
});

test("a package without human_signoff is refused and publishes nothing", () => {
  const dir = sandbox();
  const pkg = signedPackage("no-signoff-article");
  delete pkg.human_signoff;
  writePackage(dir, "no-signoff.json", pkg);

  const result = run(dir);
  assert.notStrictEqual(result.status, 0, "publisher must exit non-zero");
  assert.match(result.stderr, /human_signoff/);
  assert.match(result.stderr, /REFUSED/);
  const root = path.join(dir, "blog");
  assert.deepStrictEqual(fs.readdirSync(root), [], "publish root must stay empty");
});

test("a package failing the scale gate is refused and publishes nothing", () => {
  const dir = sandbox();
  const pkg = signedPackage("thin-article");
  pkg.body_words = 40;
  pkg.body_html = `<p>${WORDS.join(" ")}</p><p>${WORDS.join(" ")}</p><p>${WORDS.join(" ")}</p><p>${WORDS.join(" ")}</p>`;
  writePackage(dir, "thin.json", pkg);

  const result = run(dir);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /body_words/);
  assert.deepStrictEqual(fs.readdirSync(path.join(dir, "blog")), []);
});

test("a signed package publishes in one atomic rename and keeps the record with the page", () => {
  const dir = sandbox();
  writePackage(dir, "signed.json", signedPackage("signed-article"));

  const result = run(dir);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[PUBLISHED\] .*signed-article\//);

  const dest = path.join(dir, "blog", "signed-article");
  const html = fs.readFileSync(path.join(dest, "index.html"), "utf8");
  const record = JSON.parse(fs.readFileSync(path.join(dest, "package.json"), "utf8"));
  assert.strictEqual(html, BODY_HTML);
  assert.strictEqual(record.slug, "signed-article");
  assert.strictEqual(record.human_signoff.name, "Bhuvan");
  assert.ok(!fs.existsSync(path.join(dir, "blog", ".staging")), "staging area must be cleaned up");
});

test("an existing destination is refused and left byte-identical", () => {
  const dir = sandbox();
  const dest = path.join(dir, "blog", "taken-article");
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, "index.html"), "ORIGINAL", "utf8");
  writePackage(dir, "taken.json", signedPackage("taken-article"));

  const result = run(dir);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /already exists/);
  assert.strictEqual(fs.readFileSync(path.join(dest, "index.html"), "utf8"), "ORIGINAL");
  assert.ok(!fs.existsSync(path.join(dest, "package.json")), "no partial record may land");
});

test("one bad package does not publish the good package beside it, and the good one still ships when alone", () => {
  const dir = sandbox();
  const bad = signedPackage("refused-article");
  delete bad.human_signoff;
  writePackage(dir, "a-bad.json", bad);
  writePackage(dir, "b-good.json", signedPackage("good-article"));

  const result = run(dir);
  assert.notStrictEqual(result.status, 0, "the gate must fail the run when any package is refused");
  assert.strictEqual(fs.existsSync(path.join(dir, "blog", "refused-article")), false);
  assert.strictEqual(
    fs.existsSync(path.join(dir, "blog", "good-article", "index.html")),
    true,
    "a validated package is still published",
  );
});
