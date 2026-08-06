#!/usr/bin/env python3
"""Fetch latin-subset woff2 fonts from Google Fonts for self-hosting."""
import re, subprocess, os

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
OUT = "/opt/data/stealthrdp-v2/fonts"
os.makedirs(OUT, exist_ok=True)

# One combined CSS request for all families/weights
css_url = ("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700"
           "&family=Inter:wght@400;500;600"
           "&family=JetBrains+Mono:wght@400;600&display=swap")
r = subprocess.run(["curl", "-s", "--max-time", "30", "-A", UA, css_url],
                   capture_output=True, text=True)
css = r.stdout
print(f"CSS bytes: {len(css)}")

blocks = re.findall(r"@font-face\s*\{[^}]*\}", css)
print(f"blocks: {len(blocks)}")

saved = 0
for b in blocks:
    fam = re.search(r"font-family:\s*'([^']+)'", b)
    fw = re.search(r"font-weight:\s*(\d+)", b)
    ur = re.search(r"unicode-range:\s*([^;]+);", b)
    src = re.search(r"url\(([^)]+\.woff2)\)", b)
    if not (fam and fw and ur and src):
        continue
    if "U+0000-00FF" not in ur.group(1):
        continue
    name = fam.group(1).lower().replace(" ", "-")
    out = f"{OUT}/{name}_{fw.group(1)}.woff2"
    subprocess.run(["curl", "-s", "--max-time", "30", src.group(1), "-o", out],
                   check=True)
    size = os.path.getsize(out)
    print(f"saved {out} ({size} bytes)")
    saved += 1

print(f"total saved: {saved}")
