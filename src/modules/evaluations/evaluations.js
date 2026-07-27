(function(){

window.EvaluationModule = {

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
    return state?.evaluations || [];
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

    if(!Array.isArray(state.evaluations)){
      state.evaluations=[];
    }

    if(prepend){
      state.evaluations.unshift(data);
    }else{
      state.evaluations.push(data);
    }

    this._saveIfNeeded(save);
    return data;
  },

  update(id, data, {save=true}={}){
    const state = this._getState();

    if(!state||!Array.isArray(state.evaluations)){
      return null;
    }

    const index=state.evaluations.findIndex(
      item=>item.id===id
    );

    if(index<0){
      return null;
    }

    state.evaluations[index]=data;
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

    state.evaluations=items;
    this._saveIfNeeded(save);

    return items;
  }

};

console.log("[ShiftControl V1.1] Evaluations module loaded");

})();
