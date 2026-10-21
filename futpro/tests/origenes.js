/* Pruebas del origen de los extranjeros (js/origenes.js). Uso: node tests/origenes.js */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
[555, 777].forEach(function (seed) {
  var S = H.restore(H.buildWorld(seed)), C = FP.NATBY;
  function foreign(lg) { var cnt = {}, n = 0, f = 0; S.clubs.filter(function (c) { return c.lg === lg; }).forEach(function (c) { (S.ro[c.id] || []).forEach(function (p) { n++; if (p.nat !== c.c) { f++; cnt[p.nat] = (cnt[p.nat] || 0) + 1; } }); }); return { n: n, f: f, cnt: cnt }; }
  var chi = foreign('CHI1'), sa = 0; Object.keys(chi.cnt).forEach(function (k) { if (C[k].conf === 'CONMEBOL') sa += chi.cnt[k]; });
  t('seed ' + seed + ': en Chile la mayoría de los extranjeros es sudamericana (' + sa + ' de ' + chi.f + ')', sa >= chi.f * 0.7, JSON.stringify(chi.cnt));
  t('seed ' + seed + ': en Chile hay pocos extranjeros de fuera del continente', Object.keys(chi.cnt).filter(function (k) { return C[k].conf !== 'CONMEBOL'; }).reduce(function (a, k) { return a + chi.cnt[k]; }, 0) <= chi.f * 0.25);
  t('seed ' + seed + ': ni Estados Unidos ni Burkina Faso aparecen entre los extranjeros de Colo-Colo', (function () { var c = S.clubs.filter(function (x) { return x.nm === 'Colo-Colo'; })[0]; return (S.ro[c.id] || []).every(function (p) { return p.nat !== 'BFA' && p.nat !== 'USA'; }); })());
  var usa = foreign('USA1'); t('seed ' + seed + ': en la MLS predominan México y Canadá', (usa.cnt.MEX || 0) + (usa.cnt.CAN || 0) > usa.f * 0.25);
  var eng = foreign('ENG1'); t('seed ' + seed + ': la Premier sigue siendo la más abierta (>30 % de extranjeros)', eng.f / eng.n > 0.3, eng.f / eng.n);
  var chiShare = chi.f / chi.n; t('seed ' + seed + ': la proporción de extranjeros en Chile se mantiene (8–20 %)', chiShare > 0.08 && chiShare < 0.2, chiShare);
});
console.log('ok', ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
