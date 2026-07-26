(function(){

window.AttendanceModule = {

  getAll(){

    const state = window.ShiftControlState.get();

    return state.executions || [];

  },


  find(employeeId,date){

    return this.getAll().find(
      x =>
        x.employeeId === employeeId &&
        x.date === date
    ) || null;

  },


  create(data){

    const state = window.ShiftControlState.get();

    if(!state.executions){
      state.executions=[];
    }


    const existing=this.find(
      data.employeeId,
      data.date
    );


    if(existing){

      Object.assign(existing,data);

    }else{

      state.executions.push({
        id:data.id || crypto.randomUUID(),
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

    state.executions =
      state.executions.filter(
        x=>x.id!==id
      );


    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

  },


  clearDate(date){

    const state = window.ShiftControlState.get();

    state.executions =
      state.executions.filter(
        x=>x.date!==date
      );


    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

  },


  removeWhere(callback){

    const state = window.ShiftControlState.get();

    state.executions =
      state.executions.filter(
        item=>!callback(item)
      );


    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

  },


  removeGeneratedByAbsence(absenceId){

    const state = window.ShiftControlState.get();

    state.executions =
      state.executions.filter(
        item=>!(item.source==='absence-period'&&item.absenceId===absenceId)
      );


    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

  },


  removeEmployee(employeeId){

    const state = window.ShiftControlState.get();

    state.executions =
      state.executions.filter(
        x=>x.employeeId!==employeeId
      );


    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

  },


  removeEmployeeReferences(employeeId){

    const state = window.ShiftControlState.get();

    state.executions =
      state.executions
        .filter(x=>x.employeeId!==employeeId)
        .map(x=>x.replacementId===employeeId
          ? {...x,replacementId:''}
          : x
        );


    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

  }


};


console.log("[ShiftControl V31] Attendance module loaded");


})();