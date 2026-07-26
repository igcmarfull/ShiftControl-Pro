(function(){

window.EmployeeModule = {

  getAll(){

    if(!window.ShiftControlState){
      console.warn("[Employees] State Manager no disponible");
      return [];
    }

    const state = window.ShiftControlState.get();

    return state?.employees || [];

  }

};

console.log("[ShiftControl V31] Employees module loaded");

})();
