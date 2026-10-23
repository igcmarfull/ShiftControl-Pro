/* Representantes, fase 2: contactos que moderan la visibilidad y el seguimiento (js/agentes.js: Agents.strength/visibility/pullBoost; js/scouting.js: Rep.exposure y Rep.pull).
   Uso: node tests/agentes2.js   (≈ 4 minutos). Jugadores de nivel 55, 70 y 85, con y sin representante.
   Los límites (6 puntos de reputación, +50 % de peso) son supuestos de diseño. */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
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

// ---------- 1) contactos por país y división ----------
hire(null);
t('sin representante la visibilidad no cambia', S.clubs.every(function (c) { return A.visibility(c) === 0 && A.pullBoost(c) === 1; }));
var base = {}; S.clubs.forEach(function (c) { base[c.id] = Rep.exposure(c).need; });
hire(engLow);
console.log('especialista de divisiones inferiores inglesas (nivel ' + engLow.lvl + '): League Two −' + A.visibility(eng4).toFixed(2) + ' | Premier −' + A.visibility(eng1).toFixed(2) + ' | Japón −' + A.visibility(jpn).toFixed(2));
t('el especialista de League Two influye mucho más en la 4.ª división inglesa que en la Premier', A.visibility(eng4) > 3 * A.visibility(eng1) && A.visibility(eng4) > 2);
t('no influye en países donde no tiene contactos (sin prohibirlos)', A.visibility(jpn) === 0 && Rep.exposure(jpn).need === base[jpn.id]);
var maxV = 0; L.forEach(function (a) { h.agent = { id: a.id, lvl: a.lvl, com: a.com, nm: a.nm }; S.clubs.forEach(function (c) { var v = A.visibility(c); if (v > maxV) maxV = v; if (v < 0) maxV = 99; }); });
t('ningún agente baja el requisito de ningún club más de 6 puntos (máximo ' + maxV.toFixed(2) + ')', maxV <= 6 + 1e-9);
hire(engLow);
t('el requisito de cada club baja como máximo 6 puntos y nunca sube', S.clubs.every(function (c) { var d = base[c.id] - Rep.exposure(c).need; return d >= -1e-9 && d <= 6 + 1e-9; }));
var peso = Math.max.apply(null, S.clubs.map(function (c) { return A.pullBoost(c); }));
t('el peso de seguimiento sube como máximo un 50 % (' + peso.toFixed(2) + ')', peso <= 1.5 + 1e-9 && peso > 1.1);
hire(elite); var elite1 = S.clubs.filter(function (c) { return c.c === 'ENG' && lgt(c) === 1; })[0], elite4 = eng4;
t('el agente de élite influye más en la Premier que en la 4.ª división', A.visibility(elite1) > 3 * A.visibility(elite4));
// la calidad del agente importa un poco
var lvl1 = L.filter(function (a) { return a.kind === 'local' && a.lvl === 1; })[0], lvl4 = L.filter(function (a) { return a.kind === 'local' && a.lvl >= 3; })[0];

// ---------- 2) las reglas deportivas no se tocan ----------
hire(null); var fits0 = S.clubs.map(function (c) { var f = Rep.fit(c); return f.kind + ':' + f.ok + ':' + f.gap; });
hire(engLow); var fits1 = S.clubs.map(function (c) { var f = Rep.fit(c); return f.kind + ':' + f.ok + ':' + f.gap; });
t('Rep.fit es idéntico con y sin representante', JSON.stringify(fits0) === JSON.stringify(fits1));
t('Rep.PULL.domestic sigue en 0,10 y la puerta de nivel no cambia', Rep.PULL.domestic === 0.10 && Rep.PULL.lowerStar === 0.05 && Rep.PULL.lowerBase === 0.12 && Rep.PULL.lowerWant === 0.55);
var w0 = (hire(null), Rep.wage(club, 1)); hire(engLow); var w1 = Rep.wage(club, 1);
t('el sueldo ofrecido depende del nivel del agente como antes (no de sus contactos)', Math.abs(w1 / w0 - (1 + engLow.lvl * 0.05)) < 0.06, [w0, w1]);

