(function(){

window.AdditionalModule = {

  _getState(){
    return window.ShiftControlState?.get?.() || window.state || null;
  },

  _saveIfNeeded(shouldSave){
    if(shouldSave&&window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }
  },

  _normalizeAmount(value){
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
  },

  _normalizePaidStatus(value){
    if(value===undefined || value===null){
      return 'Pendiente';
    }

    const paid = String(value).trim();
    return paid || 'Pendiente';
  },

  _normalizeDate(value){
    return typeof value === 'string' ? value.trim() : '';
  },

  _normalizeRecord(data){
    const normalized = {
      id: data.id || crypto.randomUUID(),
      employeeId: data.employeeId || '',
      date: this._normalizeDate(data.date),
      shift: data.shift || '',
      reason: data.reason || '',
      amount: this._normalizeAmount(data.amount),
      paid: this._normalizePaidStatus(data.paid),
      paidDate: this._normalizeDate(data.paidDate),
      source: data.source || ''
    };

    if(data.replacedEmployeeId !== undefined){
      normalized.replacedEmployeeId = data.replacedEmployeeId;
    }

    if(data.generatedFromExecutionId !== undefined){
      normalized.generatedFromExecutionId = data.generatedFromExecutionId;
    }

    if(data.approvedForPaymentAt !== undefined){
      normalized.approvedForPaymentAt = data.approvedForPaymentAt;
    }

    if(data.approvedBy !== undefined){
      normalized.approvedBy = data.approvedBy;
    }

    return normalized;
  },

  _normalizeFields(data){
    const normalized = {};

    if('employeeId' in data){
      normalized.employeeId = data.employeeId || '';
    }

    if('date' in data){
      normalized.date = this._normalizeDate(data.date);
    }

    if('shift' in data){
      normalized.shift = data.shift || '';
    }

    if('reason' in data){
      normalized.reason = data.reason || '';
    }

    if('amount' in data){
      normalized.amount = this._normalizeAmount(data.amount);
    }

    if('paid' in data){
      normalized.paid = this._normalizePaidStatus(data.paid);
    }

    if('paidDate' in data){
      normalized.paidDate = this._normalizeDate(data.paidDate);
    }

    if('source' in data){
      normalized.source = data.source || '';
    }

    if('replacedEmployeeId' in data){
      normalized.replacedEmployeeId = data.replacedEmployeeId;
    }

    if('generatedFromExecutionId' in data){
      normalized.generatedFromExecutionId = data.generatedFromExecutionId;
    }

    if('approvedForPaymentAt' in data){
      normalized.approvedForPaymentAt = data.approvedForPaymentAt;
    }

    if('approvedBy' in data){
      normalized.approvedBy = data.approvedBy;
    }

    return normalized;
  },

  getAll(){
    const state = this._getState();
    return state?.additional || [];
  },

  findById(id){
    const state = this._getState();

    return (state?.additional || []).find(
      item=>item.id===id
    ) || null;
  },

  patch(id, changes, {save=true}={}){
    const state = this._getState();

    if(!state){
      return null;
    }

    const existing=(state.additional || []).find(
      item=>item.id===id
    ) || null;

    if(!existing){
      return null;
    }

    Object.assign(existing,changes);
    this._saveIfNeeded(save);

    return existing;
  },

  replaceAll(records, {save=true}={}){
    const state = this._getState();

    if(!state){
      return [];
    }

    state.additional = Array.isArray(records) ? records : [];
    this._saveIfNeeded(save);

    return state.additional;
  },

  add(data, {prepend=false, save=true}={}){
    const state = this._getState();

    if(!state){
      return null;
    }

    if(!Array.isArray(state.additional)){
      state.additional = [];
    }

    if(prepend){
      state.additional.unshift(data);
    }else{
      state.additional.push(data);
    }

    this._saveIfNeeded(save);

    return data;
  },

  find(employeeId, date){
    return this.getAll().find(
      item =>
        item.employeeId === employeeId &&
        item.date === date
    ) || null;
  },

  create(data){
    const state = this._getState();

    if(!state.additional){
      state.additional = [];
    }

    const normalized = this._normalizeRecord(data);
    const existing = this.find(normalized.employeeId, normalized.date);

    if(existing){
      Object.assign(existing, normalized);
    } else {
      state.additional.push(normalized);
    }

    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

    return this.find(normalized.employeeId, normalized.date);
  },

  update(id, data){
    const state = this._getState();

    if(!state.additional){
      state.additional = [];
    }

    const normalized = this._normalizeRecord({id, ...data});

    state.additional = state.additional.map(item =>
      item.id === id ? {...item, ...normalized} : item
    );

    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

    return state.additional.find(item => item.id === id) || null;
  },

  remove(id){
    const state = this._getState();

    if(!state.additional){
      state.additional = [];
    }

    state.additional = state.additional.filter(item => item.id !== id);

    if(window.ShiftControlState?.save){
      window.ShiftControlState.save();
    }

    return true;
  },

  getPendingPayments(){
    return this.getAll().filter(item => item.paid !== 'Pagado');
  }

};

console.log("[ShiftControl V31] Additional module loaded");

})();
