(() => {
  const page = document.querySelector('main.os-vps-page');
  if (!page) return;

  const selectors = [
    '.os-vps-cheap',
    '.os-vps-root',
    '.os-vps-size',
    '.os-vps-regions',
    '.os-vps-activation',
    '.os-vps-support',
    '.os-vps-order'
  ];

  const sections = selectors
    .map((selector) => page.querySelector(`:scope > ${selector}`))
    .filter(Boolean);

  if (sections.length < 2) return;

  const shell = document.createElement('section');
  shell.className = 'os-guide-flow';
  shell.setAttribute('aria-label', 'VPS guide');

  const nav = document.createElement('nav');
  nav.className = 'os-guide-nav';
  nav.setAttribute('aria-label', 'Guide topics');

  const stage = document.createElement('div');
  stage.className = 'os-guide-stage';

  sections[0].before(shell);
  shell.append(nav, stage);

  const buttons = [];

  sections.forEach((section, index) => {
    section.classList.add('os-guide-pane');
    const heading = section.querySelector('h2');
    const label = heading ? heading.textContent.trim() : `Section ${index + 1}`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'os-guide-nav-button';
    button.textContent = label;
    button.setAttribute('aria-controls', section.id || `os-guide-pane-${index + 1}`);

    if (!section.id) section.id = `os-guide-pane-${index + 1}`;

    button.addEventListener('click', () => activate(index, true));
    nav.appendChild(button);
    buttons.push(button);
    stage.appendChild(section);
  });

  function activate(index, updateHash = false) {
    sections.forEach((section, sectionIndex) => {
      const active = sectionIndex === index;
      section.hidden = !active;
      section.classList.toggle('is-active', active);
      section.setAttribute('aria-hidden', String(!active));
      buttons[sectionIndex].classList.toggle('is-active', active);
      buttons[sectionIndex].setAttribute('aria-current', active ? 'true' : 'false');
    });

    if (updateHash && sections[index].id) {
      history.replaceState(null, '', `#${sections[index].id}`);
    }
  }

  function indexFromHash() {
    if (!location.hash) return -1;
    const target = document.querySelector(location.hash);
    if (!target) return -1;
    return sections.findIndex((section) => section === target || section.contains(target));
  }

  const initialIndex = indexFromHash();
  activate(initialIndex >= 0 ? initialIndex : 0, false);

  window.addEventListener('hashchange', () => {
    const index = indexFromHash();
    if (index >= 0) activate(index, false);
  });
})();