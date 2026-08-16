#!/usr/bin/env python3
"""Responsive evidence pass for the StealthRDP homepage.

Measures the live/local page and captures each homepage section at the target
mobile widths. It intentionally uses domcontentloaded plus a bounded wait: the
preview status endpoint may be unavailable and must not hold up the audit.
"""
from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from typing import Any

from playwright.async_api import async_playwright

WIDTHS = (360, 390, 412, 768)
SECTIONS = {
    "01-hero": ".hero",
    "02-trust": ".trust-bar",
    "03-usecases": ".decision-header",
    "04-plans": ".decision-combined",
    "05-infrastructure": ".infrastructure-section",
    "06-reviews": ".reviews-section",
    "07-cta": ".cta-band",
    "08-footer": "footer.footer",
}

MEASURE_JS = r"""() => {
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const visible = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden';
  };
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      left: +r.left.toFixed(2), right: +r.right.toFixed(2),
      top: +(r.top + scrollY).toFixed(2), bottom: +(r.bottom + scrollY).toFixed(2),
      width: +r.width.toFixed(2), height: +r.height.toFixed(2)
    };
  };
  const lines = (el) => {
    if (!el || !el.textContent.trim()) return 0;
    const s = getComputedStyle(el);
    const lineHeight = parseFloat(s.lineHeight);
    const box = el.getBoundingClientRect();
    const contentHeight = box.height - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom);
    if (Number.isFinite(lineHeight) && lineHeight > 0 && contentHeight > lineHeight * 1.05) {
      return Math.max(1, Math.round(contentHeight / lineHeight));
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.width || r.height);
    const ys = [];
    rects.forEach((r) => {
      const y = Math.round(r.top * 10) / 10;
      if (!ys.some((value) => Math.abs(value - y) < 1)) ys.push(y);
    });
    return ys.length;
  };
  const probe = (selector, limit = 20) => qa(selector).filter(visible).slice(0, limit).map((el) => {
    const r = rect(el);
    const s = getComputedStyle(el);
    return {
      selector, text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 120), rect: r,
      lines: lines(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
      overflowX: s.overflowX, overflowY: s.overflowY, whiteSpace: s.whiteSpace,
      clipped: el.scrollWidth > el.clientWidth + 1 ||
        (el.scrollHeight > el.clientHeight + 1 && (s.overflowY === 'hidden' || s.overflowY === 'clip'))
    };
  });
  const container = q('.hero .container') || q('.container');
  const cr = container ? container.getBoundingClientRect() : null;
  const cps = container ? getComputedStyle(container) : null;
  const gutter = cr ? {
    left: +(cr.left + parseFloat(cps.paddingLeft)).toFixed(2),
    right: +(cr.right - parseFloat(cps.paddingRight)).toFixed(2),
    width: +(cr.width - parseFloat(cps.paddingLeft) - parseFloat(cps.paddingRight)).toFixed(2)
  } : null;
  const sectionNames = [
    ['hero', '.hero'], ['marquee', '.marquee'], ['trust', '.trust-bar'],
    ['usecases', '.decision-header'], ['plans', '.decision-combined'],
    ['infrastructure', '.infrastructure-section'], ['reviews', '.reviews-section'],
    ['cta', '.cta-band'], ['footer', 'footer.footer']
  ];
  const sections = sectionNames.map(([name, selector]) => {
    const el = q(selector);
    const r = rect(el);
    return r ? { name, selector, ...r } : { name, selector, missing: true };
  });
  const rhythm = sections.filter((section) => !section.missing).map((section, index, all) => {
    const next = all[index + 1];
    return {...section, gapToNext: next ? +(next.top - section.bottom).toFixed(2) : null};
  });
  const edgeSelectors = [
    '.hero-copy', '.hero-copy > *', '.trust-bar .container > *',
    '.decision-combined > .container > *', '.decision-header > *', '.decision-workload', '.decision-combined .usecase-chips > *',
    '.plans-preview .section-head', '.plan-finder', '.plan-finder > *',
    '.billing-toggle', '.plan-grid', '.plan-card', '.infrastructure-section .container > *',
    '.infra-list li', '.review-card', '.review-disclosure', '.reviews-more',
    '.cta-grid > *', '.cta-actions .btn', 'footer.footer .container > *',
    '.footer-grid > *', '.footer-bottom > *'
  ];
  const edgeElements = edgeSelectors.flatMap((selector) => probe(selector, 80));
  const outsideGutter = gutter ? edgeElements.filter((item) => item.rect &&
    !['.plan-grid', '.plan-card'].includes(item.selector) &&
    (item.rect.left < gutter.left - 1 || item.rect.right > gutter.right + 1)) : [];
  const textSelectors = [
    '.hero .eyebrow', '.hero h1', '.hero .sub', '.hero-micro', '.hero-stat .lbl',
    '.trust-bar .container', '.decision-header h2', '.decision-header p', '.topic-chip',
    '.plans-preview h2', '.plans-preview .section-head p', '.finder-note', '.plan-card .p-name',
    '.plan-card .plan-price', '.plan-card .plan-spec', '.infra-list li',
    '.reviews-head h2', '.reviews-head p', '.review-card blockquote', '.cta-copy h2',
    '.cta-copy p', '.footer-about p', '.footer-col a'
  ];
  const textProbes = textSelectors.flatMap((selector) => probe(selector, 80));
  const textClipping = textProbes.filter((item) => item.clipped ||
    (item.whiteSpace === 'nowrap' && item.scrollWidth > item.clientWidth + 1));
  const grid = q('.plan-grid');
  const cards = grid ? qa('.plan-card', grid).map(rect) : [];
  const gridRect = rect(grid);
  const popularTag = q('.plan-card.popular .plan-popular');
  const popularTagRect = rect(popularTag);
  const popularTagClipped = !!(gridRect && popularTagRect && (popularTagRect.top < gridRect.top || popularTagRect.bottom > gridRect.bottom));
  const carousel = grid ? {
    rect: gridRect, display: getComputedStyle(grid).display, overflowX: getComputedStyle(grid).overflowX,
    snap: getComputedStyle(grid).scrollSnapType, scrollLeft: +grid.scrollLeft.toFixed(2),
    scrollWidth: grid.scrollWidth, clientWidth: grid.clientWidth, cards
  } : null;
  const stats = q('.hero-stats');
  const finder = q('.plan-finder');
  const eyebrow = q('.hero .eyebrow');
  const reviews = q('.review-wall');
  const footer = q('footer.footer');
  return {
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    document: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth, bodyHeight: document.body.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth },
    gutter, sections: rhythm,
    key: {
      eyebrow: eyebrow ? {...rect(eyebrow), lines: lines(eyebrow), scrollWidth: eyebrow.scrollWidth, clientWidth: eyebrow.clientWidth, clipped: eyebrow.scrollWidth > eyebrow.clientWidth + 1 || eyebrow.scrollHeight > eyebrow.clientHeight + 1} : null,
      hero: rect(q('.hero')), heroCopy: rect(q('.hero-copy')), stats: stats ? {...rect(stats), display: getComputedStyle(stats).display, direction: getComputedStyle(stats).flexDirection,
        children: qa('.hero-stat', stats).map((el) => ({...rect(el), borderRight: getComputedStyle(el).borderRightWidth, borderBottom: getComputedStyle(el).borderBottomWidth}))} : null,
      microToStatsGap: q('.hero-micro') && stats ? +(stats.getBoundingClientRect().top - q('.hero-micro').getBoundingClientRect().bottom).toFixed(2) : null,
      finder: finder ? {...rect(finder), scrollWidth: finder.scrollWidth, clientWidth: finder.clientWidth,
        controls: qa('select, #locationTabs, .finder-note', finder).map(rect)} : null,
      billing: q('#billingToggle') ? {...rect(q('#billingToggle')), wrap: getComputedStyle(q('#billingToggle')).flexWrap} : null,
      carousel, popularTag: popularTagRect, popularTagClipped, infraRows: qa('.infra-list li').map(rect),
      reviews: reviews ? {...rect(reviews), visibleCards: qa('.review-card').filter(visible).length, totalCards: qa('.review-card').length,
        disclosure: rect(q('.review-disclosure')), more: rect(q('#reviewsMore'))} : null,
      cta: rect(q('.cta-band')), footer: footer ? rect(footer) : null
    },
    outsideGutter, textClipping, textProbes,
    consoleErrors: window.__auditConsoleErrors || []
  };
}"""


