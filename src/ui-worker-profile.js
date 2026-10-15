(function(){
  'use strict';

  const HUES=[212,262,152,28,336,190,45];
  function hueFor(name){
    let sum=0;
    for(const ch of String(name||''))sum=(sum+ch.charCodeAt(0))%997;
    return HUES[sum%HUES.length];
  }

  function toneFor(type,status){
    if(type==='Asistencia')return status==='Presente'?'green':status==='Atrasado'?'orange':'red';
    if(type==='Reemplazo realizado')return 'green';
    if(type==='Reemplazo recibido')return 'purple';
    if(type==='Turno extra')return 'orange';
    if(type==='Evaluación')return 'yellow';
    if(type==='Faltante')return 'red';
    return 'blue';
  }

  function enhance(){
    const body=document.getElementById('workerDrawerBody');
    if(!body)return;

    const name=body.querySelector('.worker-profile-title h3')?.textContent||'';
    const avatar=body.querySelector('.drawer-avatar.large');
    if(avatar)avatar.style.setProperty('--hue',hueFor(name));

    const period=body.querySelector('.worker-profile-period');
    const monthLabel=period?.querySelector(':scope > strong');
    if(monthLabel&&!monthLabel.dataset.wp){
      monthLabel.dataset.wp='1';
      monthLabel.setAttribute('role','button');
      monthLabel.setAttribute('title','Elegir mes');
      monthLabel.addEventListener('click',()=>{
        const input=period.querySelector('input[type="month"]');
        try{input?.showPicker?.()}catch(error){input?.focus()}
      });
    }

    body.querySelectorAll('.worker-profile-kpis:not(.compact) > div').forEach(card=>{
      const delta=card.querySelector('.worker-delta');
      card.dataset.tr=delta?(delta.classList.contains('positive')?'pos':delta.classList.contains('negative')?'neg':'neu'):'none';
      const small=card.querySelector('small');
      if(small&&!small.dataset.wp){
        small.dataset.wp='1';
        Array.from(small.childNodes).forEach(node=>{
          if(node.nodeType===3&&node.textContent.trim()){
            const hint=document.createElement('em');
            hint.className='wp-hint';
            hint.textContent=node.textContent.trim();
            small.replaceChild(hint,node);
          }
        });
      }
    });

    const card=body.querySelector('.health-card');
    if(card){
      const score=parseInt(card.querySelector('.health-score strong')?.textContent,10)||0;
      card.dataset.level=score>=75?'ok':score>=60?'mid':'low';
      card.style.setProperty('--pct',score);
    }

    body.querySelectorAll('.worker-timeline-row').forEach(row=>{
      if(row.dataset.wp)return;
      row.dataset.wp='1';
      const type=row.querySelector('strong')?.textContent.trim()||'';
      const span=row.querySelector('span');
      if(!span)return;
      const parts=span.textContent.split(' · ');
      const date=parts.shift()||'';
      let title=type;
      if(type==='Asistencia'&&parts.length)title=parts.shift();
      row.dataset.tone=toneFor(type,title);
      row.dataset.type=type;
      const box=row.querySelector('div');
      box.innerHTML='';
      const strong=document.createElement('strong');
      strong.textContent=title;
      box.appendChild(strong);
      if(parts.length){
        const detail=document.createElement('span');
        detail.textContent=parts.join(' · ');
        box.appendChild(detail);
      }
      const time=document.createElement('time');
      time.textContent=date;
      row.appendChild(time);
    });
  }

  const original=window.renderWorkerProfile;
  if(typeof original!=='function')return;
  window.renderWorkerProfile=function(){
    const result=original.apply(this,arguments);
    try{enhance()}catch(error){console.warn('Ficha',error)}
    return result;
  };
})();
