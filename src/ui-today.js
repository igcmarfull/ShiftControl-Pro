(function(){
  'use strict';
  // Operación del día (escritorio): resumen del día, cobertura por turno y bloques inferiores.
  // No cambia reglas de asistencia: lee lo que ya calculan renderToday() y los módulos existentes.
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PRESENT=['Presente','Atrasado'];
  const LEAVE=['Licencia','Vacaciones','Permiso'];
  const CIRC=339.29;
  const RING=138.2;
  const last={};

  const data=()=>window.ShiftControlState?.get?.()||window.state||{};
  const emp=id=>typeof window.employee==='function'?window.employee(id):null;
  const isoOf=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const todayIso=()=>isoOf(new Date());
  const addDays=(iso,days)=>{const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+days);return isoOf(d)};
  const initials=name=>String(name||'?').trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  const plural=(n,one,many)=>`${n} ${n===1?one:many}`;
  function put(key,el,html){if(el&&last[key]!==html){last[key]=html;el.innerHTML=html}}
  function plannedRows(date){return typeof window.todayPlannedRows==='function'?window.todayPlannedRows(date):[]}
  function execsOf(date){return (data().executions||[]).filter(e=>e.date===date)}
  function hasExec(execs,row){return execs.some(e=>e.employeeId===row.employee.id)}
  function isPresent(execs,row){return execs.some(e=>e.employeeId===row.employee.id&&PRESENT.includes(e.status))}

  function ring(pct,tone){
    const value=Math.max(0,Math.min(1,pct));
    return `<div class="r"><svg viewBox="0 0 54 54" aria-hidden="true"><circle class="bg" cx="27" cy="27" r="22"/><circle cx="27" cy="27" r="22" stroke="var(--${tone})" stroke-dasharray="${RING}" stroke-dashoffset="${(RING*(1-value)).toFixed(1)}"/></svg><div class="c">${value>=1?'✓':Math.round(value*100)+'%'}</div></div>`;
  }

  function renderTop(date,rows,execs){
    const root=$('odTop');
    if(!root)return;
    if(!rows.length){
      put('top',root,`<div class="od-empty-day"><strong>No hay trabajadores planificados</strong><small>Planifica turnos o carga la planificación base para comenzar la operación del día.</small></div>`);
      return;
    }
    const pendingRows=rows.filter(row=>!hasExec(execs,row));
    const reviewed=rows.length-pendingRows.length;
    const pct=Math.round(reviewed/rows.length*100);
    const count=status=>execs.filter(e=>e.status===status).length;
    const leaves=execs.filter(e=>LEAVE.includes(e.status)).length;
    const stats=[['Planificados',rows.length,''],['Presentes',count('Presente'),''],['Atrasos',count('Atrasado'),''],['Ausentes',count('Ausente'),''],['Licencias',leaves,''],['Sin confirmar',pendingRows.length,pendingRows.length?'warn':'']];

    const items=[...document.querySelectorAll('#todayProblems .problem-item')].map(item=>({text:(item.textContent||'').trim(),ok:/var\(--green\)/.test(item.querySelector('i')?.getAttribute('style')||'')}));
    const problems=items.filter(item=>!item.ok);
    const names=pendingRows.slice(0,3).map(row=>`${esc(row.employee.name)} (Turno ${esc(row.plan?.code||'—')})`).join(' · ');
    const alert=problems.length
      ?`<div class="od-alert"><span class="ic">!</span><div class="tx">${problems.map(item=>esc(item.text.replace(/\.$/,''))).join(' · ')}${names?`<span>${names}${pendingRows.length>3?` y ${pendingRows.length-3} más`:''}</span>`:''}</div><button type="button" class="od-b" onclick="document.getElementById('todayDesktopShiftView').scrollIntoView({behavior:'smooth',block:'start'})">Revisar</button></div>`
      :`<div class="od-alert ok"><span class="ic">✓</span><div class="tx">La operación está revisada y no presenta conflictos críticos.</div></div>`;

    const covers=['A','B','C'].map(code=>{
      const group=rows.filter(row=>row.plan?.code===code);
      const done=group.filter(row=>isPresent(execs,row)).length;
      if(!group.length)return `<div class="od-cc off">${ring(0,'panel3')}<div><strong>Turno ${code}</strong><small>Sin trabajadores</small></div></div>`;
      const fraction=done/group.length;
      const tone=fraction>=1?'green':fraction>0?'yellow':'red';
      return `<div class="od-cc">${ring(fraction,tone)}<div><strong>Turno ${code}</strong><small>${done}/${group.length} cubierto${group.length===1?'':'s'}</small></div></div>`;
    }).join('');

    put('top',root,`
      <section class="od-hero">
        <div class="od-ring"><div class="wc-donut"><svg viewBox="0 0 128 128" aria-hidden="true"><circle class="bg" cx="64" cy="64" r="54"/><circle class="fg" cx="64" cy="64" r="54" stroke-dasharray="${CIRC}" stroke-dashoffset="${(CIRC*(1-pct/100)).toFixed(1)}"/></svg><div class="c"><b>${pct}%</b><small>confirmado</small></div></div>
          <div><h4>${reviewed} de ${rows.length} confirmados</h4><p>${pendingRows.length?plural(pendingRows.length,'trabajador sin confirmar','trabajadores sin confirmar'):'Todos revisados'}</p></div></div>
        <div><div class="od-stats">${stats.map(([label,value,tone])=>`<div class="od-st ${tone}"><span>${label}</span><b>${value}</b></div>`).join('')}</div></div>
      </section>
      ${alert}
      <div class="od-cov">${covers}</div>`);
  }

  function shiftStart(code){
    const settings=data().settings||{};
    const defaults={A:'07:00–15:00',B:'15:00–23:00',C:'23:00–07:00'};
    const match=String(settings[code]||defaults[code]).match(/(\d{1,2}):(\d{2})/)||defaults[code].match(/(\d{1,2}):(\d{2})/);
    return `${String(match[1]).padStart(2,'0')}:${match[2]}`;
  }

  function renderLow(date,rows,execs){
    const root=$('odLow');
    if(!root)return;
    // Asistencia de los últimos 7 días (hasta la fecha elegida)
    const weekdays=['Do','Lu','Ma','Mi','Ju','Vi','Sa'];
    const days=Array.from({length:7},(_,index)=>addDays(date,index-6));
    const stats=days.map(day=>{
      const dayRows=plannedRows(day);
      const dayExecs=execsOf(day);
      const present=dayRows.filter(row=>isPresent(dayExecs,row)).length;
      return {day,total:dayRows.length,present,pct:dayRows.length?Math.round(present/dayRows.length*100):null};
    });
    const valid=stats.filter(item=>item.pct!==null);
    const totalPlanned=valid.reduce((sum,item)=>sum+item.total,0);
    const average=totalPlanned?Math.round(valid.reduce((sum,item)=>sum+item.present,0)/totalPlanned*100):null;
    const bars=stats.map((item,index)=>{
      const d=new Date(item.day+'T12:00:00');
      const label=index===6?(item.day===todayIso()?'Hoy':`${weekdays[d.getDay()]} ${d.getDate()}`):`${weekdays[d.getDay()]} ${d.getDate()}`;
      const pct=item.pct??0;
      const tip=item.pct===null?`${label}: sin turnos planificados`:`${label}: ${item.present}/${item.total} presentes`;
      return `<div class="ic-bar ${index===6?'now':''}" title="${esc(tip)}"><b style="--top:${Math.round(88*(1-pct/100))}px">${item.pct===null?'—':item.pct+'%'}</b><i style="height:${item.pct===null?4:Math.max(4,Math.round(88*pct/100))}px"></i><span>${esc(label)}</span></div>`;
    }).join('');

    // Excepciones y reemplazos del día
    const lines=[];
    execs.filter(e=>!PRESENT.includes(e.status)).forEach(e=>{
      const worker=emp(e.employeeId);
      const code=typeof window.plannedShiftFor==='function'?window.plannedShiftFor(e.employeeId,date):'';
      const leave=LEAVE.includes(e.status);
      const replacement=e.replacementId?emp(e.replacementId)?.name:'';
      lines.push(`<div class="od-exr" style="--c:var(--${leave?'blue':'red'})"><span class="ic">${esc(initials(worker?.name).slice(0,1)||'!')}</span><div><strong>${esc(worker?.name||'Trabajador')}</strong><small>${esc(e.status)}${code?` · Turno ${esc(code)}`:''}</small></div>${replacement?`<span class="od-arrow">→ ${esc(replacement)}</span>`:`<span class="od-chip" style="--c:var(--red)">Sin reemplazo</span>`}</div>`);
    });
    rows.filter(row=>!hasExec(execs,row)).forEach(row=>lines.push(`<div class="od-exr" style="--c:var(--yellow)"><span class="ic">!</span><div><strong>${esc(row.employee.name)}</strong><small>Sin confirmar · Turno ${esc(row.plan?.code||'—')}</small></div><span class="od-chip" style="--c:var(--yellow)">Pendiente</span></div>`));
    const shown=lines.slice(0,5);
    const exceptions=shown.length?`<div class="od-ex">${shown.join('')}</div>${lines.length>shown.length?`<p class="od-more">y ${plural(lines.length-shown.length,'caso más','casos más')}</p>`:''}`:'<div class="od-quiet"><span>✓</span>Sin excepciones ni pendientes.</div>';

    // Relevo del siguiente turno (solo para hoy)
    let relay='<div class="od-quiet">El relevo se muestra solo para el día de hoy.</div>';
    let relayTitle='Siguiente turno';
    if(date===todayIso()){
      const hour=new Date().getHours();
      const currentCode=hour>=7&&hour<15?'A':hour>=15&&hour<23?'B':'C';
      const nextCode={A:'B',B:'C',C:'A'}[currentCode];
      const nextDate=hour>=23&&nextCode==='A'?addDays(date,1):date;
      const nextRows=plannedRows(nextDate).filter(row=>row.plan?.code===nextCode);
      const nextExecs=execsOf(nextDate);
      relay=`<div class="od-next"><div class="when">Turno ${nextCode}<small>${plural(nextRows.length,'trabajador planificado','trabajadores planificados')}</small></div>${nextRows.slice(0,5).map(row=>{const ok=isPresent(nextExecs,row);return `<div class="p"><span class="od-av">${esc(initials(row.employee.name))}</span><div><strong>${esc(row.employee.name)}</strong></div><span class="od-chip" style="--c:var(--${ok?'green':'blue'})">${ok?'Confirmado':'Planificado'}</span></div>`}).join('')}${nextRows.length>5?`<p class="od-more">y ${nextRows.length-5} más</p>`:''}</div>`;
      relayTitle=`Entra a las ${shiftStart(nextCode)}`;
    }

    put('low',root,`
      <section class="ic-cp"><div class="ic-ch"><div><h4>Asistencia de los últimos 7 días</h4><div class="sub">Presentes sobre planificados</div></div><div class="tot"><b>${average===null?'—':average+'%'}</b>promedio</div></div><div class="ic-bars" style="grid-template-columns:repeat(7,minmax(0,1fr))">${bars}</div></section>
      <section class="ic-cp"><div class="ic-ch"><div><h4>Excepciones y reemplazos</h4><div class="sub">${esc(typeof window.fmt==='function'?window.fmt(date):date)}</div></div></div>${exceptions}</section>
      <section class="ic-cp"><div class="ic-ch"><div><h4>Relevo del siguiente turno</h4><div class="sub">${esc(relayTitle)}</div></div></div>${relay}</section>`);
  }

  function renderExtras(){
    if(!$('today'))return;
    const date=$('todayDate')?.value||todayIso();
    const rows=plannedRows(date);
    const execs=execsOf(date);
    renderTop(date,rows,execs);
    renderLow(date,rows,execs);
  }

  function init(){
    if(typeof window.renderToday!=='function'||window.renderToday.__uiToday)return;
    const original=window.renderToday;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      try{renderExtras()}catch(error){console.error('Operación del día:',error)}
      return result;
    };
    wrapped.__uiToday=true;
    window.renderToday=wrapped;
    try{renderExtras()}catch(_){}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.ShiftControlToday={render:renderExtras};
})();
