(function(){

window.FinanceReconciliationModule = {

  _getState(){
    return window.ShiftControlState?.get?.() || null;
  },

  _saveIfNeeded(shouldSave){
    if(shouldSave&&window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }
  },

  getAll(){
    const state = this._getState();
    return state?.financeReconciliations || [];
  },

  findById(id){
    return this.getAll().find(
      item=>item.id===id
    ) || null;
  },

  add(data, {prepend=false, save=true}={}){
    const state = this._getState();

    if(!state){
      return null;
    }

    if(!Array.isArray(state.financeReconciliations)){
      state.financeReconciliations=[];
    }

    if(prepend){
      state.financeReconciliations.unshift(data);
    }else{
      state.financeReconciliations.push(data);
    }

    this._saveIfNeeded(save);
    return data;
  },

  update(id, data, {save=true}={}){
    const state = this._getState();

    if(!state||!Array.isArray(state.financeReconciliations)){
      return null;
    }

    const index=state.financeReconciliations.findIndex(
      item=>item.id===id
    );

    if(index<0){
      return null;
    }

    state.financeReconciliations[index]=data;
    this._saveIfNeeded(save);

    return data;
  },

  patch(id, changes, {save=true}={}){
    const existing=this.findById(id);

    if(!existing){
      return null;
    }

    Object.assign(existing,changes);
    this._saveIfNeeded(save);

    return existing;
  },

  remove(id, {save=true}={}){
    const state = this._getState();

    if(!state||!Array.isArray(state.financeReconciliations)){
      return null;
    }

    const existing=this.findById(id);

    state.financeReconciliations=state.financeReconciliations.filter(
      item=>item.id!==id
    );

    this._saveIfNeeded(save);
    return existing;
  },

  replaceAll(items, {save=true}={}){
    const state = this._getState();

    if(!state){
      return [];
    }

    state.financeReconciliations=items;
    this._saveIfNeeded(save);

    return items;
  }

};

console.log("[ShiftControl V1.0] Finance reconciliations module loaded");

})();
