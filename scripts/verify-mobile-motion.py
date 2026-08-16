"""Verify mobile OS/review motion and desktop regression on the local build."""
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright

OUT = Path("/opt/data/stealthrdp-mobile-audit")


async def probe(page, label):
    await page.goto("http://127.0.0.1:8080/", wait_until="domcontentloaded")
    await page.wait_for_timeout(900)
    before = await page.evaluate("""() => {
      const css = s => getComputedStyle(document.querySelector(s));
      const rect = s => document.querySelector(s)?.getBoundingClientRect();
      const r = rect('.review-wall');
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        osAnimation: css('.marquee-track').animationName,
        osDuration: css('.marquee-track').animationDuration,
        reviewAnimation: css('.review-mobile-track').animationName,
        desktopReviewAnimation: css('.review-column-1 .review-track').animationName,
        reviewDuration: css('.review-mobile-track').animationDuration,
        reviewWallDisplay: css('.review-wall').display,
        mobileColumnDisplay: css('.review-mobile-column').display,
        desktopColumnDisplays: [...document.querySelectorAll('.review-column')].map(e => getComputedStyle(e).display),
        mobileReviewMore: Boolean(document.querySelector('#reviewsMore')),
        reviewHeight: r ? Math.round(r.height) : null,
        reviewCount: document.querySelector('.review-wall')?.dataset.reviewCount,
        osTrackTransform: css('.marquee-track').transform,
        reviewTrackTransform: css('.review-mobile-track').transform,
      };
    }""")
    await page.wait_for_timeout(1300)
    after = await page.evaluate("""() => ({
      osTrackTransform: getComputedStyle(document.querySelector('.marquee-track')).transform,
      reviewTrackTransform: getComputedStyle(document.querySelector('.review-mobile-track')).transform,
      overflow: document.documentElement.scrollWidth - innerWidth
    })""")
    await page.screenshot(path=str(OUT / f"{label}.png"), full_page=False)
    return {"before": before, "after": after}


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        results = {}

        mobile = await browser.new_page(viewport={"width": 390, "height": 844})
        results["mobile"] = await probe(mobile, "motion-mobile")
        await mobile.close()

        reduced = await browser.new_page(viewport={"width": 390, "height": 844})
        await reduced.emulate_media(reduced_motion="reduce")
        await reduced.goto("http://127.0.0.1:8080/", wait_until="domcontentloaded")
        await reduced.wait_for_timeout(900)
        results["reducedMotion"] = await reduced.evaluate("""() => ({
          osAnimation: getComputedStyle(document.querySelector('.marquee-track')).animationName,
          reviewAnimation: getComputedStyle(document.querySelector('.review-mobile-track')).animationName,
        })""")
        await reduced.close()

        desktop = await browser.new_page(viewport={"width": 1440, "height": 900})
        results["desktop"] = await probe(desktop, "motion-desktop")
        await desktop.close()
        await browser.close()

    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
