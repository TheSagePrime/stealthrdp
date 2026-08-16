"""Capture FULL mobile section screenshots (element-level, no viewport clip)."""
import asyncio
from pathlib import Path

from playwright.async_api import async_playwright

BASE = "https://preview.antah.de/"
OUT = Path("/opt/data/stealthrdp-mobile-audit")


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 390, "height": 844})
        await pg.goto(BASE, wait_until="domcontentloaded")
        await pg.wait_for_timeout(2500)

        selectors = {
            "1-hero": ".hero",
            "2-trust-chips": ".trust-bar",
            "3-usecase": ".usecases-section",
            "4-plans": ".plans-preview",
            "5-infra": ".infrastructure-section",
            "6-reviews": ".reviews-section",
            "7-cta": ".cta-band",
            "8-footer": "footer.site-footer, footer",
        }
        for name, sel in selectors.items():
            try:
                el = pg.locator(sel).first
                await el.scroll_into_view_if_needed()
                await pg.wait_for_timeout(400)
                await el.screenshot(path=str(OUT / f"{name}.png"))
                box = await el.bounding_box()
                print(name, "captured", round(box["height"]) if box else "?")
            except Exception as e:
                print(name, "ERR", e)
        await b.close()


asyncio.run(main())
