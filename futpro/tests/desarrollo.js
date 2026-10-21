/* Trayectorias más variadas: maduración temprana/tardía y revisiones de potencial. Uso: node tests/desarrollo.js */
var H = require('./harness.js'), FP = H.FP, U = FP.U, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
H.restore(H.buildWorld(61));
function old(p, age) { var d; if (age <= 21) d = (p.pt - p.o) * (0.30 + U.R() * 0.15) + U.norm() * 0.9; else if (age <= 25) d = (p.pt - p.o) * (0.28 + U.R() * 0.2) + U.norm() * 0.8; else if (age <= 29) d = U.norm() * 0.8 - 0.1; else if (age <= 32) d = -(0.5 + (age - 29) * 0.35) + U.norm() * 0.8; else d = -(1.5 + (age - 32) * 0.5) + U.norm() * 0.9; p.o = U.clamp(Math.round(p.o + d), 25, 96); if (age <= 24) p.pt = Math.max(p.o, Math.min(97, p.pt + Math.round(U.norm() * 0.8))); else p.pt = p.o; }
function run(fn, N) {
  var out = [];
  for (var i = 0; i < N; i++) {
    var p = FP.Youth.makePros('CHI', 13), o0 = p.o, pt0 = p.pt, o20 = null, o23 = null; delete p.dv;
    for (var age = 13; age <= 30; age++) { fn(p, age); if (age === 19) o20 = p.o; if (age === 22) o23 = p.o; }
    out.push({ o0: o0, pt0: pt0, o19: o20, o22: o23, fin: p.o, peak: p.o });
  }
  return out;
}
function mean(a, f) { return a.reduce(function (s, x) { return s + f(x); }, 0) / a.length; }
function sd(a, f) { var m = mean(a, f); return Math.sqrt(mean(a, function (x) { return Math.pow(f(x) - m, 2); })); }
if (process.argv[2]) Object.assign(FP.Sim.REV, JSON.parse(process.argv[2]));
var N = 3000, A = run(old, N), B = run(FP.Sim.progressPlayer, N);
function rel(x) { return x.fin - x.pt0; }
console.log('final-pt0 media: antes', mean(A, rel).toFixed(2), 'ahora', mean(B, rel).toFixed(2), '| sd: antes', sd(A, rel).toFixed(2), 'ahora', sd(B, rel).toFixed(2));
var late = function (x) { return x.o22 - x.o19; };
console.log('ganancia 19→22: media antes', mean(A, late).toFixed(2), 'ahora', mean(B, late).toFixed(2), '| sd antes', sd(A, late).toFixed(2), 'ahora', sd(B, late).toFixed(2));
var lateShare = B.filter(function (x) { return x.o22 - x.o19 >= 4; }).length / N, lateOld = A.filter(function (x) { return x.o22 - x.o19 >= 4; }).length / N;
console.log('tardíos (+4 entre 19 y 22): antes', (lateOld * 100).toFixed(1) + '%', 'ahora', (lateShare * 100).toFixed(1) + '%');
var surp = B.filter(function (x) { return x.fin - x.pt0 >= 6; }).length / N, bust = B.filter(function (x) { return x.fin - x.pt0 <= -8; }).length / N;
console.log('superan el potencial inicial en 6+:', (surp * 100).toFixed(1) + '%', '| quedan 8+ por debajo:', (bust * 100).toFixed(1) + '%', '(antes', (A.filter(function (x) { return x.fin - x.pt0 >= 6; }).length / N * 100).toFixed(1) + '% /', (A.filter(function (x) { return x.fin - x.pt0 <= -8; }).length / N * 100).toFixed(1) + '%)');
t('la media final no cambia (±1,0)', Math.abs(mean(B, rel) - mean(A, rel)) <= 1.0, [mean(A, rel), mean(B, rel)]);
t('más dispersión del resultado (≥ +25%)', sd(B, rel) >= sd(A, rel) * 1.25, [sd(A, rel), sd(B, rel)]);
t('hay maduradores tardíos (5-25%)', lateShare >= 0.05 && lateShare <= 0.25, lateShare);
t('más tardíos que antes', lateShare > lateOld);
t('los niveles siguen en rango', B.every(function (x) { return x.fin >= 25 && x.fin <= 96; }));
// jugador del usuario
var h = FP.Game.startPreset(); t('el jugador tiene perfil de desarrollo', h.dv != null && h.dv >= -2 && h.dv <= 3, h.dv);
var up = 0, down = 0; for (var k = 0; k < 400; k++) { h.pot = 70; h.ovr = 55; var before = h.pot; FP.Desarrollo.review(); if (h.pot > before) up++; else if (h.pot < before) down++; }
console.log('revisiones del jugador en 400 intentos: alzas', up, 'bajas', down);
t('revisiones con frecuencia razonable', up / 400 >= 0.02 && up / 400 <= 0.09 && down / 400 >= 0.03 && down / 400 <= 0.12, [up, down]);
console.log('ok', ok, 'fallas', bad); process.exit(bad ? 1 : 0);
