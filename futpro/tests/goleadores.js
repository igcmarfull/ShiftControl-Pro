/* Calibración del reparto de goles de la IA: goleador medio de la liga por calidad de liga. Uso: node tests/goleadores.js
   Referencias aproximadas (de memoria, no datos exactos): ligas top ≈ 21-25 goles, medias ≈ 18-20, resto ≈ 15-18. */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var S = H.restore(H.buildWorld(31)); for (var i = 0; i < 52 * 4; i++) FP.Sim.step();
var tiers = { top: [], mid: [], low: [], bajo: [] }, gpg = [];
Object.keys(S.lgs).forEach(function (id) { var lg = S.lgs[id], d = FP.LGDEF[id]; (lg.hist || []).forEach(function (e) { if (e.sc && e.sc[0]) { var k = d.q >= 70 ? 'top' : d.q >= 60 ? 'mid' : d.q >= 50 ? 'low' : 'bajo'; tiers[k].push(e.sc[0][1]); } }); });
function avg(a) { return a.reduce(function (s, x) { return s + x; }, 0) / Math.max(1, a.length); }
console.log(Object.keys(tiers).map(function (k) { return k + ' ' + avg(tiers[k]).toFixed(1) + ' (n=' + tiers[k].length + ', máx ' + Math.max.apply(null, tiers[k]) + ')'; }).join(' | '));
t('top: goleador medio 18-27', avg(tiers.top) >= 18 && avg(tiers.top) <= 27, avg(tiers.top));
t('medias: 16-24', avg(tiers.mid) >= 16 && avg(tiers.mid) <= 24, avg(tiers.mid));
t('resto: 13-21', avg(tiers.low) >= 13 && avg(tiers.low) <= 21 && avg(tiers.bajo) >= 12 && avg(tiers.bajo) <= 21, [avg(tiers.low), avg(tiers.bajo)]);
t('ninguna liga con más de 45 goles', ['top', 'mid', 'low', 'bajo'].every(function (k) { return Math.max.apply(null, tiers[k].concat([0])) <= 45; }));
t('mejores ligas con goleador mayor que las de menor calidad', avg(tiers.top) > avg(tiers.bajo));
// goles por partido en un conjunto de ligas
var tot = 0, n = 0; Object.keys(S.lgs).slice(0, 40).forEach(function (id) { var c = S.comps[S.lgs[id].cmp]; if (!c || !c.fx) return; c.fx.forEach(function (f) { if (f.d) { tot += f.hs + f.as; n++; } }); });
t('goles por partido entre 2,2 y 3,2', n > 100 && tot / n >= 2.2 && tot / n <= 3.2, tot / n);
console.log('ok', ok, 'fallas', bad); process.exit(bad ? 1 : 0);
