(() => {
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function winLogo() {
    return '<span class="ref-win-logo" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
  }

  function winWindow(kind, title, body) {
    return `<section class="ref-win-window" data-ref-win-window="${kind}" hidden>
      <header class="ref-win-titlebar" data-ref-drag>
        <span>${esc(title)}</span>
        <span class="ref-win-window-actions"><button type="button" data-minimize aria-label="Minimize">—</button><button type="button" data-close aria-label="Close">×</button></span>
      </header>
      <div class="ref-win-window-body">${body}</div>
    </section>`;
  }

  function winExplorer() {
    return `<div class="ref-explorer"><aside><span class="is-active">This PC</span><span>Desktop</span><span>Downloads</span><span>Network</span></aside><main>
      <div class="ref-explorer-path">This PC</div>
      <div class="ref-drive"><strong>Local Disk (C:)</strong><div class="ref-drive-bar"><i style="width:42%"></i></div><small>58.2 GB free</small></div>
      <div class="ref-drive"><strong>Data (D:)</strong><div class="ref-drive-bar"><i style="width:18%"></i></div><small>122 GB free</small></div>
    </main></div>`;
  }

  function winServer(version) {
    return `<div class="ref-server"><aside><b>Dashboard</b><span>Local Server</span><span>All Servers</span><span>File Services</span></aside><main>
      <h4>${esc(version)}</h4><p>Local Server</p>
      <div class="ref-server-grid">
        <span><b>Computer name</b><small>STEALTH-RDP</small></span>
        <span><b>Remote Desktop</b><small>Enabled</small></span>
        <span><b>Windows Update</b><small>Available</small></span>
        <span><b>Ethernet</b><small>Connected</small></span>
      </div>
    </main></div>`;
  }

  function winPowerShell() {
    return `<div class="ref-ps"><div class="ref-ps-output" data-ref-ps-output><div>Windows PowerShell</div><div>Copyright (C) Microsoft Corporation.</div><br></div><form class="ref-ps-form" data-ref-ps-form><label><span class="ref-ps-prompt">PS C:\\Users\\Administrator&gt;</span><input data-ref-ps-input autocomplete="off" spellcheck="false" aria-label="PowerShell command"></label></form></div>`;
  }

  function windowsMarkup(version = 'Windows Server 2022', preview = false) {
    if (preview) {
      return `<div class="ref-win-desktop" aria-hidden="true">
        <div class="ref-win-icon-stack"><div class="ref-win-icon"><span class="ref-win-icon-mark">▦</span>Server</div><div class="ref-win-icon"><span class="ref-win-icon-mark">▣</span>This PC</div></div>
        <section class="ref-win-window" style="display:block;left:80px;top:48px;width:300px;min-height:190px"><header class="ref-win-titlebar"><span>Server Manager</span><span class="ref-win-window-actions"><button type="button">—</button><button type="button">×</button></span></header><div class="ref-win-window-body">${winServer(version)}</div></section>
        <div class="ref-win-taskbar"><span></span><div class="ref-win-task-center"><button type="button">${winLogo()}</button><button type="button">⌕</button><button type="button">▣</button><button type="button">&gt;_</button></div><div class="ref-win-tray"><span>ENG</span><span>▰</span><span class="ref-win-clock">12:48<br>9/8/26</span></div></div>
      </div>`;
    }

    return `<div class="ref-win-desktop" data-ref-win>
      <div class="ref-win-icon-stack">
        <button type="button" class="ref-win-icon" data-open="server"><span class="ref-win-icon-mark">▦</span>Server Manager</button>
        <button type="button" class="ref-win-icon" data-open="explorer"><span class="ref-win-icon-mark">▣</span>This PC</button>
        <button type="button" class="ref-win-icon" data-open="powershell"><span class="ref-win-icon-mark">&gt;_</span>PowerShell</button>
      </div>
      ${winWindow('server','Server Manager',winServer(version))}
      ${winWindow('explorer','File Explorer',winExplorer())}
      ${winWindow('powershell','Windows PowerShell',winPowerShell())}
      <section class="ref-win-start" data-ref-start hidden>
        <div class="ref-win-search">Type here to search</div><h4>Pinned</h4>
        <div class="ref-win-pins"><button type="button" data-open="server"><span class="ref-win-pin-icon">▦</span>Server Manager</button><button type="button" data-open="explorer"><span class="ref-win-pin-icon">▣</span>File Explorer</button><button type="button" data-open="powershell"><span class="ref-win-pin-icon">&gt;_</span>PowerShell</button></div>
        <div class="ref-win-start-foot"><span class="ref-win-user"><span class="ref-win-avatar">A</span>Administrator</span><span>⏻</span></div>
      </section>
      <div class="ref-win-taskbar"><span></span><div class="ref-win-task-center"><button type="button" data-start aria-label="Start">${winLogo()}</button><button type="button" aria-label="Search">⌕</button><button type="button" data-open="explorer" aria-label="File Explorer">▣</button><button type="button" data-open="server" aria-label="Server Manager">▦</button><button type="button" data-open="powershell" aria-label="PowerShell">&gt;_</button></div><div class="ref-win-tray"><span>ENG</span><span>▰</span><span class="ref-win-clock" data-ref-win-clock></span></div></div>
    </div>`;
  }

  function wireWinDrag(win, desktop) {
    const handle = qs('[data-ref-drag]', win);
    if (!handle) return;
    let drag = null;
    handle.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button')) return;
      const wr = win.getBoundingClientRect();
      const dr = desktop.getBoundingClientRect();
      drag = {x:event.clientX,y:event.clientY,left:wr.left-dr.left,top:wr.top-dr.top};
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const left = Math.max(0, Math.min(desktop.clientWidth - win.offsetWidth, drag.left + event.clientX - drag.x));
      const top = Math.max(0, Math.min(desktop.clientHeight - win.offsetHeight - 46, drag.top + event.clientY - drag.y));
      win.style.left = `${left}px`; win.style.top = `${top}px`;
    });
    const stop = () => { drag = null; };
    handle.addEventListener('pointerup', stop); handle.addEventListener('pointercancel', stop);
  }

  function psResult(command, version) {
    const raw = command.trim(); const cmd = raw.toLowerCase();
    if (!cmd) return '';
    if (cmd === 'help') return 'hostname  whoami  ipconfig  dir  ver  cls  help';
    if (cmd === 'hostname') return 'STEALTH-RDP';
    if (cmd === 'whoami') return 'stealth-rdp\\administrator';
    if (cmd === 'ipconfig') return 'Ethernet adapter Ethernet: IPv4 Address . . . : 10.0.0.24';
    if (cmd === 'dir') return 'Desktop   Documents   Downloads   Public';
    if (cmd === 'ver') return `Microsoft Windows [${version}]`;
    return `The term '${raw}' is not recognized. Type 'help'.`;
  }

  function wireWindows(root, version) {
    const desktop = qs('[data-ref-win]', root); if (!desktop) return;
    const start = qs('[data-ref-start]', desktop); let z = 30;
    function open(kind) {
      const win = qs(`[data-ref-win-window="${kind}"]`, desktop); if (!win) return;
      win.hidden = false; win.style.zIndex = String(++z); start.hidden = true;
      if (!win.dataset.positioned) {
        const idx = qsa('.ref-win-window', desktop).indexOf(win);
        win.style.left = `${72 + idx*15}px`; win.style.top = `${42 + idx*14}px`; win.dataset.positioned='1';
      }
      if (kind === 'powershell') setTimeout(() => qs('[data-ref-ps-input]', win)?.focus(),0);
    }
    qsa('[data-open]', desktop).forEach((el) => el.addEventListener('click', () => open(el.dataset.open)));
    qs('[data-start]', desktop)?.addEventListener('click', () => { start.hidden = !start.hidden; });
    qsa('.ref-win-window', desktop).forEach((win) => {
      wireWinDrag(win, desktop);
      qs('[data-close]', win)?.addEventListener('click', () => { win.hidden=true; });
      qs('[data-minimize]', win)?.addEventListener('click', () => { win.hidden=true; });
      win.addEventListener('pointerdown', () => { win.style.zIndex = String(++z); });
    });
    const form = qs('[data-ref-ps-form]', desktop), input = qs('[data-ref-ps-input]', desktop), output = qs('[data-ref-ps-output]', desktop);
    form?.addEventListener('submit', (event) => {
      event.preventDefault(); const command = input.value; input.value='';
      if (command.trim().toLowerCase()==='cls') { output.innerHTML=''; return; }
      const row=document.createElement('div'); row.innerHTML=`<span class="ref-ps-prompt">PS C:\\Users\\Administrator&gt;</span> ${esc(command)}`; output.appendChild(row);
      const result=psResult(command,version); if(result){const out=document.createElement('div');out.textContent=result;output.appendChild(out);} output.scrollTop=output.scrollHeight;
    });
    const clock = qs('[data-ref-win-clock]', desktop);
    const updateClock=()=>{ if(!clock)return; const d=new Date(); clock.innerHTML=`${new Intl.DateTimeFormat([], {hour:'2-digit',minute:'2-digit'}).format(d)}<br>${d.getMonth()+1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`; };
    updateClock(); const timer=setInterval(updateClock,30000); window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
    open('server');
  }

  function linuxTerminalResult(command, distro) {
    const raw=command.trim(); const cmd=raw.toLowerCase();
    if (!cmd) return '';
    if (cmd==='help') return 'help  ls  pwd  whoami  hostname  uname  cat /etc/os-release  date  clear';
    if (cmd==='ls') return 'bin   etc   home   root   srv   usr   var';
    if (cmd==='pwd') return '/root';
    if (cmd==='whoami') return 'root';
    if (cmd==='hostname') return 'stealth-rdp';
    if (cmd==='uname' || cmd==='uname -a') return 'Linux stealth-rdp 6.12.0 x86_64 Linux';
    if (cmd==='cat /etc/os-release') return `NAME="${distro}"\nID=${distro.toLowerCase().replace(/\s+/g,'')}\nPRETTY_NAME="${distro} Linux"`;
    if (cmd==='date') return new Date().toString();
    return `sh: ${raw}: not found`;
  }

  function linuxWorkspaceMain(distro) {
    return `<section class="ref-i3-workspace is-main" data-ws="1"><div class="ref-i3-pane"><div class="ref-i3-pane-head"><span>terminal — root@stealth-rdp</span><span>1</span></div><div class="ref-i3-terminal"><div class="ref-i3-output" data-i3-output><div class="ok">${esc(distro)} Linux</div><div class="muted">StealthRDP VPS · type help</div><br></div><form class="ref-i3-form" data-i3-form><label><span>root@stealth-rdp:~#</span><input data-i3-input autocomplete="off" spellcheck="false" aria-label="Linux command"></label></form></div></div><div class="ref-i3-side"><div class="ref-i3-pane"><div class="ref-i3-pane-head"><span>files</span><span>/root</span></div><div class="ref-i3-files"><div class="ref-i3-file"><span>📁 .ssh</span><small>dir</small></div><div class="ref-i3-file"><span>📁 backups</span><small>dir</small></div><div class="ref-i3-file"><span>📄 server.log</span><small>12K</small></div><div class="ref-i3-file"><span>📄 deploy.sh</span><small>1K</small></div></div></div><div class="ref-i3-pane"><div class="ref-i3-pane-head"><span>system</span><span>stealth-rdp</span></div><div class="ref-i3-sys"><div><b>OS</b> ${esc(distro)}</div><div><b>Kernel</b> 6.12.0</div><div><b>Shell</b> ash</div><div><b>Region</b> USA / EU</div><div><b>Storage</b> NVMe</div></div></div></div></section>`;
  }

  function linuxWorkspaceFiles() {
    return `<section class="ref-i3-workspace" data-ws="2" hidden style="grid-template-columns:1fr 1fr"><div class="ref-i3-pane"><div class="ref-i3-pane-head"><span>ranger</span><span>/etc</span></div><div class="ref-i3-files"><div class="ref-i3-file"><span>📁 nginx</span><small>dir</small></div><div class="ref-i3-file"><span>📁 ssh</span><small>dir</small></div><div class="ref-i3-file"><span>📄 hosts</span><small>file</small></div><div class="ref-i3-file"><span>📄 resolv.conf</span><small>file</small></div></div></div><div class="ref-i3-pane"><div class="ref-i3-pane-head"><span>editor</span><span>deploy.sh</span></div><div class="ref-i3-sys"><div><b>#!/bin/sh</b></div><div>apk update</div><div>apk add nginx</div><div>rc-service nginx start</div></div></div></section>`;
  }

  function linuxWorkspaceMonitor() {
    return `<section class="ref-i3-workspace" data-ws="3" hidden style="grid-template-columns:1fr"><div class="ref-i3-pane"><div class="ref-i3-pane-head"><span>htop</span><span>stealth-rdp</span></div><div class="ref-i3-monitor"><div class="ref-i3-meter"><label><span>CPU</span><span>18%</span></label><div><i style="width:18%"></i></div></div><div class="ref-i3-meter"><label><span>Memory</span><span>2.8G / 8G</span></label><div><i style="width:35%"></i></div></div><div class="ref-i3-meter"><label><span>NVMe</span><span>21G / 80G</span></label><div><i style="width:26%"></i></div></div><div class="ref-i3-meter"><label><span>Network</span><span>Connected</span></label><div><i style="width:62%"></i></div></div></div></div></section>`;
  }

  function linuxMarkup(distro='Alpine', preview=false) {
    if (preview) {
      return `<div class="ref-linux-desktop" aria-hidden="true"><div class="ref-i3-bar"><div class="ref-i3-workspaces"><button class="is-active">1</button><button>2</button><button>3</button></div><div class="ref-i3-title">terminal — root@stealth-rdp</div><div class="ref-i3-status"><span>NET</span><span>CPU 18%</span><span>12:48</span></div></div><div class="ref-i3-stage">${linuxWorkspaceMain(distro)}</div></div>`;
    }
    return `<div class="ref-linux-desktop" data-ref-linux><div class="ref-i3-bar"><div class="ref-i3-workspaces"><button type="button" class="is-active" data-ws-button="1">1</button><button type="button" data-ws-button="2">2</button><button type="button" data-ws-button="3">3</button><button type="button" data-launcher>≡</button></div><div class="ref-i3-title" data-i3-title>terminal — root@stealth-rdp</div><div class="ref-i3-status"><span>NET</span><span>CPU 18%</span><span data-i3-clock></span></div></div><div class="ref-i3-stage">${linuxWorkspaceMain(distro)}${linuxWorkspaceFiles()}${linuxWorkspaceMonitor()}</div><div class="ref-i3-launcher" data-i3-launcher hidden><input value="" placeholder="run command" aria-label="Application launcher"><div class="ref-i3-launcher-list"><button type="button" data-launch-ws="1">terminal</button><button type="button" data-launch-ws="2">files</button><button type="button" data-launch-ws="3">htop</button></div></div></div>`;
  }

  function wireLinux(root, distro) {
    const desktop=qs('[data-ref-linux]',root); if(!desktop)return;
    const buttons=qsa('[data-ws-button]',desktop), workspaces=qsa('[data-ws]',desktop), title=qs('[data-i3-title]',desktop);
    const titles={1:'terminal — root@stealth-rdp',2:'files / editor',3:'htop — stealth-rdp'};
    function activate(id){ buttons.forEach(b=>b.classList.toggle('is-active',b.dataset.wsButton===String(id))); workspaces.forEach(w=>w.hidden=w.dataset.ws!==String(id)); title.textContent=titles[id]||''; }
    buttons.forEach(b=>b.addEventListener('click',()=>activate(b.dataset.wsButton)));
    const launcher=qs('[data-i3-launcher]',desktop); qs('[data-launcher]',desktop)?.addEventListener('click',()=>{launcher.hidden=!launcher.hidden; if(!launcher.hidden)qs('input',launcher)?.focus();}); qsa('[data-launch-ws]',launcher).forEach(b=>b.addEventListener('click',()=>{activate(b.dataset.launchWs);launcher.hidden=true;}));
    const form=qs('[data-i3-form]',desktop),input=qs('[data-i3-input]',desktop),output=qs('[data-i3-output]',desktop);
    form?.addEventListener('submit',(event)=>{event.preventDefault();const command=input.value;input.value='';if(command.trim().toLowerCase()==='clear'){output.innerHTML='';return;}const row=document.createElement('div');row.innerHTML=`<span class="ok">root@stealth-rdp:~#</span> ${esc(command)}`;output.appendChild(row);const result=linuxTerminalResult(command,distro);if(result){result.split('\n').forEach(line=>{const out=document.createElement('div');out.textContent=line;output.appendChild(out);});}output.scrollTop=output.scrollHeight;});
    const clock=qs('[data-i3-clock]',desktop); const update=()=>{if(clock)clock.textContent=new Intl.DateTimeFormat([],{hour:'2-digit',minute:'2-digit'}).format(new Date());}; update(); const timer=setInterval(update,30000);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  }

  function selectedWindowsVersion(hero) {
    const versions=qsa('.os-hero-chip',hero).map(x=>x.textContent.trim()).filter(Boolean); return versions[1]||versions[0]||'Windows Server 2022';
  }
  function selectedLinuxDistro() {
    return qs('#linux-distros .os-distro-tab strong')?.textContent.trim()||'Alpine';
  }

  function buildWindowsPage() {
    const hero=qs('main.os-vps-page > .os-vps-hero'), host=qs('.hero-console',hero||document); if(!hero||!host)return;
    const version=selectedWindowsVersion(hero); host.classList.add('ref-os-host'); host.innerHTML=`<div class="ref-shell">${windowsMarkup(version,false)}</div>`; wireWindows(host,version);
  }
  function buildLinuxPage() {
    const hero=qs('main.os-vps-page > .os-vps-hero'), host=qs('.hero-console',hero||document); if(!hero||!host)return;
    const distro=selectedLinuxDistro(); host.classList.add('ref-os-host'); host.innerHTML=`<div class="ref-shell">${linuxMarkup(distro,false)}</div>`; wireLinux(host,distro);
  }
  function buildHome() {
    const hero=qs('body[data-page="home"] .hero'), host=qs('.hero-console',hero||document); if(!hero||!host)return;
    host.classList.add('ref-os-host'); host.innerHTML=`<div class="ref-os-compare" style="--split:50%"><div class="ref-win-desktop">${windowsMarkup('Windows Server 2022',true).replace(/^<div class="ref-win-desktop" aria-hidden="true">|<\/div>$/g,'')}</div><div class="ref-linux-desktop">${linuxMarkup('Alpine',true).replace(/^<div class="ref-linux-desktop" aria-hidden="true">|<\/div>$/g,'')}</div><span class="ref-os-tag win">Windows</span><span class="ref-os-tag linux">Linux</span><div class="ref-os-divider"></div><div class="ref-os-handle"></div><input type="range" min="12" max="88" value="50" aria-label="Compare Windows and Linux"></div>`;
    const compare=qs('.ref-os-compare',host), slider=qs('input[type="range"]',compare); slider.addEventListener('input',()=>compare.style.setProperty('--split',`${slider.value}%`));
  }

  function init() {
    const path=location.pathname.replace(/\/+$/,'');
    if(path==='/windows-vps') buildWindowsPage();
    else if(path==='/linux-vps') buildLinuxPage();
    else if(path===''||path==='/') buildHome();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
