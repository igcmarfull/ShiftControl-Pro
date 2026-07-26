(function(){

window.ShiftControlLocal = {

  load(key){
    try{
      return JSON.parse(localStorage.getItem(key));
    }catch(error){
      console.warn("[Storage Local] Error leyendo datos", error);
      return null;
    }
  },

  save(key,value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
    }catch(error){
      console.warn("[Storage Local] Error guardando datos", error);
    }
  }

};

})();
