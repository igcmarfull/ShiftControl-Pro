(function(){

window.DailyClosureModule = {

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
    return state?.dailyClosures || [];
  },

  isClosed(date){
    const state = this._getState();
    return (state?.dailyClosures || []).includes(date);
  },

  add(date, {save=true}={}){
    const state = this._getState();

    if(!state){
      return null;
    }

    state.dailyClosures=state.dailyClosures||[];

    if(!state.dailyClosures.includes(date)){
      state.dailyClosures.push(date);
    }

    this._saveIfNeeded(save);

    return date;
  },

  remove(date, {save=true}={}){
    const state = this._getState();

    if(!state){
      return null;
    }

    const dailyClosures=state.dailyClosures||[];
    const existing=dailyClosures.includes(date)
      ?date
      :null;

    state.dailyClosures=dailyClosures.filter(
      item=>item!==date
    );

    this._saveIfNeeded(save);

    return existing;
  },

  replaceAll(items, {save=true}={}){
    const state = this._getState();

    if(!state){
      return [];
    }

    state.dailyClosures=items;
    this._saveIfNeeded(save);

    return items;
  }

};

console.log("[ShiftControl V31] Daily closures module loaded");

})();