async def interaction_probe(page) -> dict[str, Any]:
    async def click_if_present(selector: str) -> bool:
        locator = page.locator(selector).first
        if await locator.count() and await locator.is_visible():
            await locator.click()
            return True
        return False

    result: dict[str, Any] = {}
    result["nav"] = False
    nav = page.locator("#navToggle").first
    if await nav.count() and await nav.is_visible():
        await nav.click()
        result["nav"] = await page.locator("#mobileNav").evaluate("el => el.classList.contains('open')")
        await nav.click()

    chip = page.locator('[data-use-case="trading"]').first
    if await chip.count():
        await chip.click()
        await page.wait_for_timeout(100)
        result["chip"] = await page.evaluate("""() => ({
          active: document.querySelector('[data-use-case="trading"]')?.classList.contains('active'),
          recommended: [...document.querySelectorAll('.plan-card.recommended')].map(c => c.querySelector('.p-name')?.textContent.trim()),
          note: document.querySelector('#finderNote')?.textContent.trim(),
          plansTop: document.querySelector('#plans')?.getBoundingClientRect().top + scrollY
        })""")

    use_case = page.locator("#useCaseSelect").first
    if await use_case.count():
        await use_case.select_option("web-hosting")
        await page.wait_for_timeout(80)
        result["useCaseSelect"] = await page.evaluate("""() => ({
          value: document.querySelector('#useCaseSelect')?.value,
          recommended: [...document.querySelectorAll('.plan-card.recommended')].map(c => c.querySelector('.p-name')?.textContent.trim()),
          note: document.querySelector('#finderNote')?.textContent.trim()
        })""")

    os_select = page.locator("#osSelect").first
    if await os_select.count():
        await os_select.select_option("windows")
        await page.wait_for_timeout(80)
        result["osSelect"] = await page.evaluate("""() => ({
          value: document.querySelector('#osSelect')?.value,
          note: document.querySelector('#finderNote')?.textContent.trim()
        })""")

    eu = page.locator('#locationTabs button[data-location="EU"]').first
    if await eu.count():
        await eu.click()
        await page.wait_for_timeout(700)
        result["location"] = await page.evaluate("""() => ({
          active: document.querySelector('#locationTabs button.active')?.textContent.trim(),
          cards: [...document.querySelectorAll('#planGrid .plan-card')].map(c => c.querySelector('.p-name')?.textContent.trim()),
          recommended: [...document.querySelectorAll('#planGrid .plan-card.recommended')].map(c => c.querySelector('.p-name')?.textContent.trim()),
          prices: [...document.querySelectorAll('#planGrid .plan-card .cur')].map(c => c.textContent.trim())
        })""")

    annual = page.locator('#billingToggle button[data-cycle="annual"]').first
    if await annual.count():
        await annual.click()
        await page.wait_for_timeout(80)
        result["billing"] = await page.evaluate("""() => ({
          active: document.querySelector('#billingToggle button.active')?.dataset.cycle,
          firstPrice: document.querySelector('#planGrid .plan-card .cur')?.textContent.trim()
        })""")

    more = page.locator("#reviewsMore").first
    if await more.count() and await more.is_visible():
        before = await page.locator('.review-card:visible').count()
        await more.click()
        await page.wait_for_timeout(80)
        after = await page.locator('.review-card:visible').count()
        result["reviews"] = {"before": before, "after": after, "label": await more.text_content()}

    result["carousel"] = await page.evaluate("""() => {
      const grid = document.querySelector('#planGrid');
      if (!grid || !grid.children.length) return null;
      const first = grid.children[0].getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(grid).gap) || 0;
      const step = first.width + gap;
      const before = grid.scrollLeft;
      grid.scrollLeft = before + step;
      return {before, step, after: grid.scrollLeft, delta: grid.scrollLeft - before,
        firstLeft: first.left, cardWidth: first.width, viewportRight: innerWidth};
    }""")
    await page.wait_for_timeout(160)
    result["carouselAfterSettle"] = await page.evaluate("""() => {
      const grid = document.querySelector('#planGrid');
      if (!grid || !grid.children.length) return null;
      const first = grid.children[0].getBoundingClientRect();
      const second = grid.children[1]?.getBoundingClientRect();
      return {scrollLeft: grid.scrollLeft, first, second};
    }""")
    return result


