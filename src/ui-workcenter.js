(function(){
  'use strict';
  // Centro de trabajo: anillo de avance, línea de tiempo del turno, asistencia y pagos pendientes.
  // No calcula reglas de negocio nuevas: lee lo que ya muestran los paneles del propio Centro de trabajo
  // (flujos, cierre guiado, integridad) y los módulos existentes (asistencia del día, jornadas adicionales).
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const CIRC=339.29;
  const last={};
  let observer=null;
  let queued=false;

  function setText(id,value){const el=$(id);if(el&&el.textContent!==String(value))el.textContent=String(value)}
  function setHtml(key,el,html){if(el&&last[key]!==html){last[key]=html;el.innerHTML=html}}

  function shiftRange(){
    const settings=(window.ShiftControlState?.get?.()||window.state||{}).settings||{};
    const hour=new Date().getHours();
    const code=hour>=7&&hour<15?'A':hour>=15&&hour<23?'B':'C';
    const names={A:'Mañana',B:'Tarde',C:'Noche'};
    const defaults={A:'07:00–15:00',B:'15:00–23:00',C:'23:00–07:00'};
    const raw=String(settings[code]||defaults[code]);
    const match=raw.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/)||defaults[code].match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
    const start=Number(match[1])*60+Number(match[2]);
    let end=Number(match[3])*60+Number(match[4]);
    if(end<=start)end+=1440;
    const now=new Date();
    let current=now.getHours()*60+now.getMinutes();
    if(current<start)current+=1440;
    const pad=n=>String(Math.floor(n/60)%24).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
    return {name:names[code],label:`${pad(start)} – ${pad(end)}`,fraction:Math.max(0,Math.min(1,(current-start)/(end-start))),now:pad(now.getHours()*60+now.getMinutes()),start:pad(start),end:pad(end)};
  }

  function closeProgress(){
    const match=($('v17CloseProgress')?.textContent||'').match(/(\d+)\s*\/\s*(\d+)/);
    return match?{done:Number(match[1]),total:Number(match[2])||7}:{done:0,total:7};
  }

  function flows(){
    return [...document.querySelectorAll('#v16Workflows .v16-workflow')].map(item=>({
      title:(item.querySelector('b')?.textContent||'').trim(),
      pct:Math.max(0,Math.min(100,parseInt(item.querySelector('.v16-workflow-progress i')?.style.width||'0',10)||0))
    }));
  }

  function renderHero(){
    const progress=closeProgress();
    const pct=progress.total?Math.round(progress.done/progress.total*100):0;
    const donut=$('wcDonutFg');
    if(donut)donut.setAttribute('stroke-dashoffset',String((CIRC*(1-pct/100)).toFixed(2)));
    setText('wcDonutPct',pct+'%');
    setText('wcHeroSub',`${progress.done} de ${progress.total} controles listos`);

    const range=shiftRange();
    setText('wcTlTitle',`Línea de tiempo · Turno ${range.name}`);
    setText('wcTlRange',range.label);
    const list=flows();
    const points=list.map((flow,index)=>{
      const left=list.length>1?index/(list.length-1)*100:0;
      const done=flow.pct>=100;
      const align=index===0?'start':index===list.length-1?'end':'mid';
      const detail=index===0?`${flow.pct}% · ${range.start}`:index===list.length-1?`${flow.pct}% · ${range.end}`:`${flow.pct}%`;
      return `<div class="pt ${done?'done':''} ${align}" style="left:${left}%"><i>${done?'✓':index+1}</i><b>${esc(flow.title)}</b><small>${esc(detail)}</small></div>`;
    }).join('');
    const nowLeft=Math.max(2,Math.min(98,range.fraction*100));
    setHtml('timeline',$('wcTimeline'),`<div class="rail"></div><div class="fill" style="width:${nowLeft.toFixed(1)}%"></div><div class="now" style="left:${nowLeft.toFixed(1)}%"><span>Ahora ${esc(range.now)}</span></div>${points}`);

    const count=($('v17IntegrityCount')?.textContent||'').trim();
    const ok=!count||/sin errores|revisando/i.test(count);
    const badge=$('wcIntegrity');
    if(badge){
      badge.textContent=ok?'Correcta':count;
      badge.classList.toggle('bad',!ok);
    }
    const mount=$('wcIntegrityMount');
    if(mount)mount.hidden=ok;
  }

  function renderAttendance(){
    const root=$('wcAttendance');
    if(!root||typeof window.v14DailySnapshot!=='function')return;
    let snapshot;
    try{snapshot=window.v14DailySnapshot()}catch(_){return}
    const rows=snapshot.rows||[];
    if(!rows.length){
      setHtml('attendance',root,`<div class="abx-ph"><h4>Asistencia del turno</h4><span>${esc(window.fmt?window.fmt(snapshot.date):snapshot.date)}</span></div><div class="abx-empty"><strong>Sin turnos planificados</strong><small>No hay trabajadores planificados para esta fecha.</small></div>`);
      return;
    }
    const executions=snapshot.executions||[];
    const isPresent=e=>['Presente','Atrasado'].includes(e.status);
    const late=executions.filter(e=>e.status==='Atrasado').length;
    const present=(snapshot.grouped?.present||[]).length-late;
    const exceptions=(snapshot.grouped?.problem||[]).length+(snapshot.grouped?.covered||[]).length;
    const pending=(snapshot.pending||[]).length;
    const total=rows.length;
    const seg=(n,color)=>n>0?`<i style="flex:${n};background:var(--${color})"></i>`:'';
    const shifts=['A','B','C'].map(code=>{
      const group=rows.filter(row=>row.plan?.code===code);
      const done=group.filter(row=>executions.some(e=>e.employeeId===row.employee.id&&isPresent(e))).length;
      return {code,total:group.length,done,pct:group.length?Math.round(done/group.length*100):0};
    }).filter(shift=>shift.total>0);
    const colors={A:'blue',B:'orange',C:'purple'};
    const initials=name=>String(name||'?').trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();
    const who=(snapshot.pending||[]).slice(0,3).map(row=>`<span class="wc-person"><span class="av">${esc(initials(row.employee?.name))}</span><span>${esc(row.employee?.name||'Trabajador')} · Turno ${esc(row.plan?.code||'—')}</span></span>`).join('');
    const rest=Math.max(0,total-present-late-exceptions-pending);
    setHtml('attendance',root,`
      <div class="abx-ph"><h4>Asistencia del turno</h4><span>${total} planificado${total===1?'':'s'}</span></div>
      <div class="wc-seg" role="img" aria-label="Asistencia: ${present} presentes, ${late} atrasados, ${exceptions} excepciones, ${pending} sin confirmar">${seg(present,'green')}${seg(late,'yellow')}${seg(exceptions,'red')}${seg(pending,'blue')}${seg(rest,'panel3')}</div>
      <div class="wc-leg"><span style="--c:var(--green)"><b>${present}</b>Presentes</span><span style="--c:var(--yellow)"><b>${late}</b>Atrasados</span><span style="--c:var(--red)"><b>${exceptions}</b>Excepciones</span><span style="--c:var(--blue)"><b>${pending}</b>Sin confirmar</span></div>
      <div class="wc-cov">${shifts.map(shift=>`<div><div class="h">Turno ${shift.code}<em>${shift.done}/${shift.total}</em></div><div class="wc-bar" style="--c:var(--${colors[shift.code]})"><i style="width:${shift.pct}%"></i></div></div>`).join('')}</div>
      ${who?`<div class="wc-who">Sin confirmar:${who}</div>`:''}`);
  }

  function renderPayments(){
    const root=$('wcPayments');
    if(!root)return;
    const isAdmin=typeof window.getAppRole==='function'&&window.getAppRole()==='admin';
    const items=isAdmin&&window.AdditionalModule?.getAll?window.AdditionalModule.getAll().filter(item=>item.paid!=='Pagado'):[];
    root.hidden=!isAdmin;
    if(!isAdmin)return;
    const money=window.money||(v=>'$'+Number(v||0).toLocaleString('es-CL'));
    if(!items.length){
      setHtml('payments',root,`<div class="abx-ph"><h4>Pagos pendientes de turnos</h4><span>${esc(money(0))}</span></div><div class="wc-leg"><span style="--c:var(--green)"><b>0</b>turnos extra por pagar</span></div>`);
      return;
    }
    const total=items.reduce((sum,item)=>sum+Number(item.amount||0),0);
    const recent=items.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,6).reverse();
    const max=Math.max(1,...recent.map(item=>Number(item.amount||0)));
    const bars=recent.map(item=>`<i title="${esc(money(item.amount))}" style="height:${Math.max(12,Math.round(Number(item.amount||0)/max*100))}%"></i>`).join('');
    setHtml('payments',root,`
      <div class="abx-ph"><h4>Pagos pendientes de turnos</h4><button type="button" class="abx-link" onclick="showView('additional')">Revisar pagos</button></div>
      <div class="wc-pay-total">${esc(money(total))}</div>
      <div class="wc-pay" role="img" aria-label="${items.length} turnos extra por pagar">${bars}</div>
      <div class="wc-leg"><span style="--c:var(--red)"><b>${items.length}</b>turno${items.length===1?'':'s'} extra por pagar</span></div>`);
  }

  function render(){
    queued=false;
    if(!$('workcenter'))return;
    renderHero();
    renderAttendance();
    renderPayments();
    observer?.takeRecords();
  }
  function schedule(){
    if(queued)return;
    queued=true;
    (window.requestAnimationFrame||setTimeout)(render);
  }

  function init(){
    const root=$('workcenter');
    if(!root)return;
    observer=new MutationObserver(schedule);
    observer.observe(root,{subtree:true,childList:true,characterData:true});
    document.querySelectorAll('.nav-btn').forEach(button=>button.addEventListener('click',()=>setTimeout(schedule,0)));
    setInterval(()=>{if(root.classList.contains('active'))render()},60000);
    schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.ShiftControlWorkCenter={render};
})();
