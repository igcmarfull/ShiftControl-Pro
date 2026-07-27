(function(){

window.ChecklistModule = {

  _getState(){
    return window.ShiftControlState?.get?.() || null;
  },

  _saveIfNeeded(shouldSave){
    if(shouldSave&&window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }
  },

  getAll(){
    const state=this._getState();
    return state?.checklists || {};
  },

  get(key){
    return this.getAll()[key] || null;
  },

  set(key, data, {save=true}={}){
    const state=this._getState();

    if(!state){
      return null;
    }

    if(!state.checklists||Array.isArray(state.checklists)||typeof state.checklists!=='object'){
      state.checklists={};
    }

    state.checklists[key]=data;
    this._saveIfNeeded(save);

    return data;
  },

  patch(key, changes, {save=true}={}){
    const existing=this.get(key);

    if(!existing){
      return null;
    }

    Object.assign(existing,changes);
    this._saveIfNeeded(save);

    return existing;
  },

  replaceAll(items, {save=true}={}){
    const state=this._getState();

    if(!state){
      return {};
    }

    state.checklists=items;
    this._saveIfNeeded(save);

    return items;
  }

};

console.log("[ShiftControl V1.1.1] Checklists module loaded");

})();
