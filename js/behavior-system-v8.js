(() => {
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));

  function normalizePlanPriority(root=document){
    qsa('.plan-card',root).forEach(card=>{
      const name=qs('.p-name',card)?.textContent.trim().toLowerCase();
      const gold=name==='gold';
      card.classList.toggle('behavior-priority-plan',gold);
      if(!gold) card.classList.remove('popular');
      const badge=qs('.plan-popular',card); if(badge) badge.hidden=!gold;
    });
  }
  function makePlanGrid(grid){
    if(!grid)return;
    grid.classList.remove('behavior-plan-rail'); grid.classList.add('behavior-plan-grid'); grid.removeAttribute('data-behavior-rail');
    const controls=grid.previousElementSibling; if(controls?.classList.contains('behavior-plan-controls')) controls.remove();
    const obs=new MutationObserver(()=>normalizePlanPriority(grid));
    qsa('.plan-card',grid).forEach(card=>obs.observe(card,{attributes:true,attributeFilter:['hidden','class']}));
  }
  function enhancePlans(){
    normalizePlanPriority(); makePlanGrid(qs('main.os-vps-page .os-vps-plan-grid'));
    if(!qs('main.os-vps-page')) makePlanGrid(qs('body[data-page="plans"] .plan-grid'));
  }

  function sectionLabel(section){
    if(section.classList.contains('os-vps-hero')) return qs('.eyebrow',section)?.textContent.trim()||qs('h1',section)?.textContent.trim();
    return qs('h2',section)?.textContent.trim()||qs('.included-label',section)?.textContent.trim();
  }
  function buildJourneyRail(page){
    if(!page||qs(':scope > .behavior-journey',page))return;
    const sections=[qs(':scope > .os-vps-hero',page),qs(':scope > .os-vps-catalog',page),qs(':scope > .os-vps-distros',page),qs(':scope > .os-guide-flow',page),qs(':scope > .os-vps-faq',page),qs(':scope > .cta-band',page)].filter(Boolean);
    if(sections.length<3)return;
    const rail=document.createElement('nav'); rail.className='behavior-journey'; rail.setAttribute('aria-label','Page sections');
    const buttons=sections.map((section,index)=>{
      if(!section.id)section.id=`page-step-${index+1}`;
      const button=document.createElement('button'); button.type='button'; button.className='behavior-journey-item'; button.textContent=sectionLabel(section)||String(index+1);
      button.addEventListener('click',()=>{const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;section.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});});
      rail.appendChild(button); return button;
    });
    page.prepend(rail);
    const setActive=section=>{const idx=sections.indexOf(section);if(idx<0)return;buttons.forEach((b,i)=>{const active=i===idx;b.classList.toggle('is-active',active);b.setAttribute('aria-current',active?'location':'false');});};
    const observer=new IntersectionObserver(entries=>{const candidate=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(candidate)setActive(candidate.target);},{rootMargin:'-24% 0px -58% 0px',threshold:[.05,.2,.5]});
    sections.forEach(s=>observer.observe(s)); setActive(sections[0]);
  }

  function accordionGroup(items){
    if(!items.length)return;
    items.forEach((item,index)=>{item.open=index===0;item.addEventListener('toggle',()=>{if(!item.open)return;items.forEach(peer=>{if(peer!==item)peer.open=false;});});});
  }
  function enhanceFaq(){accordionGroup(qsa('.os-vps-faq-item'));accordionGroup(qsa('body[data-page="faq"] details'));}
  function calmReviews(){const reel=qs('.review-reel');if(reel)reel.classList.add('behavior-review-rail');}

  function init(){enhancePlans();buildJourneyRail(qs('main.os-vps-page'));enhanceFaq();calmReviews();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
