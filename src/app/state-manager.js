(function(){

window.ShiftControlState = {

  data:null,

  replace(nextState){

    state = nextState;

    window.state = nextState;

    this.data = nextState;

    return nextState;

  },

  initialize(defaultState){

    const currentState = this.replace(defaultState);

    console.log(
      "[ShiftControl V31] State Manager inicializado"
    );

    return currentState;

  },

  get(){

    return this.data;

  },

  set(data){

    return this.replace(data);

  },


  save(){

    if(typeof window.save === "function"){

      window.save();

      console.log(
        "[ShiftControl V31] Estado guardado"
      );

    }

  },

  syncLegacyState(){

    if(this.data){

      this.replace(this.data);

      console.log(
        "[ShiftControl V31] Estado nuevo sincronizado al legacy"
      );

    }else if(window.state){

      this.replace(window.state);

      console.log(
        "[ShiftControl V31] Estado antiguo conectado"
      );

    }

    return this.data;

  }

};

})();
