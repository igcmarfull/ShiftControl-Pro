/* Pruebas de convocatorias al primer equipo (juveniles). Uso: node tests/callups.js */
var H = require('./harness.js'), FP = H.FP, M = FP.Market, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var snap = H.buildWorld(4242);
function run(label, target, seasons) {
  var S = H.restore(snap);
  var c = S.clubs.filter(function (c) { return FP.LGDEF[c.lg].t === 1 && c.c === 'CHI'; })[1];
  var h = FP.Game.startCareer({ nm: 'Zz', nat: 'CHI', city: '', age: 15, h: 172, kg: 62, pos: 'CM', foot: 'R', style: 'tecnico', extra: { pas: 12, con: 12, vis: 8 }, ovrTarget: target, club: { kind: 'academy', id: c.id } });
  var stints = 0, pendFirst = 0, firstAp = 0, prevOn = 0, maxExtra = 0;
  for (var i = 0; i < 52 * seasons && !h.retired && h.tk === 'academy'; i++) {
    if (i === 0) console.log(label, 'ovr', h.ovr, 'club.st', FP.S.clubs[h.club].st, 'd', FP.Callup.standing().d.toFixed(1));
    FP.Game.beginWeek();
    var q = FP.S.pending.slice(); q.forEach(function (it) { var cm = FP.S.comps[it.c], f = cm && cm.fx[it.i]; if (f && (f.h === h.club || f.a === h.club)) pendFirst++; });
    var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending();
    FP.Game.endWeek();
    maxExtra = Math.max(maxExtra, (h.extraTeams || []).length);
    if (h.cu && h.cu.on && !prevOn) stints++; prevOn = h.cu && h.cu.on;
    H.respond(h); FP.Dec.open().forEach(function (d) { FP.Dec.resolve(d.id, d.opts[0].k); });
  }
  var cu = h.cu || {};
  console.log(label, 'edad', FP.Hero.age(), 'tk', h.tk, 'ovr', h.ovr, 'citaciones', cu.n, 'partidos 1er equipo', cu.ap, 'min', cu.min, 'debut', cu.debut ? cu.debut.w : '-', 'pendientes', pendFirst);
  return { h: h, cu: cu, stints: stints, pendFirst: pendFirst, maxExtra: maxExtra };
}
var avg = run('promedio', 50, 3), star = run('destacado', 68, 3);
t('el juvenil promedio casi no es citado', avg.cu.n <= 3, avg.cu.n);
t('el destacado es citado alguna vez', star.cu.n >= 1, star.cu.n);
t('citado entra en partidos del primer equipo', star.pendFirst >= 1, star.pendFirst);
console.log('ok', ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
