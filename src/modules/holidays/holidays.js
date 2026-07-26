(function(){

window.HolidayModule = {

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
    return state?.holidays || [];
  },

  findById(id){
    const state = this._getState();

    return (state?.holidays || []).find(
      item=>item.id===id
    ) || null;
  },

  add(data, {save=true}={}){
    const state = this._getState();

    if(!state){
      return null;
    }

    state.holidays.push(data);
    this._saveIfNeeded(save);

    return data;
  },

  update(id, changes, {save=true}={}){
    const state = this._getState();

    if(!state){
      return null;
    }

    const existing=state.holidays.find(
      item=>item.id===id
    ) || null;

    if(!existing){
      return null;
    }

    Object.assign(existing,changes);
    this._saveIfNeeded(save);

    return existing;
  },

  remove(id, {save=true}={}){
    const state = this._getState();

    if(!state){
      return null;
    }

    const existing=state.holidays.find(
      item=>item.id===id
    ) || null;

    state.holidays=state.holidays.filter(
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

    state.holidays=items;
    this._saveIfNeeded(save);

    return items;
  }

};

console.log("[ShiftControl V31] Holidays module loaded");

})();
