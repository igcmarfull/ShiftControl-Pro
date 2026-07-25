(function(){

async function initApp(){

  console.log("[ShiftControl] Iniciando plataforma...");

  if(window.ShiftControlStorage){
    await window.ShiftControlStorage.bootstrap();
  }

  AppState.initialized = true;

  console.log("[ShiftControl] Aplicación inicializada.");

}

window.initApp = initApp;

})();
