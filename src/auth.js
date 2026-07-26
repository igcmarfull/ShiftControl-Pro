(function(){
  'use strict';

  const config=window.SHIFTCONTROL_CONFIG;
  const LEGACY_AUTH_KEYS=[
    'shiftcontrol_auth_users_v1415',
    'shiftcontrol_auth_session_v1415',
    'shiftcontrol_auth_session_temp_v1415'
  ];
  const SESSION_ONLY_KEY='shiftcontrol_auth_session_only_v1';
  const SESSION_TAB_KEY='shiftcontrol_auth_session_tab_v1';
  let client=null;
  let currentContext=null;
  let initialized=false;
  let initializePromise=null;

  function getClient(){
    if(client)return client;

    if(!config?.supabaseUrl||!config?.supabasePublishableKey){
      throw new Error('Falta la configuración de Supabase.');
    }

    if(!window.supabase?.createClient){
      throw new Error('No se cargó la librería de Supabase.');
    }

    client=window.supabase.createClient(
      config.supabaseUrl,
      config.supabasePublishableKey
    );

    return client;
  }

  function clearLegacyAuth(){
    try{
      LEGACY_AUTH_KEYS.forEach(key=>localStorage.removeItem(key));
      LEGACY_AUTH_KEYS.forEach(key=>sessionStorage.removeItem(key));
    }catch(_error){}
  }

  function setPersistencePreference(remember){
    try{
      if(remember){
        localStorage.removeItem(SESSION_ONLY_KEY);
        sessionStorage.removeItem(SESSION_TAB_KEY);
      }else{
        localStorage.setItem(SESSION_ONLY_KEY,'true');
        sessionStorage.setItem(SESSION_TAB_KEY,'true');
      }
    }catch(_error){}
  }

  async function enforceSessionPreference(){
    try{
      const sessionOnly=localStorage.getItem(SESSION_ONLY_KEY)==='true';
      const currentTab=sessionStorage.getItem(SESSION_TAB_KEY)==='true';

      if(sessionOnly&&!currentTab){
        await getClient().auth.signOut({scope:'local'});
        localStorage.removeItem(SESSION_ONLY_KEY);
      }
    }catch(_error){}
  }

  function accessError(message,code){
    const error=new Error(message);
    error.code=code;
    return error;
  }

  function legacyRole(role){
    return role==='CHIEF'?'chief':'admin';
  }

  function freezeContext(user,profile,membership,company){
    const context={
      userId:user.id,
      email:user.email||'',
      displayName:profile.display_name,
      companyId:company.id,
      companyName:company.name,
      role:membership.role,
      legacyRole:legacyRole(membership.role)
    };

    return Object.freeze(context);
  }

  async function loadContext(user){
    const supabaseClient=getClient();
    const profileResult=await supabaseClient
      .from('profiles')
      .select('id, display_name, active')
      .eq('id',user.id)
      .maybeSingle();

    if(profileResult.error)throw profileResult.error;
    if(!profileResult.data||profileResult.data.active!==true){
      throw accessError(
        'Tu perfil no está habilitado.',
        'AUTH_PROFILE_INACTIVE'
      );
    }

    const membershipResult=await supabaseClient
      .from('company_memberships')
      .select('company_id, user_id, role, active')
      .eq('user_id',user.id)
      .eq('active',true);

    if(membershipResult.error)throw membershipResult.error;

    const memberships=membershipResult.data||[];
    if(memberships.length!==1){
      throw accessError(
        'Tu cuenta no tiene una empresa activa asignada.',
        'AUTH_COMPANY_MEMBERSHIP_INVALID'
      );
    }

    const membership=memberships[0];
    if(!['ADMIN','CHIEF'].includes(membership.role)){
      throw accessError(
        'Tu cuenta no tiene un rol válido.',
        'AUTH_ROLE_INVALID'
      );
    }

    const companyResult=await supabaseClient
      .from('companies')
      .select('id, name, active')
      .eq('id',membership.company_id)
      .maybeSingle();

    if(companyResult.error)throw companyResult.error;
    if(!companyResult.data||companyResult.data.active!==true){
      throw accessError(
        'La empresa asociada a tu cuenta no está habilitada.',
        'AUTH_COMPANY_INACTIVE'
      );
    }

    return freezeContext(
      user,
      profileResult.data,
      membership,
      companyResult.data
    );
  }

  async function activate(user){
    if(!user){
      currentContext=null;
      return null;
    }

    currentContext=await loadContext(user);
    clearLegacyAuth();
    return currentContext;
  }

  async function initialize(){
    if(initializePromise)return initializePromise;

    initializePromise=(async()=>{
      await enforceSessionPreference();

      const {data,error}=await getClient().auth.getSession();
      if(error)throw error;

      initialized=true;
      return activate(data.session?.user||null);
    })();

    try{
      return await initializePromise;
    }finally{
      initializePromise=null;
    }
  }

  async function signIn(email,password,options={}){
    setPersistencePreference(options.remember!==false);

    const {data,error}=await getClient().auth.signInWithPassword({
      email,
      password
    });

    if(error)throw error;

    try{
      initialized=true;
      return await activate(data.user);
    }catch(error){
      await getClient().auth.signOut({scope:'local'});
      currentContext=null;
      throw error;
    }
  }

  async function signOut(){
    const {error}=await getClient().auth.signOut({scope:'local'});
    currentContext=null;
    setPersistencePreference(true);
    clearLegacyAuth();
    if(error)throw error;
  }

  function legacyUser(){
    const context=currentContext;
    if(!context)return null;

    return {
      id:context.userId,
      username:context.email,
      email:context.email,
      name:context.displayName,
      role:context.legacyRole,
      active:true
    };
  }

  window.AuthContext=Object.freeze({
    get:()=>currentContext,
    isReady:()=>initialized,
    hasCompany:()=>Boolean(currentContext?.companyId)
  });

  window.ShiftControlAuth=Object.freeze({
    getClient,
    initialize,
    signIn,
    signOut,
    legacyUser
  });
})();
