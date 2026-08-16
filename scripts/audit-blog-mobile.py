"""Audit and capture Blog mobile layout on the live preview."""
import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

BASE = os.environ.get("BASE_URL", "https://preview.antah.de/blog.html")
OUT = Path("/opt/data/stealthrdp-mobile-audit/blog-pre-compact")

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        results = {}
        for width in (360, 390, 412, 768):
            page = await browser.new_page(viewport={"width": width, "height": 844})
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            await page.goto(BASE, wait_until="domcontentloaded")
            await page.wait_for_timeout(1400)
            results[str(width)] = await page.evaluate("""() => {
              const q=s=>document.querySelector(s);
              const r=s=>{const e=q(s);if(!e)return null;const b=e.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),right:Math.round(b.right),bottom:Math.round(b.bottom)}};
              const cards=[...document.querySelectorAll('.blog-card')];
              return {
                viewport: innerWidth,
                overflow: document.documentElement.scrollWidth-innerWidth,
                bodyHeight: document.body.scrollHeight,
                head:r('.page-head'), toolbar:r('.blog-toolbar'), filters:r('.blog-filters'),
                topics:r('.blog-topics'), results:r('.blog-results-bar'), grid:r('.blog-grid'),
                cards:cards.slice(0,3).map(e=>{const b=e.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),right:Math.round(b.right)}}),
                cardDisplay:getComputedStyle(q('.blog-card')).display,
                cardBodyPadding:getComputedStyle(q('.blog-card .bc-body')).padding,
                topicCount:document.querySelectorAll('[data-blog-topic]').length,
                articleCount:document.querySelectorAll('.blog-card:not([hidden])').length,
                clipping:[...document.querySelectorAll('.page-head,.blog-toolbar,.blog-topics,.blog-results-bar,.blog-card')].filter(e=>e.scrollWidth>e.clientWidth+1).length
              };
            }""")
            await page.screenshot(path=str(OUT / f"{width}-top.png"), full_page=False)
            await page.locator('.blog-grid').screenshot(path=str(OUT / f"{width}-grid.png"))
            chip=page.locator('[data-blog-topic]').nth(1)
            if await chip.count():
                await chip.click()
                await page.wait_for_timeout(200)
                results[str(width)]["filter"] = await page.evaluate("""() => ({active:document.querySelector('[data-blog-topic].active')?.textContent.trim(), visible:document.querySelectorAll('.blog-card:not([hidden])').length})""")
            await page.close()
        (OUT / "measurements.json").write_text(json.dumps(results, indent=2))
        print(json.dumps(results, indent=2))
        await browser.close()

asyncio.run(main())
