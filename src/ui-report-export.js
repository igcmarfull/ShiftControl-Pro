(function(){
  'use strict';
  // Menú «Exportar» de la página Reportes: Excel (ReportExcel) o el CSV de siempre.
  // Los botones siguen siendo los de index.html; aquí solo se abre el menú junto a ellos.
  let menu=null;

  function close(){
    if(!menu)return;
    menu.remove();
    menu=null;
    document.removeEventListener('click',onDocument,true);
    document.removeEventListener('keydown',onKey,true);
    window.removeEventListener('resize',close);
  }
  function onDocument(event){
    if(menu&&!menu.contains(event.target)&&!event.target.closest('[data-rx-open]'))close();
  }
  function onKey(event){if(event.key==='Escape')close()}

  window.reportExportMenu=function(button,kind){
    if(menu){close();return}
    const accounting=kind==='accounting';
    menu=document.createElement('div');
    menu.className='rx-menu';
    menu.setAttribute('role','menu');
    menu.innerHTML=`<button type="button" class="rx-it" role="menuitem" data-rx="xlsx"><i class="x">XLSX</i><span><b>Excel (.xlsx)</b><small>Formato Prosercom, con filtros y totales</small></span></button>`+
      `<button type="button" class="rx-it" role="menuitem" data-rx="csv"><i>CSV</i><span><b>CSV</b><small>Texto plano, como hasta ahora</small></span></button>`+
      `<div class="rx-note">El archivo queda registrado en el historial.</div>`;
    button.setAttribute('data-rx-open','1');
    document.body.appendChild(menu);
    const rect=button.getBoundingClientRect();
    menu.style.top=`${Math.round(rect.bottom+8)}px`;
    menu.style.right=`${Math.max(12,Math.round(window.innerWidth-rect.right))}px`;
    menu.addEventListener('click',event=>{
      const item=event.target.closest('[data-rx]');
      if(!item)return;
      const choice=item.dataset.rx;
      close();
      if(choice==='xlsx')window.ReportExcel?.download?.();
      else if(accounting)window.exportAccountingCSV?.();
      else window.exportMonthlyCSV?.();
    });
    document.addEventListener('click',onDocument,true);
    document.addEventListener('keydown',onKey,true);
    window.addEventListener('resize',close);
  };
})();
