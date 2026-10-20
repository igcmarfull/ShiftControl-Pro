/* Pruebas de la biografía. Uso: node tests/bio.js */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var snap = H.buildWorld(555), S = H.restore(snap), h = FP.Game.startPreset();
var d0 = FP.Bio.build(); t('esbozo al inicio', d0.grade[0] === 'Esbozo' && d0.lead.length > 20 && d0.lock.length >= 4, d0.grade);
for (var i = 0; i < 52 * 9; i++) { if (i === 40) { Object.keys(h.at).forEach(function (a) { h.at[a] = Math.min(80, h.at[a] + 12); h.cap[a] = 95; }); h.pot = 90; FP.Hero.updateOvr(); } FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h); FP.Dec.open().forEach(function (d) { FP.Dec.resolve(d.id, d.opts[0].k); });
  if (i % 60 === 0) { var d = FP.Bio.build(); t('construye en la semana ' + i, d.secs.length >= 2 && d.lead.length > 10); } }
var d = FP.Bio.build();
t('hay trayectoria', d.secs.some(function (s) { return s.id === 'trayectoria' && s.sub.length >= 2; }));
t('hay selección nacional', d.secs.some(function (s) { return s.id === 'seleccion'; }));
t('hitos registrados durante el juego', h.bio.ev.length >= 3, h.bio.ev.length);
t('crece frente al inicio', d.secs.length > d0.secs.length);
t('sin html sin escapar en el título', d.secs.every(function (s) { return s.t.indexOf('<') < 0; }));
// retiro
h.retired = true; h.retiredAge = FP.Hero.age(); h.retiredW = FP.S.week; var dr = FP.Bio.build();
t('sección de retiro', dr.secs.some(function (s) { return s.id === 'retiro'; }) && !dr.lock.some(function (l) { return l[0] === 'Retiro'; }));
console.log('ok', ok, 'fallas', bad, d.grade[0], d.secs.length + ' secciones');
process.exit(bad ? 1 : 0);
