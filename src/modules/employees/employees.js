(function(){

window.EmployeeModule = {

  getAll(){

    if(!window.ShiftControlState){
      console.warn("[Employees] State Manager no disponible");
      return [];
    }

    const state = window.ShiftControlState.get();

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

    const state = window.ShiftControlState.get();

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

    return employee;

  },


  update(id,data){

    const state = window.ShiftControlState.get();

    state.employees = state.employees.map(
      employee =>
        employee.id===id
        ? {...employee,...data}
        : employee
    );

    return this.find(id);

  },


  remove(id){

    const state = window.ShiftControlState.get();

    state.employees =
      state.employees.filter(
        employee=>employee.id!==id
      );

    return true;

  },


  addDocument(id,document){

    const state = window.ShiftControlState.get();

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

    const state = window.ShiftControlState.get();

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
