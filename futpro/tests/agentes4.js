/* Representantes, fase 4: pruebas internacionales gestionadas por el agente (js/agentes.js, js/tryouts.js, js/hero.js).
   Uso: node tests/agentes4.js. Valores de diseño: invitación 0,05–0,90, 2 viajes al año, 13 semanas entre viajes, respuesta en 2 semanas, autorización del club con contrato. */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
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
// ---------- 1) disponibilidad y solicitud ----------
reset('free'); h.agent = null; t('sin representante no se pueden pedir pruebas internacionales', !A.requestTrip(cc, [clubsCC[0].c.id]).ok);
hire(engLow); setAge(15); t('a los 15 años no se puede viajar a pruebas (edad mínima ' + T.TRIP_MIN_AGE + ')', !A.requestTrip(cc, [clubsCC[0].c.id]).ok); setAge(23);
t('los países de prueba se ordenan por los contactos del agente', opts.every(function (o, i) { return i === 0 || opts[i - 1].contact >= o.contact; }));
t('las opciones solo incluyen clubes que pueden recibirte (cupos y permisos)', opts.every(function (o) { return o.clubs.length === o.n && o.n > 0; }));
var gestBefore = (h.agb ? h.agb.hist.length : 0), rs0 = S.rs, r1 = A.requestTrip(cc, [clubsCC[0].c.id, clubsCC[1].c.id]);
t('una solicitud sin contrato crea una gestión pendiente (no un viaje)', r1.ok && h.agb.tr && !h.agb.tr.acc && !h.ty.trip, r1.msg);
t('la solicitud consume una gestión efectiva', h.agb.hist.length === gestBefore + 1);
t('no se puede pedir otra mientras hay una pendiente', !A.requestTrip(cc, [clubsCC[2].c.id]).ok);
t('antes de la respuesta no ocurre nada', (A.tripWeekly(), h.agb.tr && !h.agb.tr.acc));
t('pedir más de ' + T.TRIP_MAX_CLUBS + ' clubes se rechaza', (h.agb.tr = null, !A.requestTrip(cc, clubsCC.slice(0, T.TRIP_MAX_CLUBS + 1).map(function (o) { return o.c.id; })).ok));
t('pedir un club inexistente o no disponible se rechaza', !A.requestTrip(cc, [-5]).ok);
// ---------- 2) la invitación no está garantizada y depende de los contactos ----------
var inv = S.clubs.filter(function (c) { return c.c === cc || c.c === 'JPN'; }).map(function (c) { return A.inviteChance(c); });
t('la probabilidad de invitación está acotada entre 0,05 y 0,90', inv.every(function (p) { return p >= C4.pMin - 1e-9 && p <= C4.pMax + 1e-9; }), [Math.min.apply(null, inv), Math.max.apply(null, inv)]);
var engClub = clubsCC[0].c, noContact = S.clubs.filter(function (c) { return c.c !== 'ENG' && FP.LGDEF[c.lg].t === FP.LGDEF[engClub.lg].t; })[0];
hire(engLow); var pCon = A.inviteChance(engClub); hire(null); h.agent = null; var pSin = A.inviteChance(engClub); hire(engLow);
t('los contactos del agente aumentan la probabilidad de que el club acepte la invitación (' + pSin.toFixed(2) + ' → ' + pCon.toFixed(2) + ')', pCon > pSin);
var tripP = {}; hire(null); h.agent = null; T.tripClubs(cc).forEach(function (o) { tripP[o.c.id] = o.p; }); hire(engLow); var sameP = T.tripClubs(cc).every(function (o) { return Math.abs(tripP[o.c.id] - o.p) < 1e-12; });
t('el agente NO cambia la probabilidad deportiva de superar la prueba (+0,00)', sameP);
var acc = 0, dec = 0, runs = 150;
for (var i = 0; i < runs; i++) { reset('free'); hire(engLow); S.rs = 9000 + i * 13; A.requestTrip(cc, clubsCC.slice(0, 3).map(function (o) { return o.c.id; })); S.week += C4.reply; A.tripWeekly(); if (h.agb.tr && h.agb.tr.acc) { acc += h.agb.tr.acc.length; dec += 3 - h.agb.tr.acc.length; } else dec += 3; S.week -= C4.reply; }
console.log('invitaciones aceptadas ' + acc + ' de ' + runs * 3 + ' solicitudes (' + Math.round(acc / (runs * 3) * 100) + ' %)');
t('no es automático: hay clubes que aceptan y clubes que rechazan', acc > 0 && dec > 0 && acc < runs * 3);
reset('free'); hire(engLow); A.requestTrip(cc, [clubsCC[0].c.id]); var idd = clubsCC[0].c.id; S.rs = 1; var tries = 0; while (tries++ < 60 && !(h.agb.declined || {})[idd]) { S.rs = 100 + tries * 7; h.agb.tr = { cc: cc, ids: [idd], w: S.week, resp: S.week, auth: false, acc: null }; A.tripWeekly(); }
if ((h.agb.declined || {})[idd]) { t('un club que rechaza no puede volver a pedirse hasta pasadas ' + C4.decline + ' semanas', !A.requestTrip(cc, [idd]).ok && /rechaz/.test(A.requestTrip(cc, [idd]).msg)); } else t('hubo al menos un rechazo para probar la espera', false);
// ---------- 3) confirmar el viaje: costos y límites ----------
function accepted() { reset('free'); hire(engLow); for (var k = 0; k < 400; k++) { S.rs = 30000 + k * 17; h.agb = null; h.ty = null; T.ensure(); h.agb = null; A.requestTrip(cc, clubsCC.slice(0, 3).map(function (o) { return o.c.id; })); S.week += C4.reply; A.tripWeekly(); S.week -= C4.reply; if (h.agb.tr && h.agb.tr.acc) return true; } return false; }
t('se consigue una invitación en alguna prueba', accepted());
var accIds = h.agb.tr.acc.slice(), money0 = h.money, cost = T.tripCost(cc, accIds.length), rc = A.confirmTrip();
t('confirmar inicia el viaje con el motor existente (T.startTrip) y cobra el costo de siempre (' + cost + ')', rc.ok && h.ty.trip && h.ty.trip.agent && h.ty.trip.cc === cc && Math.abs((money0 - h.money) - cost) < 1e-6 || (cost === 0 && rc.ok), rc.msg);
t('el viaje dura 1 + clubes semanas', h.ty.trip.w1 - h.ty.trip.w0 === 1 + accIds.length);
t('tras confirmar la gestión pendiente desaparece y el viaje queda contado', !h.agb.tr && h.agb.trips.length === 1);
t('mientras viaja no se puede pedir otra gestión', !A.requestTrip(cc, [clubsCC[0].c.id]).ok);
var repI = h.rep.int, repL = h.rep.loc, repN = h.rep.nat; S.week = h.ty.trip.w1; T.weekly(S.week);
t('al volver el viaje termina con el motor existente', h.ty.trip === null);
t('el viaje gestionado deja 13 semanas hasta el siguiente (existente: 6)', h.ty.tripCd === S.week + 13);
t('las pruebas no cambian la reputación', h.rep.int === repI && h.rep.loc === repL && h.rep.nat === repN);
var r13 = A.requestTrip(cc, [clubsCC[0].c.id]); t('antes de 13 semanas no se puede pedir otro viaje (' + r13.msg + ')', !r13.ok);
S.week += 13; h.ty.tripCd = 0; h.agb.declined = {}; var r2 = A.requestTrip(cc, [clubsCC[1].c.id]); t('pasadas 13 semanas se puede pedir el segundo viaje', r2.ok, r2.msg);
h.agb.tr = null; h.agb.trips.push(S.week); S.week += 14; h.ty.tripCd = 0; var r3 = A.requestTrip(cc, [clubsCC[1].c.id]);
t('un tercer viaje en 52 semanas se rechaza (máximo ' + C4.perYear + ')', !r3.ok && /Máximo/.test(r3.msg), r3.msg);
reset('free'); hire(engLow); h.agb = null; var bz = {}; A.tripStatus(); h.agb.hist = [S.week - 1, S.week - 2, S.week - 3, S.week - 4, S.week - 5, S.week - 6]; var r6 = A.requestTrip(cc, [clubsCC[0].c.id]);
t('con las 6 gestiones del año agotadas no se pueden pedir pruebas', !r6.ok && /gestiones/.test(r6.msg), r6.msg);
// ---------- 4) edad, cupos y permisos ----------
reset('free'); hire(engLow); setAge(17); var optsM = A.tripOptions();
t('un menor de 18 solo puede probar en países permitidos por la normativa (los mismos de T.tripClubs)', optsM.every(function (o) { return o.clubs.every(function (c) { var cl = S.clubs[c.id]; return Rep.foreignOK(cl, h.nat, 17); }); }));
if (optsM.length) t('a los 17 años el viaje no tiene costo (existente)', T.tripCost(optsM[0].c, 1) === 0);
setAge(23); var blocked = null; T.tripCountries().forEach(function (c2) { T.tripClubs(c2).forEach(function (o) { if (!o.ok && !blocked) blocked = o; }); });
if (blocked) { var rb = A.requestTrip(blocked.c.c, [blocked.c.id]); t('un club con cupo lleno o sin permiso de trabajo no puede recibirte (' + rb.msg + ')', !rb.ok); } else t('existe un club bloqueado para probar', false);
// ---------- 5) con contrato: autorización del club ----------
reset('pro'); hire(engLow); var role = FP.Hero.roleLabel(); var pa = A.tripAuthChance();
console.log('rol ' + role + ', probabilidad de autorización ' + pa.toFixed(2));
t('la autorización no es automática ni imposible', pa > 0.05 && pa < 0.95);
var vals = {}; ['Suplente', 'Titular', 'Estrella'].forEach(function (r) { FP.Hero.roleLabel = function () { return r; }; vals[r] = A.tripAuthChance(); });
t('un suplente tiene más facilidad para que lo autoricen que una estrella (' + vals.Suplente.toFixed(2) + ' > ' + vals.Titular.toFixed(2) + ' > ' + vals.Estrella.toFixed(2) + ')', vals.Suplente > vals.Titular && vals.Titular > vals.Estrella);
FP.Hero.roleLabel = function () { return 'Titular'; }; var base0 = A.tripAuthChance(); h.contract.endW = S.week + 20; var near = A.tripAuthChance(); h.contract.endW = S.week + 80; K.ensure().noRenew = true; var nr = A.tripAuthChance(); K.ensure().noRenew = false;
t('con el contrato por vencer o si te negaste a renovar hay más facilidad', near > base0 && nr > base0, [base0, near, nr]);
var grants = 0, denials = 0, deniedOk = true, gestOk = true;
for (var j = 0; j < 120; j++) { reset('pro'); hire(engLow); FP.Hero.roleLabel = function () { return 'Titular'; }; S.rs = 500 + j * 11; var g0 = h.agb ? h.agb.hist.length : 0, m0 = h.mor, rr = A.requestTrip(cc, [clubsCC[0].c.id]); if (rr.ok) { grants++; if (!h.agb.tr.auth) gestOk = false; } else { denials++; if (!(h.agb.authCd > S.week) || h.agb.hist.length !== g0 || h.mor >= m0) deniedOk = false; } }
console.log('autorizaciones ' + grants + ' / denegaciones ' + denials);
t('con contrato unas veces el club autoriza y otras no', grants > 0 && denials > 0);
t('una denegación activa la espera de ' + C4.authCd + ' semanas, no gasta gestión y cuesta algo de ánimo', deniedOk);
t('una autorización deja la gestión pendiente marcada como autorizada', gestOk);
reset('pro'); hire(engLow); FP.Hero.roleLabel = function () { return 'Titular'; }; h.agb = null; var ok2 = false; for (var j2 = 0; j2 < 80 && !ok2; j2++) { S.rs = 700 + j2 * 3; h.agb = null; ok2 = A.requestTrip(cc, [clubsCC[0].c.id]).ok; } 
reset('pro'); hire(engLow); h.agb = null; h.agb = { dest: null, prio: null, set: -999, until: 0, last: -999, hist: [], loan: 0, ask: -999, log: [], authCd: S.week + 10 }; t('durante la espera tras una denegación no se puede volver a pedir (' + A.requestTrip(cc, [clubsCC[0].c.id]).msg + ')', !A.requestTrip(cc, [clubsCC[0].c.id]).ok);
// ---------- 6) consecuencias de la ausencia ----------
function trip(starter, missedOfficial, missedFriendly) { reset('pro'); hire(engLow); FP.Hero.roleLabel = function () { return starter ? 'Titular' : 'Suplente'; }; h.ct = 60; var tr = { cc: cc, w0: S.week, w1: S.week + 3, clubs: [clubsCC[0].c.id], agent: 1 }; A.tripStarted(tr); var st = FP.Hero.squadStatus(); for (var k = 0; k < missedOfficial; k++) A.onAbsence(true); for (k = 0; k < missedFriendly; k++) A.onAbsence(false); var away = h.away; A.tripFinished(tr, []); return { ct: h.ct, st: st, away: away, after: h.away }; }
var a1 = trip(true, 3, 2), a2 = trip(true, 0, 0), a3 = trip(false, 3, 0), a4 = trip(true, 1, 0), a5 = trip(true, 5, 0);
t('con contrato el jugador no juega mientras dura el viaje (ausencia autorizada)', a1.st.role === 'out' && /viaje/.test(a1.st.why) && a1.away && a1.away.starter === true);
t('un titular que pierde 3 partidos oficiales baja 6 puntos de confianza', a1.ct === 54, a1.ct);
t('los amistosos no cuentan como ausencia', a1.away.missed === 3);
t('sin partidos perdidos no hay consecuencias para la confianza', a2.ct === 60, a2.ct);
t('un suplente que se ausenta no pierde confianza', a3.ct === 60, a3.ct);
t('perder 1 partido como titular baja 2 puntos', a4.ct === 58, a4.ct);
t('el castigo máximo es de 6 puntos (5 partidos)', a5.ct === 54, a5.ct);
t('al volver termina la ausencia autorizada', a1.after === null);
reset('pro'); hire(engLow); var offer = { type: 'transfer', fee: 0, club: clubsCC[0].c.id }, offer2 = { type: 'precontract', fee: 0 }; A.tripFinished({ cc: cc, agent: 1, clubs: [] }, [offer, offer2]);
t('con contrato vigente las ofertas de la prueba llevan un traspaso (no un fichaje gratis)', offer.fee > 0 && offer2.fee === 0);
reset('free'); hire(engLow); var offerF = { type: 'transfer', fee: 0 }; A.tripFinished({ cc: cc, agent: 1, clubs: [] }, [offerF]); t('un jugador libre mantiene la oferta sin traspaso', offerF.fee === 0);
// integración: terminar el viaje con contrato desde el motor de pruebas
reset('pro'); hire(engLow); FP.Hero.roleLabel = function () { return 'Suplente'; }; h.ct = 55; T.ensure(); h.agb = null; var okc = false; for (var j3 = 0; j3 < 100 && !okc; j3++) { S.rs = 2000 + j3 * 5; h.agb = null; h.ty.trip = null; h.cd = {}; if (A.requestTrip(cc, clubsCC.slice(0, 2).map(function (o) { return o.c.id; })).ok) { S.week += C4.reply; A.tripWeekly(); S.week -= C4.reply; if (h.agb.tr && h.agb.tr.acc) okc = true; } }
t('con contrato se consigue autorización e invitación en el flujo completo', okc);
if (okc) { var c0 = A.confirmTrip(); t('con contrato el viaje se confirma y marca la ausencia', c0.ok && h.away && h.ty.trip.agent, c0.msg); var w1 = h.ty.trip.w1; S.week = w1; T.weekly(w1); t('con contrato el motor de pruebas cierra el viaje al volver (aunque no estés libre)', h.ty.trip === null && h.away === null && h.ty.tripCd === w1 + 13); }
// ---------- 7) estado guardado ----------
reset('free'); hire(engLow); h.agb = null; var okS = false; for (var j4 = 0; j4 < 100 && !okS; j4++) { S.rs = 4000 + j4 * 9; h.agb = null; if (A.requestTrip(cc, clubsCC.slice(0, 3).map(function (o) { return o.c.id; })).ok) okS = true; }
var before = JSON.stringify(h.agb.tr), sts = JSON.stringify(A.tripStatus().used);
FP.Store.unpack(JSON.parse(JSON.stringify(FP.Store.pack()))); S = FP.S; h = S.hero;
t('la gestión de pruebas pendiente sobrevive a guardar y cargar', JSON.stringify(h.agb.tr) === before);
var old = JSON.parse(JSON.stringify(FP.Store.pack())); delete old.hero.agb; FP.Store.unpack(old); S = FP.S; h = S.hero; var rsOld = S.rs; A.tripWeekly(); t('en una partida anterior (sin estado de agente) las pruebas no hacen nada ni consumen el RNG', S.rs === rsOld);
t('sin gestión pendiente la semana no consume el RNG', (function () { h.agb = null; var r0 = S.rs; A.tripWeekly(); return S.rs === r0; })());
console.log('ok', ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
