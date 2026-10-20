/* Comprobaciones de coherencia sobre el mundo y una carrera: node tests/invariants.js [temporadas=6] [semilla=4242]
   Verifica: ningún equipo juega contra sí mismo, las nóminas juveniles respetan edad y nacionalidad,
   no hay pruebas de academia para adultos, el jugador no se convoca fuera de edad, y las estadísticas
   por clase suman lo mismo que su registro de partidos. */
var H = require('./harness.js'), FP = H.FP, D = FP.Date, C = FP.Core;
var seasons = +process.argv[2] || 6, seed = +process.argv[3] || 4242, fails = [];
function bad(msg) { if (fails.length < 40) fails.push(msg); }
var snap = H.buildWorld(seed), S = H.restore(snap);
var prof = { nm: 'Test', nat: 'CHI', city: '', age: 13, h: 170, kg: 60, pos: 'ST', foot: 'R', style: 'killer', extra: { fin: 10, rem: 10, pos: 10 }, club: { kind: 'amat', name: 'Club Test', st: 50 } };
var h = FP.Game.startCareer(prof), weeks = Math.round(seasons * 52.18), minAgeAbs = 99, trialAdult = 0;
for (var wk = 0; wk < weeks && !h.retired; wk++) {
  FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) {
    var prep = FP.Game.nextPending(); if (prep) {
      var cat = prep.comp.cat || (prep.mine >= 5000 && prep.mine < 20000 ? 'ABS' : null), age = FP.Hero.age();
      if (cat) { var lim = { U15: 15, U17: 17, U20: 20, U23: 23, ABS: 99 }[cat]; if (cat === 'U20' && FP.NATBY[h.nat].conf === 'UEFA') lim = 19; if (D.year(S.week) - D.year(h.b) > lim) bad('semana ' + S.week + ': el jugador disputa ' + cat + ' fuera de edad (' + age + ')'); if (cat === 'ABS' && age < 17) bad('ABS con ' + age + ' años'); }
      if (prep.f.h === prep.f.a) bad('partido de un equipo contra sí mismo');
    }
    FP.Game.playPending();
  }
  FP.Game.endWeek(); H.respond(h); H.seekTrials(h);
  h.offers.forEach(function (o) { if (o.type === 'trial' && FP.Hero.age() > 19) trialAdult++; });
  if (isNaN(h.ovr) || h.ovr < 1 || h.ovr > 99) bad('media inválida ' + h.ovr);
}
// 1) autoenfrentamientos en cualquier competición
Object.keys(S.comps).forEach(function (id) { S.comps[id].fx.forEach(function (f) { if (f.h === f.a) bad('autoenfrentamiento en ' + id); }); });
// 2) nóminas
var st = S.nt, nBad = 0, nLists = 0;
Object.keys(st.sq).forEach(function (k) {
  var parts = k.split('|'), natId = +parts[0], cat = parts[1], list = st.sq[k], nat = S.nat[natId - 5000];
  var lim = FP.NT.limitFor(cat, nat), at = list.at;
  list.ids.forEach(function (i) {
    var p = S.pl[i]; if (!p) return; nLists++;
    if (p.nat !== nat.c) { nBad++; bad('nómina ' + k + ': ' + p.n + ' (' + p.nat + ') no es de ' + nat.c); }
    if (cat !== 'ABS' && D.year(at) - D.year(p.b) > lim) { nBad++; bad('nómina ' + k + ': ' + p.n + ' tiene ' + C.age(p, at) + ' años (límite ' + lim + ')'); }
  });
});
// 3) pruebas para adultos
if (trialAdult) bad('se ofrecieron ' + trialAdult + ' pruebas de academia a un jugador mayor de 19');
// 4) estadísticas: clase vs registro
var byClass = FP.Stats.byClass(), ledP = 0, logP = 0;
Object.keys(byClass).forEach(function (k) { ledP += byClass[k].tot.p; });
h.log.forEach(function (m) { if (m.min > 0) logP++; });
if (h.log.length < 400 && ledP !== logP) bad('ledger (' + ledP + ') != log (' + logP + ')');
['u15', 'u17', 'u20', 'u23', 'abs'].forEach(function (k) { if (byClass[k]) byClass[k].rows.forEach(function (r) { if (r.k !== k) bad('fila mal clasificada'); }); });
// 5) club vs selección: h.tot no incluye selecciones
var ntP = 0; ['u15', 'u17', 'u20', 'u23', 'abs'].forEach(function (k) { if (byClass[k]) ntP += byClass[k].tot.p; });
console.log('temporadas', seasons, 'edad final', FP.Hero.age(), h.tk, 'partidos de selección', ntP, 'caps', h.nt.caps, 'listas', nLists, 'ids malos', nBad);
console.log('torneos jugados', S.nt.hist.length, '| selecciones con plantilla', Object.keys(S.nt.sq).length);
if (fails.length) { console.log('FALLAS (' + fails.length + '):'); fails.forEach(function (f) { console.log(' -', f); }); process.exit(1); }
console.log('OK: todas las invariantes se cumplen');
