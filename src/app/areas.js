(function(){
  'use strict';

  // Áreas de la estación: la Jefa de Isla ve la isla, la Jefa de Tienda ve la
  // tienda y el administrador ve ambas. El área de cada trabajador se toma
  // del campo libre employee.area ("Isla", "Tienda").
  const AREAS=Object.freeze({
    ISLA:Object.freeze({key:'ISLA',label:'Isla',chiefTitle:'Jefa de Isla'}),
    TIENDA:Object.freeze({key:'TIENDA',label:'Tienda',chiefTitle:'Jefa de Tienda'})
  });

  // Colecciones con registros por trabajador que se recortan para una jefa.
  const EMPLOYEE_COLLECTIONS=Object.freeze([
    'plans',
    'executions',
    'absences',
    'additional',
    'evaluations',
    'cashShortages'
  ]);

  function normalizeText(value){
    return String(value||'')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g,'')
      .trim()
      .toLowerCase();
  }

  function normalizeArea(value){
    const text=normalizeText(value);
    if(text==='isla')return 'ISLA';
    if(text==='tienda')return 'TIENDA';
    return null;
  }

  function employeeArea(employee){
    return normalizeArea(employee?.area);
  }

  // Área de la sesión actual: null para el administrador. Las jefaturas sin
  // área registrada (cuentas anteriores a la separación) son de isla.
  function getSessionArea(){
    const context=window.AuthContext?.get?.()||null;
    if(String(context?.role||'').toUpperCase()!=='CHIEF')return null;
    return normalizeArea(context.area)||'ISLA';
  }

  // Trabajadores visibles para un área. La isla conserva el criterio
  // anterior: si nadie tiene área "Isla" (bases antiguas), ve a todo el
  // personal que no sea de tienda.
  function employeesForArea(employees,area){
    const list=Array.isArray(employees)?employees:[];
    if(!area)return list;
    const own=list.filter(employee=>employeeArea(employee)===area);
    if(area==='ISLA'&&!own.length){
      return list.filter(employee=>employeeArea(employee)!=='TIENDA');
    }
    return own;
  }

  // Copia superficial del estado con solo los trabajadores del área y sus
  // registros. Los datos generales (configuración, feriados, cierres) se
  // conservan. Las escrituras se combinan luego sobre el estado completo.
  function scopeState(fullState,area){
    if(!area||!fullState||typeof fullState!=='object')return fullState;
    const scoped={...fullState};
    const employees=employeesForArea(fullState.employees,area);
    const ids=new Set(employees.map(employee=>employee.id));
    scoped.employees=employees;
    EMPLOYEE_COLLECTIONS.forEach(key=>{
      if(!Array.isArray(fullState[key]))return;
      scoped[key]=fullState[key].filter(item=>
        !item||!item.employeeId||ids.has(item.employeeId)
      );
    });
    return scoped;
  }

  function info(area){
    return AREAS[area]||null;
  }

  window.ShiftControlAreas=Object.freeze({
    AREAS,
    normalizeArea,
    employeeArea,
    getSessionArea,
    employeesForArea,
    scopeState,
    info
  });
})();
