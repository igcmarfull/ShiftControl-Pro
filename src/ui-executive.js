(function(){
  'use strict';
  // Centro ejecutivo: franja principal, bloques de detalle y compromisos.
  // Envuelve window.renderDashboard(): la función original sigue calculando prioridades, alertas y
  // pagos en los contenedores de index.html (ahora ocultos); aquí solo se leen y se presentan.
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const CIRC=339.29;
  const PRESENT=['Presente','Atrasado'];
  const SHIFTS=[['A','blue'],['B','orange'],['C','purple']];
  const AREAS={ISLA:'Isla',TIENDA:'Tienda'};
  let last='';
  let foldOpen=false;
  let original=null;

  const data=()=>window.ShiftControlState?.get?.()||window.state||{};
  const money=value=>typeof window.money==='function'?window.money(value):`$${Number(value||0).toLocaleString('es-CL')}`;
  const isoOf=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const addDays=(iso,days)=>{const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+days);return isoOf(d)};
  const dm=iso=>String(iso||'').slice(8,10)+'-'+String(iso||'').slice(5,7);
  const initials=name=>String(name||'?').trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  const plural=(n,one,many)=>`${n} ${n===1?one:many}`;
  const nameOf=id=>(typeof window.employee==='function'?window.employee(id)?.name:null)||'Trabajador';
  const areaOf=id=>{const worker=typeof window.employee==='function'?window.employee(id):null;return AREAS[window.ShiftControlAreas?.employeeArea?.(worker)||'ISLA']||''};
  const todayIso=()=>typeof isoToday==='string'?isoToday:isoOf(new Date());
  const go=view=>`showView('${view}')`;
  document.addEventListener('toggle',event=>{if(event.target?.classList?.contains('ex-fold'))foldOpen=event.target.open},true);

  function ring(pct,tone,size,stroke,label){
    const value=Math.max(0,Math.min(1,pct));
    const style=stroke?`style="stroke-width:${stroke}"`:'';
    return `<div class="wc-donut" style="width:${size}px;height:${size}px"><svg viewBox="0 0 128 128" style="width:${size}px;height:${size}px"><circle class="bg" cx="64" cy="64" r="54" ${style}/><circle class="fg" cx="64" cy="64" r="54" style="${stroke?`stroke-width:${stroke};`:''}stroke:var(--${tone})" stroke-dasharray="${CIRC}" stroke-dashoffset="${(CIRC*(1-value)).toFixed(1)}"/></svg>${label?`<div class="c"><b style="font-size:${Math.round(size/4.2)}px">${label}</b></div>`:''}</div>`;
  }
  function when(iso){
    const d=new Date(iso);
    if(Number.isNaN(d.getTime()))return '';
    const time=d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
    return isoOf(d)===todayIso()?`Hoy, ${time}`:`${dm(isoOf(d))}, ${time}`;
  }

  // ---- datos ----
  function dayStats(state,date){
    const planned=(state.plans||[]).filter(p=>p.date===date&&['A','B','C'].includes(p.code));
    const execs=(state.executions||[]).filter(e=>e.date===date);
    const present=execs.filter(e=>PRESENT.includes(e.status));
    return {planned,execs,present};
  }
  function tasksFromOriginal(){
    return Array.from(document.querySelectorAll('#decisionCenter .task-item')).map(node=>({
      level:(node.className.match(/\b(critical|high|medium|low)\b/)||[])[1]||'low',
      title:node.querySelector('.task-copy strong')?.textContent||'',
      detail:node.querySelector('.task-copy span')?.textContent||'',
      action:node.querySelector('button')?.getAttribute('onclick')||'',
      label:node.querySelector('button')?.textContent||'Ver'
    }));
  }
  const LEVEL_TONE={critical:'red',high:'red',medium:'yellow',low:'blue'};

  function hero(state,date){
    const {planned,execs,present}=dayStats(state,date);
    const exceptions=execs.filter(e=>!PRESENT.includes(e.status)).length;
    const replacements=execs.filter(e=>e.replacementId||e.replacedEmployeeId||e.generatedFromExecutionId).length;
    const activeAbs=(state.absences||[]).filter(a=>date>=a.from&&date<=a.to).length;
    const extras=(state.additional||[]).filter(a=>a.date===date).length;
    const tasks=tasksFromOriginal();
    const pct=planned.length?present.length/planned.length:1;
    const closed=window.DailyClosureModule?.isClosed?.(date);
    return {tasks,html:`<section class="ex-hero"><div class="ex-ring">${ring(pct,pct>=1?'green':'blue',100,0,`${Math.round(pct*100)}%`)}<div><h4>Cobertura ${Math.round(pct*100)}%</h4><p>${closed?'Jornada cerrada':'Jornada abierta'} · ${present.length} de ${planned.length} confirmados</p></div></div><div><div class="ex-stats">
      <div class="ex-st"><span>Personal</span><b>${present.length}/${planned.length}</b><small>presentes</small></div>
      <div class="ex-st"><span>Ausencias</span><b>${activeAbs}</b><small>activas hoy</small></div>
      <div class="ex-st"><span>Reemplazos</span><b>${replacements}</b><small>vinculados</small></div>
      <div class="ex-st"><span>Turnos extra</span><b>${extras}</b><small>del día</small></div>
      <div class="ex-st"><span>Excepciones</span><b>${exceptions}</b><small>registradas</small></div>
      <div class="ex-st ${tasks.length?'warn':''}"><span>Por revisar</span><b>${tasks.length}</b><small>${tasks.length===1?'asunto':'asuntos'}</small></div></div></div></section>`};
  }

  function review(tasks){
    const items=tasks.slice(0,4).map(t=>`<div class="ex-rev"><i class="ex-dot" style="--c:var(--${LEVEL_TONE[t.level]})"></i><div><strong>${esc(t.title)}</strong><small>${esc(t.detail)}</small></div><button type="button" class="ex-go" onclick="${esc(t.action)}">${esc(t.label)}</button></div>`).join('');
    return `<section class="abx-panel"><div class="ex-h"><h4>Lo que conviene revisar</h4><small>${tasks.length?plural(tasks.length,'asunto','asuntos'):''}</small></div>${items||'<div class="ex-ok">✓ Todo al día. No hay acciones pendientes.</div>'}${tasks.length>4?`<div class="ex-more">+${tasks.length-4} más en Bandeja ADMIN</div>`:''}</section>`;
  }

  function shifts(state,date){
    const {planned,present}=dayStats(state,date);
    const cards=SHIFTS.map(([code,tone])=>{
      const group=planned.filter(p=>p.code===code);
      const done=group.filter(p=>present.some(e=>e.employeeId===p.employeeId)).length;
      return `<div class="ex-sh">${ring(group.length?done/group.length:0,tone,46,16)}<div><b>Turno ${code}</b><small>${done}/${group.length}</small></div></div>`;
    }).join('');
    return `<section class="abx-panel"><div class="ex-h"><h4>Cobertura por turno</h4><small>Presentes / planificados</small></div><div class="ex-shifts">${cards}</div></section>`;
  }

  function attendance(state,date){
    const days=Array.from({length:7},(_,i)=>addDays(date,i-6));
    const rows=days.map(day=>{
      const {planned,present}=dayStats(state,day);
      return {day,planned:planned.length,pct:planned.length?Math.min(1,present.length/planned.length):null};
    });
    const valid=rows.filter(r=>r.pct!==null);
    const avg=valid.length?Math.round(valid.reduce((s,r)=>s+r.pct,0)/valid.length*100):null;
    const wd=['Do','Lu','Ma','Mi','Ju','Vi','Sa'];
    const bars=rows.map(r=>`<div class="ex-b" title="${dm(r.day)}: ${r.pct===null?'sin turnos':Math.round(r.pct*100)+'%'}"><i style="height:${r.pct===null?3:Math.max(4,Math.round(r.pct*100))}%" class="${r.pct===null?'off':''}"></i><span>${wd[new Date(r.day+'T12:00:00').getDay()]}</span></div>`).join('');
    return `<section class="abx-panel"><div class="ex-h"><h4>Asistencia · 7 días</h4><small>${avg===null?'Sin datos':`Promedio ${avg}%`}</small></div><div class="ex-chart">${bars}</div></section>`;
  }

  function absences(state,date){
    const list=(state.absences||[]).filter(a=>date>=a.from&&date<=a.to).sort((a,b)=>String(a.to).localeCompare(String(b.to)));
    const rows=list.slice(0,4).map(a=>`<div class="ex-rev"><span class="ex-av">${esc(initials(nameOf(a.employeeId)))}</span><div><strong>${esc(nameOf(a.employeeId))}</strong><small>${esc(a.type||'Ausencia')} · hasta ${dm(a.to)}</small></div><span class="ex-tag">${esc(areaOf(a.employeeId))}</span></div>`).join('');
    return `<section class="abx-panel"><div class="ex-h"><h4>Ausencias activas</h4><small>${list.length} hoy</small></div>${rows||'<div class="ex-ok">No hay ausencias activas.</div>'}${list.length>4?`<div class="ex-more">+${list.length-4} más</div>`:''}<button type="button" class="ex-link" onclick="${go('absences')}">Ver ausencias y cobertura →</button></section>`;
  }

  function upcoming(state,date){
    const names=['Hoy','Mañana'];
    const rows=[0,1,2].map(i=>{
      const day=addDays(date,i);
      const {planned,present}=dayStats(state,day);
      const label=names[i]||new Date(day+'T12:00:00').toLocaleDateString('es-CL',{weekday:'long'});
      const cells=SHIFTS.map(([code])=>{
        const group=planned.filter(p=>p.code===code);
        const text=i===0?`${group.filter(p=>present.some(e=>e.employeeId===p.employeeId)).length}/${group.length}`:String(group.length);
        return `<span class="${planned.length&&!group.length?'bad':''}">${code} ${text}</span>`;
      }).join('');
      return `<div class="ex-next"><b>${esc(label)}</b>${cells}</div>`;
    }).join('');
    return `<section class="abx-panel"><div class="ex-h"><h4>Próximos 3 días</h4><small>Personal planificado</small></div>${rows}</section>`;
  }

  function finance(date){
    const recs=(window.FinanceReconciliationModule?.getAll?.()||[]).filter(r=>r.date===date);
    const shortages=(window.ShortageModule?.getAll?.()||[]).filter(r=>r.date===date).reduce((s,r)=>s+Math.abs(Number(r.amount||0)),0);
    const diff=recs.reduce((s,r)=>s+Number(r.difference||0),0);
    const body=recs.length||shortages
      ?`<big>${money(diff)}</big><small>Diferencia de cuadratura${shortages?` · faltantes ${money(shortages)}`:' · sin faltantes de caja'}</small>`
      :'<big class="dim">Sin registro</big><small>Aún no se registra la cuadratura de hoy</small>';
    return `<section class="abx-panel ex-mini"><div class="ex-h"><h4>Finanzas de hoy</h4><button type="button" class="ex-go" onclick="${go('finance')}">Abrir</button></div>${body}</section>`;
  }

  function incidents(){
    const list=(window.IncidentModule?.getAll?.()||[]).filter(i=>!i.archived&&i.status!=='resolved');
    let body='<big>0</big><small>Sin incidencias abiertas</small>';
    if(list.length){
      const types={};
      list.forEach(i=>{const t=i.type||'Otro';types[t]=(types[t]||0)+1});
      const top=Object.entries(types).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([t,n])=>`${n} de ${t}`).join(' · ');
      const oldest=list.map(i=>new Date(i.createdAt||'').getTime()).filter(Number.isFinite).sort((a,b)=>a-b)[0];
      const days=oldest?Math.max(0,Math.floor((Date.now()-oldest)/86400000)):null;
      body=`<big>${list.length}</big><small>${esc(top)}${days===null?'':` · la más antigua, ${plural(days,'día','días')}`}</small>`;
    }
    return `<section class="abx-panel ex-mini"><div class="ex-h"><h4>Incidencias abiertas</h4><button type="button" class="ex-go" onclick="${go('incidents')}">Abrir</button></div>${body}</section>`;
  }

  function evaluations(state,date){
    const period=date.slice(0,7);
    const active=(typeof window.employeesForEval==='function'?window.employeesForEval():(state.employees||[]).filter(e=>e.active!==false));
    const ids=new Set(active.map(e=>e.id));
    const list=(window.EvaluationModule?.getAll?.()||[]).filter(e=>e.period===period&&ids.has(e.employeeId));
    const done=list.filter(e=>e.status!=='draft');
    const scores=done.map(e=>{const v=Object.values(e.scores||{}).map(Number).filter(Number.isFinite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null}).filter(v=>v!==null);
    const avg=scores.length?(scores.reduce((a,b)=>a+b,0)/scores.length).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1}):null;
    const missing=Math.max(0,active.length-new Set(list.map(e=>e.employeeId)).size);
    return `<section class="abx-panel ex-mini"><div class="ex-h"><h4>Evaluaciones del mes</h4><button type="button" class="ex-go" onclick="${go('evaluations')}">Abrir</button></div><big>${done.length} de ${active.length}</big><small>${avg?`Promedio ${avg} / 5 · `:''}${missing} sin evaluar</small></section>`;
  }

  function commitments(state){
    const unpaid=(state.additional||[]).filter(a=>a.paid!=='Pagado');
    const total=unpaid.reduce((s,a)=>s+Number(a.amount||0),0);
    const approved=unpaid.filter(a=>a.paid==='Aprobado para pago').reduce((s,a)=>s+Number(a.amount||0),0);
    const repl=unpaid.filter(a=>a.source==='replacement'||a.generatedFromExecutionId);
    const replAmount=repl.reduce((s,a)=>s+Number(a.amount||0),0);
    return `<section class="abx-panel"><div class="ex-h"><h4>Compromisos pendientes</h4><button type="button" class="ex-go" onclick="${go('additional')}">Ver pagos</button></div><div class="ex-money"><div><small>Total pendiente de pago</small><big>${money(total)}</big></div><small>${plural(unpaid.length,'turno extra por pagar','turnos extra por pagar')}</small></div><div class="ex-bar"><i style="width:${total?Math.round(approved/total*100):0}%"></i></div><div class="ex-meta"><span><b>${money(approved)}</b> aprobado, listo para pagar</span><span><b>${money(total-approved)}</b> por aprobar</span>${repl.length?`<span><b>${repl.length}</b> de ellos ${repl.length===1?'es reemplazo':'son reemplazos'} (${money(replAmount)})</span>`:''}</div></section>`;
  }

  function alertsPanel(){
    const items=Array.from(document.querySelectorAll('#alerts .alert-item')).map(n=>n.textContent.trim());
    const body=items.length?items.slice(0,5).map(text=>`<div class="ex-rev ex-alert"><i class="ex-dot" style="--c:var(--yellow)"></i><div><strong>${esc(text)}</strong></div></div>`).join(''):'<div class="ex-ok">Sin alertas pendientes.</div>';
    return `<section class="abx-panel"><div class="ex-h"><h4>Alertas</h4><button type="button" class="ex-go" onclick="${typeof window.openAlerts==='function'?'openAlerts()':go('absences')}">Abrir</button></div>${body}${items.length>5?`<div class="ex-more">+${items.length-5} más</div>`:''}</section>`;
  }

  function movements(state){
    const events=[];
    let closeGroup=null;
    (state.audit||[]).slice(0,40).forEach(a=>{
      if(String(a.action||'').startsWith('Jornada cerrada para ')){
        const day=String(a.date||'').slice(0,10);
        const iso=(String(a.action).match(/\d{4}-\d{2}-\d{2}/)||[''])[0];
        if(closeGroup&&closeGroup.day===day){closeGroup.dates.push(iso);return}
        closeGroup={day,at:a.date,action:a.action,dates:[iso]};
        events.push(closeGroup);
        return;
      }
      events.push({at:a.date,action:a.action});
    });
    const rows=events.slice(0,5).map(e=>{
      let text=e.action;
      if(e.dates&&e.dates.length>1){const sorted=e.dates.filter(Boolean).sort();text=`${e.dates.length} jornadas cerradas (${dm(sorted[0])} al ${dm(sorted[sorted.length-1])})`}
      return `<div class="ex-ev"><i class="ex-dot"></i><div>${esc(text)}<small>${esc(when(e.at))}</small></div></div>`;
    }).join('');
    return `<section class="abx-panel"><div class="ex-h"><h4>Últimos movimientos</h4><button type="button" class="ex-go" onclick="${go('audit')}">Historial</button></div>${rows||'<div class="ex-ok">Sin actividad registrada.</div>'}</section>`;
  }

  function render(){
    const dash=$('dashboard');
    if(!dash||!data().plans)return;
    let root=$('exRoot');
    if(!root){
      root=document.createElement('div');
      root.id='exRoot';
      root.className='ex-root';
      const anchor=dash.querySelector('.dashboard-hero');
      if(anchor)anchor.insertAdjacentElement('afterend',root);else dash.prepend(root);
    }
    const state=data();
    const date=$('todayDate')?.value||todayIso();
    const h=hero(state,date);
    const mobile=window.matchMedia?.('(max-width:820px)').matches;
    const open=mobile?foldOpen:true;
    const html=h.html
      +`<div class="ex-cols">${review(h.tasks)}${shifts(state,date)}</div>`
      +`<details class="ex-fold" ${open?'open':''}><summary>Más detalle del día</summary><div class="ex-foldbody"><div class="ex-cols3">${attendance(state,date)}${absences(state,date)}${upcoming(state,date)}</div><div class="ex-cols3">${finance(date)}${incidents()}${evaluations(state,date)}</div></div></details>`
      +commitments(state)
      +`<div class="ex-cols">${alertsPanel()}${movements(state)}</div>`;
    if(html!==last||!root.firstChild){last=html;root.innerHTML=html}
    // Estado de la operación junto a los botones de la cabecera
    const health=$('v16Health');
    const actions=dash.querySelector('.executive-actions');
    if(actions){
      let chip=$('exHealth');
      if(!chip){chip=document.createElement('span');chip.id='exHealth';actions.prepend(chip)}
      const warn=health?.classList.contains('warn');
      chip.className=`ex-chip ${warn?'warn':''}`;
      chip.textContent=`● ${health?.textContent||'Operación estable'}`;
    }
  }

  function install(){
    if(typeof window.renderDashboard!=='function'||original)return;
    original=window.renderDashboard;
    window.renderDashboard=function(){
      const result=original.apply(this,arguments);
      try{render()}catch(error){console.warn('Centro ejecutivo',error)}
      return result;
    };
  }
  install();
})();
