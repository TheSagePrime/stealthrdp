/* OS brand icons — verbatim self-hosted library assets.
   - Devicon (MIT): Windows Server, Ubuntu, Debian, CentOS, Rocky Linux,
     AlmaLinux, and Fedora.
   - theSVG (CC0): FreeBSD and Alpine Linux.
   All assets are checked into assets/os-icons/ and rendered inline.
   There are no runtime CDN calls and no hand-assembled brand paths. */
import fs from "fs";
import path from "path";

const ICON_DIR = path.join(process.cwd(), "assets", "os-icons");

const ICON_FILES = {
  "Windows Server": "windows8.svg",
  "Ubuntu": "ubuntu.svg",
  "Debian": "debian.svg",
  "CentOS": "centos.svg",
  "Rocky Linux": "rockylinux.svg",
  "AlmaLinux": "almalinux.svg",
  "Fedora": "fedora.svg",
  "FreeBSD": "freebsd.svg",
  "Alpine Linux": "alpine-linux.svg",
};

function loadIcon(name) {
  const file = ICON_FILES[name];
  if (!file) throw new Error(`Unknown OS icon: ${name}`);
  const asset = path.join(ICON_DIR, file);
  if (!fs.existsSync(asset)) throw new Error(`Missing OS icon asset: ${asset}`);
  let svg = fs.readFileSync(asset, "utf8").trim();
  svg = svg.replace(/<title>[\s\S]*?<\/title>/i, "");
  svg = svg.replace(/^<svg([^>]*)>/, (_match, attrs) => {
    const withoutA11y = attrs.replace(/\s(?:role|aria-label)="[^"]*"/g, "");
    return `<svg${withoutA11y} role="img" aria-label="${name}">`;
  });
  if (!svg.includes("viewBox")) svg = svg.replace(/^<svg/, '<svg viewBox="0 0 24 24"');
  return svg;
}

export function osMarkSvg(name) {
  return loadIcon(name);
}

/* Normalized viewBoxes keep different source artboards visually aligned.
   Ubuntu preserves its official orange rectangle and white glyph. */
export const OS_VIEWBOX = {
  "Windows Server": "-14.15 -13.95 155.91 155.91",
  "Ubuntu": "20 0 88.663 128",
  "Debian": "-13.91 -13.91 155.81 155.81",
  "CentOS": "-13.58 -15.12 155.81 155.81",
  "Rocky Linux": "-16 -16 160 160",
  "AlmaLinux": "-16 -16 160 160",
  "Fedora": "-15.77 -15.77 159.55 159.55",
  "FreeBSD": "-1 -1 26 26",
  "Alpine Linux": "-1 -1 26 26",
};

export const OS_LIST = Object.keys(ICON_FILES);
