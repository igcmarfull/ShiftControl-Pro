(function(){
  'use strict';
  const ICONS={
    home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    inbox:'<path d="M3 13l3-8h12l3 8"/><path d="M3 13v6h18v-6h-5l-1 3H9l-1-3z"/>',
    moon:'<path d="M20 14a8 8 0 1 1-9-11 6.5 6.5 0 0 0 9 11z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    layout:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    work:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    alert:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    list:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    swap:'<path d="M7 4L3 8l4 4"/><path d="M3 8h14"/><path d="M17 20l4-4-4-4"/><path d="M21 16H7"/>',
    cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    week:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 10v11M13 10v11"/>',
    users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    dollar:'<path d="M12 2v20"/><path d="M17 6.5C16 5 14.3 4.5 12 4.5c-2.8 0-4.5 1.2-4.5 3.2 0 4.8 9.5 2.3 9.5 7.1 0 2-1.8 3.4-5 3.4-2.4 0-4.2-.7-5.3-2.3"/>',
    team:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    chart:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
    doc:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    receipt:'<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    box:'<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>'
  };
  const MAP={'operational-home':'home','admin-inbox':'inbox','daily-summary':'moon','today':'sun','dashboard':'layout','workcenter':'work','actual':'clock','execution':'check','absences':'plus','incidents':'alert','checklists':'list','handoff':'swap','planning':'cal','weekly':'week','employees':'users','evaluations':'star','additional':'plus','finance':'dollar','team':'team','reports':'chart','audit':'doc','settings':'gear','invoices':'receipt','inventory':'box'};
  const SVG_ATTR='viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const KEY='shiftcontrol.nav.collapsed';
  const root=()=>document.querySelector('.sidebar .nav');

  function readCollapsed(){
    try{const raw=localStorage.getItem(KEY);const v=raw?JSON.parse(raw):null;return Array.isArray(v)?v:null}catch(_){return null}
  }
  function writeCollapsed(list){try{localStorage.setItem(KEY,JSON.stringify(list))}catch(_){}}

  function icons(nav){
    nav.querySelectorAll('.nav-btn[data-view]').forEach(b=>{
      const s=b.querySelector(':scope > span');
      if(!s||s.classList.contains('mk-ico'))return;
      const name=MAP[b.dataset.view]||'doc';
      s.className='mk-ico';
      s.innerHTML=`<svg ${SVG_ATTR}>${ICONS[name]}</svg>`;
    });
  }

  function visibleCount(group){
    const was=group.classList.contains('mk-collapsed');
    if(was)group.classList.remove('mk-collapsed');
    const n=[...group.querySelectorAll('.nav-btn')].filter(b=>getComputedStyle(b).display!=='none').length;
    if(was)group.classList.add('mk-collapsed');
    return n;
  }

  function groups(nav){
    const saved=readCollapsed();
    nav.querySelectorAll('.nav-group').forEach(g=>{
      const t=g.querySelector('.nav-group-title');
      if(!t||t.dataset.mkReady)return;
      const label=t.textContent.trim();
      t.dataset.mkReady='1';
      t.dataset.label=label;
      t.setAttribute('role','button');
      t.setAttribute('tabindex','0');
      t.innerHTML=`<span>${label}</span><span class="mk-n"></span><svg class="mk-chev" ${SVG_ATTR}><path d="M6 9l6 6 6-6"/></svg>`;
      const hasActive=!!g.querySelector('.nav-btn.active');
      const startCollapsed=saved?saved.includes(label):true;
      g.classList.toggle('mk-collapsed',startCollapsed&&!hasActive);
      t.setAttribute('aria-expanded',g.classList.contains('mk-collapsed')?'false':'true');
      const toggle=()=>{
        g.classList.toggle('mk-collapsed');
        t.setAttribute('aria-expanded',g.classList.contains('mk-collapsed')?'false':'true');
        writeCollapsed([...nav.querySelectorAll('.nav-group.mk-collapsed .nav-group-title')].map(x=>x.dataset.label));
      };
      t.addEventListener('click',toggle);
      t.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}});
    });
    counts(nav);
  }

  function counts(nav){
    nav.querySelectorAll('.nav-group').forEach(g=>{
      const n=g.querySelector('.mk-n');
      if(n)n.textContent=String(visibleCount(g));
    });
  }

  let lastActive=null;
  function expandActive(nav){
    const a=nav.querySelector('.nav-btn.active');
    const g=a&&a.closest('.nav-group');
    if(g&&g.classList.contains('mk-collapsed')){
      g.classList.remove('mk-collapsed');
      g.querySelector('.nav-group-title')?.setAttribute('aria-expanded','true');
    }
    if(a&&a!==lastActive){lastActive=a;if(typeof a.scrollIntoView==='function')a.scrollIntoView({block:'nearest'})}
  }

  function init(){
    const nav=root();
    if(!nav||nav.dataset.mkPapel)return;
    nav.dataset.mkPapel='1';
    icons(nav);
    groups(nav);
    // counts() y expandActive() alteran clases del propio menú: se vacía la cola de cada observador
    // después de actuar para que esos cambios no vuelvan a dispararlo.
    const navObs=new MutationObserver(()=>{expandActive(nav);counts(nav);navObs.takeRecords()});
    navObs.observe(nav,{subtree:true,attributes:true,attributeFilter:['class','style','hidden']});
    const bodyObs=new MutationObserver(()=>{counts(nav);navObs.takeRecords()});
    bodyObs.observe(document.body,{attributes:true,attributeFilter:['data-role','class']});
    // Los permisos por rol ocultan botones después de la carga: recalcular los contadores
    setTimeout(()=>counts(nav),1500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  function icon(view){
    const name=MAP[view]||'doc';
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  }
  window.ShiftControlPapel={init,icon};
})();
