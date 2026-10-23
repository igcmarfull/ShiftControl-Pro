/* Mapa de oportunidades: en qué etapa se cierran los clubes de cada país para un jugador y qué cambia un representante. Uso: node tools/auditoria/agentes-mapa.js */
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
h.tk = 'pro'; h.club = cur.id; h.team = cur.id; setAge(21);
var cn = FP.DATA.countries;
function mapa(ovr, intv, agentObj) {
  setOvr(ovr); h.rep.int = intv; h.agent = agentObj ? { nm: agentObj.nm, lvl: agentObj.lvl, com: agentObj.com, id: agentObj.id } : null; var age = FP.Hero.age(), by = {};
  S.clubs.forEach(function (c) { if (c === cur) return; var o = by[c.c] || (by[c.c] = { n: 0, vis: 0, ok: 0, fit: 0 }); o.n++; if (!Rep.exposure(c).ok) return; o.vis++; if (!Rep.foreignOK(c, h.nat, age) || !Rep.permit(c)) return; o.ok++; var f = Rep.fit(c); if (f.kind !== 'none' && f.ok) o.fit++; });
  return by;
}
function tot(by, k) { return Object.keys(by).reduce(function (a, c) { return a + by[c][k]; }, 0); }
(process.env.CASOS ? JSON.parse(process.env.CASOS) : [[58, 25], [58, 45], [70, 25], [70, 45]]).forEach(function (p) {
  var base = mapa(p[0], p[1], null), n = tot(base, 'n');
  console.log('\n=== jugador chileno de 21 años, nivel ' + h.ovr + ', reputación internacional ' + p[1] + ' (sin representante) ===');
  console.log('clubes del mundo ' + n + ' → que lo conocen (visibilidad) ' + tot(base, 'vis') + ' → que pueden ficharlo (cupos, edad, permiso) ' + tot(base, 'ok') + ' → que además encajan deportivamente ' + tot(base, 'fit'));
  var rows = Object.keys(base).filter(function (c) { return base[c].fit > 0; }).sort(function (a, b) { return base[b].fit - base[a].fit; });
  console.log('países con al menos un club posible: ' + rows.length + ' de ' + Object.keys(base).length + ' | ' + rows.slice(0, 12).map(function (c) { return cn[c].n + ' ' + base[c].fit; }).join(', '));
  var closedBy = { vis: 0, perm: 0, fit: 0 }; Object.keys(base).forEach(function (c) { closedBy.vis += base[c].n - base[c].vis; closedBy.perm += base[c].vis - base[c].ok; closedBy.fit += base[c].ok - base[c].fit; });
  console.log('clubes cerrados por: no lo conocen ' + closedBy.vis + ' | cupos/edad/permiso ' + closedBy.perm + ' | no encaja deportivamente ' + closedBy.fit);
  var withAg = {}; ['lowerdiv', 'local', 'elite'].forEach(function (kind) { L.filter(function (a) { return a.kind === kind; }).forEach(function (a) { var m = mapa(p[0], p[1], a); var d = tot(m, 'fit') - tot(base, 'fit'); if (!withAg[kind]) withAg[kind] = []; withAg[kind].push(d); }); });
  console.log('clubes posibles que añade un representante (solo visibilidad): ' + Object.keys(withAg).map(function (k) { var v = withAg[k].sort(function (a, b) { return a - b; }); return k + ' mediana ' + v[Math.floor(v.length / 2)] + ' máx ' + v[v.length - 1]; }).join(' | '));
});
process.exit(0);
