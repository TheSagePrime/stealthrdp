(() => {
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function iconButton(label, direction) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `behavior-arrow behavior-arrow-${direction}`;
    button.setAttribute('aria-label', label);
    const path = direction === 'prev' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
    return button;
  }

  function visibleCards(grid) {
    return qsa('.plan-card', grid).filter((card) => !card.hidden && getComputedStyle(card).display !== 'none');
  }

  function normalizePlanPriority(root = document) {
    qsa('.plan-card', root).forEach((card) => {
      const name = qs('.p-name', card)?.textContent.trim().toLowerCase();
      const isGold = name === 'gold';
      card.classList.toggle('behavior-priority-plan', isGold);
      if (!isGold) card.classList.remove('popular');
      const badge = qs('.plan-popular', card);
      if (badge) badge.hidden = !isGold;
    });
  }

  function enhancePlanGrid(grid) {
    if (!grid || grid.dataset.behaviorRail === 'true') return;
    grid.dataset.behaviorRail = 'true';
    grid.classList.add('behavior-plan-rail');

    const controls = document.createElement('div');
    controls.className = 'behavior-plan-controls';
    const prev = iconButton('Previous plans', 'prev');
    const next = iconButton('Next plans', 'next');
    controls.append(prev, next);
    grid.before(controls);

    const move = (direction) => {
      const cards = visibleCards(grid);
      if (!cards.length) return;
      const first = cards[0];
      const step = Math.max(first.getBoundingClientRect().width + 14, grid.clientWidth * 0.74);
      grid.scrollBy({ left: direction * step, behavior: 'smooth' });
    };

    prev.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));

    const updateControls = () => {
      const cards = visibleCards(grid);
      const overflow = grid.scrollWidth > grid.clientWidth + 4 && cards.length > 1;
      controls.hidden = !overflow;
      prev.disabled = grid.scrollLeft <= 4;
      next.disabled = grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 4;
    };

    grid.addEventListener('scroll', updateControls, { passive: true });
    window.addEventListener('resize', updateControls, { passive: true });

    const observer = new MutationObserver(() => {
      grid.scrollLeft = 0;
      normalizePlanPriority(grid);
      requestAnimationFrame(updateControls);
    });
    qsa('.plan-card', grid).forEach((card) => observer.observe(card, { attributes: true, attributeFilter: ['hidden', 'class'] }));

    requestAnimationFrame(updateControls);
  }

  function enhancePlans() {
    normalizePlanPriority();
    const osGrid = qs('main.os-vps-page .os-vps-plan-grid');
    if (osGrid) enhancePlanGrid(osGrid);

    if (!qs('main.os-vps-page')) {
      const planGrid = qs('body[data-page="plans"] .plan-grid');
      if (planGrid) enhancePlanGrid(planGrid);
    }
  }

  function sectionLabel(section) {
    if (section.classList.contains('os-vps-hero')) {
      return qs('.eyebrow', section)?.textContent.trim() || qs('h1', section)?.textContent.trim();
    }
    return qs('h2', section)?.textContent.trim() || qs('.included-label', section)?.textContent.trim();
  }

  function buildJourneyRail(page) {
    if (!page || qs(':scope > .behavior-journey', page)) return;

    const sections = [
      qs(':scope > .os-vps-hero', page),
      qs(':scope > .os-vps-catalog', page),
      qs(':scope > .os-vps-distros', page),
      qs(':scope > .os-guide-flow', page),
      qs(':scope > .os-vps-faq', page),
      qs(':scope > .cta-band', page)
    ].filter(Boolean);

    if (sections.length < 3) return;

    const rail = document.createElement('nav');
    rail.className = 'behavior-journey';
    rail.setAttribute('aria-label', 'Page sections');

    const buttons = sections.map((section, index) => {
      if (!section.id) section.id = `page-step-${index + 1}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'behavior-journey-item';
      button.textContent = sectionLabel(section) || `${index + 1}`;

      // Smooth vertical scrolling is allowed only after an explicit user click.
      // Passive observers must never move the page viewport.
      button.addEventListener('click', () => {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        section.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      });

      rail.appendChild(button);
      return button;
    });

    page.prepend(rail);

    const setActive = (section) => {
      const index = sections.indexOf(section);
      if (index < 0) return;

      buttons.forEach((button, buttonIndex) => {
        const active = index === buttonIndex;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-current', active ? 'location' : 'false');
      });

      // IMPORTANT: do not call scrollIntoView() here.
      // This function is driven by IntersectionObserver while the user scrolls.
      // Moving the viewport from here causes scroll-jacking and upward snapping.
    };

    const observer = new IntersectionObserver((entries) => {
      const candidate = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (candidate) setActive(candidate.target);
    }, { rootMargin: '-24% 0px -58% 0px', threshold: [0.05, 0.2, 0.5] });

    sections.forEach((section) => observer.observe(section));
    setActive(sections[0]);
  }

  function accordionGroup(items) {
    if (!items.length) return;
    items.forEach((item, index) => {
      item.open = index === 0;
      item.addEventListener('toggle', () => {
        if (!item.open) return;
        items.forEach((peer) => {
          if (peer !== item) peer.open = false;
        });
      });
    });
  }

  function enhanceFaq() {
    const osFaq = qsa('.os-vps-faq-item');
    if (osFaq.length) accordionGroup(osFaq);

    const faqPageItems = qsa('body[data-page="faq"] details');
    if (faqPageItems.length) accordionGroup(faqPageItems);
  }

  function calmReviews() {
    const reel = qs('.review-reel');
    if (!reel) return;
    reel.classList.add('behavior-review-rail');
  }

  function init() {
    enhancePlans();
    buildJourneyRail(qs('main.os-vps-page'));
    enhanceFaq();
    calmReviews();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
