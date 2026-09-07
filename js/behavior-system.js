(() => {
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
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

  function makePlanGrid(grid) {
    if (!grid) return;
    grid.classList.remove('behavior-plan-rail');
    grid.classList.add('behavior-plan-grid');
    grid.removeAttribute('data-behavior-rail');
    const controls = grid.previousElementSibling;
    if (controls?.classList.contains('behavior-plan-controls')) controls.remove();
    const observer = new MutationObserver(() => normalizePlanPriority(grid));
    qsa('.plan-card', grid).forEach((card) => observer.observe(card, { attributes: true, attributeFilter: ['hidden', 'class'] }));
  }

  function enhancePlans() {
    normalizePlanPriority();
    makePlanGrid(qs('main.os-vps-page .os-vps-plan-grid'));
    if (!qs('main.os-vps-page')) makePlanGrid(qs('body[data-page="plans"] .plan-grid'));
  }

  function sectionLabel(section) {
    if (section.classList.contains('os-vps-hero')) return qs('.eyebrow', section)?.textContent.trim() || qs('h1', section)?.textContent.trim();
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
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        section.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      });
      rail.appendChild(button);
      return button;
    });
    page.prepend(rail);

    const setActive = (section) => {
      const index = sections.indexOf(section);
      if (index < 0) return;
      buttons.forEach((button, i) => {
        const active = i === index;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-current', active ? 'location' : 'false');
      });
    };
    const observer = new IntersectionObserver((entries) => {
      const candidate = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
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
        items.forEach((peer) => { if (peer !== item) peer.open = false; });
      });
    });
  }

  function enhanceFaq() {
    accordionGroup(qsa('.os-vps-faq-item'));
    accordionGroup(qsa('body[data-page="faq"] details'));
  }

  function calmReviews() {
    const reel = qs('.review-reel');
    if (reel) reel.classList.add('behavior-review-rail');
  }

  function windowMarkup(kind, title, body) {
    return `<section class="mini-win-window" data-window="${kind}" hidden>
      <header class="mini-win-titlebar" data-drag-handle>
        <span>${esc(title)}</span>
        <span class="mini-win-controls">
          <button type="button" data-minimize aria-label="Minimize">—</button>
          <button type="button" data-close aria-label="Close">×</button>
        </span>
      </header>
      <div class="mini-win-body">${body}</div>
    </section>`;
  }

  function windowsDesktopMarkup(version, compact = false) {
    if (compact) {
      return `<div class="mini-win-desktop is-home-preview" aria-hidden="true">
        <div class="mini-win-wallpaper-mark"><span></span><span></span><span></span><span></span></div>
        <div class="mini-win-preview-window"><b>${esc(version)}</b><small>Server Manager</small><div><i></i><i></i><i></i></div></div>
        <div class="mini-win-taskbar"><span class="mini-win-logo">⊞</span><span></span><span></span><span></span></div>
      </div>`;
    }

    const explorer = `<div class="mini-explorer">
      <aside><button type="button" class="is-selected">This PC</button><button type="button">Desktop</button><button type="button">Downloads</button></aside>
      <main><div class="mini-explorer-path">This PC</div><div class="mini-drive-grid"><button type="button"><b>Local Disk (C:)</b><span><i style="width:42%"></i></span><small>58.2 GB free</small></button><button type="button"><b>Data (D:)</b><span><i style="width:18%"></i></span><small>122 GB free</small></button></div></main>
    </div>`;
    const serverManager = `<div class="mini-server-manager"><div class="mini-server-sidebar"><b>Dashboard</b><span>Local Server</span><span>All Servers</span></div><div class="mini-server-main"><h4>${esc(version)}</h4><p>Local Server</p><div class="mini-server-tiles"><span><b>Computer name</b><small>STEALTH-RDP</small></span><span><b>Remote Desktop</b><small>Enabled</small></span><span><b>Windows Update</b><small>Available</small></span><span><b>Ethernet</b><small>Connected</small></span></div></div></div>`;
    const powershell = `<div class="mini-ps"><div class="mini-ps-output" data-ps-output><div>Windows PowerShell</div><div>Copyright (C) Microsoft Corporation.</div><div class="mini-ps-gap"></div></div><form data-ps-form><label><span>PS C:\Users\Administrator&gt;</span><input data-ps-input autocomplete="off" spellcheck="false" aria-label="PowerShell command"></label></form></div>`;

    return `<div class="mini-win-desktop" data-mini-windows>
      <div class="mini-win-wallpaper-mark"><span></span><span></span><span></span><span></span></div>
      <div class="mini-win-icons">
        <button type="button" data-open-window="explorer"><span class="mini-desktop-icon">▣</span><small>This PC</small></button>
        <button type="button" data-open-window="server"><span class="mini-desktop-icon">▦</span><small>Server Manager</small></button>
        <button type="button" data-open-window="powershell"><span class="mini-desktop-icon">&gt;_</span><small>PowerShell</small></button>
      </div>
      ${windowMarkup('explorer', 'File Explorer', explorer)}
      ${windowMarkup('server', 'Server Manager', serverManager)}
      ${windowMarkup('powershell', 'Windows PowerShell', powershell)}
      <div class="mini-win-start" data-start-menu hidden>
        <div class="mini-start-user"><span>A</span><b>Administrator</b></div>
        <div class="mini-start-apps"><button type="button" data-open-window="server">Server Manager</button><button type="button" data-open-window="explorer">File Explorer</button><button type="button" data-open-window="powershell">Windows PowerShell</button></div>
      </div>
      <div class="mini-win-taskbar">
        <button type="button" class="mini-win-start-btn" data-start-button aria-label="Start">⊞</button>
        <button type="button" data-open-window="explorer" aria-label="File Explorer">▣</button>
        <button type="button" data-open-window="server" aria-label="Server Manager">▦</button>
        <button type="button" data-open-window="powershell" aria-label="PowerShell">&gt;_</button>
        <span class="mini-win-clock" data-win-clock></span>
      </div>
    </div>`;
  }

  function appendPsLine(output, command, result) {
    const commandLine = document.createElement('div');
    commandLine.innerHTML = `<span class="mini-ps-prompt">PS C:\\Users\\Administrator&gt;</span> ${esc(command)}`;
    output.appendChild(commandLine);
    if (result !== null && result !== '') {
      const resultLine = document.createElement('div');
      resultLine.textContent = result;
      output.appendChild(resultLine);
    }
    output.scrollTop = output.scrollHeight;
  }

  function psResult(command, version) {
    const raw = command.trim();
    const cmd = raw.toLowerCase();
    if (!cmd) return '';
    if (cmd === 'help') return 'Commands: hostname, whoami, ipconfig, dir, ver, cls, help';
    if (cmd === 'hostname') return 'STEALTH-RDP';
    if (cmd === 'whoami') return 'stealth-rdp\\administrator';
    if (cmd === 'ver') return `Microsoft Windows [${version}]`;
    if (cmd === 'dir') return 'Desktop   Documents   Downloads   Public';
    if (cmd === 'ipconfig') return 'Ethernet adapter Ethernet:  IPv4 Address . . . : 10.0.0.24';
    return `The term '${raw}' is not recognized. Type 'help'.`;
  }

  function wireDraggableWindow(win, desktop) {
    const handle = qs('[data-drag-handle]', win);
    if (!handle) return;
    let drag = null;
    handle.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button')) return;
      const rect = win.getBoundingClientRect();
      const parent = desktop.getBoundingClientRect();
      drag = { x: event.clientX, y: event.clientY, left: rect.left - parent.left, top: rect.top - parent.top };
      handle.setPointerCapture(event.pointerId);
      win.classList.add('is-dragging');
    });
    handle.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const maxLeft = Math.max(0, desktop.clientWidth - win.offsetWidth);
      const maxTop = Math.max(0, desktop.clientHeight - win.offsetHeight - 42);
      const left = Math.min(maxLeft, Math.max(0, drag.left + event.clientX - drag.x));
      const top = Math.min(maxTop, Math.max(0, drag.top + event.clientY - drag.y));
      win.style.left = `${left}px`;
      win.style.top = `${top}px`;
      win.style.transform = 'none';
    });
    const stop = () => { drag = null; win.classList.remove('is-dragging'); };
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  }

  function wireWindowsDesktop(root, version) {
    const desktop = qs('[data-mini-windows]', root);
    if (!desktop) return;
    const startMenu = qs('[data-start-menu]', desktop);
    const startButton = qs('[data-start-button]', desktop);
    let z = 20;

    function openWindow(kind) {
      const win = qs(`[data-window="${kind}"]`, desktop);
      if (!win) return;
      win.hidden = false;
      win.classList.remove('is-minimized');
      win.style.zIndex = String(++z);
      startMenu.hidden = true;
      if (!win.dataset.positioned) {
        const index = qsa('.mini-win-window', desktop).indexOf(win);
        win.style.left = `${70 + index * 18}px`;
        win.style.top = `${48 + index * 16}px`;
        win.style.transform = 'none';
        win.dataset.positioned = 'true';
      }
      if (kind === 'powershell') setTimeout(() => qs('[data-ps-input]', win)?.focus(), 0);
    }

    qsa('[data-open-window]', desktop).forEach((button) => button.addEventListener('click', () => openWindow(button.dataset.openWindow)));
    startButton?.addEventListener('click', () => { startMenu.hidden = !startMenu.hidden; });

    qsa('.mini-win-window', desktop).forEach((win) => {
      wireDraggableWindow(win, desktop);
      qs('[data-close]', win)?.addEventListener('click', () => { win.hidden = true; });
      qs('[data-minimize]', win)?.addEventListener('click', () => { win.hidden = true; win.classList.add('is-minimized'); });
      win.addEventListener('pointerdown', () => { win.style.zIndex = String(++z); });
    });

    const form = qs('[data-ps-form]', desktop);
    const input = qs('[data-ps-input]', desktop);
    const output = qs('[data-ps-output]', desktop);
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const command = input.value;
      if (command.trim().toLowerCase() === 'cls') output.innerHTML = '';
      else appendPsLine(output, command, psResult(command, version));
      input.value = '';
    });

    const clock = qs('[data-win-clock]', desktop);
    const updateClock = () => { if (clock) clock.textContent = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(new Date()); };
    updateClock();
    const timer = setInterval(updateClock, 30000);
    window.addEventListener('pagehide', () => clearInterval(timer), { once: true });

    openWindow('server');
  }

  function linuxTerminalMarkup(distro, compact = false) {
    if (compact) {
      return `<div class="mini-linux-terminal is-home-preview" aria-hidden="true"><div class="mini-linux-bar"><i></i><i></i><i></i><span>${esc(distro)}</span></div><div class="mini-linux-preview-lines"><p><b>${esc(distro.toLowerCase())}@stealth:~$</b> uname -a</p><p>Linux stealth-rdp x86_64 GNU/Linux</p><p><b>${esc(distro.toLowerCase())}@stealth:~$</b> <i></i></p></div></div>`;
    }
    return `<div class="mini-linux-terminal" data-mini-linux>
      <div class="mini-linux-bar"><i></i><i></i><i></i><span>${esc(distro)} Terminal</span></div>
      <div class="mini-linux-screen" data-linux-output>
        <div>StealthRDP Linux VPS</div><div>Type <b>help</b> to see available commands.</div><div class="mini-linux-gap"></div>
      </div>
      <form class="mini-linux-form" data-linux-form><label><span data-linux-prompt>${esc(distro.toLowerCase())}@stealth:~$</span><input data-linux-input autocomplete="off" spellcheck="false" aria-label="Linux command"></label></form>
    </div>`;
  }

  function linuxResult(command, distro) {
    const raw = command.trim();
    const cmd = raw.toLowerCase();
    const name = distro || 'Linux';
    if (!cmd) return '';
    if (cmd === 'help') return 'help  ls  pwd  whoami  hostname  uname  cat /etc/os-release  date  clear';
    if (cmd === 'ls' || cmd === 'ls -la') return 'apps  backups  logs  public_html';
    if (cmd === 'pwd') return '/root';
    if (cmd === 'whoami') return 'root';
    if (cmd === 'hostname') return 'stealth-rdp';
    if (cmd === 'uname' || cmd === 'uname -a') return 'Linux stealth-rdp 6.8.0 x86_64 GNU/Linux';
    if (cmd === 'cat /etc/os-release') return `NAME="${name}"\nID=${name.toLowerCase().replace(/\s+/g, '')}\nPRETTY_NAME="${name}"`;
    if (cmd === 'date') return new Date().toString();
    return `bash: ${raw}: command not found`;
  }

  function appendLinuxOutput(output, prompt, command, result) {
    const cmdLine = document.createElement('div');
    cmdLine.innerHTML = `<b>${esc(prompt)}</b> ${esc(command)}`;
    output.appendChild(cmdLine);
    if (result) {
      result.split('\n').forEach((line) => {
        const node = document.createElement('div');
        node.textContent = line;
        output.appendChild(node);
      });
    }
    output.scrollTop = output.scrollHeight;
  }

  function wireLinuxTerminal(root, distro) {
    const terminal = qs('[data-mini-linux]', root);
    if (!terminal) return;
    const form = qs('[data-linux-form]', terminal);
    const input = qs('[data-linux-input]', terminal);
    const output = qs('[data-linux-output]', terminal);
    const prompt = qs('[data-linux-prompt]', terminal);
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const command = input.value;
      if (command.trim().toLowerCase() === 'clear') output.innerHTML = '';
      else appendLinuxOutput(output, prompt.textContent, command, linuxResult(command, distro));
      input.value = '';
    });
    terminal.addEventListener('click', (event) => {
      if (!event.target.closest('button')) input?.focus();
    });
  }

  function buildWindowsHero(hero) {
    const target = qs('.hero-console', hero || document);
    if (!target) return;
    const versions = qsa('.os-hero-chip', hero).map((chip) => chip.textContent.trim()).filter(Boolean);
    const choices = versions.length ? versions : ['Server 2019', 'Server 2022', 'Server 2025'];
    let active = Math.min(1, choices.length - 1);

    const render = () => {
      target.classList.add('behavior-os-visual');
      target.innerHTML = `<div class="os-visual-shell mini-os-shell windows-visual"><div class="os-visual-topbar"><span class="os-visual-title"><img src="/assets/os-logos/windows-colored.svg" alt="">Windows VPS</span><span class="os-visual-status">${esc(choices[active])}</span></div><div class="os-visual-stage">${windowsDesktopMarkup(choices[active])}</div><div class="os-visual-selector">${choices.map((choice, i) => `<button type="button" data-index="${i}" class="${i === active ? 'is-active' : ''}">${esc(choice)}</button>`).join('')}</div></div>`;
      wireWindowsDesktop(target, choices[active]);
      qsa('.os-visual-selector button', target).forEach((button) => button.addEventListener('click', () => { active = Number(button.dataset.index); render(); }));
    };
    render();
  }

  function buildLinuxHero(hero) {
    const target = qs('.hero-console', hero || document);
    if (!target) return;
    const distroButtons = qsa('#linux-distros .os-distro-tab strong').map((node) => node.textContent.trim()).filter(Boolean);
    const choices = distroButtons.length ? distroButtons.slice(0, 8) : ['Ubuntu', 'Debian', 'AlmaLinux', 'Rocky Linux'];
    let active = 0;

    const render = () => {
      target.classList.add('behavior-os-visual');
      target.innerHTML = `<div class="os-visual-shell mini-os-shell linux-visual"><div class="os-visual-topbar"><span class="os-visual-title">Linux VPS</span><span class="os-visual-status">${esc(choices[active])}</span></div><div class="os-visual-stage">${linuxTerminalMarkup(choices[active])}</div><div class="os-visual-selector">${choices.map((choice, i) => `<button type="button" data-index="${i}" class="${i === active ? 'is-active' : ''}">${esc(choice)}</button>`).join('')}</div></div>`;
      wireLinuxTerminal(target, choices[active]);
      qsa('.os-visual-selector button', target).forEach((button) => button.addEventListener('click', () => { active = Number(button.dataset.index); render(); }));
    };
    render();
  }

  function buildHomeCompare() {
    const hero = qs('body[data-page="home"] .hero');
    const target = qs('.hero-console', hero || document);
    if (!hero || !target) return;
    target.classList.add('behavior-os-visual');
    target.innerHTML = `<div class="os-compare mini-os-compare" style="--compare-split:50%"><div class="os-compare-layer windows-side">${windowsDesktopMarkup('Windows Server 2022', true)}</div><div class="os-compare-layer linux-side">${linuxTerminalMarkup('Ubuntu', true)}</div><span class="os-compare-label windows-label">Windows</span><span class="os-compare-label linux-label">Linux</span><div class="os-compare-divider" aria-hidden="true"></div><div class="os-compare-handle" aria-hidden="true"></div><input type="range" min="15" max="85" value="50" aria-label="Windows and Linux comparison"></div>`;
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
