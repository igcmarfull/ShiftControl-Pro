(function(){
  'use strict';
  const OK_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  const CAL_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>';

  function enhance(){
    const grid=document.getElementById('absenceStatsGrid');
    if(grid){
      grid.querySelectorAll('.ab-k:not(.wide)').forEach(card=>{
        const num=card.querySelector(':scope > b');
        if(!num||card.classList.contains('calm')||num.textContent.trim()!=='0')return;
        card.classList.add('calm',num.classList.contains('ok')?'is-ok':'is-idle');
        const icon=document.createElement('i');
        icon.className='ab-calm-ic';
        icon.innerHTML=num.classList.contains('ok')?OK_ICON:CAL_ICON;
        card.insertBefore(icon,card.firstChild);
      });
    }
    document.querySelectorAll('#absenceStrip .ab-day').forEach(day=>{
      if(day.querySelector('small'))return;
      const nil=document.createElement('small');
      nil.className='nil';
      nil.innerHTML='<i></i><span>sin ausencias</span>';
      day.appendChild(nil);
    });
  }

  const original=window.renderAbsencePanel;
  if(typeof original!=='function')return;
  window.renderAbsencePanel=function(){
    const result=original.apply(this,arguments);
    try{enhance()}catch(error){console.warn('Ausencias',error)}
    return result;
  };
  try{enhance()}catch(error){}
})();
