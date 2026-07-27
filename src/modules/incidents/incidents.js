(function(){

window.IncidentModule = {

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
    return state?.incidents || [];
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

    if(!Array.isArray(state.incidents)){
      state.incidents=[];
    }

    if(prepend){
      state.incidents.unshift(data);
    }else{
      state.incidents.push(data);
    }

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

  replaceAll(items, {save=true}={}){
    const state = this._getState();

    if(!state){
      return [];
    }

    state.incidents=items;
    this._saveIfNeeded(save);

    return items;
  }

};

console.log("[ShiftControl V1.0.1] Incidents module loaded");

})();
