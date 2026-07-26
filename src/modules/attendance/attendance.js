(function(){

window.AttendanceModule = {

  _getState(){

    return window.ShiftControlState?.get?.() || null;

  },

  getAll(){

    const state = this._getState();

    return state.executions || [];

  },

  findById(id){

    const state = this._getState();

    return (state?.executions || []).find(
      item=>item.id===id
    ) || null;

  },

  add(data, {save=true}={}){

    const state = this._getState();

    if(!state){
      return null;
    }

    state.executions.push(data);

    if(save&&window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

    return data;

  },

  patch(id, changes, {save=true}={}){

    const state = this._getState();

    if(!state){
      return null;
    }

    const existing=(state.executions || []).find(
      item=>item.id===id
    ) || null;

    if(!existing){
      return null;
    }

    Object.assign(existing,changes);

    if(save&&window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

    return existing;

  },

  replaceAll(items, {save=true}={}){

    const state = this._getState();

    if(!state){
      return [];
    }

    state.executions=items;

    if(save&&window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

    return items;

  },


  find(employeeId,date){

    return this.getAll().find(
      x =>
        x.employeeId === employeeId &&
        x.date === date
    ) || null;

  },


  create(data){

    const state = this._getState();

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

    const state = this._getState();

    state.executions =
      state.executions.filter(
        x=>x.id!==id
      );


    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

  },


  clearDate(date){

    const state = this._getState();

    state.executions =
      state.executions.filter(
        x=>x.date!==date
      );


    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

  },


  removeWhere(callback){

    const state = this._getState();

    state.executions =
      state.executions.filter(
        item=>!callback(item)
      );


    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

  },


  removeGeneratedByAbsence(absenceId){

    const state = this._getState();

    state.executions =
      state.executions.filter(
        item=>!(item.source==='absence-period'&&item.absenceId===absenceId)
      );


    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

  },


  removeEmployee(employeeId){

    const state = this._getState();

    state.executions =
      state.executions.filter(
        x=>x.employeeId!==employeeId
      );


    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

  },


  removeEmployeeReferences(employeeId){

    const state = this._getState();

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
