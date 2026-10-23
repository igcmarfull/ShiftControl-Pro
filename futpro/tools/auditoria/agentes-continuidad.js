/* Continuidad de la búsqueda del representante: gestiones repartidas (antes) frente a lista de objetivos (ahora). Uso: node tools/auditoria/agentes-continuidad.js */
var H = require(require('path').join(__dirname,'..','..','tests','harness.js')), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var S = H.restore(H.buildWorld(777)), h = FP.Game.startPreset(), M = FP.Market, Rep = FP.Rep, D = FP.Date, U = FP.U, A = FP.Agents, K = FP.Contracts;
var cl = S.clubs.filter(function (c) { return c.lg === 'CHI1'; }).sort(function (a, b) { return a.st - b.st; }), club = cl[Math.floor(cl.length / 2)];
setAge(23); h.bd = [2003, 5, 15]; h.nat = 'CHI'; S.pl[0].nat = 'CHI'; h.pos = 'ST'; h.tk = 'amat'; h.club = null;
function setOvr(target) { var x = target; for (var k = 0; k < 40; k++) { FP.Core.ATTRS.forEach(function (a) { h.at[a] = x; h.cap[a] = 95; }); h.pot = target + 6; S.pl[0].pt = h.pot; FP.Hero.updateOvr(); if (Math.abs(h.ovr - target) <= 1) break; x += h.ovr < target ? 1 : -1; } }
setOvr(70);
var o = M.addOffer({ type: 'pro', club: club.id, years: 3, wage: 40, role: 'Titular', text: 'x', exp: S.week + 20 }); M.respond(o.id, true);
for (var i = 0; i < 10; i++) { FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h); FP.Dec.open().forEach(function (d) { FP.Dec.resolve(d.id, d.opts[0].k); }); }
function setAge(n) { h.b = Math.round(S.week - (n + 0.4) * 52.1775); S.pl[0].b = h.b; }
var cur = S.clubs[h.club], cc = 'CHI', L = A.ensure().list, lgt = function (c) { return FP.LGDEF[c.lg].t; };
function agent(kind, nat) { return L.filter(function (a) { return a.kind === kind && (!nat || a.nat === nat); })[0]; }
var engLow = agent('lowerdiv', 'ENG'), elite = agent('elite'), loc = agent('local', 'CHI');
function hire(a) { h.agent = a ? { nm: a.nm, lvl: a.lvl, com: a.com, id: a.id, since: S.week } : null; if (a && h.agb) { h.agb.dest = null; h.agb.prio = null; h.agb.loan = 0; } }

function setAge(n) { h.b = Math.round(S.week - (n + 0.4) * 52.1775); S.pl[0].b = h.b; }
h.tk = 'pro'; h.club = cur.id; h.team = cur.id; var CB = A.CFG.brief, RUNS = +process.env.RUNS || 60;
function season(ovr, arm, r) {
  setAge(23); setOvr(ovr); h.rep.int = 45; var w0 = S.week; S.rs = 5000 + r * 7;
  h.agb = null; hire(arm === 'none' ? null : engLow); if (arm !== 'none') { CB.maxTargets = arm === 'objetivos' ? 3 : 0; A.setBrief('liga:ENG3', 'titular'); }
  h.int = []; h.cd = {}; h.offers = []; var maxV = 0, reach = 0, oe = 0, ot = 0, oAny = 0;
  for (var k = 0; k < 52; k++) {
    S.week++; Rep.scoutWeek(S.week); A.weekly(); if (U.R() < 0.2) Rep.spark({ played: true, rating: 8.5, g: 2 }); Rep.weekly();
    var best = 0; h.int.forEach(function (e) { var c = S.clubs[e.c]; if (c.lg === 'ENG3' && e.v > best) best = e.v; }); if (best > maxV) maxV = best; if (best >= 38) reach = 1;
    if (k >= 12 && k % 2 === 0) { h.contract = { wage: 40, endW: S.week + 80, role: 'Titular' }; h.offers = []; Rep.offers(false, 3); var os = h.offers.filter(function (x) { return x.club != null; }); ot += os.length; var e2 = os.filter(function (x) { return S.clubs[x.club].lg === 'ENG3'; }).length; oe += e2; if (e2) oAny = 1; }
  }
  S.week = w0; return { maxV: maxV, reach: reach, oe: oe, ot: ot, oAny: oAny, gest: h.agb ? h.agb.hist.length : 0 };
}
[55, 70, 85].forEach(function (ovr) {
  ['none', 'legacy', 'objetivos'].forEach(function (arm) {
    var m = { maxV: 0, reach: 0, oe: 0, ot: 0, oAny: 0, gest: 0 };
    for (var r = 0; r < RUNS; r++) { var x = season(ovr, arm, r); Object.keys(m).forEach(function (k) { m[k] += x[k]; }); }
    console.log('nivel ' + ovr + ' ' + (arm + '          ').slice(0, 10) + '| interés máximo en la 3.ª inglesa ' + (m.maxV / RUNS).toFixed(1) + ' | temporadas con algún club de la 3.ª inglesa ≥ 38: ' + Math.round(m.reach / RUNS * 100) + ' % | ofertas de la 3.ª inglesa por temporada ' + (m.oe / RUNS).toFixed(2) + ' (' + Math.round(m.oAny / RUNS * 100) + ' % de temporadas) | ofertas totales ' + (m.ot / RUNS).toFixed(2) + ' | gestiones ' + (m.gest / RUNS).toFixed(1));
  });
});
process.exit(0);
