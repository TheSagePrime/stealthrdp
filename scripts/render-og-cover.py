"""Render data/og-cover.src.html -> assets/og-cover.png at 1200x630."""
import asyncio
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path("/opt/data/stealthrdp-homepage-edit")
SRC = ROOT / "data" / "og-cover.src.html"
OUT = ROOT / "assets" / "og-cover.png"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
        await page.goto(SRC.as_uri())
        await page.wait_for_timeout(1200)
        await page.screenshot(path=str(OUT))
        await browser.close()
    print(f"written {OUT} ({OUT.stat().st_size} bytes)")


asyncio.run(main())
