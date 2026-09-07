(() => {
  const qs = (selector, root = document) => root.querySelector(selector);

  function installOverlay(type, label) {
    const overlay = document.createElement('div');
    overlay.className = `os-fresh-install is-${type}`;
    if (type === 'linux') {
      overlay.innerHTML = `<div class="os-fresh-install-card"><div class="os-fresh-install-tty" data-fresh-tty></div><div class="os-fresh-install-track"><i data-fresh-bar></i></div></div>`;
    } else {
      overlay.innerHTML = `<div class="os-fresh-install-card"><img class="os-fresh-install-logo" src="/img/windows11.png" alt=""><h3>Installing ${label}</h3><div class="os-fresh-install-status" data-fresh-status>Preparing installation</div><div class="os-fresh-install-track"><i data-fresh-bar></i></div><span class="os-fresh-install-percent" data-fresh-percent>0%</span></div>`;
    }
    return overlay;
  }

  function finishOverlay(overlay, delay) {
    setTimeout(() => overlay.classList.add('is-done'), delay);
    setTimeout(() => overlay.remove(), delay + 420);
  }

  function runWindowsInstall(frame, version) {
    const overlay = installOverlay('windows', version);
    frame.appendChild(overlay);
    const status = qs('[data-fresh-status]', overlay);
    const bar = qs('[data-fresh-bar]', overlay);
    const percent = qs('[data-fresh-percent]', overlay);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = reduced ? [[80, 100, 'Windows is ready']] : [
      [140, 12, 'Preparing installation'],
      [430, 30, 'Copying Windows files'],
      [720, 51, 'Installing features'],
      [1010, 70, 'Applying network settings'],
      [1300, 87, 'Creating Administrator profile'],
      [1590, 100, 'Windows is ready']
    ];
    steps.forEach(([delay, value, text]) => setTimeout(() => {
      if (!overlay.isConnected) return;
      status.textContent = text;
      bar.style.width = `${value}%`;
      percent.textContent = `${value}%`;
    }, delay));
    finishOverlay(overlay, reduced ? 250 : 1940);
  }

  function runLinuxInstall(shell) {
    const overlay = installOverlay('linux', 'Alpine Linux');
    shell.appendChild(overlay);
    const tty = qs('[data-fresh-tty]', overlay);
    const bar = qs('[data-fresh-bar]', overlay);
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
      finishOverlay(overlay, 220);
      return;
    }
    lines.forEach(([cls, text], index) => setTimeout(() => {
      if (!overlay.isConnected) return;
      const line = document.createElement('div');
      if (cls) line.className = cls;
      line.textContent = text;
      tty.appendChild(line);
      bar.style.width = `${Math.round(((index + 1) / lines.length) * 100)}%`;
    }, 100 + index * 165));
    finishOverlay(overlay, 1770);
  }

  function selectedWindowsVersion(hero) {
    const chips = Array.from(hero.querySelectorAll('.os-hero-chip')).map((chip) => chip.textContent.trim()).filter(Boolean);
    return chips[1] || chips[0] || 'Windows Server 2022';
  }

  function scaleIframe(frame, iframe) {
    const resize = () => {
      const scale = frame.clientWidth / 1107;
      iframe.style.transform = `scale(${scale})`;
    };
    resize();
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(resize);
      observer.observe(frame);
      window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
    } else {
      window.addEventListener('resize', resize, { passive: true });
    }
  }

  function buildWindows() {
    const hero = qs('main.os-vps-page > .os-vps-hero');
    const host = qs('.hero-console', hero || document);
    if (!hero || !host) return;
    const version = selectedWindowsVersion(hero);
    host.className = `${host.className.replace(/\b(ref-os-host|v9-win-host|win11-exact-host|behavior-os-visual)\b/g, '').trim()} full-os-demo-host`;
    host.innerHTML = `<div class="full-os-demo-frame" data-full-os-frame><div class="full-os-demo-viewport"><iframe class="full-os-demo-iframe" data-full-os-iframe src="/win11-demo/" width="1107" height="623" title="StealthRDP Windows interactive demo" loading="eager"></iframe></div></div>`;
    const frame = qs('[data-full-os-frame]', host);
    const iframe = qs('[data-full-os-iframe]', host);
    scaleIframe(frame, iframe);
    runWindowsInstall(frame, version);
  }

  function enhanceLinux() {
    const hero = qs('main.os-vps-page > .os-vps-hero');
    const host = qs('.hero-console', hero || document);
    const shell = qs('.ref-shell', host || document);
    if (!hero || !host || !shell) return;
    const desktop = qs('.ref-i3-desktop, .ref-linux-desktop', shell);
    if (!desktop) return;
    shell.style.position = 'relative';
    runLinuxInstall(shell);
  }

  function init() {
    const path = location.pathname.replace(/\/+$/, '');
    if (path === '/windows-vps') buildWindows();
    else if (path === '/linux-vps') enhanceLinux();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
