/* FUTPRO — arranque */
(function () {
  'use strict';
  function boot() {
    try { FP.Start.menu(); }
    catch (e) { console.error(e); document.getElementById('app').innerHTML = '<pre style="padding:1rem;color:#f87171;white-space:pre-wrap">' + String(e.stack || e) + '</pre>'; }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  // guarda al cerrar la pestaña (mejor esfuerzo)
  window.addEventListener('beforeunload', function () { try { if (FP.S && FP.S.hero) FP.Store.save(); } catch (e) { } });
})();
