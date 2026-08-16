"""Verify mobile optimization on the live preview (390px viewport)."""
import asyncio

from playwright.async_api import async_playwright

BASE = "https://preview.antah.de/"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 390, "height": 844})
        await page.goto(BASE, wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)

        # Plans carousel: horizontal, snap, compact height
        r = await page.evaluate("""() => {
          const grid = document.querySelector('.plan-grid');
          const card = document.querySelector('.plan-card');
          const desc = document.querySelector('.plan-card .p-desc');
          return {
            gridDisplay: getComputedStyle(grid).display,
            overflowX: getComputedStyle(grid).overflowX,
            scrollSnap: getComputedStyle(grid).scrollSnapType,
            cardWidth: Math.round(card.getBoundingClientRect().width),
            viewport: window.innerWidth,
            cardHeight: Math.round(card.getBoundingClientRect().height),
            descHidden: getComputedStyle(desc).display === 'none',
            totalPageHeight: document.body.scrollHeight,
          };
        }""")
        print("plans:", r)

        # Reviews capped on mobile + expand toggle
        r = await page.evaluate("""() => {
          const visible = [...document.querySelectorAll('.review-card')].filter(c => getComputedStyle(c).display !== 'none').length;
          const total = document.querySelectorAll('.review-card').length;
          const btn = document.querySelector('#reviewsMore');
          const btnVisible = getComputedStyle(btn).display !== 'none';
          btn.click();
          const after = [...document.querySelectorAll('.review-card')].filter(c => getComputedStyle(c).display !== 'none').length;
          return {visibleBefore: visible, total, btnVisible, btnText: btn.textContent, visibleAfterExpand: after};
        }""")
        print("reviews:", r)

        # Overall vertical footprint
        r = await page.evaluate("document.body.scrollHeight")
        print("page height after expand:", r)
        await browser.close()


asyncio.run(main())
