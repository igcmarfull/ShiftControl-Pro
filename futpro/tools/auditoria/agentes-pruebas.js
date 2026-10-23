/* Tasa de invitaciones a pruebas internacionales según los contactos del agente. Uso: node tools/auditoria/agentes-pruebas.js */
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
var T = FP.Tryouts, C4 = A.CFG.trip, W0 = S.week, K = FP.Contracts;
function reset(tk) { h.agb = null; h.ty = null; T.ensure(); h.cd = {}; h.offers = []; setAge(23); h.tk = tk || 'free'; if (h.tk === 'free') { h.club = null; h.contract = null; } else { h.club = cur.id; h.team = cur.id; h.contract = { wage: 40, endW: S.week + 80, role: 'Titular' }; } h.mor = 60; h.fat = 20; h.inj = null; h.money = 500; }
setOvr(60); reset('free'); hire(engLow);
var opts = A.tripOptions(), cc = (opts.filter(function (o) { return o.c === 'ENG' && o.n >= 3; })[0] || opts.filter(function (o) { return o.n >= 3; })[0]).c, clubsCC = T.tripClubs(cc).filter(function (o) { return o.ok; });
console.log('país de prueba: ' + cc + ', clubes posibles ' + clubsCC.length + ' | opciones del agente: ' + opts.slice(0, 5).map(function (o) { return o.name + ' ' + o.n + ' (contacto ' + o.contact.toFixed(2) + ')'; }).join(', '));

var out = [];
[['con contactos (' + engLow.nm.replace(' (agente)', '') + ', especialista inglés)', engLow], ['sin contactos en esos países (generalista de Chile)', agent('local', 'CHI')], ['sin representante efectivo (nivel 1 de otro país)', agent('lowerdiv', 'JPN') || agent('local', 'JPN')]].forEach(function (par) {
  var rows = [];
  [['ENG', 'Inglaterra'], ['BRA', 'Brasil'], ['POR', 'Portugal'], ['ARG', 'Argentina']].forEach(function (cp) {
    reset('free'); hire(par[1]); var cl = T.tripClubs(cp[0]).filter(function (o) { return o.ok; }).slice(0, 3); if (cl.length < 2) return;
    var acc = 0, tot = 0, pm = 0; cl.forEach(function (o) { pm += A.inviteChance(o.c); }); pm /= cl.length;
    for (var i = 0; i < 400; i++) { reset('free'); hire(par[1]); S.rs = 7000 + i * 11; if (!A.requestTrip(cp[0], cl.map(function (o) { return o.c.id; })).ok) continue; S.week += C4.reply; A.tripWeekly(); acc += h.agb.tr && h.agb.tr.acc ? h.agb.tr.acc.length : 0; tot += cl.length; S.week -= C4.reply; }
    rows.push(cp[1] + ' ' + Math.round(acc / Math.max(tot, 1) * 100) + ' % (probabilidad media ' + pm.toFixed(2) + ')');
  });
  console.log(par[0] + ': ' + rows.join(' | '));
});
process.exit(0);
