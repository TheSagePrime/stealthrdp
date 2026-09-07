(() => {
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

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

  function makePlanGrid(grid) {
    if (!grid) return;
    grid.classList.remove('behavior-plan-rail');
    grid.classList.add('behavior-plan-grid');
    grid.removeAttribute('data-behavior-rail');

    const controls = grid.previousElementSibling;
    if (controls?.classList.contains('behavior-plan-controls')) controls.remove();

    const observer = new MutationObserver(() => normalizePlanPriority(grid));
    qsa('.plan-card', grid).forEach((card) => {
      observer.observe(card, { attributes: true, attributeFilter: ['hidden', 'class'] });
    });
  }

  function enhancePlans() {
    normalizePlanPriority();
    makePlanGrid(qs('main.os-vps-page .os-vps-plan-grid'));

    if (!qs('main.os-vps-page')) {
      const planGrid = qs('body[data-page="plans"] .plan-grid');
      if (planGrid) makePlanGrid(planGrid);
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
    if (reel) reel.classList.add('behavior-review-rail');
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function windowsScene(version, compact = false) {
    return `
      <div class="windows-desktop${compact ? ' is-compact' : ''}">
        <div class="windows-panel">
          <div class="windows-panel-head"><span>${esc(version)}</span><span>•••</span></div>
          <div class="windows-panel-body">
            <div class="windows-panel-nav"><span></span><span></span><span></span><span></span></div>
            <div class="windows-panel-main">
              <div class="windows-version-name">${esc(version)}</div>
              <div class="windows-metric-grid">
                <div class="windows-metric"><b>USA / EU</b><small>Region</small></div>
                <div class="windows-metric"><b>NVMe</b><small>Storage</small></div>
                <div class="windows-metric"><b>Administrator</b><small>Access</small></div>
                <div class="windows-metric"><b>Windows</b><small>Environment</small></div>
              </div>
            </div>
          </div>
        </div>
        <div class="windows-taskbar"><span></span><span></span><span></span><span></span></div>
      </div>`;
  }

  function linuxScene(lines, distro = 'Linux', compact = false) {
    const safeLines = lines.length ? lines : [
      '$ stealth deploy --os linux --region us',
      'region USA / EU',
      'storage NVMe',
      'root included'
    ];
    return `
      <div class="linux-terminal${compact ? ' is-compact' : ''}">
        <div class="linux-line"><span class="linux-prompt">${esc(distro.toLowerCase())}@stealth:~$</span><span>${esc(safeLines[0] || '')}</span></div>
        ${safeLines.slice(1, 5).map((line, index) => `<div class="linux-line"><span class="${index === safeLines.slice(1,5).length - 1 ? 'linux-ok' : 'linux-dim'}">${index === safeLines.slice(1,5).length - 1 ? '✓' : '›'}</span><span>${esc(line)}</span></div>`).join('')}
        <div class="linux-line"><span class="linux-prompt">${esc(distro.toLowerCase())}@stealth:~$</span><span class="linux-cursor" aria-hidden="true"></span></div>
      </div>`;
  }

  function existingConsoleLines(hero) {
    return qsa('.console-line', hero)
      .map((line) => line.textContent.trim())
      .filter(Boolean);
  }

  function buildWindowsHero(hero) {
    const target = qs('.hero-console', hero);
    if (!target) return;
    const versions = qsa('.os-hero-chip', hero).map((chip) => chip.textContent.trim()).filter(Boolean);
    const choices = versions.length ? versions : ['Server 2019', 'Server 2022', 'Server 2025'];
    let active = Math.min(1, choices.length - 1);

    target.classList.add('behavior-os-visual');
    target.innerHTML = `
      <div class="os-visual-shell windows-visual">
        <div class="os-visual-topbar">
          <span class="os-visual-title"><img src="/assets/os-logos/windows-colored.svg" alt="">Windows VPS</span>
          <span class="os-visual-status">${esc(choices[active])}</span>
        </div>
        <div class="os-visual-stage">${windowsScene(choices[active])}</div>
        <div class="os-visual-selector">${choices.map((choice, index) => `<button type="button" data-index="${index}" class="${index === active ? 'is-active' : ''}">${esc(choice)}</button>`).join('')}</div>
      </div>`;

    const stage = qs('.os-visual-stage', target);
    const status = qs('.os-visual-status', target);
    qsa('.os-visual-selector button', target).forEach((button) => {
      button.addEventListener('click', () => {
        active = Number(button.dataset.index);
        stage.innerHTML = windowsScene(choices[active]);
        status.textContent = choices[active];
        qsa('.os-visual-selector button', target).forEach((peer) => peer.classList.toggle('is-active', peer === button));
      });
    });
  }

  function buildLinuxHero(hero) {
    const target = qs('.hero-console', hero);
    if (!target) return;
    const lines = existingConsoleLines(hero);
    const distroButtons = qsa('#linux-distros .os-distro-tab strong').map((node) => node.textContent.trim()).filter(Boolean);
    const choices = distroButtons.length ? distroButtons.slice(0, 6) : ['Ubuntu', 'Debian', 'AlmaLinux', 'Rocky Linux'];
    let active = 0;

    target.classList.add('behavior-os-visual');
    target.innerHTML = `
      <div class="os-visual-shell linux-visual">
        <div class="os-visual-topbar">
          <span class="os-visual-title">Linux VPS</span>
          <span class="os-visual-status">${esc(choices[active])}</span>
        </div>
        <div class="os-visual-stage">${linuxScene(lines, choices[active])}</div>
        <div class="os-visual-selector">${choices.map((choice, index) => `<button type="button" data-index="${index}" class="${index === active ? 'is-active' : ''}">${esc(choice)}</button>`).join('')}</div>
      </div>`;

    const stage = qs('.os-visual-stage', target);
    const status = qs('.os-visual-status', target);
    qsa('.os-visual-selector button', target).forEach((button) => {
      button.addEventListener('click', () => {
        active = Number(button.dataset.index);
        stage.innerHTML = linuxScene(lines, choices[active]);
        status.textContent = choices[active];
        qsa('.os-visual-selector button', target).forEach((peer) => peer.classList.toggle('is-active', peer === button));
      });
    });
  }

  function buildHomeCompare() {
    const hero = qs('body[data-page="home"] .hero');
    const target = qs('.hero-console', hero || document);
    if (!hero || !target) return;
    const lines = existingConsoleLines(hero);

    target.classList.add('behavior-os-visual');
    target.innerHTML = `
      <div class="os-compare" style="--compare-split:50%">
        <div class="os-compare-layer windows-side">${windowsScene('Windows Server 2022', true)}</div>
        <div class="os-compare-layer linux-side">${linuxScene(lines, 'Ubuntu', true)}</div>
        <span class="os-compare-label windows-label">Windows</span>
        <span class="os-compare-label linux-label">Linux</span>
        <div class="os-compare-divider" aria-hidden="true"></div>
        <div class="os-compare-handle" aria-hidden="true"></div>
        <input type="range" min="15" max="85" value="50" aria-label="Windows and Linux comparison">
      </div>`;

    const compare = qs('.os-compare', target);
    const slider = qs('input[type="range"]', compare);
    slider.addEventListener('input', () => compare.style.setProperty('--compare-split', `${slider.value}%`));
  }

  function enhanceHeroVisuals() {
    const path = location.pathname.replace(/\/+$/, '');
    if (path === '/windows-vps') buildWindowsHero(qs('main.os-vps-page > .os-vps-hero'));
    else if (path === '/linux-vps') buildLinuxHero(qs('main.os-vps-page > .os-vps-hero'));
    else if (path === '' || path === '/') buildHomeCompare();
  }

  function init() {
    enhancePlans();
    buildJourneyRail(qs('main.os-vps-page'));
    enhanceFaq();
    calmReviews();
    enhanceHeroVisuals();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
