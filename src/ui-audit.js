(function(){
  'use strict';
  // Historial de actividad: solo presentación. Envuelve renderAudit() para agrupar por día, clasificar cada registro
  // por tipo (a partir del texto existente, sin guardar nada nuevo), juntar los cierres consecutivos de jornada y paginar.
  // Los registros (state.audit), la búsqueda (#auditSearch), la exportación y «Limpiar historial» siguen siendo los de index.html.
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PAGE=40;
  const CATS=[
    ['cierres','Cierres','✓','green',/^jornada cerrada|cierre|mes cerrado|reabri/i],
    ['reportes','Reportes','↗','purple',/export|reporte|respaldo|csv|impresi|liquidaci/i],
    ['pagos','Pagos','$','orange',/pago|pagad|jornada adicional|turno extra|factura|gasto|dep[oó]sito|cuadratura|faltante/i],
    ['planificacion','Planificación','▦','blue',/planific|patr[oó]n|asignaci|feriado|turnos? (base|asignad)/i],
    ['asistencia','Asistencia','⇄','blue',/asistencia|reemplaz|presente|ausen|licencia|vacaciones|permiso|ejecuci|atraso|checklist/i]
  ];
  let filter='todos';
  let limit=PAGE;
  let lastKey='';
  let original=null;

  const categoryOf=item=>{
    const text=String(item.action||'');
    const hit=CATS.find(cat=>cat[4].test(text));
    return hit?hit[0]:'otros';
  };
  const meta=key=>{
    const hit=CATS.find(cat=>cat[0]===key);
    return hit?{label:hit[1],icon:hit[2],tone:hit[3]}:{label:'Otros',icon:'•',tone:'muted'};
  };
  const dayKey=item=>{
    const d=new Date(item.date||0);
    return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const todayKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  function dayLabel(key){
    if(!key)return 'Sin fecha';
    const today=todayKey();
    const y=new Date();y.setDate(y.getDate()-1);
    const yesterday=`${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,'0')}-${String(y.getDate()).padStart(2,'0')}`;
    const text=new Date(key+'T12:00:00').toLocaleDateString('es-CL',{day:'numeric',month:'long'});
    return key===today?`Hoy · ${text}`:key===yesterday?`Ayer · ${text}`:text;
  }
  const timeOf=item=>item.date?new Date(item.date).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}):'';
  const dm=iso=>String(iso||'').slice(8,10)+'-'+String(iso||'').slice(5,7);
  const closeDay=item=>(String(item.action||'').match(/^Jornada cerrada para (\d{4}-\d{2}-\d{2})/)||[])[1]||'';

  function rowHtml(item){
    const cat=meta(categoryOf(item));
    return `<div class="hs-row"><span class="hs-ic" style="--c:var(--${cat.tone})">${cat.icon}</span><div><strong>${esc(item.action||'Movimiento registrado')}</strong><small>${item.details?esc(item.details):esc(cat.label)}</small></div><span class="hs-t">${esc(timeOf(item))}</span></div>`;
  }

  function build(rows){
    const out=[];
    let current='';
    let i=0;
    let shown=0;
    while(i<rows.length&&shown<limit){
      const item=rows[i];
      const key=dayKey(item);
      if(key!==current){current=key;out.push(`<div class="hs-day">${esc(dayLabel(key))}</div>`)}
      if(closeDay(item)){
        const group=[item];
        let j=i+1;
        while(j<rows.length&&closeDay(rows[j])&&dayKey(rows[j])===key){group.push(rows[j]);j++}
        if(group.length>1){
          const days=group.map(closeDay).sort();
          const id=`hsg${i}`;
          out.push(`<div class="hs-row hs-grp" data-grp="${id}"><span class="hs-ic" style="--c:var(--green)">✓</span><div><strong>${group.length} jornadas cerradas · ${dm(days[0])} al ${dm(days[days.length-1])}</strong><small>Cierres · ${esc(timeOf(group[group.length-1]))} a ${esc(timeOf(group[0]))}</small></div><button type="button" class="hs-toggle" onclick="auditToggleGroup('${id}',this)">Ver detalle ▾</button></div><div class="hs-sub" id="${id}" hidden>${group.map(rowHtml).join('')}</div>`);
          i=j;shown+=group.length;continue;
        }
      }
      out.push(rowHtml(item));
      i++;shown++;
    }
    return {html:out.join(''),consumed:i};
  }

  function ensureChrome(){
    const cards=document.querySelector('#audit .cards');
    if(cards&&!$('auditTodayCard')){
      const first=cards.firstElementChild;
      const card=document.createElement('div');
      card.className='card';
      card.id='auditTodayCard';
      card.innerHTML='<div class="metric-label">Hoy</div><div class="metric-value" id="auditTodayCount">0</div><div class="metric-sub">movimientos</div>';
      if(first)first.insertAdjacentElement('afterend',card);else cards.appendChild(card);
    }
    const list=$('auditList');
    if(list&&!$('auditTabs')){
      const tabs=document.createElement('div');
      tabs.id='auditTabs';
      tabs.className='hs-tabs';
      tabs.addEventListener('click',event=>{
        const button=event.target.closest('button[data-cat]');
        if(!button)return;
        filter=button.dataset.cat;
        limit=PAGE;
        render();
      });
      list.insertAdjacentElement('beforebegin',tabs);
    }
  }

  function render(){
    const list=$('auditList');
    if(!list||!window.state)return;
    ensureChrome();
    const search=($('auditSearch')?.value||'').trim().toLowerCase();
    const key=`${search}|${filter}`;
    if(key!==lastKey){lastKey=key;limit=PAGE}
    const all=[...(window.state.audit||[])].sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
    const counts={todos:all.length};
    all.forEach(item=>{const c=categoryOf(item);counts[c]=(counts[c]||0)+1});
    const today=todayKey();
    const todayCount=$('auditTodayCount');
    if(todayCount)todayCount.textContent=all.filter(item=>dayKey(item)===today).length;
    const tabs=$('auditTabs');
    if(tabs){
      const order=[['todos','Todos'],['planificacion','Planificación'],['asistencia','Asistencia'],['pagos','Pagos'],['cierres','Cierres'],['reportes','Reportes'],['otros','Otros']];
      tabs.innerHTML=order.filter(([k])=>k==='todos'||counts[k]).map(([k,label])=>`<button type="button" data-cat="${k}" class="${filter===k?'on':''}">${label}<em class="inv-count">${counts[k]||0}</em></button>`).join('');
    }
    const rows=all.filter(item=>{
      if(filter!=='todos'&&categoryOf(item)!==filter)return false;
      if(!search)return true;
      return [item.action,item.details,item.user,item.date].filter(Boolean).join(' ').toLowerCase().includes(search);
    });
    if(!rows.length){list.innerHTML='<div class="empty">No hay movimientos registrados.</div>';return}
    const built=build(rows);
    const remaining=rows.length-built.consumed;
    list.innerHTML=`<div class="hs-list">${built.html}</div>${remaining>0?`<div class="hs-more"><button type="button" class="btn" onclick="auditShowMore()">Ver más movimientos <em class="inv-count">${remaining}</em></button></div>`:''}`;
  }

  window.auditToggleGroup=function(id,button){
    const box=$(id);
    if(!box)return;
    box.hidden=!box.hidden;
    button.textContent=box.hidden?'Ver detalle ▾':'Ocultar ▴';
  };
  window.auditShowMore=function(){limit+=PAGE;render()};

  function install(){
    if(typeof window.renderAudit!=='function'||original)return;
    original=window.renderAudit;
    window.renderAudit=function(){
      const result=original.apply(this,arguments);
      try{render()}catch(error){console.warn('Historial',error)}
      return result;
    };
  }
  install();
})();
