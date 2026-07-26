(function(){

window.MonthClosureModule = {

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
    return state?.closedMonths || [];
  },

  isClosed(period){
    const state = this._getState();
    return (state?.closedMonths || []).includes(period);
  },

  add(period, {save=true}={}){
    const state = this._getState();

    if(!state){
      return null;
    }

    state.closedMonths.push(period);
    this._saveIfNeeded(save);

    return period;
  },

  remove(period, {save=true}={}){
    const state = this._getState();

    if(!state){
      return null;
    }

    const existing=state.closedMonths.includes(period)
      ?period
      :null;

    state.closedMonths=state.closedMonths.filter(
      item=>item!==period
    );

    this._saveIfNeeded(save);

    return existing;
  },

  replaceAll(items, {save=true}={}){
    const state = this._getState();

    if(!state){
      return [];
    }

    state.closedMonths=items;
    this._saveIfNeeded(save);

    return items;
  }

};

console.log("[ShiftControl V31] Month closures module loaded");

})();
