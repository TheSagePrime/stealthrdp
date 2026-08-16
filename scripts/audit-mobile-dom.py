"""Deterministic mobile audit: measure clipping, asymmetry, overflow at 390px."""
import asyncio

from playwright.async_api import async_playwright

BASE = "https://preview.antah.de/"


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 390, "height": 844})
        await pg.goto(BASE, wait_until="domcontentloaded")
        await pg.wait_for_timeout(2500)

        r = await pg.evaluate("""() => {
          const out = {};
          const q = (s) => document.querySelector(s);

          // 1. Eyebrow wrap/cut
          const eye = q('.hero .eyebrow');
          if (eye) {
            const cs = getComputedStyle(eye);
            out.eyebrow = {height: Math.round(eye.getBoundingClientRect().height), lines: Math.round(eye.getBoundingClientRect().height / parseFloat(cs.lineHeight)), scrollW: eye.scrollWidth, clientW: eye.clientWidth};
          }

          // 2. Hero stats container + rows
          const stats = q('.hero-stats');
          const statRows = [...document.querySelectorAll('.hero-stat')];
          out.heroStats = {display: stats ? getComputedStyle(stats).flexDirection : '?', rows: statRows.map(s => ({borderBottom: getComputedStyle(s).borderBottomWidth, h: Math.round(s.getBoundingClientRect().height)}))};

          // 3. CTA buttons spacing
          const cta = q('.hero-cta');
          out.ctaGap = cta ? getComputedStyle(cta).gap : '?';
          const micro = q('.hero-micro');
          const statBoxTop = stats ? stats.getBoundingClientRect().top : 0;
          out.gapMicroToStats = micro && stats ? Math.round(statBoxTop - micro.getBoundingClientRect().bottom) : '?';

          // 4. Header palette trigger visibility
          const pal = q('.palette-trigger, #paletteToggle, [data-palette-trigger]');
          out.paletteTrigger = pal ? {display: getComputedStyle(pal).display, text: pal.textContent.trim().slice(0,20)} : 'not-found';

          // 5. Plan finder widths
          const finder = q('.plan-finder');
          const sel = q('.finder-field select');
          const locTabs = q('#locationTabs');
          out.finder = finder ? {w: Math.round(finder.getBoundingClientRect().width), selW: sel ? Math.round(sel.getBoundingClientRect().width) : '?', locW: locTabs ? Math.round(locTabs.getBoundingClientRect().width) : '?', scrollW: finder.scrollWidth, clientW: finder.clientWidth} : 'missing';

          // 6. Billing toggle wrap
          const bill = q('#billingToggle');
          out.billing = bill ? {h: Math.round(bill.getBoundingClientRect().height), wrap: getComputedStyle(bill).flexWrap} : 'missing';

          // 7. Plan card clipping
          const card = q('.plan-card');
          out.planCard = card ? {w: Math.round(card.getBoundingClientRect().width), h: Math.round(card.getBoundingClientRect().height), scrollW: card.scrollWidth, clientW: card.clientWidth, priceFont: q('.plan-price .cur') ? getComputedStyle(q('.plan-price .cur')).fontSize : '?'} : 'missing';
          const grid = q('.plan-grid');
          out.planGrid = grid ? {scrollW: grid.scrollWidth, clientW: grid.clientWidth, scrollable: grid.scrollWidth > grid.clientWidth} : 'missing';

          // 8. Infra rows alignment
          const infraItems = [...document.querySelectorAll('.infra-list li')];
          out.infra = infraItems.map(li => ({h: Math.round(li.getBoundingClientRect().height)}));

          // 9. Review card clipping
          const rc = q('.review-card');
          out.reviewCard = rc ? {w: Math.round(rc.getBoundingClientRect().width), scrollW: rc.scrollWidth, clientW: rc.clientWidth} : 'missing';

          // 10. Trust bar structure
          const trust = q('.trust-bar .container');
          out.trust = trust ? {h: Math.round(trust.getBoundingClientRect().height), items: [...trust.children].map(c => ({text: c.textContent.trim().slice(0,25), w: Math.round(c.getBoundingClientRect().width)}))} : 'missing';

          // 11. CTA
          const ctaBand = q('.cta-band .cta-grid');
          out.ctaBand = ctaBand ? {cols: getComputedStyle(ctaBand).gridTemplateColumns, btnW: q('.cta-actions .btn') ? Math.round(q('.cta-actions .btn').getBoundingClientRect().width) : '?'} : 'missing';

          // 12. Footer
          const foot = document.querySelector('footer');
          out.footer = foot ? {h: Math.round(foot.getBoundingClientRect().height), display: getComputedStyle(foot).display} : 'missing';

          out.bodyOverflow = document.documentElement.scrollWidth - window.innerWidth;
          return out;
        }""")
        import json
        print(json.dumps(r, indent=1))
        await b.close()


asyncio.run(main())
