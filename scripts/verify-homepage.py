"""Verify homepage restructure interactions on the live preview."""
import asyncio

from playwright.async_api import async_playwright

BASE = "https://preview.antah.de/"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto(BASE, wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)

        # 1. Section order sanity
        order = await page.evaluate("""() => {
          const names = ['hero','trust-bar','usecases-section','plans-preview','infrastructure-section','reviews-section','cta-band'];
          return names.map(n => { const el = document.querySelector('.' + n); return el ? el.getBoundingClientRect().top + window.scrollY : -1; });
        }""")
        print("section offsets:", order)

        # 2. Chip click -> recommended highlight + scroll
        r = await page.evaluate("""() => {
          const chips = [...document.querySelectorAll('[data-use-case]')];
          const trading = chips.find(c => c.getAttribute('data-use-case') === 'trading');
          trading.click();
          return {chips: chips.length, recommended: [...document.querySelectorAll('.plan-card.recommended')].map(c => c.querySelector('.p-name')?.textContent), note: document.querySelector('#finderNote').textContent};
        }""")
        print("chip:", r)

        # 3. Select change
        r = await page.evaluate("""() => {
          const sel = document.querySelector('#useCaseSelect');
          sel.value = 'web-hosting';
          sel.dispatchEvent(new Event('change'));
          return {recommended: [...document.querySelectorAll('.plan-card.recommended')].map(c => c.querySelector('.p-name')?.textContent), note: document.querySelector('#finderNote').textContent};
        }""")
        print("select:", r)

        # 4. Location toggle EU
        await page.evaluate("document.querySelector('#locationTabs button[data-location=\\\"EU\\\"]').click()")
        await page.wait_for_timeout(2500)
        r = await page.evaluate("""() => {
          const cards = [...document.querySelectorAll('.plan-card')];
          return {activeLoc: document.querySelector('#locationTabs button.active')?.textContent, cards: cards.length,
                  recommended: cards.filter(c => c.classList.contains('recommended')).map(c => c.querySelector('.p-name')?.textContent),
                  prices: cards.slice(0,3).map(c => c.querySelector('.cur')?.textContent)};
        }""")
        print("location:", r)

        # 5. Trust bar items + mobile no overflow
        r = await page.evaluate("""() => ({trustItems: document.querySelectorAll('.trust-bar span').length, finder: !!document.querySelector('.plan-finder'), outcomeGone: !document.querySelector('.outcome-panel')})""")
        print("structure:", r)
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.wait_for_timeout(800)
        ov = await page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        print("mobile overflow:", ov)
        await browser.close()


asyncio.run(main())
