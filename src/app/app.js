(function(){

async function initApp(){

  console.log("[ShiftControl] Iniciando plataforma...");

  if(window.ShiftControlStorage){
    await window.ShiftControlStorage.bootstrap();
  }

  if(window.ShiftControlState){
    window.ShiftControlState.syncLegacyState();
  }

  if(window.AppState){
    AppState.initialized = true;
  }

  console.log("[ShiftControl] Aplicación inicializada.");

}

window.initApp = initApp;

})();
