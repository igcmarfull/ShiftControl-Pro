(function(){

function requirePlanningMutationAccess(employeeId){
  const context = window.AuthContext?.get?.() || null;
  if(!context?.companyId || !['ADMIN', 'CHIEF'].includes(context.role)){
    throw new Error('Se requiere una sesión de empresa válida.');
  }
  // Legacy PlanningModule writes the company-wide document. All CHIEF
  // mutations must use ShiftControlAreaCalendar (area_state + RLS), including
  // chiefs whose area assignment is missing or temporarily unavailable.
  if(context.role === 'CHIEF'){
    throw new Error('Utiliza el calendario de tu área para modificar turnos.');
  }
  return context;
}

window.PlanningModule = {

  _getState(){

    return window.ShiftControlState?.get?.() || null;

  },

  getAll(){

    if(!window.ShiftControlState){
      console.warn("[Planning] State Manager no disponible");
      return [];
    }

    const state = this._getState();

    return state?.plans || [];

  },


  // Presentation helper only. Authorization must also be enforced by Supabase.
  getByArea(area){
    const normalized = String(area || '').trim().toUpperCase();
    if(!['ESTACION', 'TIENDA'].includes(normalized)){
      throw new Error('Area invalida: use ESTACION o TIENDA.');
    }

    const employees = window.EmployeeModule?.getByArea?.(normalized) || [];
    const employeeIds = new Set(employees.map(employee => employee.id));
    return this.getAll().filter(plan => employeeIds.has(plan.employeeId));
  },

  find(employeeId,date){

    return this.getAll().find(
      plan =>
        plan.employeeId===employeeId &&
        plan.date===date
    ) || null;

  },


  create(data){
    requirePlanningMutationAccess(data?.employeeId);


    const state = this._getState();

    if(!state.plans){
      state.plans=[];
    }


    const existing=this.find(
      data.employeeId,
      data.date
    );


    if(existing){

      Object.assign(existing,data);

    }else{

      state.plans.push({
        id: data.id || crypto.randomUUID(),
        ...data
      });

    }


    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }


    return this.find(
      data.employeeId,
      data.date
    );

  },


  remove(id){
    requirePlanningMutationAccess();


    const state = this._getState();

    state.plans =
      state.plans.filter(
        plan=>plan.id!==id
      );


    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

    return true;

  },


  clearEmployee(employeeId,date){
    requirePlanningMutationAccess(employeeId);


    const state = this._getState();

    state.plans =
      state.plans.filter(
        plan =>
          !(plan.employeeId===employeeId && plan.date===date)
      );


    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

  },


  removeEmployeePlans(employeeId){
    requirePlanningMutationAccess(employeeId);


    const state = this._getState();

    state.plans =
      state.plans.filter(
        plan=>plan.employeeId!==employeeId
      );


    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

  }


};


console.log("[ShiftControl V31] Planning module loaded");


})();
