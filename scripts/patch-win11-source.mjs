#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.argv[2];
if (!root) throw new Error('Usage: node patch-win11-source.mjs <win11-root>');

const textExts = new Set(['.js', '.jsx', '.json', '.html', '.css', '.scss', '.md', '.txt']);
const skip = new Set(['node_modules', '.git', 'build']);

const replacements = [
  [/mailto:blueedgetechno@gmail\.com/gi, 'https://stealthrdp.com'],
  [/https?:\/\/pinterest\.com\/blue_edge/gi, 'https://stealthrdp.com'],
  [/https?:\/\/open\.spotify\.com\/user\/62axxw0etmycj09el078cock0/gi, 'https://stealthrdp.com'],
  [/https?:\/\/twitter\.com\/blueedgetechno/gi, 'https://stealthrdp.com'],
  [/https?:\/\/github\.com\/blueedgetechno\/windows11/gi, 'https://stealthrdp.com'],
  [/https?:\/\/github\.com\/yyqyu\/win11/gi, 'https://stealthrdp.com'],
  [/https?:\/\/blueedge\.me\/unescape/gi, 'https://stealthrdp.com'],
  [/https?:\/\/discord\.gg\/Fz3Dkc4S/gi, 'https://stealthrdp.com'],
  [/blueedgetechno@gmail\.com/gi, 'StealthRDP'],
  [/blueedgetechno/gi, 'StealthRDP'],
  [/blue_edge/gi, 'StealthRDP'],
  [/Blue Edge/gi, 'StealthRDP'],
  [/name:\s*['"]Blue['"]/g, "name: 'StealthRDP'"],
  [/name:\s*['"]Unescape['"]/g, "name: 'StealthRDP'"],
  [/icon:\s*['"]unescape['"]/g, "icon: 'settings'"],
];

let changed = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!entry.isFile() || !textExts.has(path.extname(entry.name).toLowerCase())) continue;
    let text = fs.readFileSync(full, 'utf8');
    const before = text;
    for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
    if (text !== before) {
      fs.writeFileSync(full, text);
      changed += 1;
    }
  }
}

walk(root);

// The app hardcodes /img/* at runtime. Keep that path because the StealthRDP
// container copies the demo's public/img directory to /app/img.
console.log(`patch-win11-source: rebranded ${changed} text files`);
