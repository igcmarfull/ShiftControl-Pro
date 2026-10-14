(function(){
  'use strict';
  // Checklist operativo: solo presentación. Envuelve renderOpsChecklist() para añadir el anillo de
  // avance, el resumen de ítems y el selector Isla/Tienda; las respuestas, el envío y la revisión
  // siguen en index.html (setChecklistState, completeOpsChecklist, reviewChecklistV12…).
  const $=id=>document.getElementById(id);
  const CIRC=339.29;
  let original=null;

  function ring(pct){
    const value=Math.max(0,Math.min(100,pct))/100;
    return `<div class="wc-donut" style="width:84px;height:84px"><svg viewBox="0 0 128 128" style="width:84px;height:84px"><circle class="bg" cx="64" cy="64" r="54" style="stroke-width:14"/><circle class="fg" cx="64" cy="64" r="54" style="stroke-width:14;stroke:var(--${value>=1?'green':'blue'})" stroke-dasharray="${CIRC}" stroke-dashoffset="${(CIRC*(1-value)).toFixed(1)}"/></svg><div class="c"><b style="font-size:19px">${Math.round(pct)}%</b></div></div>`;
  }

  function enhance(){
    const head=document.querySelector('#checklists .ops-panel-head');
    if(!head||typeof window.getOpsChecklist!=='function'||typeof window.opsChecklistItems!=='function')return;
    const data=window.getOpsChecklist();
    const items=window.opsChecklistItems();
    const answered=items.filter(([id])=>data.items&&data.items[id]).length;
    const issues=items.filter(([id])=>data.items&&data.items[id]==='issue').length;
    const pct=items.length?answered/items.length*100:0;

    let box=$('ckRing');
    if(!box){box=document.createElement('div');box.id='ckRing';box.className='ck-ring';head.prepend(box)}
    const html=ring(pct);
    if(box.dataset.v!==html){box.dataset.v=html;box.innerHTML=html}

    const context=$('checklistContext');
    if(context){
      let summary=$('ckSummary');
      if(!summary){summary=document.createElement('p');summary.id='ckSummary';summary.className='ck-summary';context.insertAdjacentElement('afterend',summary)}
      summary.textContent=`${answered} de ${items.length} ítems respondidos${issues?` · ${issues} con problema`:''}`;
    }

    const sign=document.querySelector('#checklists .ops-signoff');
    if(sign)sign.classList.toggle('ck-done',!!data.completed);

    // Selector segmentado para el administrador; el select original sigue siendo la fuente de verdad.
    const select=document.querySelector('#checklists .ops-area-select');
    if(select){
      let seg=$('ckSeg');
      if(!seg){
        seg=document.createElement('div');
        seg.id='ckSeg';
        seg.className='ck-seg role-admin-only';
        seg.setAttribute('role','tablist');
        seg.setAttribute('aria-label','Área');
        seg.innerHTML='<button type="button" role="tab" data-area="ISLA">Isla</button><button type="button" role="tab" data-area="TIENDA">Tienda</button>';
        seg.addEventListener('click',event=>{
          const button=event.target.closest('button[data-area]');
          if(button&&typeof window.setOpsAdminArea==='function')window.setOpsAdminArea(button.dataset.area);
        });
        select.insertAdjacentElement('beforebegin',seg);
      }
      seg.querySelectorAll('button').forEach(button=>button.classList.toggle('on',button.dataset.area===select.value));
    }
  }

  function install(){
    if(typeof window.renderOpsChecklist!=='function'||original)return;
    original=window.renderOpsChecklist;
    window.renderOpsChecklist=function(){
      const result=original.apply(this,arguments);
      try{enhance()}catch(error){console.warn('Checklist',error)}
      return result;
    };
  }
  install();
})();
