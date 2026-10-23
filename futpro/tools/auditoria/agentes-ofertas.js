/* Representantes, fase 2: contactos que moderan la visibilidad y el seguimiento (js/agentes.js: Agents.strength/visibility/pullBoost; js/scouting.js: Rep.exposure y Rep.pull).
   Uso: node tests/agentes2.js   (≈ 4 minutos). Jugadores de nivel 55, 70 y 85, con y sin representante.
   Los límites (6 puntos de reputación, +50 % de peso) son supuestos de diseño. */
var H = require(require('path').join(__dirname,'..','..','tests','harness.js')), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var S = H.restore(H.buildWorld(777)), h = FP.Game.startPreset(), M = FP.Market, Rep = FP.Rep, D = FP.Date, U = FP.U, A = FP.Agents, K = FP.Contracts;
var cl = S.clubs.filter(function (c) { return c.lg === 'CHI1'; }).sort(function (a, b) { return a.st - b.st; }), club = cl[Math.floor(cl.length / 2)];
h.b = D.of(2026 - 23, 5, 15); S.pl[0].b = h.b; h.bd = [2003, 5, 15]; h.nat = 'CHI'; S.pl[0].nat = 'CHI'; h.pos = 'ST'; h.tk = 'amat'; h.club = null;
function setOvr(target) { var x = target; for (var k = 0; k < 40; k++) { FP.Core.ATTRS.forEach(function (a) { h.at[a] = x; h.cap[a] = 95; }); h.pot = target + 6; S.pl[0].pt = h.pot; FP.Hero.updateOvr(); if (Math.abs(h.ovr - target) <= 1) break; x += h.ovr < target ? 1 : -1; } }
setOvr(70);
var o = M.addOffer({ type: 'pro', club: club.id, years: 3, wage: 40, role: 'Titular', text: 'x', exp: S.week + 20 }); M.respond(o.id, true);
for (var i = 0; i < 10; i++) { FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h); FP.Dec.open().forEach(function (d) { FP.Dec.resolve(d.id, d.opts[0].k); }); }
var cur = S.clubs[h.club], cc = M.heroCountry(), age = FP.Hero.age(), L = A.ensure().list;
function agent(kind, nat) { return L.filter(function (a) { return a.kind === kind && (!nat || a.nat === nat); })[0]; }
var engLow = agent('lowerdiv', 'ENG'), arg = agent('sudamericano', 'ARG'), elite = agent('elite'), loc = agent('local', 'CHI');
function hire(a) { h.agent = a ? { nm: a.nm, lvl: a.lvl, com: a.com, id: a.id, since: S.week } : null; }
var lgt = function (c) { return FP.LGDEF[c.lg].t; };
var eng4 = S.clubs.filter(function (c) { return c.c === 'ENG' && lgt(c) === 4; })[0], eng1 = S.clubs.filter(function (c) { return c.c === 'ENG' && lgt(c) === 1; })[0], jpn = S.clubs.filter(function (c) { return c.c === 'JPN'; })[0];

var lgt = function (c) { return FP.LGDEF[c.lg].t; };

// ---------- ofertas reales de las divisiones inferiores inglesas con y sin agente ----------
function offersRun(ovr, v, a, runs) {
  setOvr(ovr); hire(a); h.rep.int = v; var eng = 0, tot = 0, wins = 0; h.contract = h.contract || {}; h.contract.endW = S.week + 20;
  for (var r = 0; r < runs; r++) {
    h.int = []; h.cd = {}; h.offers = []; var n = 0;
    while (n++ < 60 && h.int.filter(function (e) { return e.v >= 40; }).length < 4) { Rep.scoutWeek(S.week); if (U.R() < 0.2) Rep.spark({ played: true, rating: 8.5, g: 2 }); }
    K.preOffers(); Rep.offers(false, 3);
    var os = h.offers.filter(function (x) { return x.club != null; }); tot += os.length;
    var e = os.filter(function (x) { var c = S.clubs[x.club]; return c.c === 'ENG' && lgt(c) >= 3; }).length; eng += e; if (e) wins++;
  }
  return { eng: eng / runs, tot: tot / runs, any: wins / runs * 100 };
}
[55, 70, 85].forEach(function (ovr) { [37].forEach(function (v) {
  var a = offersRun(ovr, v, null, 120), b = offersRun(ovr, v, engLow, 120);
  console.log('ofertas nivel ' + ovr + ', reputación ' + v + ': de la 3.ª/4.ª inglesa por temporada — sin agente ' + a.eng.toFixed(2) + ' (' + Math.round(a.any) + ' % de las temporadas) | con agente ' + b.eng.toFixed(2) + ' (' + Math.round(b.any) + ' %) | ofertas totales ' + a.tot.toFixed(2) + ' → ' + b.tot.toFixed(2));
}); });
process.exit(0);
