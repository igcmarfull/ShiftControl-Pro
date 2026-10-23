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
h.tk = 'pro'; h.club = cur.id; h.team = cur.id; var CB = A.CFG.brief, RUNS = +process.env.RUNS || 60; if (process.env.CFG) Object.assign(CB, JSON.parse(process.env.CFG)); var LV = (process.env.LEVELS || '55,70,85').split(',').map(Number), ARMS = (process.env.ARMS || 'none,legacy,objetivos').split(','), TAG = process.env.TAG || '';

CB.maxTargets = 3; setAge(23); setOvr(70); h.rep.int = 45; var w0 = S.week; S.rs = 5000;
for (var run = 0; run < 3; run++) {
  S.rs = 5000 + run * 7; h.agb = null; hire(engLow); A.setBrief('liga:ENG3', 'titular'); h.int = []; h.cd = {}; h.offers = [];
  console.log('--- temporada ' + (run + 1));
  for (var k = 0; k < 52; k++) {
    S.week++; Rep.scoutWeek(S.week); var n0 = h.agb.log.length; A.weekly(); h.int.forEach(function (e) { e.v -= A.decay(e.c); }); h.int = h.int.filter(function (e) { return e.v >= 5; });       // solo el enfriamiento del interés: la reputación se mantiene fija
    if (h.agb.log.length > n0) { var tg = (h.agb.tg || []).map(function (t) { return S.clubs[t.c].nm + ' v=' + Math.round(Rep.interestOf(t.c)) + ' push=' + t.push; }).join(', '); console.log('sem ' + k + ': ' + h.agb.log[0].t + '  [objetivos: ' + tg + ']'); }
  }
  S.week = w0;
}
process.exit(0);
