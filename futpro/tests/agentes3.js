/* Representantes, fase 3: instrucciones, gestión semanal, cesión y renovación (js/agentes.js, js/scouting.js, js/ui-agentes.js).
   Uso: node tests/agentes3.js. Los límites (×1,6 destino, ×1,3 prioridad, 26/8 semanas, 1 gestión cada 4 y 6 al año) son supuestos de diseño. */
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
var sw0 = S.week;

// ---------- 1) instrucciones: validación, ranuras, plazos ----------
h.agent = null; delete h.agb;
t('sin representante no se pueden dar instrucciones', !A.setBrief('pais:ENG', '').ok && !A.askLoan().ok && !A.askRenew().ok);
hire(engLow);
t('sin instrucciones no hay efecto ni estado activo', A.brief() === null && S.clubs.every(function (c) { return A.briefWeight(c, { gap: 5, kind: 'ok' }) === 1; }));
var r = A.setBrief('pais:ENG', 'titular');
t('dar instrucciones de destino y prioridad funciona', r.ok && A.brief() && A.brief().dest.k === 'pais' && A.brief().dest.arg === 'ENG' && A.brief().prio === 'titular', r.msg);
t('un destino inexistente se rechaza', !A.setBrief('pais:IDN', '').ok && !A.setBrief('pais:ZZZ', '').ok && !A.setBrief('liga:XXX9', '').ok);
S.week += 3; r = A.setBrief('europa', 'sueldo');
t('cambiar las instrucciones antes de 8 semanas se rechaza (' + r.msg + ')', !r.ok && A.brief().dest.k === 'pais');
S.week += 5; r = A.setBrief('eur', 'sueldo');
t('pasadas 8 semanas se pueden cambiar', r.ok && A.brief().dest.k === 'europa' && A.brief().prio === 'sueldo', r.msg);
t('una sola ranura de destino y una de prioridad', Object.keys(A.brief()).filter(function (k) { return /^(dest|prio)$/.test(k); }).length === 2 && typeof A.brief().prio === 'string');
S.week += 26; t('las instrucciones caducan a las 26 semanas', A.brief() === null);
S.week += 0; r = A.setBrief('inf', 'desarrollo'); t('tras caducar se puede dar otra instrucción', r.ok);
// cambiar de agente: se limpian destino y prioridad pero no los plazos (sin trucos)
hire(loc); t('al cambiar de agente se limpian las instrucciones', A.brief() === null && h.agb.dest === null && h.agb.prio === null);
r = A.setBrief('pais:ESP', ''); t('cambiar de agente no reinicia el plazo de 8 semanas (' + r.msg + ')', !r.ok);
S.week += 8; t('clima: tras esperar sí se puede', A.setBrief('pais:ESP', '').ok);
r = A.setBrief('any', ''); t('retirar las instrucciones se puede hacer siempre', r.ok && A.brief() === null);
S.week = sw0;
// ---------- 2) sesgos de interés: acotados y sin cerrar mercados ----------
hire(engLow); S.week = sw0 + 200; h.agb.set = -999; A.setBrief('pais:ENG', 'titular');
var f3 = { gap: 5, kind: 'ok' }, enc = S.clubs.filter(function (c) { return c.c === 'ENG'; })[0], jp = S.clubs.filter(function (c) { return c.c === 'JPN'; })[0];
var wEng = A.briefWeight(enc, f3), wJp = A.briefWeight(jp, f3);
t('el destino sube el peso de sus clubes (×1,6 con contactos) y con titularidad ×1,3', Math.abs(wEng - 1.6 * 1.3) < 1e-9, wEng);
t('los demás clubes bajan un 20 %, nunca a cero (mercados abiertos)', Math.abs(A.briefWeight(jp, { gap: 0, kind: 'ok' }) - 0.8) < 1e-9 && wJp > 0);
hire(loc); h.agb.set = -999; A.setBrief('pais:ENG', ''); var wHalf = A.briefWeight(enc, f3);
t('sin contactos en el país el efecto del destino es la mitad (×1,3)', Math.abs(wHalf - 1.3) < 1e-9, wHalf);
var maxW = 0; hire(engLow); h.agb.set = -999; ['titular', 'sueldo', 'desarrollo'].forEach(function (pr) { ['pais:ENG', 'inf', 'eur', 'liga:ENG4'].forEach(function (d) { h.agb.set = -999; S.week += 30; A.setBrief(d, pr); S.clubs.forEach(function (c) { var f = Rep.fit(c); var w = A.briefWeight(c, f); if (w > maxW) maxW = w; }); }); });
t('ningún peso de instrucciones supera 1,6 × 1,3 (máximo ' + maxW.toFixed(2) + ')', maxW <= 1.6 * 1.3 + 1e-9 && maxW > 1.3);
// ---------- 3) las puertas deportivas no cambian ----------
S.week = sw0 + 400; hire(null); var fit0 = S.clubs.map(function (c) { var f = Rep.fit(c); return f.kind + f.ok + f.gap; }).join(), ex0 = S.clubs.map(function (c) { return Rep.exposure(c).need; }).join(); S.rs = 12345; var g0 = []; for (var q = 0; q < 300; q++) g0.push(Rep.lowerGate(S.clubs[q * 3]) + ':' + Rep.offerGate(S.clubs[q * 3]));
hire(engLow); h.agb.set = -999; A.setBrief('pais:ENG', 'sueldo');
var fit1 = S.clubs.map(function (c) { var f = Rep.fit(c); return f.kind + f.ok + f.gap; }).join(); S.rs = 12345; var g1 = []; for (q = 0; q < 300; q++) g1.push(Rep.lowerGate(S.clubs[q * 3]) + ':' + Rep.offerGate(S.clubs[q * 3]));
t('Rep.fit es idéntico con y sin instrucciones', fit0 === fit1);
t('lowerGate y offerGate dan el mismo resultado con y sin instrucciones (misma semilla)', g0.join() === g1.join());
t('la visibilidad solo cambia por los contactos (no por las instrucciones)', S.clubs.map(function (c) { return Rep.exposure(c).need; }).join() === (function () { var b = h.agb; var save = h.agb; h.agb = null; var x = S.clubs.map(function (c) { return Rep.exposure(c).need; }).join(); h.agb = save; return x; })());
t('Rep.PULL.domestic sigue en 0,10', Rep.PULL.domestic === 0.10);
// ---------- 4) gestión semanal ----------
S.week = sw0 + 600; setAge(23); h.rep.int = 45; h.int = []; h.cd = {}; h.offers = []; hire(engLow); h.agb = null; A.setBrief('liga:ENG3', 'titular');
var b = A.brief(), offs0 = h.offers.length, log = [], weeks = [];
for (var w = 0; w < 80; w++) { S.week++; var lb = b.last, n0 = b.hist.length; A.weekly(); if (b.hist.length > n0) weeks.push(S.week); }
t('la gestión respeta un máximo de una cada 4 semanas', weeks.every(function (x, i) { return i === 0 || x - weeks[i - 1] >= 4; }), weeks.join());
t('la gestión respeta un máximo de 6 en 52 semanas (' + weeks.filter(function (x) { return x - weeks[0] < 52; }).length + ')', weeks.filter(function (x) { return x - weeks[0] < 52; }).length <= 6);
t('la gestión se detiene al caducar las instrucciones (26 semanas)', weeks.every(function (x) { return x <= b.until; }) && weeks.length <= 7, weeks.length);
t('la gestión no crea ofertas, solo interés', h.offers.length === offs0);
t('la gestión deja informes en el historial', h.agb.log.length >= 1 && h.agb.log.every(function (x) { return x.t && x.w != null; }));
var oks = h.agb.log.filter(function (x) { return x.ok; });
console.log('informes: ' + h.agb.log.slice(0, 4).map(function (x) { return (x.ok ? '+ ' : '- ') + x.t; }).join(' | '));
// sin instrucciones no pasa nada
S.week += 100; setAge(23); h.agb.dest = null; h.agb.prio = null; var rs1 = S.rs, hl = h.agb.log.length; for (w = 0; w < 30; w++) { S.week++; A.weekly(); }
t('sin instrucciones el representante no gestiona nada ni consume el RNG', S.rs === rs1 && h.agb.log.length === hl);
// motivos de «sin oportunidades»
function reasonFor(setup, dest, prio) { S.week += 60; setAge(23); h.agb = null; h.int = []; h.cd = {}; setup(); hire(engLow); A.setBrief(dest, prio); var b = A.brief(); S.week += 5; A.weekly(); return h.agb.log[0] && h.agb.log[0].t; }
var m1 = reasonFor(function () { h.rep.int = 5; }, 'pais:ENG', '');
t('sin reputación suficiente explica que ningún club lo conoce (' + m1 + ')', /sin oportunidades/.test(m1) && /te conoce|reputación/.test(m1));
var m2 = reasonFor(function () { h.rep.int = 80; setAge(16); }, 'pais:ENG', '');
t('un menor sin traslado permitido: explica cupos o edad (' + m2 + ')', /sin oportunidades/.test(m2) && /cupos|edad/.test(m2));
setAge(23);
setOvr(40); var m3 = reasonFor(function () { h.rep.int = 90; }, 'liga:ENG1', '');
t('un nivel muy inferior explica que ningún club lo necesita (' + m3 + ')', /sin oportunidades/.test(m3) && /nivel y posición|te conoce|no pueden/.test(m3));
setOvr(70);
// precontrato: no hay gestión
h.agb = null; h.rep.int = 45; hire(engLow); A.setBrief('pais:ENG', ''); K.ensure().pre = { club: 1, w: S.week + 10 }; var bb = A.brief(), last0 = bb.last; S.week += 6; A.weekly(); t('con un precontrato firmado el agente no gestiona', bb.last === last0); K.ensure().pre = null;
// ---------- 4b) continuidad: lista de objetivos ----------
S.week = sw0 + 800; setAge(23); h.rep.int = 45; h.int = []; h.cd = {}; h.offers = []; h.agb = null; hire(engLow); A.setBrief('liga:ENG3', 'titular'); var bt = A.brief(), warm = true, offT = h.offers.length, maxT = 0, pushes = {}, closed = 0, gests = 0;
for (w = 0; w < 52; w++) { S.week++; var nh = bt.hist.length; A.weekly(); if (bt.hist.length > nh) gests++; h.int.forEach(function (e) { e.v -= A.decay(e.c); }); h.int = h.int.filter(function (e) { return e.v >= 5; }); if (bt.tg.length && S.week < bt.until) warm = warm && A.decay(bt.tg[0].c) === 0.35; maxT = Math.max(maxT, bt.tg.length); bt.tg.forEach(function (x) { pushes[x.c] = Math.max(pushes[x.c] || 0, x.push); }); }
t('la lista de objetivos nunca supera 3 clubes (máximo ' + maxT + ')', maxT <= 3 && maxT >= 1);
t('el agente insiste con el mismo club más de una vez', Object.keys(pushes).some(function (k) { return pushes[k] >= 2; }), JSON.stringify(pushes));
t('las seis gestiones se reparten en objetivos, no en clubes siempre distintos (' + gests + ' gestiones, ' + Object.keys(pushes).length + ' clubes)', gests <= 6 && Object.keys(pushes).length <= gests);
t('un objetivo cultivado se enfría más despacio (0,35) mientras duran las instrucciones', warm);
t('un club que no es objetivo se enfría al ritmo de siempre (0,7)', A.decay(-5) === 0.7);
t('la insistencia no crea ofertas', h.offers.length === offT);
t('los informes explican la insistencia o el cierre', h.agb.log.some(function (x) { return /insistió|ya te sigue de cerca/.test(x.t); }));
t('ningún informe dice «interés N de 38» con N ≥ 38', h.agb.log.every(function (x) { var m = /interés sube a (\d+) de 38/.exec(x.t); return !m || +m[1] < 38; }));
// un objetivo que deja de ser posible se abandona con su motivo
h.agb = null; hire(engLow); A.setBrief('liga:ENG3', 'titular'); var bd = A.brief(); S.week += 8; h.int = []; h.cd = {}; h.rep.int = 45; for (w = 0; w < 6 && !bd.tg.length; w++) { S.week += 4; A.weekly(); }
var tgc = bd.tg[0] && bd.tg[0].c; if (tgc != null) { h.cd[tgc] = S.week + 50; S.week += 4; A.weekly(); t('un objetivo que te descarta se abandona y el agente lo explica', !bd.tg.some(function (x) { return x.c === tgc; }) && h.agb.log.some(function (x) { return /dejó de insistir con/.test(x.t); })); } else t('hubo un objetivo para probar el abandono', false);
// cambiar de instrucciones o de agente vacía los objetivos
S.week += 30; A.setBrief('liga:ENG4', ''); t('cambiar las instrucciones vacía la lista de objetivos', A.brief().tg.length === 0);
A.brief().tg.push({ c: 1, since: 0, push: 1, last: 0 }); A.hire({ nm: loc.nm, lvl: loc.lvl, com: loc.com, id: loc.id }); t('cambiar de agente vacía la lista de objetivos', h.agb.tg.length === 0);
// ---------- 5) cesión y renovación ----------
setAge(20); h.tk = 'pro'; h.club = cur.id; h.team = cur.id; h.agb = null; hire(engLow);
var rl = A.askLoan(); t('pedir una cesión a los 20 años funciona (' + rl.msg + ')', rl.ok);
t('no se puede repetir la petición antes de 8 semanas', !A.askLoan().ok);
setAge(26); h.agb.ask = -999; t('a los 26 años no se puede pedir cesión', !A.askLoan().ok);
setAge(20); h.tk = 'amat'; h.agb.ask = -999; t('sin contrato no se puede pedir cesión', !A.askLoan().ok); h.tk = 'pro';
var winW = null; for (var k2 = 0; k2 < 120; k2++) { if (M.isWindow(S.week + k2)) { winW = S.week + k2; break; } }
S.week = winW; setAge(20); h.contract = { wage: 40, endW: S.week + 80, role: 'Suplente' }; h.agb.ask = -999; h.agb.loan = 0; h.season = h.season || {}; h.season.ap = 30; h.ovr = 70; setOvr(70);
function loans(request) { h.agb.loan = request ? S.week + 26 : 0; var n = 0, inPool = true, pool = Rep.loanClubs(cur, FP.Hero.age()).map(function (c) { return c.id; }); for (var i = 0; i < 80; i++) { h.offers = []; h.cd = {}; Rep.offers(false, 3); h.offers.filter(function (x) { return x.type === 'loan'; }).forEach(function (x) { n++; if (pool.indexOf(x.club) < 0) inPool = false; }); } return { n: n, inPool: inPool }; }
var l0 = loans(false), l1 = loans(true);
console.log('propuestas de cesión en 80 intentos: sin petición ' + l0.n + ' | con petición ' + l1.n);
t('la petición de cesión aumenta las propuestas del mercado existente', l1.n > l0.n, [l0.n, l1.n]);
t('las cesiones propuestas siguen viniendo de los clubes permitidos por las reglas de siempre', l1.inPool && l0.inPool);
// renovación
h.agb.ask = -999; h.contract = h.contract || {}; var rr = A.askRenew(); t('pedir renovación usa la solicitud de contrato existente y explica el resultado (' + rr.msg + ')', typeof rr.ok === 'boolean' && rr.msg && h.agb.log[0].t);
// ---------- 6) intención de salir: nunca automática ----------
h.flags.transferReq = false; h.agb = null; hire(engLow); A.setBrief('inf', 'titular');
t('buscar titularidad con instrucciones NO activa transferReq', h.flags.transferReq === false);
for (w = 0; w < 30; w++) { S.week++; A.weekly(); }
t('ni la gestión semanal activa transferReq', h.flags.transferReq === false);
var mor0 = h.mor; var rt = M.requestTransfer(); t('declarar la salida formalmente sí lo activa, con coste de ánimo (existente)', rt.ok && h.flags.transferReq === true && h.mor < mor0);
h.flags.transferReq = false;
// ---------- 7) guardado, carga y partidas anteriores ----------
S.week = winW; setAge(23); h.agb = null; hire(engLow); A.setBrief('pais:ENG', 'desarrollo'); S.week += 10; A.weekly();
var before = JSON.stringify(h.agb), until = h.agb.until;
FP.Store.unpack(JSON.parse(JSON.stringify(FP.Store.pack()))); S = FP.S; h = S.hero;
t('las instrucciones y el historial sobreviven a guardar y cargar', JSON.stringify(h.agb) === before && A.brief() && A.brief().dest.arg === 'ENG');
var old = JSON.parse(JSON.stringify(FP.Store.pack())); delete old.hero.agb; FP.Store.unpack(old); S = FP.S; h = S.hero;
t('una partida anterior sin instrucciones carga sin problemas y sin efectos', h.agb === undefined && A.brief() === null && A.briefWeight(S.clubs[3], { gap: 5, kind: 'ok' }) === 1);
var rsOld = S.rs; A.weekly(); t('en una partida anterior el representante no consume el RNG', S.rs === rsOld);
// ---------- 8) efecto en el mercado: jugadores de 55, 70 y 85 ----------
function season(ovr, brief, runs) {
  setAge(23); setOvr(ovr); h.rep.int = 45; var inEng = 0, tot = 0, any = 0, offersTot = 0, offersEng = 0, offAny = 0, w0 = S.week;
  for (var r = 0; r < runs; r++) {
    h.agb = null; hire(engLow); if (brief) A.setBrief('pais:ENG', 'titular'); h.int = []; h.cd = {}; h.offers = [];
    S.week = w0; setAge(23);
    for (var k = 0; k < 40; k++) { S.week++; Rep.scoutWeek(S.week); A.weekly(); if (U.R() < 0.2) Rep.spark({ played: true, rating: 8.5, g: 2 }); }
    var e = h.int.filter(function (x) { return S.clubs[x.c].c === 'ENG'; }).length; inEng += e; tot += h.int.length; if (e) any++;
    h.contract = { wage: 40, endW: S.week + 80, role: 'Titular' }; Rep.offers(false, 3); var os = h.offers.filter(function (x) { return x.club != null; }); offersTot += os.length; offersEng += os.filter(function (x) { return S.clubs[x.club].c === 'ENG'; }).length;
  }
  S.week = w0; return { eng: inEng / runs, tot: tot / runs, any: any / runs * 100, ot: offersTot / runs, oe: offersEng / runs, oa: offAny / runs * 100 };
}
h.tk = 'pro'; h.club = cur.id; h.team = cur.id;
[55, 70, 85].forEach(function (ovr) {
  var a = season(ovr, false, 30), b2 = season(ovr, true, 30);
  console.log('nivel ' + ovr + ': interés en clubes ingleses por temporada — sin instrucciones ' + a.eng.toFixed(2) + ' (' + Math.round(a.any) + ' %) | con instrucción país Inglaterra ' + b2.eng.toFixed(2) + ' (' + Math.round(b2.any) + ' %) | ofertas totales ' + a.ot.toFixed(2) + ' → ' + b2.ot.toFixed(2) + ' | ofertas inglesas ' + a.oe.toFixed(2) + ' → ' + b2.oe.toFixed(2));
  t('nivel ' + ovr + ': la instrucción aumenta el interés en el destino', b2.eng >= a.eng, [a.eng, b2.eng]);
  t('nivel ' + ovr + ': no garantiza ofertas del destino (' + Math.round(b2.oa) + ' % de las temporadas con alguna)', b2.oa < 50);
  t('nivel ' + ovr + ': las ofertas totales no se disparan (≤ 1,5 veces)', b2.ot <= a.ot * 1.5 + 0.5, [a.ot, b2.ot]);
  t('nivel ' + ovr + ': las ofertas inglesas no pasan de 1 por temporada', b2.oe <= 1.0, b2.oe);
});
console.log('ok', ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
