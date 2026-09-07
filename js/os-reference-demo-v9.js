(() => {
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function winLogo() {
    return '<span class="v9-win-logo" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
  }

  function selectedWindowsVersion(hero) {
    const versions = qsa('.os-hero-chip', hero).map((node) => node.textContent.trim()).filter(Boolean);
    return versions[1] || versions[0] || 'Windows Server 2022';
  }

  function windowMarkup(kind, title, body) {
    return `<section class="v9-win-window" data-v9-window="${kind}" hidden>
      <header class="v9-win-titlebar" data-v9-drag>
        <span>${esc(title)}</span>
        <span class="v9-win-controls"><button type="button" data-v9-minimize aria-label="Minimize">—</button><button type="button" data-v9-close aria-label="Close">×</button></span>
      </header>
      <div class="v9-win-body">${body}</div>
    </section>`;
  }

  function serverMarkup(version) {
    return `<div class="v9-server"><aside><b>Dashboard</b><span>Local Server</span><span>All Servers</span><span>File Services</span></aside><main>
      <h4>${esc(version)}</h4><p>Local Server</p>
      <div class="v9-server-grid"><span><b>Computer name</b><small>STEALTH-RDP</small></span><span><b>Remote Desktop</b><small>Enabled</small></span><span><b>Windows Update</b><small>Available</small></span><span><b>Ethernet</b><small>Connected</small></span></div>
    </main></div>`;
  }

  function explorerMarkup() {
    return `<div class="v9-explorer"><aside><span class="is-active">This PC</span><span>Desktop</span><span>Downloads</span><span>Network</span></aside><main>
      <div class="v9-explorer-path">This PC</div>
      <div class="v9-drive"><strong>Local Disk (C:)</strong><div class="v9-drive-bar"><i style="width:42%"></i></div><small>58.2 GB free</small></div>
      <div class="v9-drive"><strong>Data (D:)</strong><div class="v9-drive-bar"><i style="width:18%"></i></div><small>122 GB free</small></div>
    </main></div>`;
  }

  function powershellMarkup() {
    return `<div class="v9-ps"><div class="v9-ps-output" data-v9-ps-output><div>Windows PowerShell</div><div>Copyright (C) Microsoft Corporation.</div><br></div><form class="v9-ps-form" data-v9-ps-form><label><span class="v9-ps-prompt">PS C:\\Users\\Administrator&gt;</span><input data-v9-ps-input autocomplete="off" spellcheck="false" aria-label="PowerShell command"></label></form></div>`;
  }

  function windowsMarkup(version) {
    return `<div class="v9-win-shell" data-v9-windows>
      <div class="v9-win-icons">
        <button type="button" data-v9-open="server"><span class="v9-win-desktop-icon">▦</span>Server Manager</button>
        <button type="button" data-v9-open="explorer"><span class="v9-win-desktop-icon">▣</span>This PC</button>
        <button type="button" data-v9-open="powershell"><span class="v9-win-desktop-icon">&gt;_</span>PowerShell</button>
      </div>
      ${windowMarkup('server', 'Server Manager', serverMarkup(version))}
      ${windowMarkup('explorer', 'File Explorer', explorerMarkup())}
      ${windowMarkup('powershell', 'Windows PowerShell', powershellMarkup())}
      <section class="v9-win-start" data-v9-start hidden>
        <div class="v9-start-search">Type here to search</div>
        <h4>Pinned</h4>
        <div class="v9-start-pins"><button type="button" data-v9-open="server"><span class="v9-start-pin-icon">▦</span>Server Manager</button><button type="button" data-v9-open="explorer"><span class="v9-start-pin-icon">▣</span>File Explorer</button><button type="button" data-v9-open="powershell"><span class="v9-start-pin-icon">&gt;_</span>PowerShell</button></div>
        <div class="v9-start-foot"><span class="v9-start-user"><span class="v9-avatar">A</span>Administrator</span><span>⏻</span></div>
      </section>
      <div class="v9-win-taskbar"><span></span><div class="v9-task-center"><button type="button" data-v9-start aria-label="Start">${winLogo()}</button><button type="button" aria-label="Search">⌕</button><button type="button" data-v9-open="explorer" data-v9-task="explorer" aria-label="File Explorer">▣</button><button type="button" data-v9-open="server" data-v9-task="server" aria-label="Server Manager">▦</button><button type="button" data-v9-open="powershell" data-v9-task="powershell" aria-label="PowerShell">&gt;_</button></div><div class="v9-win-tray"><span>ENG</span><span>⌁</span><span data-v9-clock></span></div></div>
    </div>`;
  }

  function wireDrag(win, desktop) {
    const handle = qs('[data-v9-drag]', win);
    if (!handle) return;
    let drag = null;
    handle.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button')) return;
      const wr = win.getBoundingClientRect();
      const dr = desktop.getBoundingClientRect();
      drag = { x: event.clientX, y: event.clientY, left: wr.left - dr.left, top: wr.top - dr.top };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const maxLeft = Math.max(0, desktop.clientWidth - win.offsetWidth);
      const maxTop = Math.max(0, desktop.clientHeight - win.offsetHeight - 46);
      win.style.left = `${Math.min(maxLeft, Math.max(0, drag.left + event.clientX - drag.x))}px`;
      win.style.top = `${Math.min(maxTop, Math.max(0, drag.top + event.clientY - drag.y))}px`;
    });
    const stop = () => { drag = null; };
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  }

  function psResult(command, version) {
    const raw = command.trim();
    const cmd = raw.toLowerCase();
    if (!cmd) return '';
    if (cmd === 'help') return 'hostname  whoami  ipconfig  dir  ver  cls  help';
    if (cmd === 'hostname') return 'STEALTH-RDP';
    if (cmd === 'whoami') return 'stealth-rdp\\administrator';
    if (cmd === 'ipconfig') return 'Ethernet adapter Ethernet: IPv4 Address . . . : 10.0.0.24';
    if (cmd === 'dir') return 'Desktop   Documents   Downloads   Public';
    if (cmd === 'ver') return `Microsoft Windows [${version}]`;
    return `The term '${raw}' is not recognized. Type 'help'.`;
  }

  function wireWindows(host, version) {
    const desktop = qs('[data-v9-windows]', host);
    if (!desktop) return;
    const start = qs('[data-v9-start]', desktop);
    let z = 30;

    function setTaskRunning(kind, running) {
      qs(`[data-v9-task="${kind}"]`, desktop)?.classList.toggle('is-running', running);
    }

    function open(kind) {
      const win = qs(`[data-v9-window="${kind}"]`, desktop);
      if (!win) return;
      win.hidden = false;
      win.style.zIndex = String(++z);
      win.classList.add('is-active');
      start.hidden = true;
      qsa('.v9-win-window', desktop).forEach((peer) => { if (peer !== win) peer.classList.remove('is-active'); });
      if (!win.dataset.positioned) {
        const index = qsa('.v9-win-window', desktop).indexOf(win);
        win.style.left = `${76 + index * 15}px`;
        win.style.top = `${38 + index * 14}px`;
        win.dataset.positioned = '1';
      }
      setTaskRunning(kind, true);
      if (kind === 'powershell') setTimeout(() => qs('[data-v9-ps-input]', win)?.focus(), 0);
    }

    qsa('[data-v9-open]', desktop).forEach((button) => button.addEventListener('click', () => open(button.dataset.v9Open)));
    qs('[data-v9-start]', desktop)?.addEventListener('click', () => { start.hidden = !start.hidden; });

    qsa('.v9-win-window', desktop).forEach((win) => {
      wireDrag(win, desktop);
      win.addEventListener('pointerdown', () => {
        win.style.zIndex = String(++z);
        qsa('.v9-win-window', desktop).forEach((peer) => peer.classList.toggle('is-active', peer === win));
      });
      qs('[data-v9-close]', win)?.addEventListener('click', () => {
        win.hidden = true;
        setTaskRunning(win.dataset.v9Window, false);
      });
      qs('[data-v9-minimize]', win)?.addEventListener('click', () => { win.hidden = true; });
    });

    const form = qs('[data-v9-ps-form]', desktop);
    const input = qs('[data-v9-ps-input]', desktop);
    const output = qs('[data-v9-ps-output]', desktop);
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const command = input.value;
      input.value = '';
      if (command.trim().toLowerCase() === 'cls') { output.innerHTML = ''; return; }
      const row = document.createElement('div');
      row.innerHTML = `<span class="v9-ps-prompt">PS C:\\Users\\Administrator&gt;</span> ${esc(command)}`;
      output.appendChild(row);
      const result = psResult(command, version);
      if (result) {
        const line = document.createElement('div');
        line.textContent = result;
        output.appendChild(line);
      }
      output.scrollTop = output.scrollHeight;
    });

    const clock = qs('[data-v9-clock]', desktop);
    const updateClock = () => {
      if (!clock) return;
      const now = new Date();
      clock.innerHTML = `${new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(now)}<br>${now.getMonth() + 1}/${now.getDate()}/${String(now.getFullYear()).slice(-2)}`;
    };
    updateClock();
    const timer = setInterval(updateClock, 30000);
    window.addEventListener('pagehide', () => clearInterval(timer), { once: true });

    open('server');
  }

  function installOverlay(type, label) {
    const overlay = document.createElement('div');
    overlay.className = `os-install-overlay is-${type}`;
    if (type === 'linux') {
      overlay.innerHTML = `<div class="os-install-inner"><div class="os-install-tty" data-install-tty></div><div class="os-install-progress"><i data-install-bar></i></div><span class="os-install-percent" data-install-percent>0%</span></div>`;
    } else {
      overlay.innerHTML = `<div class="os-install-inner"><div class="os-install-brand">${winLogo()}</div><h3 class="os-install-title">Installing ${esc(label)}</h3><p class="os-install-status" data-install-status>Preparing installation</p><div class="os-install-progress"><i data-install-bar></i></div><span class="os-install-percent" data-install-percent>0%</span></div>`;
    }
    return overlay;
  }

  function runWindowsInstall(host, label) {
    host.style.position = 'relative';
    const overlay = installOverlay('windows', label);
    host.appendChild(overlay);
    const status = qs('[data-install-status]', overlay);
    const bar = qs('[data-install-bar]', overlay);
    const percent = qs('[data-install-percent]', overlay);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = reduced ? [[60, 100, 'Windows is ready']] : [
      [160, 12, 'Preparing installation'],
      [520, 34, 'Installing Windows features'],
      [900, 58, 'Applying network settings'],
      [1280, 78, 'Creating Administrator profile'],
      [1640, 94, 'Getting things ready'],
      [1980, 100, 'Windows is ready']
    ];
    steps.forEach(([delay, value, text]) => setTimeout(() => {
      if (!overlay.isConnected) return;
      status.textContent = text;
      bar.style.width = `${value}%`;
      percent.textContent = `${value}%`;
    }, delay));
    const finish = reduced ? 300 : 2350;
    setTimeout(() => overlay.classList.add('is-done'), finish);
    setTimeout(() => overlay.remove(), finish + 480);
  }

  function runLinuxInstall(host, distro) {
    host.style.position = 'relative';
    const overlay = installOverlay('linux', distro);
    host.appendChild(overlay);
    const tty = qs('[data-install-tty]', overlay);
    const bar = qs('[data-install-bar]', overlay);
    const percent = qs('[data-install-percent]', overlay);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lines = [
      ['dim', '[    0.000000] Booting Linux kernel 6.12.0'],
      ['', `* Loading ${distro} Linux`],
      ['', '* Mounting root filesystem'],
      ['ok', '* Network interface eth0 configured'],
      ['', '* Installing base packages'],
      ['', '* Installing i3wm terminal environment'],
      ['', '* Configuring OpenSSH'],
      ['ok', '* Root account ready'],
      ['ok', '* Starting graphical session'],
      ['ok', 'stealth-rdp login: root']
    ];
    if (reduced) {
      tty.innerHTML = `<div class="ok">${esc(distro)} Linux ready</div>`;
      bar.style.width = '100%';
      percent.textContent = '100%';
      setTimeout(() => overlay.classList.add('is-done'), 180);
      setTimeout(() => overlay.remove(), 500);
      return;
    }
    lines.forEach(([cls, text], index) => setTimeout(() => {
      if (!overlay.isConnected) return;
      const line = document.createElement('div');
      if (cls) line.className = cls;
      line.textContent = text;
      tty.appendChild(line);
      tty.scrollTop = tty.scrollHeight;
      const value = Math.round(((index + 1) / lines.length) * 100);
      bar.style.width = `${value}%`;
      percent.textContent = `${value}%`;
    }, 120 + index * 180));
    setTimeout(() => overlay.classList.add('is-done'), 2100);
    setTimeout(() => overlay.remove(), 2550);
  }

  function buildWindowsV9() {
    const hero = qs('main.os-vps-page > .os-vps-hero');
    const host = qs('.hero-console', hero || document);
    if (!hero || !host) return;
    const version = selectedWindowsVersion(hero);
    host.classList.remove('ref-os-host');
    host.classList.add('v9-win-host');
    host.innerHTML = windowsMarkup(version);
    wireWindows(host, version);
    runWindowsInstall(host, version);
  }

  function enhanceLinuxV9() {
    const hero = qs('main.os-vps-page > .os-vps-hero');
    const host = qs('.hero-console', hero || document);
    if (!hero || !host || !qs('.ref-i3-desktop', host)) return;
    const distro = qs('#linux-distros .os-distro-tab strong')?.textContent.trim() || 'Alpine';
    runLinuxInstall(host, distro);
  }

  function init() {
    const path = location.pathname.replace(/\/+$/, '');
    if (path === '/windows-vps') buildWindowsV9();
    else if (path === '/linux-vps') enhanceLinuxV9();
  }

  // v8 runs first. v9 deliberately runs one task later so it can replace/enhance that rendered demo.
  const start = () => setTimeout(init, 0);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