async def audit_source(browser, base: str, label: str, out_dir: Path) -> dict[str, Any]:
    source_dir = out_dir / label
    source_dir.mkdir(parents=True, exist_ok=True)
    all_results: dict[str, Any] = {"base": base, "label": label, "widths": {}}
    for width in WIDTHS:
        page = await browser.new_page(viewport={"width": width, "height": 900}, device_scale_factor=1)
        console_errors: list[str] = []
        page_errors: list[str] = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        await page.emulate_media(reduced_motion="reduce")
        entry: dict[str, Any] = {"width": width, "screenshots": {}, "navigation": {}}
        try:
            response = await page.goto(base, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(700)
            await page.evaluate("document.fonts && document.fonts.ready")
            entry["navigation"] = {"status": response.status if response else None, "url": page.url, "title": await page.title()}
            await page.evaluate("window.__auditConsoleErrors = []")
            for name, selector in SECTIONS.items():
                locator = page.locator(selector).first
                if await locator.count():
                    await locator.scroll_into_view_if_needed()
                    await page.wait_for_timeout(60)
                    path = source_dir / str(width) / f"{name}.png"
                    path.parent.mkdir(parents=True, exist_ok=True)
                    await locator.screenshot(path=str(path), animations="disabled")
                    entry["screenshots"][name] = str(path)
                else:
                    entry["screenshots"][name] = None
            await page.evaluate("window.scrollTo(0, 0)")
            await page.wait_for_timeout(60)
            entry["measurements"] = await page.evaluate(MEASURE_JS)
            entry["measurements"]["consoleErrors"] = console_errors + page_errors
            entry["interactions"] = await interaction_probe(page)
            entry["postInteractionOverflow"] = await page.evaluate("document.documentElement.scrollWidth - innerWidth")
        except Exception as error:  # keep other widths running and report the exact blocker
            entry["error"] = repr(error)
        finally:
            await page.close()
        all_results["widths"][str(width)] = entry
    return all_results


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True, help="Homepage URL, including local or live origin")
    parser.add_argument("--label", required=True, help="Evidence label, for example live-before or local-before")
    parser.add_argument("--out", default="/opt/data/stealthrdp-mobile-audit", help="Evidence output directory")
    args = parser.parse_args()
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        result = await audit_source(browser, args.base, args.label, out_dir)
        await browser.close()
    output = out_dir / f"{args.label}.json"
    output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"label": args.label, "base": args.base, "output": str(output), "widths": list(result["widths"])}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
