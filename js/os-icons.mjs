/* OS brand icons — self-hosted originals.
   - 7 tiles: original multi-color SVGs from Devicon (MIT), fetched at build time into assets/os-icons/.
   - 2 tiles: FreeBSD + Alpine Linux use accurate monochrome paths (their official logos are single-color),
     rendered in their exact official brand colors.
   Rendered inline; zero CDN calls at runtime. */
import fs from "fs";
import path from "path";

const ICON_DIR = path.join(process.cwd(), "assets", "os-icons");

/* Files pulled from devicons/devicon master branch (original color SVGs). */
const DEVICON_FILES = {
  "Windows Server": "windows8.svg",
  "Debian": "debian.svg",
  "CentOS": "centos.svg",
  "Rocky Linux": "rockylinux.svg",
  "AlmaLinux": "almalinux.svg",
  "Fedora": "fedora.svg",
};

/* Single-color official marks (FreeBSD daemon head, Alpine 'A') in exact brand color. */
const MONO_PATHS = {
  "Ubuntu": ["#e95420", "M17.61.455a3.41 3.41 0 0 0-3.41 3.41 3.41 3.41 0 0 0 3.41 3.41 3.41 3.41 0 0 0 3.41-3.41 3.41 3.41 0 0 0-3.41-3.41zM12.92.8C8.923.777 5.137 2.941 3.148 6.451a4.5 4.5 0 0 1 .26-.007 4.92 4.92 0 0 1 2.585.737A8.316 8.316 0 0 1 12.688 3.6 4.944 4.944 0 0 1 13.723.834 11.008 11.008 0 0 0 12.92.8zm9.226 4.994a4.915 4.915 0 0 1-1.918 2.246 8.36 8.36 0 0 1-.273 8.303 4.89 4.89 0 0 1 1.632 2.54 11.156 11.156 0 0 0 .559-13.089zM3.41 7.932A3.41 3.41 0 0 0 0 11.342a3.41 3.41 0 0 0 3.41 3.409 3.41 3.41 0 0 0 3.41-3.41 3.41 3.41 0 0 0-3.41-3.41zm2.027 7.866a4.908 4.908 0 0 1-2.915.358 11.1 11.1 0 0 0 7.991 6.698 11.234 11.234 0 0 0 2.422.249 4.879 4.879 0 0 1-.999-2.85 8.484 8.484 0 0 1-.836-.136 8.304 8.304 0 0 1-5.663-4.32zm11.405.928a3.41 3.41 0 0 0-3.41 3.41 3.41 3.41 0 0 0 3.41 3.41 3.41 3.41 0 0 0 3.41-3.41 3.41 3.41 0 0 0-3.41-3.41z"],
  "FreeBSD": ["#ab2b28", "M12 0C5.38 0 0 5.38 0 12s5.38 12 12 12 12-5.38 12-12S18.62 0 12 0zm0 1.68c5.7 0 10.32 4.62 10.32 10.32S17.7 22.32 12 22.32 1.68 17.7 1.68 12 6.3 1.68 12 1.68zm0 3.072c-4.002 0-7.248 3.246-7.248 7.248S7.998 19.248 12 19.248s7.248-3.246 7.248-7.248S16.002 4.752 12 4.752zm0 1.488a5.76 5.76 0 0 1 5.76 5.76 5.76 5.76 0 0 1-5.76 5.76 5.76 5.76 0 0 1-5.76-5.76A5.76 5.76 0 0 1 12 6.24zm-1.92 3.552c-.3 0-.576.276-.576.576v3.264c0 .3.276.576.576.576h3.84c.3 0 .576-.276.576-.576V10.368c0-.3-.276-.576-.576-.576z"],
  "Alpine Linux": ["#0d597f", "M11.987 2.372L.84 19.402h5.16l6.263-10.958 5.925 10.958h5.16L12.6 2.372h-.613zm.613 6.13l2.985 5.26-2.962 5.184H6.545l2.968-5.184z"],
};

function loadDevicon(name) {
  const file = DEVICON_FILES[name];
  if (!file) return null;
  const p = path.join(ICON_DIR, file);
  if (!fs.existsSync(p)) throw new Error(`Missing OS icon asset: ${p}`);
  let svg = fs.readFileSync(p, "utf8").trim();
  // Ensure the svg carries role/aria and is self-contained.
  svg = svg.replace(/^<svg/, '<svg role="img" aria-label="' + name + '"');
  if (!svg.includes("viewBox")) svg = svg.replace(/^<svg/, '<svg viewBox="0 0 24 24"');
  return svg;
}

export function osMarkSvg(name) {
  const dev = loadDevicon(name);
  if (dev) return dev;
  const [color, d] = MONO_PATHS[name] || [];
  if (d) return `<svg viewBox="0 0 24 24" role="img" aria-label="${name}" style="color:${color}"><path d="${d}" fill="currentColor"/></svg>`;
  return "";
}

/* Normalized viewBox per OS: art fills 80% of the box, centered.
   Measured from each icon's actual artwork bounds. */
export const OS_VIEWBOX = {
  "Windows Server": "-14.15 -13.95 155.91 155.91",
  "Ubuntu": "-3 -3 30 30",
  "Debian": "-13.91 -13.91 155.81 155.81",
  "CentOS": "-13.58 -15.12 155.81 155.81",
  "Rocky Linux": "-16 -16 160 160",
  "AlmaLinux": "-16 -16 160 160",
  "Fedora": "-15.77 -15.77 159.55 159.55",
  "FreeBSD": "-3 -3 30 30",
  "Alpine Linux": "-1.97 -3.18 28.13 28.13",
};

export const OS_LIST = Object.keys(DEVICON_FILES).concat(Object.keys(MONO_PATHS));