// ---------- 3) visibilidad para jugadores de nivel 55, 70 y 85 ----------
function visible() { return S.clubs.filter(function (c) { if (c === cur || !Rep.exposure(c).ok || !Rep.foreignOK(c, h.nat, age) || !Rep.permit(c)) return false; var f = Rep.fit(c); return f.kind !== 'none' && f.ok; }); }
var rows = [];
[55, 70, 85].forEach(function (ovr) {
  setOvr(ovr);
  [30, 35, 37, 40, 45].forEach(function (v) {
    h.rep.int = v; hire(null); var v0 = visible(), s0 = {}; v0.forEach(function (c) { s0[c.id] = 1; });
    hire(engLow); var v1 = visible(); var extra = v1.filter(function (c) { return !s0[c.id]; });
    h.rep.int = v + 6; hire(null); var v6 = visible(), s6 = {}; v6.forEach(function (c) { s6[c.id] = 1; });
    var contacted = extra.every(function (c) { return c.c === 'ENG'; }), subset = v1.every(function (c) { return s6[c.id]; });
    h.rep.int = v; hire(null);
    rows.push({ ovr: ovr, v: v, n0: v0.length, n1: v1.length, extra: extra.length, eng: extra.filter(function (c) { return lgt(c) >= 3; }).length, contacted: contacted, subset: subset });
    console.log('nivel ' + h.ovr + ', reputación ' + v + ': clubes visibles sin agente ' + v0.length + ' | con agente inglés ' + v1.length + ' (+' + extra.length + ', de ellos divisiones 3-4: ' + extra.filter(function (c) { return lgt(c) >= 3; }).length + ')');
    t('nivel ' + ovr + ' rep. ' + v + ': los clubes nuevos pertenecen solo a países con contactos', contacted);
    t('nivel ' + ovr + ' rep. ' + v + ': nunca ve más que con 6 puntos más de reputación (sin salto adicional)', subset);
    t('nivel ' + ovr + ' rep. ' + v + ': el agente no reduce la visibilidad', v1.length >= v0.length);
  });
});
var step0 = rows.filter(function (r) { return r.ovr === 70 && r.v === 40; })[0].n0 - rows.filter(function (r) { return r.ovr === 70 && r.v === 35; })[0].n0, step1 = rows.filter(function (r) { return r.ovr === 70 && r.v === 40; })[0].n1 - rows.filter(function (r) { return r.ovr === 70 && r.v === 35; })[0].n1;
console.log('salto de clubes visibles entre reputación 35 y 40 (nivel 70): sin agente +' + step0 + ' | con agente inglés +' + step1);
t('el agente no amplifica el salto conocido entre reputación 35 y 40 (+' + step0 + ' frente a +' + step1 + ')', step1 <= step0 * 1.15 + 3);

// ---------- 4) seguimiento de ojeadores ----------
function interest(ovr, v, a, runs) {
  setOvr(ovr); hire(a); h.rep.int = v; var all = 0, eng = 0, tot = 0, withAny = 0; h.contract = h.contract || {};
  for (var r = 0; r < runs; r++) {
    h.int = []; h.cd = {};
    for (var w = 0; w < 40; w++) { Rep.scoutWeek(S.week); if (U.R() < 0.2) Rep.spark({ played: true, rating: 8.5, g: 2 }); }
    var e = h.int.filter(function (x) { return S.clubs[x.c].c === 'ENG' && lgt(S.clubs[x.c]) >= 3; }).length; eng += e; tot += h.int.length; if (e) withAny++;
  }
  return { eng: eng / runs, tot: tot / runs, any: withAny / runs * 100 };
}
var seg = {};
[55, 70, 85].forEach(function (ovr) { [37, 45].forEach(function (v) {
  var a = interest(ovr, v, null, 40), b = interest(ovr, v, engLow, 40); seg[ovr + '_' + v] = [a, b];
  console.log('seguimiento nivel ' + ovr + ', reputación ' + v + ': clubes ingleses de 3.ª/4.ª división siguiéndolo — sin agente ' + a.eng.toFixed(2) + ' (en ' + Math.round(a.any) + ' % de las temporadas) | con agente ' + b.eng.toFixed(2) + ' (' + Math.round(b.any) + ' %)');
  t('nivel ' + ovr + ' rep. ' + v + ': el agente aumenta o mantiene el seguimiento de los clubes de sus contactos', b.eng >= a.eng - 0.15, [a.eng, b.eng]);
  t('nivel ' + ovr + ' rep. ' + v + ': no hay garantía de interés (no siempre hay clubes ingleses siguiéndolo)', b.any < 100 || ovr === 85, b.any);
  t('nivel ' + ovr + ' rep. ' + v + ': el interés total no se dispara (≤ 1,6 veces el de sin agente)', b.tot <= a.tot * 1.6 + 0.5, [a.tot, b.tot]);
}); });
// ---------- 5) los mercados siguen abiertos sin representante ----------
setOvr(70); hire(null); h.rep.int = 60; var open = 0;
for (var q = 0; q < 20; q++) { h.int = []; h.cd = {}; for (var w2 = 0; w2 < 40; w2++) Rep.scoutWeek(S.week); if (h.int.some(function (x) { return x.v >= 20; })) open++; }
t('sin representante siguen apareciendo clubes interesados (' + open + ' de 20 temporadas)', open >= 15);
t('sin representante hay clubes de otros países que lo siguen', (function () { var n = 0; for (var q = 0; q < 20; q++) { h.int = []; h.cd = {}; for (var w = 0; w < 40; w++) Rep.scoutWeek(S.week); if (h.int.some(function (x) { return S.clubs[x.c].c !== cc; })) n++; } return n >= 12; })());
console.log('ok', ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
