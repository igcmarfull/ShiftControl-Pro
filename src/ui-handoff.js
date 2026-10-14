(function(){
  'use strict';
  // Entrega de turno: presentación, resumen «Antes de entregar» y sugerencias de quién recibe.
  // El guardado sigue siendo saveHandoff() y el historial sigue saliendo de HandoffModule; aquí solo
  // se redibuja el historial como línea de tiempo y se añaden ayudas de lectura.
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const SHIFT_CODE={'Mañana':'A','Tarde':'B','Noche':'C'};
  const NEXT_CODE={A:'B',B:'C',C:'A'};
  const PRESENT=['Presente','Atrasado'];
  const plural=(n,one,many)=>`${n} ${n===1?one:many}`;
  let original=null;

  const isoOf=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const addDays=(iso,days)=>{const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+days);return isoOf(d)};
  const dateValue=()=>$('handoffDate')?.value||(typeof isoToday==='string'?isoToday:isoOf(new Date()));
  const fmtDate=iso=>String(iso||'').split('-').reverse().join('-');
  const rowsFor=date=>{
    if(typeof window.todayVisibleRows==='function')return window.todayVisibleRows(date);
    return typeof window.todayPlannedRows==='function'?window.todayPlannedRows(date):[];
  };

  // ---- Antes de entregar ----
  function snapshot(){
    const date=dateValue();
    const rows=rowsFor(date);
    const execs=((window.ShiftControlState?.get?.()||window.state||{}).executions||[]).filter(e=>e.date===date);
    const pending=rows.filter(row=>!execs.some(e=>e.employeeId===row.employee.id)).length;
    let checklist=null;
    if(typeof window.opsChecklistStore==='function'){
      const store=Object.entries(window.opsChecklistStore()||{}).filter(([key,item])=>item&&item.date===date&&(typeof window.opsChecklistInArea!=='function'||window.opsChecklistInArea(key,item)));
      checklist=store.some(([,item])=>item.completed);
    }
    const incidents=(window.IncidentModule?.getAll?.()||[]).filter(i=>!i.archived&&i.status!=='resolved').length;
    let reconciled=null;
    if(window.FinanceReconciliationModule?.getAll)reconciled=window.FinanceReconciliationModule.getAll().some(r=>r.date===date);
    return {date,pending,checklist,incidents,reconciled};
  }
  function summaryLines(s){
    const lines=[];
    if(s.checklist!==null)lines.push(`Checklist del día: ${s.checklist?'enviado':'pendiente'}`);
    lines.push(s.incidents?`${plural(s.incidents,'incidencia abierta','incidencias abiertas')}`:'Sin incidencias abiertas');
    lines.push(s.pending?`${plural(s.pending,'asistencia sin confirmar','asistencias sin confirmar')}`:'Asistencia confirmada');
    if(s.reconciled!==null)lines.push(`Cuadratura de caja: ${s.reconciled?'registrada':'sin registro'}`);
    return lines;
  }
  function renderPre(){
    const notes=$('handoffNotes');
    if(!notes)return;
    const group=notes.closest('.form-group');
    if(!group)return;
    let box=$('hoPre');
    if(!box){box=document.createElement('div');box.id='hoPre';box.className='ho-pre full';group.insertAdjacentElement('beforebegin',box)}
    const s=snapshot();
    const chip=(text,tone)=>`<span class="ho-st ${tone}">${esc(text)}</span>`;
    const chips=[];
    if(s.checklist!==null)chips.push(s.checklist?chip('✓ Checklist enviado','ok'):chip('Checklist pendiente','warn'));
    chips.push(s.incidents?chip(plural(s.incidents,'incidencia abierta','incidencias abiertas'),'warn'):chip('Sin incidencias abiertas','ok'));
    chips.push(s.pending?chip(plural(s.pending,'asistencia sin confirmar','asistencias sin confirmar'),'warn'):chip('✓ Asistencia confirmada','ok'));
    if(s.reconciled!==null)chips.push(s.reconciled?chip('✓ Cuadratura registrada','ok'):chip('Cuadratura sin registro',''));
    const html=`<div class="ho-pre-h"><b>Antes de entregar</b><button type="button" class="ho-link" onclick="handoffAddSummary()">Agregar a observaciones</button></div><div class="ho-chips">${chips.join('')}</div>`;
    if(box.dataset.v!==html){box.dataset.v=html;box.innerHTML=html}
  }
  window.handoffAddSummary=function(){
    const notes=$('handoffNotes');
    if(!notes)return;
    const text=summaryLines(snapshot()).map(line=>`• ${line}`).join('\n');
    if(notes.value.includes(text))return;
    notes.value=notes.value.trim()?`${notes.value.trim()}\n\n${text}`:text;
    notes.focus();
  };

  // ---- Quién recibe ----
  function renderSuggestions(){
    const to=$('handoffTo');
    const group=to?.closest('.form-group');
    if(!group)return;
    let box=$('hoSug');
    if(!box){box=document.createElement('div');box.id='hoSug';box.className='ho-sug';group.appendChild(box)}
    const code=SHIFT_CODE[$('handoffShift')?.value];
    if(!code){box.innerHTML='';return}
    const next=NEXT_CODE[code];
    const date=next==='A'?addDays(dateValue(),1):dateValue();
    const names=rowsFor(date).filter(row=>row.plan?.code===next).map(row=>row.employee.name).slice(0,5);
    const html=names.length?`<small>Turno ${next}:</small>${names.map(name=>`<button type="button" class="ho-pick" data-name="${esc(name)}">${esc(name)}</button>`).join('')}`:'';
    if(box.dataset.v!==html){box.dataset.v=html;box.innerHTML=html}
  }
  document.addEventListener('click',event=>{
    const pick=event.target.closest?.('.ho-pick');
    if(!pick)return;
    const to=$('handoffTo');
    if(to){to.value=pick.dataset.name||'';to.focus()}
  });

  // ---- Cabecera ----
  function renderControls(){
    const actions=document.querySelector('#handoff .topbar .actions');
    if(!actions)return;
    const area=actions.querySelector('.ops-area-select');
    if(area&&!$('hoAreaSeg')){
      const seg=document.createElement('div');
      seg.id='hoAreaSeg';seg.className='ck-seg role-admin-only';seg.setAttribute('role','tablist');seg.setAttribute('aria-label','Área');
      seg.innerHTML='<button type="button" role="tab" data-area="ISLA">Isla</button><button type="button" role="tab" data-area="TIENDA">Tienda</button>';
      seg.addEventListener('click',event=>{const b=event.target.closest('button[data-area]');if(b&&typeof window.setOpsAdminArea==='function')window.setOpsAdminArea(b.dataset.area)});
      area.insertAdjacentElement('beforebegin',seg);
    }
    if(area)$('hoAreaSeg')?.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.area===area.value));
    const shift=$('handoffShift');
    if(shift&&!$('hoShiftSeg')){
      const seg=document.createElement('div');
      seg.id='hoShiftSeg';seg.className='ck-seg';seg.setAttribute('role','tablist');seg.setAttribute('aria-label','Turno');
      seg.innerHTML=['Mañana','Tarde','Noche'].map(name=>`<button type="button" role="tab" data-shift="${name}">${name}</button>`).join('');
      seg.addEventListener('click',event=>{
        const b=event.target.closest('button[data-shift]');
        if(!b)return;
        shift.value=b.dataset.shift;
        shift.dispatchEvent(new Event('change',{bubbles:true}));
      });
      shift.insertAdjacentElement('afterend',seg);
    }
    if(shift)$('hoShiftSeg')?.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.shift===shift.value));
  }

  // ---- Historial ----
  function renderHistory(){
    const root=$('handoffHistory');
    if(!root||!window.HandoffModule||typeof window.opsRecordInArea!=='function')return;
    const list=window.HandoffModule.getAll().filter(window.opsRecordInArea);
    root.classList.add('ho-timeline');
    if(!list.length){
      root.innerHTML='<div class="ho-empty"><i>⇄</i><b>Todavía no hay entregas registradas</b><span>Cuando entregues un turno, quedará registrado aquí.</span></div>';
      return;
    }
    root.innerHTML=list.map((item,index)=>{
      const notes=String(item.notes||'').trim();
      const long=notes.length>110||notes.includes('\n');
      return `<div class="ho-row"><i class="ho-dot"></i><div><div class="meta"><span class="ho-chip">${esc(fmtDate(item.date))}</span><span class="ho-chip">${esc(item.shift)}</span></div><strong>${esc(item.from)} → ${esc(item.to)}</strong><span class="n ${long?'clamp':''}" id="hoNote${index}">${notes?esc(notes):'Sin observaciones'}</span>${long?`<button type="button" class="ho-more" onclick="handoffToggleNote('hoNote${index}',this)">Ver más</button>`:''}</div></div>`;
    }).join('');
  }
  window.handoffToggleNote=function(id,button){
    const note=$(id);
    if(!note)return;
    const open=note.classList.toggle('clamp');
    button.textContent=open?'Ver más':'Ver menos';
  };

  function prefillFrom(){
    const from=$('handoffFrom');
    if(from&&!from.value&&!from.dataset.prefilled&&typeof window.authenticatedDisplayName==='function'){
      from.dataset.prefilled='1';
      from.value=window.authenticatedDisplayName()||'';
    }
  }

  function render(){
    renderControls();
    renderPre();
    renderSuggestions();
    renderHistory();
    prefillFrom();
  }

  function install(){
    if(typeof window.renderHandoffs!=='function'||original)return;
    original=window.renderHandoffs;
    window.renderHandoffs=function(){
      const result=original.apply(this,arguments);
      try{render()}catch(error){console.warn('Entrega de turno',error)}
      return result;
    };
    ['handoffDate','handoffShift'].forEach(id=>$(id)?.addEventListener('change',()=>{try{render()}catch(error){}}));
  }
  install();
})();
