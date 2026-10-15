(function(){
  'use strict';
  // Trabajadores (escritorio): solo presentación. Envuelve renderEmployees() para mostrar el horario de cada turno
  // (de la configuración), el área como etiqueta y el conteo por área en la cabecera. Búsqueda, filtros,
  // edición y eliminación siguen siendo los de index.html.
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let original=null;

  const settings=()=>((window.ShiftControlState?.get?.()||window.state||{}).settings)||{};

  function enhance(){
    const table=$('employeeTable');
    if(!table)return;
    const config=settings();
    table.querySelectorAll('.badge').forEach(badge=>{
      const code=badge.textContent.trim();
      if(config[code])badge.dataset.hours=config[code];
    });
    table.querySelectorAll('tr').forEach(row=>{
      const cell=row.children[2];
      if(cell&&!cell.querySelector('.tw-tag')&&!cell.querySelector('.empty')){
        const text=cell.textContent.trim();
        if(text&&text!=='—')cell.innerHTML=`<span class="tw-tag">${esc(text)}</span>`;
      }
    });
    const list=window.EmployeeModule?.getAll?.()||[];
    const areaOf=worker=>window.ShiftControlAreas?.employeeArea?.(worker)||'ISLA';
    const isla=list.filter(worker=>areaOf(worker)!=='TIENDA').length;
    const tienda=list.length-isla;
    const head=document.querySelector('#employees .employees-desktop-head p');
    if(head)head.textContent=`Ficha, turno habitual y estado laboral · ${list.length} ${list.length===1?'trabajador':'trabajadores'} · ${isla} Isla · ${tienda} Tienda`;
  }

  function install(){
    if(typeof window.renderEmployees!=='function'||original)return;
    original=window.renderEmployees;
    window.renderEmployees=function(){
      const result=original.apply(this,arguments);
      try{enhance()}catch(error){console.warn('Trabajadores',error)}
      return result;
    };
  }
  install();
})();
