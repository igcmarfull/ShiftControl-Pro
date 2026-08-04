(function(){

window.DepositModule = {

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
    return state?.deposits || [];
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

    if(!Array.isArray(state.deposits)){
      state.deposits=[];
    }

    if(prepend){
      state.deposits.unshift(data);
    }else{
      state.deposits.push(data);
    }

    this._saveIfNeeded(save);
    return data;
  },

  update(id, data, {save=true}={}){
    const state = this._getState();

    if(!state||!Array.isArray(state.deposits)){
      return null;
    }

    const index=state.deposits.findIndex(
      item=>item.id===id
    );

    if(index<0){
      return null;
    }

    state.deposits[index]=data;
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

    if(!state||!Array.isArray(state.deposits)){
      return null;
    }

    const existing=this.findById(id);

    state.deposits=state.deposits.filter(
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

    state.deposits=items;
    this._saveIfNeeded(save);

    return items;
  }

};

console.log("[ShiftControl V1.0] Deposits module loaded");

})();
