(function(){

window.ShiftControlSupabase = {

  async save(key,data){

    if(!window.supabaseClient){
      console.warn("[Supabase] Cliente no disponible");
      return;
    }

    return window.supabaseClient
      .from("app_state")
      .upsert({
        key,
        data,
        updated_at:new Date().toISOString()
      });

  },

  async load(key){

    if(!window.supabaseClient){
      return null;
    }

    const {data,error}=await window.supabaseClient
      .from("app_state")
      .select("data")
      .eq("key",key)
      .maybeSingle();

    if(error){
      console.warn(error);
      return null;
    }

    return data?.data || null;

  }

};

})();
