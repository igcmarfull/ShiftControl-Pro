(function(){

window.ShiftControlState = {

  data:null,

  initialize(defaultState){

    this.data = defaultState;

    console.log(
      "[ShiftControl V31] State Manager inicializado"
    );

    return this.data;

  },

  get(){

    return this.data;

  },

  set(data){

    this.data = data;

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

    if(window.state){

      this.data = window.state;

      console.log(
        "[ShiftControl V31] Estado antiguo conectado"
      );

    }

    return this.data;

  }

};

})();
