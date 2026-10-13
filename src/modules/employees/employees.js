(function(){

// Areas are explicit. Legacy employees without an area remain unassigned
// until an ADMIN classifies them; never infer an area automatically.
const VALID_AREAS = ['ESTACION', 'TIENDA'];

function normalizeArea(area){
  const normalized = String(area || '').trim().toUpperCase();
  if(!VALID_AREAS.includes(normalized)){
    throw new Error('Area invalida: use ESTACION o TIENDA.');
  }
  return normalized;
}

function requireEmployeeMutationAccess(){
  const context = window.AuthContext?.get?.() || null;
  if(!context?.companyId || !['ADMIN','CHIEF'].includes(context.role)){
    throw new Error('Se requiere una sesión de empresa válida.');
  }
  // Until area-specific persistence is live, CHIEF must not mutate the
  // company-wide JSON, even via a module method bypassing the UI.
  if(context.role === 'CHIEF' && context.area){
    throw new Error('Los cambios por área aún no están habilitados.');
  }
  return context;
}

window.EmployeeModule = {

  _getState(){

    return window.ShiftControlState?.get?.() || null;

  },

  getAll(){

    if(!window.ShiftControlState){
      console.warn("[Employees] State Manager no disponible");
      return [];
    }

    const state = this._getState();

    return state?.employees || [];

  },


  getByArea(area){
    const normalized = normalizeArea(area);
    return this.getAll().filter(employee => employee.area === normalized);
  },

  getUnassigned(){
    return this.getAll().filter(employee => !VALID_AREAS.includes(employee.area));
  },

  // Only ADMIN may classify legacy employees. This is a local state helper,
  // not a substitute for server-side RLS or area-isolated persistence.
  assignArea(id, area){
    const context = window.AuthContext?.get?.() || null;
    if(context?.role !== 'ADMIN' || !context.companyId){
      throw new Error('Solo ADMIN puede asignar el área de un trabajador.');
    }
    const normalized = normalizeArea(area);
    const state = this._getState();
    if(!state || !Array.isArray(state.employees)){
      throw new Error('No se encontró el estado de trabajadores.');
    }
    const employee = state.employees.find(item => item.id === id);
    if(!employee){
      throw new Error('Trabajador no encontrado.');
    }
    if(employee.area === normalized){
      return employee;
    }
    employee.area = normalized;
    window.ShiftControlState?.save?.();
    return employee;
  },

  // Preview counts before migration; no records are changed.
  getAreaSummary(){
    const employees = this.getAll();
    return {
      ESTACION: employees.filter(item => item.area === 'ESTACION').length,
      TIENDA: employees.filter(item => item.area === 'TIENDA').length,
      UNASSIGNED: employees.filter(item => !VALID_AREAS.includes(item.area)).length,
      total: employees.length
    };
  },

  find(id){

    return this.getAll().find(
      employee => employee.id === id
    ) || null;

  },


  count(){

    return this.getAll().length;

  },


  create(data){
    requireEmployeeMutationAccess();


    const state = this._getState();

    if(!state.employees){
      state.employees=[];
    }

    const exists = state.employees.some(
      e => e.rut===data.rut || e.name===data.name
    );

    if(exists){
      return null;
    }

    const normalizedData = {...data};
    if(Object.prototype.hasOwnProperty.call(normalizedData, 'area') && window.AuthContext?.get?.()?.role !== 'ADMIN') {
      throw new Error('Solo ADMIN puede modificar el área de un trabajador.');
    }
    if(Object.prototype.hasOwnProperty.call(normalizedData, 'area')){
      normalizedData.area = normalizeArea(normalizedData.area);
    }

    const employee={
      id: typeof safeRandomUUID==='function'
        ? safeRandomUUID()
        : crypto.randomUUID(),

      ...normalizedData,

      start: data.start || new Date().toISOString().slice(0,10),

      active:true
    };


    state.employees.push(employee);

    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

    return employee;

  },


  update(id,data){
    requireEmployeeMutationAccess();


    const normalizedData = {...data};
    if(Object.prototype.hasOwnProperty.call(normalizedData, 'area') && window.AuthContext?.get?.()?.role !== 'ADMIN') {
      throw new Error('Solo ADMIN puede modificar el área de un trabajador.');
    }
    if(Object.prototype.hasOwnProperty.call(normalizedData, 'area')){
      normalizedData.area = normalizeArea(normalizedData.area);
    }

    const state = this._getState();

    state.employees = state.employees.map(
      employee =>
        employee.id===id
        ? {...employee,...normalizedData}
        : employee
    );

    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

    return this.find(id);

  },


  remove(id){
    requireEmployeeMutationAccess();


    const state = this._getState();

    state.employees =
      state.employees.filter(
        employee=>employee.id!==id
      );

    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

    return true;

  },


  addDocument(id,document){
    requireEmployeeMutationAccess();


    const state = this._getState();

    state.employees =
      state.employees.map(employee=>{

        if(employee.id!==id){
          return employee;
        }

        return {
          ...employee,
          documents:[
            ...(employee.documents||[]),
            document
          ]
        };

      });

  },


  removeDocument(id,index){
    requireEmployeeMutationAccess();


    const state = this._getState();

    state.employees =
      state.employees.map(employee=>{

        if(employee.id!==id){
          return employee;
        }

        return {
          ...employee,
          documents:
            (employee.documents||[])
            .filter((_,i)=>i!==index)
        };

      });

  }


};


console.log("[ShiftControl V31] Employees module loaded");


var EmployeeModule = window.EmployeeModule;


})();
