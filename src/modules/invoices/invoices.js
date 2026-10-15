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

  // --- Logo del proveedor ---
  // No existe una entidad "proveedor": el logo se guarda como ruta en cada factura del mismo
  // proveedor y área (misma clave de RUT o, si no hay, el nombre).
  supplierKey(inv){
    const rut=String(inv?.rutProveedor||'').replace(/[^0-9kK]/g,'').toLowerCase();
    if(rut.length>=7)return 'rut:'+rut;
    const name=String(inv?.proveedor||'').trim().toLowerCase().replace(/\s+/g,' ');
    return name?'name:'+name:'';
  },

  _areaOf(inv){
    return window.ShiftControlAreas?.normalizeArea?.(inv?.area)||'';
  },

  supplierLogoPath(inv){
    if(!inv)return '';
    if(inv.logoProveedor)return inv.logoProveedor;
    const key=this.supplierKey(inv);
    if(!key)return '';
    const area=this._areaOf(inv);
    const match=this.getAll().find(item=>item.logoProveedor&&this.supplierKey(item)===key&&this._areaOf(item)===area);
    return match?match.logoProveedor:'';
  },

  // Aplica (o quita, con path vacío) el logo a todas las facturas del proveedor en el área de la factura.
  setSupplierLogo(inv,path,{save=true}={}){
    const key=this.supplierKey(inv);
    if(!key)return 0;
    const area=this._areaOf(inv);
    let count=0;
    this.getAll().forEach(item=>{
      if(this.supplierKey(item)!==key||this._areaOf(item)!==area)return;
      if(path)item.logoProveedor=path;
      else delete item.logoProveedor;
      count++;
    });
    if(count)this._saveIfNeeded(save);
    return count;
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
