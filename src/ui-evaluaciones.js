(function(){
  'use strict';
  // Evaluación mensual: resumen del mes y lista agrupada por estado.
  // Reutiliza EvaluationModule, el editor existente y los filtros de index.html; no cambia el modelo de datos.
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const CIRC=339.29;
  const AREAS={ISLA:'Isla',TIENDA:'Tienda'};
  let areaFilter='';
  let original=null;

  const initials=name=>String(name||'?').trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  const plural=(n,one,many)=>`${n} ${n===1?one:many}`;
  // Sin área definida se trata como Isla, igual que en recordArea() de ShiftControlAreas.
  const areaOf=worker=>worker?window.ShiftControlAreas?.employeeArea?.(worker)||'ISLA':null;
  const scoreOf=record=>{
    const values=Object.values(record?.scores||{}).map(Number).filter(Number.isFinite);
    return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  };
  const fmt=value=>value.toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1});
  function monthLabel(period){
    const [y,m]=String(period||'').split('-').map(Number);
    if(!y||!m)return '';
    return new Date(y,m-1,1).toLocaleDateString('es-CL',{month:'long',year:'numeric'});
  }
  function monthName(period){
    const [y,m]=String(period||'').split('-').map(Number);
    return y&&m?new Date(y,m-1,1).toLocaleDateString('es-CL',{month:'long'}):'';
  }
  function previousPeriod(period){
    const [y,m]=String(period||'').split('-').map(Number);
    if(!y||!m)return '';
    const d=new Date(y,m-2,1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  // Promedio de las evaluaciones enviadas o aprobadas (los borradores no cuentan).
  function average(period,workerIds){
    const scores=window.EvaluationModule.getAll()
      .filter(x=>x.period===period&&x.status!=='draft'&&(!workerIds||workerIds.has(x.employeeId)))
      .map(scoreOf).filter(v=>v!==null);
    return scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null;
  }
  // Los filtros son variables `let` de index.html: se leen por nombre, no por window.
  const statusFilter=()=>typeof evalStatusFilterValue==='string'?evalStatusFilterValue:'all';
  const searchQuery=()=>typeof evalSearchQuery==='string'?evalSearchQuery:'';
  const workers=()=>typeof window.employeesForEval==='function'?window.employeesForEval():[];
  const inArea=worker=>!areaFilter||areaOf(worker)===areaFilter;

  function buildEntries(period){
    const list=window.EvaluationModule.getAll().filter(x=>x.period===period);
    const all=workers();
    const evaluated=new Set(list.map(x=>x.employeeId));
    const entries=list.map(record=>({worker:all.find(e=>e.id===record.employeeId)||null,record,status:record.status}));
    all.filter(w=>!evaluated.has(w.id)).forEach(worker=>entries.push({worker,record:null,status:'pending'}));
    return entries;
  }

  function renderHero(period,entries){
    const root=$('evHero');
    if(!root)return;
    const scoped=entries.filter(e=>!e.worker||inArea(e.worker));
    const total=scoped.length;
    const approved=scoped.filter(e=>e.status==='approved').length;
    const review=scoped.filter(e=>e.status==='submitted').length;
    const drafts=scoped.filter(e=>e.status==='draft').length;
    const pending=scoped.filter(e=>e.status==='pending').length;
    const done=approved+review;
    const pct=total?done/total:0;
    const ids=new Set(scoped.filter(e=>e.worker).map(e=>e.worker.id));
    const avg=average(period,areaFilter?ids:null);
    const prevPeriod=previousPeriod(period);
    const prev=average(prevPeriod,areaFilter?ids:null);
    let compare='';
    if(avg!==null&&prev!==null){
      const diff=avg-prev;
      const arrow=Math.abs(diff)<0.05?'=':diff>0?'▲':'▼';
      const tone=Math.abs(diff)<0.05?'':diff>0?'up':'down';
      compare=`<p><span class="${tone}">${arrow} ${fmt(Math.abs(diff))}</span> vs ${esc(monthName(prevPeriod))} (${fmt(prev)})</p>`;
    }else if(avg===null){
      compare='<p>Aún no hay evaluaciones enviadas</p>';
    }
    root.innerHTML=`<div class="ev-ring"><div class="wc-donut" style="width:110px;height:110px"><svg viewBox="0 0 128 128" style="width:110px;height:110px"><circle class="bg" cx="64" cy="64" r="54"/><circle class="fg" cx="64" cy="64" r="54" stroke-dasharray="${CIRC}" stroke-dashoffset="${(CIRC*(1-pct)).toFixed(1)}"/></svg><div class="c"><b style="font-size:26px">${Math.round(pct*100)}%</b></div></div><div><h4>${done} de ${total} evaluadas</h4><p>${pending?`Faltan ${plural(pending,'persona','personas')} este mes`:total?'Todo el personal tiene evaluación':'No hay personal activo'}</p></div></div>`
      +`<div><div class="ev-stats"><div class="ev-st ok"><span>Completadas</span><b>${approved}</b><small>evaluaciones aprobadas</small></div><div class="ev-st warn"><span>Borradores</span><b>${drafts+review}</b><small>${review?`${review} en revisión`:'pendientes de revisión'}</small></div><div class="ev-st"><span>Sin evaluar</span><b>${pending}</b><small>personal activo</small></div></div></div>`
      +`<div class="ev-avg${avg===null?' empty':''}"><span>Promedio del mes</span><b>${avg===null?'—':fmt(avg)}<small> / 5</small></b>${compare}</div>`;
  }

  function renderTabs(entries){
    const root=$('evTabs');
    if(!root)return;
    const scoped=entries.filter(e=>!e.worker||inArea(e.worker));
    const count=status=>scoped.filter(e=>e.status===status).length;
    const current=statusFilter();
    const tabs=[['all','Todos',scoped.length],['pending','Sin evaluar',count('pending')],['draft','Borradores',count('draft')]];
    if(count('submitted'))tabs.push(['submitted','En revisión',count('submitted')]);
    tabs.push(['approved','Completadas',count('approved')]);
    root.innerHTML=tabs.map(([key,label,n])=>`<button type="button" role="tab" class="${current===key?'on':''}" onclick="evalSetStatus('${key}')">${label}<em>${n}</em></button>`).join('');
  }

  // Flechas junto al selector de mes: cambian a la opción anterior o siguiente del mismo <select>.
  function ensureMonthNav(){
    const select=$('evaluationMonth');
    if(!select||select.closest('.ev-month'))return;
    const wrap=document.createElement('div');
    wrap.className='ev-month';
    const step=direction=>{
      const options=[...select.options].map(option=>option.value).sort();
      const index=options.indexOf(select.value)+direction;
      if(index<0||index>=options.length)return;
      select.value=options[index];
      if(typeof window.renderEvaluations==='function')window.renderEvaluations();
    };
    const prev=document.createElement('button');prev.type='button';prev.setAttribute('aria-label','Mes anterior');prev.textContent='‹';prev.onclick=()=>step(-1);
    const next=document.createElement('button');next.type='button';next.setAttribute('aria-label','Mes siguiente');next.textContent='›';next.onclick=()=>step(1);
    select.parentNode.insertBefore(wrap,select);
    wrap.append(prev,select,next);
  }

  function ensureToolbar(){
    const bar=document.querySelector('#evaluations .eval-toolbar');
    if(!bar||bar.querySelector('.ev-seg'))return;
    const seg=document.createElement('div');
    seg.className='ev-seg';
    seg.setAttribute('role','tablist');
    seg.setAttribute('aria-label','Área');
    seg.innerHTML=[['','Todas'],['ISLA','Isla'],['TIENDA','Tienda']].map(([key,label])=>`<button type="button" role="tab" data-area="${key}" class="${key===areaFilter?'on':''}" onclick="evalSetArea('${key}')">${label}</button>`).join('');
    bar.appendChild(seg);
  }

  // Color estable por persona para la inicial (marca: azul, verde y naranja).
  const TONES=['blue','green','orange'];
  const avatarTone=name=>TONES[[...String(name||'')].reduce((sum,ch)=>sum+ch.charCodeAt(0),0)%TONES.length];

  function rowHtml(entry,period){
    const w=entry.worker,record=entry.record;
    const name=w?w.name:'Trabajador eliminado';
    const role=w?(w.role||w.area||'Equipo'):'Sin ficha activa';
    const area=AREAS[areaOf(w)]||'';
    const labels={draft:['Borrador','yellow'],submitted:['En revisión','blue'],approved:['Aprobada','green'],pending:['Sin evaluar','orange']};
    const [label,tone]=labels[entry.status]||labels.pending;
    const score=scoreOf(record);
    const bar=score!==null&&entry.status!=='draft'?`<div class="ev-score">${fmt(score)}<i><b style="width:${Math.round(score*20)}%"></b></i></div>`:'<span></span>';
    let go;
    if(record){
      const text=entry.status==='draft'?'Continuar':'Ver';
      go=`<button type="button" class="ev-go ${entry.status==='draft'?'pri':''}" onclick="openEvaluation('${esc(record.id)}')">${text}</button>`;
    }else{
      go=`<button type="button" class="ev-go pri" onclick="newEvaluationFor('${esc(w?.id)}')">Evaluar</button>`;
    }
    const del=record?`<button type="button" class="ev-del role-admin-only" onclick="deleteEvaluationFromList('${esc(record.id)}',event)" aria-label="Eliminar evaluación">✕</button>`:'';
    return `<div class="ev-row ${entry.status==='approved'?'done':''}"><span class="ev-av" style="--c:var(--${avatarTone(name)})">${esc(initials(name))}</span><div><strong>${esc(name)}</strong><small>${esc(role)}</small></div><span class="ev-tag">${esc(area||'—')}</span><span class="ev-chip" style="--c:var(--${tone})">${label}</span>${bar}<span class="ev-actions">${go}${del}</span></div>`;
  }

  function renderList(period,entries){
    const root=$('evaluationList');
    if(!root)return;
    const query=searchQuery();
    const status=statusFilter();
    const visible=entries.filter(entry=>{
      const w=entry.worker;
      if(!w)return status==='all';
      if(!inArea(w))return false;
      if(query&&!String(w.name||'').toLowerCase().includes(query))return false;
      if(status!=='all'&&entry.status!==status)return false;
      return true;
    });
    root.classList.remove('list-view');
    root.classList.add('ev-list');
    if(!visible.length){
      root.innerHTML='<div class="ops-empty">No hay resultados para este filtro.</div>';
      return;
    }
    const groups=[['draft','Borradores por revisar'],['submitted','En revisión'],['pending','Sin evaluar'],['approved','Completadas']];
    const byName=(a,b)=>String(a.worker?.name||'').localeCompare(String(b.worker?.name||''),'es');
    root.innerHTML=groups.map(([key,title])=>{
      const rows=visible.filter(entry=>entry.status===key).sort(byName);
      return rows.length?`<div class="ev-gh">${title} · ${rows.length}</div>${rows.map(entry=>rowHtml(entry,period)).join('')}`:'';
    }).join('');
  }

  function render(){
    const select=$('evaluationMonth');
    if(!select||!window.EvaluationModule)return;
    const period=select.value;
    const entries=buildEntries(period);
    ensureToolbar();
    ensureMonthNav();
    renderHero(period,entries);
    renderTabs(entries);
    renderList(period,entries);
    const sub=document.querySelector('#evaluations .ev-sub');
    if(sub)sub.textContent=`Cada persona mantiene su propia ficha. ${monthLabel(period)?`Evaluaciones de ${monthLabel(period)}.`:''}`;
    document.querySelectorAll('#evaluations .ev-seg button').forEach(btn=>btn.classList.toggle('on',btn.dataset.area===areaFilter));
    const next=$('evNextBtn');
    if(next)next.disabled=!entries.some(e=>(e.status==='draft'||e.status==='pending')&&(!e.worker||inArea(e.worker)));
  }

  window.evalSetStatus=status=>{
    const select=$('evalStatusFilter');
    if(select)select.value=status;
    if(typeof window.onEvalFilterChange==='function')window.onEvalFilterChange();
    else render();
  };
  window.evalSetArea=area=>{areaFilter=area||'';render()};
  window.evaluateNext=()=>{
    const period=$('evaluationMonth')?.value;
    const entries=buildEntries(period).filter(e=>!e.worker||inArea(e.worker));
    const draft=entries.find(e=>e.status==='draft'&&e.record);
    if(draft)return window.openEvaluation(draft.record.id);
    const pending=entries.find(e=>e.status==='pending'&&e.worker);
    if(pending)return window.newEvaluationFor(pending.worker.id);
    if(typeof window.showToast==='function')window.showToast('No quedan evaluaciones por hacer este mes');
  };

  function install(){
    if(typeof window.renderEvaluations!=='function'||original)return;
    original=window.renderEvaluations;
    window.renderEvaluations=function(){
      const result=original.apply(this,arguments);
      try{render()}catch(error){console.error('Evaluaciones',error)}
      return result;
    };
    try{render()}catch(error){}
  }
  install();
})();
