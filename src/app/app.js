(function(){

async function initApp(){

  console.log("[ShiftControl] Iniciando plataforma...");

  if(window.ShiftControlStorage){
    await window.ShiftControlStorage.bootstrap();
  }

  if(window.ShiftControlState){
    window.ShiftControlState.syncLegacyState();
  }

  if(window.migrateLegacyCashShortages){
    await window.migrateLegacyCashShortages();
  }

  if(window.migrateLegacyIncidents){
    await window.migrateLegacyIncidents();
  }

  if(window.migrateLegacyEvaluations){
    await window.migrateLegacyEvaluations();
  }

  if(window.migrateLegacyChecklists){
    await window.migrateLegacyChecklists();
  }

  if(window.migrateLegacyFinanceReconciliations){
    await window.migrateLegacyFinanceReconciliations();
  }

  if(window.migrateLegacyFinanceExpenses){
    await window.migrateLegacyFinanceExpenses();
  }

  if(window.migrateLegacyDeposits){
    await window.migrateLegacyDeposits();
  }

  if(window.AppState){
    AppState.initialized = true;
  }

  console.log("[ShiftControl] Aplicación inicializada.");

}

window.initApp = initApp;

})();
