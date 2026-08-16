import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        page=await b.new_page(viewport={"width":390,"height":844})
        await page.goto("http://127.0.0.1:8080/", wait_until="domcontentloaded")
        await page.wait_for_timeout(900)
        section=page.locator(".reviews-section")
        await section.scroll_into_view_if_needed()
        await page.wait_for_timeout(300)
        await section.screenshot(path="/opt/data/stealthrdp-mobile-audit/review-reel-section.png")
        print(await page.evaluate("""() => ({
          scrollY,
          reviewWall: document.querySelector('.review-wall')?.getBoundingClientRect().toJSON(),
          mobileTrack: getComputedStyle(document.querySelector('.review-mobile-track')).transform,
          more: Boolean(document.querySelector('#reviewsMore'))
        })"""))
        await b.close()

asyncio.run(main())
