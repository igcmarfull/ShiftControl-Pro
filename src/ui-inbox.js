(function(){
  'use strict';

  function enhance(){
    const root=document.getElementById('adminInboxRoot');
    if(!root)return;

    const rows=Array.from(root.querySelectorAll('.abx-row'));
    rows.forEach((row,index)=>{
      const buttons=row.querySelectorAll('.abx-acts button');
      if(buttons.length===1)row.classList.add('single');
      if(index===0&&row.querySelector('.abx-tag')?.textContent.trim()==='Urgente')row.classList.add('lead');
      if(row.dataset.tap)return;
      row.dataset.tap='1';
      row.addEventListener('click',event=>{
        if(!window.matchMedia('(max-width:820px)').matches)return;
        if(event.target.closest('.abx-acts'))return;
        const button=row.querySelector('.abx-acts button.pri')||row.querySelector('.abx-acts button');
        if(button)button.click();
      });
    });

    root.querySelectorAll('.abx-tabs button').forEach(button=>{
      const count=button.querySelector('em')?.textContent.trim();
      button.classList.toggle('zero',count==='0');
    });

    root.querySelectorAll('.abx-kpi').forEach((kpi,index)=>{
      const target=['.abx-decide','.abx-decide','.abx-side .abx-panel:nth-child(1)','.abx-side .abx-panel:nth-child(2)'][index];
      if(!target||kpi.dataset.jump)return;
      kpi.dataset.jump='1';
      kpi.addEventListener('click',()=>{
        if(!window.matchMedia('(max-width:820px)').matches)return;
        root.querySelector(target)?.scrollIntoView({behavior:'smooth',block:'start'});
      });
    });

    const money=root.querySelector('.abx-side .abx-panel:nth-child(1)');
    if(money){
      const lines=Array.from(money.querySelectorAll('.abx-line'));
      let allZero=true;
      lines.forEach(line=>{
        const zero=line.querySelector('em')?.textContent.trim()==='0';
        line.classList.toggle('zero',zero);
        if(!zero)allZero=false;
      });
      money.classList.toggle('is-calm',allZero);
      if(allZero&&!money.querySelector('.abx-calm')){
        const calm=document.createElement('div');
        calm.className='abx-calm';
        calm.innerHTML='<i>✓</i><span>Todo al día<small>Sin facturas ni finanzas por resolver</small></span>';
        money.querySelector('.abx-big')?.after(calm);
      }
    }

    const closures=root.querySelector('.abx-side .abx-panel:nth-child(2)');
    if(closures){
      const days=Array.from(closures.querySelectorAll('.abx-line')).filter(line=>line.querySelector('.abx-mini'));
      days.forEach((line,index)=>line.classList.toggle('m-extra',index>=3));
      const more=closures.querySelector('.abx-more');
      if(days.length&&!closures.querySelector('.abx-all')){
        const total=days.length+(more?parseInt((more.textContent.match(/\d+/)||['0'])[0],10):0);
        const link=document.createElement('button');
        link.type='button';
        link.className='abx-link block abx-all';
        link.textContent='Ver todos los cierres ('+total+')';
        link.setAttribute('onclick',"showView('daily-summary')");
        (more||days[days.length-1]).after(link);
      }
    }
  }

  const original=window.renderAdminInbox;
  if(typeof original!=='function')return;
  window.renderAdminInbox=function(){
    const result=original.apply(this,arguments);
    try{enhance()}catch(error){console.warn('Bandeja ADMIN',error)}
    return result;
  };
  try{enhance()}catch(error){}
})();
