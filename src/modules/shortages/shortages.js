(function(){

window.ShortageModule = {

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
    return state?.cashShortages || [];
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

    if(!Array.isArray(state.cashShortages)){
      state.cashShortages=[];
    }

    if(prepend){
      state.cashShortages.unshift(data);
    }else{
      state.cashShortages.push(data);
    }

    this._saveIfNeeded(save);
    return data;
  },

  update(id, data, {save=true}={}){
    const state = this._getState();

    if(!state||!Array.isArray(state.cashShortages)){
      return null;
    }

    const index=state.cashShortages.findIndex(
      item=>item.id===id
    );

    if(index<0){
      return null;
    }

    state.cashShortages[index]=data;
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

    if(!state||!Array.isArray(state.cashShortages)){
      return null;
    }

    const existing=this.findById(id);

    state.cashShortages=state.cashShortages.filter(
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

    state.cashShortages=items;
    this._saveIfNeeded(save);

    return items;
  }

};

console.log("[ShiftControl V1.0.1] Shortages module loaded");

})();
