(function(){

window.ShiftControlStorageV31 = {

  async load(key){

    const remote = await ShiftControlSupabase.load(key);

    if(remote){
      ShiftControlLocal.save(key,remote);
      return remote;
    }

    return ShiftControlLocal.load(key);

  },

  async save(key,data){

    ShiftControlLocal.save(key,data);

    await ShiftControlSupabase.save(key,data);

  }

};

})();
