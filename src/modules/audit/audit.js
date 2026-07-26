(function(){

window.AuditModule = {

  _getState(){
    return window.ShiftControlState?.get?.() || window.state || null;
  },

  _saveIfNeeded(shouldSave){
    if(shouldSave&&window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }
  },

  getAll(){
    const state = this._getState();
    return state?.audit || [];
  },

  add(data, {save=true}={}){
    const state = this._getState();

    if(!state){
      return null;
    }

    state.audit.unshift(data);
    this._saveIfNeeded(save);

    return data;
  },

  replaceAll(items, {save=true}={}){
    const state = this._getState();

    if(!state){
      return [];
    }

    state.audit=items;
    this._saveIfNeeded(save);

    return items;
  }

};

console.log("[ShiftControl V31] Audit module loaded");

})();
