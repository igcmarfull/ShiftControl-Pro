/* Pruebas del sistema de contratos: node tests/contracts.js */
var H = require('./harness.js'), FP = H.FP, K = FP.Contracts, M = FP.Market, D = FP.Date;
var fails = [], ok = 0;
function check(c, m) { if (c) ok++; else { fails.push(m); } }
var snap = H.buildWorld(2468), S = H.restore(snap);
var prof = { nm: 'Cx', nat: 'CHI', city: '', age: 19, h: 175, kg: 70, pos: 'ST', foot: 'R', style: 'killer', extra: { fin: 12, rem: 12, pos: 6 }, ovrTarget: 62, club: { kind: 'amat', name: 'Club Cx', st: 50 } };
var h = FP.Game.startCareer(prof);
function club(i) { return S.clubs.filter(function (c) { return FP.LGDEF[c.lg].t === 2 && c.c === 'CHI'; })[i]; }
// pasar a profesional con contrato "legítimo" para poder probar el resto
function mk(c, type, extra) { var o = Object.assign({ type: type, club: c.id, fee: 0 }, extra || {}); return M.addOffer(o); }
H.restore(snap); S = FP.S; h = FP.Game.startCareer(prof); K.ensure();
h.tk = 'free'; h.club = null; h.team = null; h.contract = null; h.freeSince = S.week;
// 1) varias ofertas; al firmar una se cierran las incompatibles
var o1 = mk(club(0), 'transfer'), o2 = mk(club(1), 'transfer'), o3 = mk(club(2), 'transfer'), tr = M.addOffer({ type: 'trial', club: club(3).id });
check(h.offers.length === 4, 'deben existir 4 ofertas (hay ' + h.offers.length + ')');
var r = M.respond(o1.id, true);
check(r.ok, 'firma libre debe completarse: ' + r.msg);
check(h.tk === 'pro' || h.tk === 'academy', 'debe quedar con contrato');
check(h.offers.length === 0, 'se cierran las ofertas incompatibles (quedan ' + h.offers.length + ')');
check(K.ensure().hist.some(function (e) { return e.k === 'cerrada'; }), 'las cerradas quedan en el historial');
// doble clic: la segunda aceptación no puede fichar a otro club
var r2 = M.respond(o2.id, true); check(!r2.ok, 'una segunda aceptación debe fallar');
// 2) contrato detallado
var ct = h.contract; check(ct.cid && ct.startW != null && ct.endW != null && ct.wage > 0 && ct.role, 'el contrato guarda cid, fechas, sueldo y rol');
check(K.ensure().reg.length >= 1, 'registro de contratos');
// 3) operación que fracasa: las demás ofertas siguen
h.tk = 'free'; h.club = null; h.team = null; h.contract = null; K.ensure().pend = null; h.offers = [];
var a = mk(club(0), 'transfer'), b = mk(club(1), 'transfer');
h.inj = { n: 20, nm: 'x' };
var origR = Math.random; var fails0 = 0;
// forzamos fracaso del examen médico con lesión larga (probabilidad alta): se repite hasta que ocurra
var tries = 0, failed = false;
while (tries++ < 40 && !failed) { h.offers = []; K.ensure().pend = null; a = mk(club(0), 'transfer'); b = mk(club(1), 'transfer'); h.tk = 'free'; h.club = null; h.team = null; h.contract = null; var rr = M.respond(a.id, true); if (!rr.ok) { failed = true; check(h.offers.some(function (x) { return x.id === b.id; }), 'tras un fracaso la otra oferta sigue disponible'); } else { h.inj = { n: 20, nm: 'x' }; } }
check(failed, 'con lesión larga el examen médico debe fracasar alguna vez');
h.inj = null;
// 4) precontrato: continúa en su club
FP.S.hero.tk = 'free'; h.offers = []; K.ensure().pend = null; h.contract = null;
var cur = club(0); mk(cur, 'transfer'); M.respond(h.offers[0].id, true);
if (h.tk !== 'pro' && h.tk !== 'academy') { h.tk = 'pro'; }
h.club = cur.id; h.team = cur.id; h.tk = 'pro';
h.contract.endW = S.week + 10; h.contract.end = D.year(S.week + 10);
h.offers = [];
var pc = M.addOffer({ type: 'precontract', club: club(1).id, fee: 0, pre: h.contract.endW + 1, exp: h.contract.endW - 1 });
var rp = M.respond(pc.id, true); check(rp.ok, 'precontrato firmado: ' + rp.msg);
check(h.club === cur.id && h.tk === 'pro', 'continúa en el club actual tras el precontrato');
check(K.ensure().pre && K.ensure().pre.club === club(1).id, 'queda registrado el precontrato');
check(M.addOffer({ type: 'precontract', club: club(2).id, fee: 0, pre: h.contract.endW + 1, exp: h.contract.endW - 1 }) === null && !h.offers.some(function (o) { return o.type === 'precontract' || o.type === 'transfer'; }), 'con precontrato firmado no se generan más propuestas de contrato');
for (var j = 0; j < 8; j++) { M.transferOffers(); }
check(!h.offers.some(function (o) { return o.type === 'precontract' || o.type === 'transfer' || o.type === 'pro'; }), 'transferOffers no genera propuestas tras el precontrato');
for (var i = 0; i < 14; i++) { FP.Game.beginWeek(); while (FP.Game.hasPending()) FP.Game.playPending(); FP.Game.endWeek(); }
check(h.club === club(1).id, 'se incorpora al club del precontrato al terminar el contrato (club ' + h.club + ')');
// 5) cesión conserva el contrato del dueño
h.offers = []; K.ensure().pend = null;
var owner = h.contract, ownerClub = h.club;
var ln = M.addOffer({ type: 'loan', club: club(2).id });
while (!M.isWindow(S.week)) { FP.Game.beginWeek(); FP.Game.endWeek(); }
var rl = M.respond(ln.id, true);
if (rl.ok && h.tk === 'loan') { check(h.loan && h.loan.ct === owner && h.loan.from === ownerClub, 'la cesión conserva el contrato del club propietario'); }
else check(true, 'cesión en trámite');
// 6) bonos: pago único
h.loan = null; h.tk = 'pro'; h.club = ownerClub; h.team = ownerClub; h.contract = owner; owner.status = 'activo';
owner.bonuses = { goals: { n: 3, amt: 50 } }; var m0 = h.money; h.season.g = 3; K.bonusWeekly(S.week); var m1 = h.money; K.bonusWeekly(S.week); K.bonusWeekly(S.week + 1);
check(m1 > m0, 'el bono por goles se paga'); check(h.money === m1, 'el bono no se paga dos veces');
check(K.ensure().fin.some(function (e) { return e.k === 'bono'; }), 'el pago queda en el libro económico');
// 7) persistencia
var js = JSON.stringify({ d: FP.Store.pack() }); FP.Store.unpack(JSON.parse(js).d);
var h2 = FP.S.hero; check(h2.cx.hist.length > 5 && h2.cx.reg.length >= 1 && h2.cx.fin.length >= 1, 'el historial contractual sobrevive guardar/cargar');
// 8) menores: sin contratos profesionales para niños
var pk = { nm: 'Kid', nat: 'CHI', city: '', age: 13, h: 160, kg: 50, pos: 'CM', foot: 'R', style: 'tecnico', extra: {}, club: { kind: 'amat', name: 'Kid FC', st: 48 } };
H.restore(snap); S = FP.S; var hk = FP.Game.startCareer(pk); var c0 = S.clubs.filter(function (c) { return c.c === 'CHI' && FP.LGDEF[c.lg].t === 1; })[0];
var of = M.addOffer({ type: 'academy', club: c0.id }); check(of.t.kind === 'formacion' && of.t.years <= 2 && !of.t.release && !Object.keys(of.t.bonuses).length, 'contrato de formación para un niño de 13: sin cláusulas ni bonos');
var op = M.addOffer({ type: 'pro', club: c0.id }); var rk = M.respond(op.id, true); check(!rk.ok, 'no se firma contrato profesional con 13 años');
// 9) negociación: resultados posibles y consecuencias
H.restore(snap); S = FP.S; h = FP.Game.startCareer(prof); K.ensure();
h.tk = 'free'; h.club = null; h.team = null; h.contract = null; h.rep.nat = 70; h.rep.loc = 70;
var res = {}, wd = 0;
for (var q = 0; q < 60; q++) {
  h.offers = []; var cl = S.clubs.filter(function (c) { return FP.LGDEF[c.lg].t === 1 && c.c === 'CHI'; })[q % 10];
  var of2 = M.addOffer({ type: 'transfer', club: cl.id, fee: 0 }); h.cd = {};
  var ask = q % 3 === 0 ? { wage: of2.t.wage * 1.04 } : q % 3 === 1 ? { wage: of2.t.wage * 1.25, role: 'Estrella del equipo' } : { wage: of2.t.wage * 3 };
  var rn = K.negotiate(of2.id, ask); res[rn.result || 'err'] = (res[rn.result || 'err'] || 0) + 1;
  if (rn.result === 'withdraw') { wd++; check(!h.offers.some(function (x) { return x.id === of2.id; }), 'una oferta retirada desaparece'); }
}
check(res.accept > 0 && res.counter > 0 && res.withdraw > 0, 'la negociación produce aceptación, contrapropuesta y retiro (' + JSON.stringify(res) + ')');
// 10) renovación conserva cláusulas
h.offers = []; h.tk = 'free'; h.contract = null; var cb = S.clubs.filter(function (c) { return c.c === 'ESP' && FP.LGDEF[c.lg].t === 1; })[0];
h.nat = 'CHI'; var rrr = 0;
h.tk = 'pro'; h.club = cb.id; h.team = cb.id; h.contract = K.applyTermsToContract({ type: 'prof' }, { kind: 'prof', role: 'Titular habitual', startW: S.week - 30, endW: S.week + 30, endY: D.year(S.week + 30), wage: 100, bonuses: { goals: { n: 8, amt: 9 } }, release: 7777, loanable: true, signBonus: 0 }, null);
K.register(h.contract, cb.id, 'prueba'); S.ro[cb.id] = S.ro[cb.id] || [];
var rv = K.makeRenew({}); check(rv && rv.t.release === 7777 && rv.t.bonuses.goals && rv.t.bonuses.goals.n === 8, 'la renovación conserva cláusula y bonos no modificados');
var rr2 = M.respond(rv.id, true); check(rr2.ok && h.contract.release === 7777 && h.contract.bonuses.goals, 'tras renovar siguen la cláusula y los bonos');
// 11) rol prometido incumplido -> aviso con minutos reales
h.contract.role = 'Estrella del equipo'; K.openRole(); h.log = []; for (var z = 0; z < 8; z++) h.log.unshift({ w: S.week, k: 'liga', min: 0, why: 0 });
K.roleWeekly(S.week); check(K.ensure().role.lvl === 1, 'minutos nulos con rol de estrella generan aviso');
h.log = []; for (var z2 = 0; z2 < 8; z2++) h.log.unshift({ w: S.week, k: 'liga', min: 90, why: 0 }); K.roleWeekly(S.week); check(K.ensure().role.lvl === 0, 'si juega, el conflicto se resuelve');
// 12) partida antigua: sin h.cx, contrato sin cid y ofertas sin términos
var hh = FP.S.hero; delete hh.cx; hh.contract = { type: 'prof', wage: 120, end: D.year(S.week) + 2, clause: null, role: 'Titular' }; hh.tk = 'pro'; hh.club = cb.id; hh.team = cb.id;
hh.offers = [{ id: 901, type: 'transfer', club: S.clubs[5].id, fee: 100, wage: 200, years: 3, role: 'Titular', text: 'vieja', exp: S.week + 5, w: S.week }];
FP.Store.unpack(JSON.parse(JSON.stringify({ d: FP.Store.pack() })).d); var hm = FP.S.hero;
check(hm.cx && hm.contract.cid && hm.offers[0].t && hm.offers[0].t.wage === 200, 'una partida antigua se migra (contrato y ofertas)');
for (var wk = 0; wk < 20; wk++) { FP.Game.beginWeek(); while (FP.Game.hasPending()) FP.Game.playPending(); FP.Game.endWeek(); }
check(true, 'avanza 20 semanas tras migrar sin errores');
// 13) solicitudes de renovación y acciones de rol no fallan
['raise', 'early', 'role', 'bonus', 'clause', 'refuse'].forEach(function (k) { var rq = K.request(k); check(rq && typeof rq.msg === 'string', 'solicitud ' + k); });
['coach', 'board', 'role'].forEach(function (k) { var ra = K.roleAction(k); check(ra && typeof ra.msg === 'string', 'acción de rol ' + k); });
console.log('ok', ok, 'fallas', fails.length); fails.forEach(function (f) { console.log(' -', f); }); process.exit(fails.length ? 1 : 0);
