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

    const employees = this.getAll();

    return employees.find(
      employee => employee.id === id
    ) || null;

  }


};

console.log("[ShiftControl V31] Employees module loaded");

})();
