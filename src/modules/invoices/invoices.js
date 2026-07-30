(function(){

window.InvoiceModule = {

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
    return state?.invoices || [];
  },

  findById(id){
    return this.getAll().find(item=>item.id===id) || null;
  },

  filter(predicate){
    return this.getAll().filter(predicate);
  },

  add(data, {prepend=false, save=true}={}){
    const state=this._getState();

    if(!state){
      return null;
    }

    if(!Array.isArray(state.invoices)){
      state.invoices=[];
    }

    if(prepend){
      state.invoices.unshift(data);
    }else{
      state.invoices.push(data);
    }

    this._saveIfNeeded(save);
    return data;
  },

  create(data, opts={}){
    return this.add(data, opts);
  },

  update(id, data, {save=true}={}){
    const state=this._getState();

    if(!state||!Array.isArray(state.invoices)){
      return null;
    }

    const index=state.invoices.findIndex(
      item=>item.id===id
    );

    if(index<0){
      return null;
    }

    state.invoices[index]=data;
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
    const state=this._getState();

    if(!state){
      return [];
    }

    state.invoices=items;
    this._saveIfNeeded(save);

    return items;
  },

  remove(id, {save=true}={}){
    const state=this._getState();

    if(!state||!Array.isArray(state.invoices)){
      return false;
    }

    const index=state.invoices.findIndex(
      item=>item.id===id
    );

    if(index<0){
      return false;
    }

    state.invoices.splice(index,1);
    this._saveIfNeeded(save);

    return true;
  }

};

console.log("[ShiftControl V1.0] Invoices module loaded");

})();
