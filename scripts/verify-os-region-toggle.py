#!/usr/bin/env python3
import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:8081")
SCREENSHOT_DIR = Path(os.environ.get("SCREENSHOT_DIR", "/opt/data/tmp/stealthrdp-region-toggle-evidence"))
ROUTES = ["/windows-vps/", "/linux-vps/"]


async def snapshot(page):
    return await page.evaluate(
        """() => ({
          buttons: [...document.querySelectorAll('#locationTabs button')].map((button) => ({
            text: button.textContent.trim(),
            selected: button.getAttribute('aria-selected'),
            active: button.classList.contains('active'),
            height: Math.round(button.getBoundingClientRect().height),
          })),
          cards: [...document.querySelectorAll('#planGrid .plan-card')].map((card) => ({
            region: card.dataset.planLocation,
            hidden: card.hidden,
            display: getComputedStyle(card).display,
            name: card.querySelector('.p-name')?.textContent.trim(),
            regionText: card.querySelector('.p-location')?.textContent.trim(),
            href: card.querySelector('a.btn')?.href,
            rect: (() => {
              const box = card.getBoundingClientRect();
              return { left: Math.round(box.left), right: Math.round(box.right), width: Math.round(box.width) };
            })(),
          })),
          note: document.querySelector('#osVpsRegionNote')?.textContent.trim(),
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          control: (() => {
            const el = document.querySelector('.os-vps-region-control');
            if (!el) return null;
            const box = el.getBoundingClientRect();
            return { width: Math.round(box.width), height: Math.round(box.height) };
          })(),
          structure: {
            guideIntro: Boolean(document.querySelector('.os-vps-guide-intro')),
            guideCards: document.querySelectorAll('.os-vps-guide-card').length,
            opsPanel: Boolean(document.querySelector('.os-vps-ops-panel')),
            orderPanel: Boolean(document.querySelector('.os-vps-order-panel')),
            faqItems: document.querySelectorAll('.os-vps-faq-item').length,
            flatProse: Boolean(document.querySelector('.container.prose')),
          },
        })"""
    )


async def check_route(browser, route):
    page = await browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    await page.goto(BASE + route + "?qa=region-toggle", wait_until="domcontentloaded")
    await page.wait_for_timeout(350)
    usa = await snapshot(page)
    assert [b["text"] for b in usa["buttons"]] == ["USA", "EU"]
    assert usa["buttons"][0]["selected"] == "true"
    assert usa["buttons"][1]["selected"] == "false"
    assert [c["region"] for c in usa["cards"] if not c["hidden"]] == ["USA"] * 6
    assert all(c["display"] == "none" for c in usa["cards"] if c["region"] == "EU")
    assert usa["note"] == "Showing 6 USA plans"
    assert usa["overflow"] <= 0
    expected_faq_items = 8 if route == "/windows-vps/" else 9
    assert usa["structure"]["guideIntro"]
    assert usa["structure"]["guideCards"] == 4
    assert usa["structure"]["opsPanel"] and usa["structure"]["orderPanel"]
    assert usa["structure"]["faqItems"] == expected_faq_items
    assert not usa["structure"]["flatProse"]

    await page.locator('#locationTabs button[data-location="EU"]').click()
    await page.wait_for_timeout(80)
    eu = await snapshot(page)
    assert eu["buttons"][0]["selected"] == "false"
    assert eu["buttons"][1]["selected"] == "true"
    assert [c["region"] for c in eu["cards"] if not c["hidden"]] == ["EU"] * 5
    assert all(c["display"] == "none" for c in eu["cards"] if c["region"] == "USA")
    assert eu["note"] == "Showing 5 EU plans"
    assert eu["overflow"] <= 0
    assert all(c["regionText"] == "Region: EU" for c in eu["cards"] if not c["hidden"])
    assert all("/store/eu/" in c["href"] for c in eu["cards"] if not c["hidden"])

    eu_button = page.locator('#locationTabs button[data-location="EU"]')
    await eu_button.press(" ")
    focus = await eu_button.evaluate(
        "el => ({ focused: document.activeElement === el, outline: getComputedStyle(el).outlineStyle, outlineWidth: getComputedStyle(el).outlineWidth })"
    )
    assert focus["focused"]
    assert focus["outline"] != "none"
    assert focus["outlineWidth"] != "0px"
    await page.locator(".os-vps-catalog").scroll_into_view_if_needed()
    await page.screenshot(path=str(SCREENSHOT_DIR / (route.strip("/").replace("/", "-") + "-desktop.png")), full_page=False)
    await page.locator(".header").evaluate("el => { el.style.visibility = 'hidden'; }")
    await page.locator(".os-vps-guide-grid").screenshot(path=str(SCREENSHOT_DIR / (route.strip("/").replace("/", "-") + "-guide-desktop.png")))
    await page.close()

    mobile = await browser.new_page(viewport={"width": 390, "height": 844})
    mobile_errors = []
    mobile.on("pageerror", lambda error: mobile_errors.append(str(error)))
    await mobile.goto(BASE + route + "?qa=region-toggle-mobile", wait_until="domcontentloaded")
    await mobile.wait_for_timeout(250)
    mobile_before = await snapshot(mobile)
    await mobile.locator('#locationTabs button[data-location="EU"]').click()
    await mobile.wait_for_timeout(80)
    mobile_after = await snapshot(mobile)
    assert mobile_before["overflow"] <= 0
    assert mobile_after["overflow"] <= 0
    assert mobile_after["control"]["width"] <= 390
    assert all(button["height"] >= 24 for button in mobile_after["buttons"])
    assert all(0 <= card["rect"]["left"] and card["rect"]["right"] <= 390 for card in mobile_after["cards"] if not card["hidden"])
    assert mobile_after["structure"]["guideCards"] == 4
    assert not mobile_after["structure"]["flatProse"]
    await mobile.screenshot(path=str(SCREENSHOT_DIR / (route.strip("/").replace("/", "-") + "-mobile.png")), full_page=False)
    await mobile.locator(".header").evaluate("el => { el.style.visibility = 'hidden'; }")
    await mobile.locator(".os-vps-guide-grid").screenshot(path=str(SCREENSHOT_DIR / (route.strip("/").replace("/", "-") + "-guide-mobile.png")))
    await mobile.close()
    assert not errors + mobile_errors, errors + mobile_errors
    return {"route": route, "desktopUSA": usa, "desktopEU": eu, "mobileEU": mobile_after}


async def main():
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        results = [await check_route(browser, route) for route in ROUTES]
        await browser.close()
    print(json.dumps({"base": BASE, "routes": results}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
