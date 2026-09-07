(() => {
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const RAW = 'https://raw.githubusercontent.com/yyqyu/win11/master/public/img';
  const icon = (name) => `${RAW}/icon/${name}.png`;
  const ui = (name) => `${RAW}/icon/ui/${name}.png`;
  const wallpaper = `${RAW}/wallpaper/default/img0.jpg`;
  const win11Logo = `${RAW}/windows11.png`;

  function selectedWindowsVersion(hero) {
    const versions = qsa('.os-hero-chip', hero).map((n) => n.textContent.trim()).filter(Boolean);
    return versions[1] || versions[0] || 'Windows Server 2022';
  }

  function appButton(name, label, action = '') {
    return `<button type="button" class="win11-pnapp" ${action ? `data-win11-open="${action}"` : ''}><img src="${icon(name)}" alt=""><span>${esc(label)}</span></button>`;
  }

  function windowMarkup(kind, title, iconName, body) {
    return `<section class="win11-app-window" data-win11-window="${kind}" hidden>
      <header class="win11-app-titlebar" data-win11-drag>
        <span class="win11-app-title"><img src="${icon(iconName)}" alt=""><span>${esc(title)}</span></span>
        <span class="win11-window-controls">
          <button type="button" data-win11-minimize aria-label="Minimize">—</button>
          <button type="button" aria-label="Maximize">□</button>
          <button type="button" data-win11-close aria-label="Close">×</button>
        </span>
      </header>
      <div class="win11-app-body">${body}</div>
    </section>`;
  }

  function explorerBody() {
    return `<div class="win11-explorer">
      <aside><span class="active">This PC</span><span>Desktop</span><span>Downloads</span><span>Documents</span><span>Network</span></aside>
      <main>
        <div class="win11-path">This PC</div>
        <div class="win11-drive-grid">
          <div class="win11-drive"><b>Local Disk (C:)</b><div class="win11-drive-bar"><i style="width:42%"></i></div><small>58.2 GB free</small></div>
          <div class="win11-drive"><b>Data (D:)</b><div class="win11-drive-bar"><i style="width:18%"></i></div><small>122 GB free</small></div>
        </div>
      </main>
    </div>`;
  }

  function terminalBody() {
    return `<div class="win11-terminal">
      <div class="win11-terminal-output" data-win11-terminal-output>
        <div>Microsoft Windows [Version 10.0.26100]</div>
        <div>(c) Microsoft Corporation. All rights reserved.</div><br>
      </div>
      <form data-win11-terminal-form><label><span>C:\\Users\\Administrator&gt;</span><input data-win11-terminal-input autocomplete="off" spellcheck="false" aria-label="Command"></label></form>
    </div>`;
  }

  function stealthBody(version) {
    return `<div class="win11-stealth-panel">
      <aside><strong>StealthRDP</strong><span>Dashboard</span><span>Local Server</span><span>Remote Desktop</span><span>Network</span><span>Storage</span></aside>
      <main><h3>${esc(version)}</h3><p>Administrator</p>
        <div class="win11-stealth-grid">
          <div><b>Computer name</b><span>STEALTH-RDP</span></div>
          <div><b>Remote Desktop</b><span>Enabled</span></div>
          <div><b>Region</b><span>USA / EU</span></div>
          <div><b>Storage</b><span>NVMe</span></div>
        </div>
      </main>
    </div>`;
  }

  function browserBody() {
    return `<div style="height:100%;background:#f7f8fb;display:flex;flex-direction:column;color:#202020;font:12px 'Segoe UI',Arial,sans-serif">
      <div style="height:42px;display:flex;align-items:center;gap:10px;padding:0 12px;background:#eef1f5;border-bottom:1px solid #d9dde4"><span>←</span><span>→</span><span>↻</span><div style="flex:1;background:white;border:1px solid #d5d9df;border-radius:7px;padding:7px 11px">stealthrdp.com</div></div>
      <div style="flex:1;display:grid;place-items:center;text-align:center"><div><img src="${icon('edge')}" alt="" style="width:52px;height:52px"><h3 style="margin:12px 0 4px">StealthRDP</h3><p style="margin:0;color:#667085">Windows VPS</p></div></div>
    </div>`;
  }

  function storeBody() {
    return `<div style="height:100%;background:#f7f8fb;padding:22px;box-sizing:border-box;color:#202020;font-family:'Segoe UI',Arial,sans-serif"><h2 style="margin:0 0 18px;font-size:24px">Apps</h2><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">${['calculator','notepad','paint','photos','terminal','settings'].map((name) => `<div style="padding:16px;border:1px solid #e0e4ea;background:white"><img src="${icon(name)}" alt="" style="width:32px;height:32px"><div style="margin-top:8px;font-size:12px">${name[0].toUpperCase() + name.slice(1)}</div></div>`).join('')}</div></div>`;
  }

  function windowsDesktop(version) {
    const pinned = [
      ['edge', 'Edge', 'edge'],
      ['mail', 'Mail', ''],
      ['calendar', 'Calendar', ''],
      ['store', 'Store', 'store'],
      ['photos', 'Photos', ''],
      ['settings', 'Settings', 'stealth'],
      ['calculator', 'Calculator', ''],
      ['notepad', 'Notepad', ''],
      ['paint', 'Paint', ''],
      ['explorer', 'Explorer', 'explorer'],
      ['terminal', 'Terminal', 'terminal'],
      ['security', 'Security', '']
    ];

    return `<div class="win11-exact-frame" data-win11-frame>
      <div class="win11-exact-scale">
        <div class="win11-exact-canvas" data-win11-canvas style="background-image:url('${wallpaper}')">
          <div class="win11-desk-icons">
            <button type="button" class="win11-desk-app" data-win11-open="explorer"><img src="${icon('explorer')}" alt=""><span>This PC</span></button>
            <button type="button" class="win11-desk-app"><img src="${icon('bin0')}" alt=""><span>Recycle Bin</span></button>
            <button type="button" class="win11-desk-app" data-win11-open="stealth"><img src="${icon('settings')}" alt=""><span>StealthRDP</span></button>
          </div>

          ${windowMarkup('explorer', 'File Explorer', 'explorer', explorerBody())}
          ${windowMarkup('terminal', 'Terminal', 'terminal', terminalBody())}
          ${windowMarkup('stealth', 'StealthRDP', 'settings', stealthBody(version))}
          ${windowMarkup('edge', 'Microsoft Edge', 'edge', browserBody())}
          ${windowMarkup('store', 'Microsoft Store', 'store', storeBody())}

          <section class="win11-start-menu" data-win11-start hidden>
            <div class="win11-menu-up">
              <div class="win11-start-search"><img src="${icon('search')}" alt=""><span>Type here to search</span></div>
              <div class="win11-stacbar"><span class="gpname">Pinned</span><span class="gpbtn">All apps ›</span></div>
              <div class="win11-pnapps">${pinned.map(([name, label, action]) => appButton(name, label, action)).join('')}</div>
              <div class="win11-rec-head"><span>Recommended</span><span class="gpbtn">More ›</span></div>
              <div class="win11-recapps">
                <div class="win11-recapp"><img src="${icon('settings')}" alt=""><span><b>StealthRDP</b><small>Recently added</small></span></div>
                <div class="win11-recapp"><img src="${icon('explorer')}" alt=""><span><b>File Explorer</b><small>Recently used</small></span></div>
                <div class="win11-recapp"><img src="${icon('terminal')}" alt=""><span><b>Terminal</b><small>Recently used</small></span></div>
                <div class="win11-recapp"><img src="${icon('security')}" alt=""><span><b>Windows Security</b><small>System</small></span></div>
              </div>
            </div>
            <div class="win11-menu-bar">
              <div class="win11-profile"><img src="${ui('defAccount')}" alt=""><span>StealthRDP</span></div>
              <button type="button" class="win11-power" aria-label="Power"><img src="${ui('power')}" alt=""></button>
            </div>
          </section>

          <div class="win11-taskbar">
            <div class="win11-taskcont">
              <div class="win11-tasks-cont"><div class="win11-tsbar">
                <button type="button" class="win11-tsicon" data-win11-start-button aria-label="Start"><img src="${icon('home')}" alt=""></button>
                <button type="button" class="win11-tsicon" aria-label="Search"><img src="${icon('search')}" alt=""></button>
                <button type="button" class="win11-tsicon" aria-label="Widgets"><img src="${icon('widget')}" alt=""></button>
                <button type="button" class="win11-tsicon" data-win11-open="explorer" data-win11-task="explorer" aria-label="File Explorer"><img src="${icon('explorer')}" alt=""></button>
                <button type="button" class="win11-tsicon" data-win11-open="edge" data-win11-task="edge" aria-label="Microsoft Edge"><img src="${icon('edge')}" alt=""></button>
                <button type="button" class="win11-tsicon" data-win11-open="store" data-win11-task="store" aria-label="Microsoft Store"><img src="${icon('store')}" alt=""></button>
                <button type="button" class="win11-tsicon" data-win11-open="terminal" data-win11-task="terminal" aria-label="Terminal"><img src="${icon('terminal')}" alt=""></button>
              </div></div>
              <div class="win11-taskright">
                <span class="win11-taskright-icon">⌃</span>
                <span class="win11-taskright-icon"><img src="${ui('wifi')}" alt=""></span>
                <span class="win11-taskright-icon"><img src="${ui('battery')}" alt=""></span>
                <span class="win11-taskright-icon"><img src="${ui('audio')}" alt=""></span>
                <div class="win11-task-date" data-win11-date></div>
                <span class="win11-taskright-icon"><img src="${ui('sidepane')}" alt=""></span>
                <span class="win11-task-edge"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  function wireScale(frame) {
    const canvas = qs('[data-win11-canvas]', frame);
    if (!canvas) return;
    const resize = () => {
      const scale = frame.clientWidth / 1107;
      canvas.style.transform = `scale(${scale})`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(frame);
    window.addEventListener('pagehide', () => ro.disconnect(), { once: true });
  }

  function wireDrag(win, desktop) {
    const handle = qs('[data-win11-drag]', win);
    if (!handle) return;
    let drag = null;
    handle.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button')) return;
      const wr = win.getBoundingClientRect();
      const dr = desktop.getBoundingClientRect();
      const scale = dr.width / 1107;
      drag = {
        x: event.clientX,
        y: event.clientY,
        left: parseFloat(win.style.left || '188'),
        top: parseFloat(win.style.top || '62'),
        scale
      };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const dx = (event.clientX - drag.x) / drag.scale;
      const dy = (event.clientY - drag.y) / drag.scale;
      const left = Math.max(0, Math.min(1107 - win.offsetWidth, drag.left + dx));
      const top = Math.max(0, Math.min(623 - 39 - win.offsetHeight, drag.top + dy));
      win.style.left = `${left}px`;
      win.style.top = `${top}px`;
    });
    const stop = () => { drag = null; };
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  }

  function terminalResult(command, version) {
    const raw = command.trim();
    const cmd = raw.toLowerCase();
    if (!cmd) return '';
    if (cmd === 'help') return 'hostname  whoami  ipconfig  dir  ver  cls  help';
    if (cmd === 'hostname') return 'STEALTH-RDP';
    if (cmd === 'whoami') return 'stealth-rdp\\administrator';
    if (cmd === 'ipconfig') return 'Ethernet adapter Ethernet: IPv4 Address . . . : 10.0.0.24';
    if (cmd === 'dir') return 'Desktop   Documents   Downloads   Public';
    if (cmd === 'ver') return `Microsoft Windows [${version}]`;
    return `'${raw}' is not recognized as an internal or external command.`;
  }

  function wireWindows(host, version) {
    const frame = qs('[data-win11-frame]', host);
    const desktop = qs('[data-win11-canvas]', host);
    if (!frame || !desktop) return;
    wireScale(frame);

    const start = qs('[data-win11-start]', desktop);
    let z = 50;

    function setRunning(kind, active) {
      const task = qs(`[data-win11-task="${kind}"]`, desktop);
      if (!task) return;
      task.dataset.open = active ? 'true' : 'false';
      task.dataset.active = active ? 'true' : 'false';
    }

    function open(kind) {
      const win = qs(`[data-win11-window="${kind}"]`, desktop);
      if (!win) return;
      win.hidden = false;
      win.style.zIndex = String(++z);
      if (!win.dataset.positioned) {
        const index = qsa('.win11-app-window', desktop).indexOf(win);
        win.style.left = `${188 + index * 26}px`;
        win.style.top = `${62 + index * 20}px`;
        win.dataset.positioned = '1';
      }
      start.hidden = true;
      qsa('[data-win11-task]', desktop).forEach((button) => { button.dataset.active = 'false'; });
      setRunning(kind, true);
      if (kind === 'terminal') setTimeout(() => qs('[data-win11-terminal-input]', win)?.focus(), 0);
    }

    qsa('[data-win11-open]', desktop).forEach((button) => button.addEventListener('click', () => open(button.dataset.win11Open)));
    qs('[data-win11-start-button]', desktop)?.addEventListener('click', () => { start.hidden = !start.hidden; });

    qsa('.win11-app-window', desktop).forEach((win) => {
      wireDrag(win, desktop);
      win.addEventListener('pointerdown', () => { win.style.zIndex = String(++z); });
      qs('[data-win11-close]', win)?.addEventListener('click', () => {
        win.hidden = true;
        setRunning(win.dataset.win11Window, false);
      });
      qs('[data-win11-minimize]', win)?.addEventListener('click', () => { win.hidden = true; });
    });

    const form = qs('[data-win11-terminal-form]', desktop);
    const input = qs('[data-win11-terminal-input]', desktop);
    const output = qs('[data-win11-terminal-output]', desktop);
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const command = input.value;
      input.value = '';
      if (command.trim().toLowerCase() === 'cls') { output.innerHTML = ''; return; }
      const row = document.createElement('div');
      row.textContent = `C:\\Users\\Administrator> ${command}`;
      output.appendChild(row);
      const result = terminalResult(command, version);
      if (result) {
        const out = document.createElement('div');
        out.textContent = result;
        output.appendChild(out);
      }
      output.scrollTop = output.scrollHeight;
    });

    const date = qs('[data-win11-date]', desktop);
    const updateDate = () => {
      const now = new Date();
      date.innerHTML = `<div>${now.toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: 'numeric' })}</div><div>${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric' })}</div>`;
    };
    updateDate();
    const timer = setInterval(updateDate, 30000);
    window.addEventListener('pagehide', () => clearInterval(timer), { once: true });

    open('stealth');
  }

  function windowsInstall(host, version) {
    const frame = qs('[data-win11-frame]', host);
    if (!frame) return;
    const overlay = document.createElement('div');
    overlay.className = 'v10-install-overlay';
    overlay.innerHTML = `<div class="v10-install-card"><img src="${win11Logo}" alt=""><h3>Installing ${esc(version)}</h3><div class="v10-install-status" data-v10-status>Preparing installation</div><div class="v10-install-track"><i data-v10-bar></i></div><span class="v10-install-percent" data-v10-percent>0%</span></div>`;
    frame.appendChild(overlay);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = reduced ? [[80, 100, 'Windows is ready']] : [
      [160, 12, 'Preparing installation'],
      [480, 31, 'Copying Windows files'],
      [800, 52, 'Installing features'],
      [1120, 71, 'Applying network settings'],
      [1440, 88, 'Creating Administrator profile'],
      [1760, 100, 'Windows is ready']
    ];
    const status = qs('[data-v10-status]', overlay);
    const bar = qs('[data-v10-bar]', overlay);
    const percent = qs('[data-v10-percent]', overlay);
    steps.forEach(([delay, value, text]) => setTimeout(() => {
      if (!overlay.isConnected) return;
      status.textContent = text;
      bar.style.width = `${value}%`;
      percent.textContent = `${value}%`;
    }, delay));
    const finish = reduced ? 260 : 2100;
    setTimeout(() => overlay.classList.add('done'), finish);
    setTimeout(() => overlay.remove(), finish + 420);
  }

  function linuxInstall() {
    const hero = qs('main.os-vps-page > .os-vps-hero');
    const host = qs('.hero-console', hero || document);
    const shell = qs('.ref-shell', host || document);
    if (!hero || !host || !shell || !qs('.ref-i3-desktop, .ref-linux-desktop', shell)) return;
    shell.style.position = 'relative';
    const overlay = document.createElement('div');
    overlay.className = 'v10-install-overlay v10-linux-install';
    overlay.innerHTML = `<div class="v10-install-card"><div class="v10-linux-tty" data-v10-linux-tty></div><div class="v10-install-track"><i data-v10-linux-bar></i></div></div>`;
    shell.appendChild(overlay);
    const tty = qs('[data-v10-linux-tty]', overlay);
    const bar = qs('[data-v10-linux-bar]', overlay);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lines = [
      ['dim', '[    0.000000] Linux 6.12.0 booting'],
      ['', '* Loading Alpine Linux'],
      ['', '* Mounting root filesystem'],
      ['ok', '* eth0 configured'],
      ['', '* Installing base packages'],
      ['', '* Configuring OpenSSH'],
      ['', '* Starting i3 window manager'],
      ['ok', '* root account ready'],
      ['ok', 'stealth-rdp login: root']
    ];
    if (reduced) {
      tty.innerHTML = '<div class="ok">Alpine Linux ready</div>';
      bar.style.width = '100%';
      setTimeout(() => overlay.classList.add('done'), 160);
      setTimeout(() => overlay.remove(), 440);
      return;
    }
    lines.forEach(([cls, text], index) => setTimeout(() => {
      if (!overlay.isConnected) return;
      const line = document.createElement('div');
      if (cls) line.className = cls;
      line.textContent = text;
      tty.appendChild(line);
      bar.style.width = `${Math.round(((index + 1) / lines.length) * 100)}%`;
    }, 120 + index * 170));
    setTimeout(() => overlay.classList.add('done'), 1850);
    setTimeout(() => overlay.remove(), 2250);
  }

  function buildWindows() {
    const hero = qs('main.os-vps-page > .os-vps-hero');
    const host = qs('.hero-console', hero || document);
    if (!hero || !host) return;
    const version = selectedWindowsVersion(hero);
    host.className = `${host.className.replace(/\b(ref-os-host|v9-win-host|behavior-os-visual)\b/g, '').trim()} win11-exact-host`;
    host.innerHTML = windowsDesktop(version);
    wireWindows(host, version);
    windowsInstall(host, version);
  }

  function init() {
    const path = location.pathname.replace(/\/+$/, '');
    if (path === '/windows-vps') buildWindows();
    else if (path === '/linux-vps') linuxInstall();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
