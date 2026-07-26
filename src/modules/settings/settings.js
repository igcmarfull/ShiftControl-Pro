(function(){

window.SettingsModule = {

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
    return state?.settings || {};
  },

  get(key){
    const state = this._getState();
    return state?.settings?.[key];
  },

  set(key, value, {save=true}={}){
    const state = this._getState();

    if(!state){
      return null;
    }

    state.settings=state.settings||{};
    state.settings[key]=value;
    this._saveIfNeeded(save);

    return value;
  },

  replaceAll(settings, {save=true}={}){
    const state = this._getState();

    if(!state){
      return {};
    }

    state.settings=settings;
    this._saveIfNeeded(save);

    return settings;
  }

};

console.log("[ShiftControl V31] Settings module loaded");

})();
