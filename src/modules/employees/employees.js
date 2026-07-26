(function(){

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


  find(id){

    return this.getAll().find(
      employee => employee.id === id
    ) || null;

  },


  count(){

    return this.getAll().length;

  },


  create(data){

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

    const employee={
      id: typeof safeRandomUUID==='function'
        ? safeRandomUUID()
        : crypto.randomUUID(),

      ...data,

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

    const state = this._getState();

    state.employees = state.employees.map(
      employee =>
        employee.id===id
        ? {...employee,...data}
        : employee
    );

    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

    return this.find(id);

  },


  remove(id){

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
