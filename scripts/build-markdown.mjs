import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const domino = require("@mixmark-io/domino");
const TurndownService = require("turndown");

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIRECTORY = path.dirname(SCRIPT_FILE);
const ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const defaultOutput = path.join(ROOT, "markdown");
const BASE = (process.env.SRDP_BASE || "https://www.stealthrdp.com").replace(/\/+$/, "");

function assertSafeOutputPath(value) {
  const output = path.resolve(String(value || ""));
  if (output !== defaultOutput || path.dirname(output) !== ROOT) {
    throw new Error(`Refusing unsafe Markdown output path: ${output}`);
  }
  return output;
}

function resolveTokens(value) {
  return String(value).split("__SRDP_BASE__").join(BASE);
}

function plainText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function metaContent(document, attribute, expectedValue) {
  const element = Array.from(document.getElementsByTagName("meta")).find(
    (meta) => String(meta.getAttribute(attribute) || "").toLowerCase() === expectedValue,
  );
  return element ? plainText(element.getAttribute("content")) : "";
}

function collectHtmlFiles() {
  const files = [];
  for (const name of fs.readdirSync(ROOT)) {
    if (name.endsWith(".html")) files.push(name);
  }
  for (const directory of ["blog", "docs"]) {
    const absolute = path.join(ROOT, directory);
    if (!fs.existsSync(absolute)) continue;
    for (const name of fs.readdirSync(absolute)) {
      if (name.endsWith(".html")) files.push(path.join(directory, name));
    }
  }
  return files.sort();
}

function pageToMarkdown(rawHtml) {
  const html = resolveTokens(rawHtml);
  const turndown = new TurndownService({
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    headingStyle: "atx",
    strongDelimiter: "**",
  });
  turndown.remove([
    "script",
    "style",
    "svg",
    "noscript",
    "template",
    "button",
    "form",
    "header",
    "footer",
    "nav",
  ]);
  turndown.remove((node) => {
    if (!node || node.nodeType !== 1 || typeof node.getAttribute !== "function") return false;
    const classes = String(node.getAttribute("class") || "").split(/\s+/);
    return (
      (node.getAttribute("aria-hidden") === "true" && !classes.includes("marquee-label")) ||
      (typeof node.hasAttribute === "function" && node.hasAttribute("hidden")) ||
      classes.includes("review-card-copy") ||
      classes.includes("review-mobile-column")
    );
  });

  const document = domino.createDocument(html);
  const titleElement = document.querySelector("title");
  const title = plainText(titleElement ? titleElement.textContent : "");
  const description = metaContent(document, "name", "description");
  const image = metaContent(document, "property", "og:image");
  const main = document.querySelector("main") || document.body;
  const body = turndown.turndown(main || "").replace(/\n{3,}/g, "\n\n").trim();

  const jsonLd = Array.from(document.getElementsByTagName("script"))
    .filter((script) => String(script.getAttribute("type") || "").toLowerCase() === "application/ld+json")
    .map((script) => JSON.parse(script.textContent))
    .map((value) => JSON.stringify(value, null, 2));

  const frontmatter = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    ...(image ? [`image: ${JSON.stringify(image)}`] : []),
    "---",
  ].join("\n");

  const schema = jsonLd.length ? `\n\n\`\`\`json\n${jsonLd.join("\n")}\n\`\`\`` : "";
  return `${frontmatter}\n\n${body}${schema}\n`;
}

function buildMarkdown() {
  const output = assertSafeOutputPath(defaultOutput);
  const staging = path.join(ROOT, `.markdown-build-${process.pid}`);
  const backup = path.join(ROOT, `.markdown-backup-${process.pid}`);
  fs.rmSync(staging, { recursive: true, force: true });
  fs.rmSync(backup, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  let written = 0;
  try {
    for (const relative of collectHtmlFiles()) {
      const source = path.join(ROOT, relative);
      const destination = path.join(staging, `${relative}.md`);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, pageToMarkdown(fs.readFileSync(source, "utf8")));
      written += 1;
    }

    if (fs.existsSync(output)) fs.renameSync(output, backup);
    try {
      fs.renameSync(staging, output);
    } catch (error) {
      if (fs.existsSync(backup)) fs.renameSync(backup, output);
      throw error;
    }
    fs.rmSync(backup, { recursive: true, force: true });
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }

  console.log(`build-markdown: wrote ${written} files to ${output}`);
  return written;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) buildMarkdown();

export { assertSafeOutputPath, buildMarkdown, defaultOutput, pageToMarkdown };
