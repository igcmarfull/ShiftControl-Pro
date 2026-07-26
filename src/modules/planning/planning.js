(function(){

window.PlanningModule = {

  getAll(){

    if(!window.ShiftControlState){
      console.warn("[Planning] State Manager no disponible");
      return [];
    }

    const state = window.ShiftControlState.get();

    return state?.plans || [];

  },


  find(employeeId,date){

    return this.getAll().find(
      plan =>
        plan.employeeId===employeeId &&
        plan.date===date
    ) || null;

  },


  create(data){

    const state = window.ShiftControlState.get();

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

    const state = window.ShiftControlState.get();

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

    const state = window.ShiftControlState.get();

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

    const state = window.ShiftControlState.get();

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
