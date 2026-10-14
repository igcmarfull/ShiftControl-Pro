(function(){

// Entregas de turno guardadas en el estado principal (state.handoffs), para
// que se sincronicen con Supabase como el resto de la operación.
window.HandoffModule = {

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
    return Array.isArray(state?.handoffs) ? state.handoffs : [];
  },

  add(data, {prepend=false, save=true}={}){
    const state = this._getState();

    if(!state){
      return null;
    }

    if(!Array.isArray(state.handoffs)){
      state.handoffs=[];
    }

    if(prepend){
      state.handoffs.unshift(data);
    }else{
      state.handoffs.push(data);
    }

    this._saveIfNeeded(save);
    return data;
  },

  replaceAll(items, {save=true}={}){
    const state = this._getState();

    if(!state){
      return [];
    }

    state.handoffs=items;
    this._saveIfNeeded(save);

    return items;
  }

};

console.log("[ShiftControl] Handoffs module loaded");

})();
