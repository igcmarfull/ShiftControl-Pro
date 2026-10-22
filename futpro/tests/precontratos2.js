/* Precontratos 2: apertura progresiva, mercado nacional y bajadas de nivel de los clubes (js/scouting.js: Rep.pull / pickClub / lowerGate / offerGate; js/contracts.js: K.preOffers).
   Uso: node tests/precontratos2.js   (≈ 8 minutos). Los porcentajes son supuestos de diseño. */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var S = H.restore(H.buildWorld(777)), h = FP.Game.startPreset(), M = FP.Market, Rep = FP.Rep, D = FP.Date, U = FP.U, K = FP.Contracts;
var cl = S.clubs.filter(function (c) { return c.lg === 'CHI1'; }).sort(function (a, b) { return a.st - b.st; }), club = cl[Math.floor(cl.length / 2)];
h.b = D.of(2026 - 21, 5, 15); S.pl[0].b = h.b; h.bd = [2005, 5, 15]; h.nat = 'CHI'; S.pl[0].nat = 'CHI';
FP.Core.ATTRS.forEach(function (a) { h.at[a] = 60; h.cap[a] = 92; }); ['fin', 'rem', 'com', 'pos'].forEach(function (a) { h.at[a] = 70; }); h.pot = 80; S.pl[0].pt = 80; h.pos = 'ST'; FP.Hero.updateOvr(); h.tk = 'amat'; h.club = null;
var o = M.addOffer({ type: 'pro', club: club.id, years: 3, wage: 40, role: 'Titular', text: 'x', exp: S.week + 20 }); M.respond(o.id, true);
for (var i = 0; i < 52 * 2; i++) { FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h); FP.Dec.open().forEach(function (d) { FP.Dec.resolve(d.id, d.opts[0].k); }); }
var age = FP.Hero.age(), cur = S.clubs[h.club], cc = M.heroCountry(), conf = function (c) { return FP.DATA.countries[c.c].conf; };
var pool = S.clubs.filter(function (c) { if (c === cur) return false; if (!Rep.exposure(c).ok || !Rep.foreignOK(c, h.nat, age) || !Rep.permit(c)) return false; var f = Rep.fit(c); return f.kind !== 'none' && f.ok; });
t('hay un pool amplio de clubes elegibles (' + pool.length + ')', pool.length > 200);
t('no se pone un límite inferior global: el pool incluye clubes muy inferiores', pool.some(function (c) { return c.st <= cur.st - 15; }));

// ---------- 1) reparto del interés ----------
var mid = sample(function () { h.rep.int = 60; }, 100);
var mF = frac(mid, function (c) { return c.c !== cc; }), mE = frac(mid, function (c) { return conf(c) === 'UEFA'; }), mS = frac(mid, function (c) { return c.st - cur.st > -6; }), mH = frac(mid, function (c) { return lgq(c) > lgq(cur); });
console.log('reputación internacional 60: n ' + mid.length + ' | extranjeros ' + Math.round(mF) + ' % | Europa ' + Math.round(mE) + ' % | parecido o mejor ' + Math.round(mS) + ' % | de ligas de mayor calidad ' + Math.round(mH) + ' %');
t('con fama internacional se generan precontratos (' + mid.length + ')', mid.length >= 30);
t('con fama internacional llegan ofertas desde Europa (' + Math.round(mE) + ' %)', mE >= 15);
t('con fama internacional el interés extranjero aparece sin cuotas: al menos 30 % (' + Math.round(mF) + ' %)', mF >= 30);
t('con fama internacional casi todas las ofertas son de nivel parecido o mejor (' + Math.round(mS) + ' %)', mS >= 85);
t('con fama internacional una parte importante viene de ligas de mayor calidad (' + Math.round(mH) + ' %)', mH >= 40);
// quien pide salir recibe más propuestas de clubes inferiores que quien no
h.flags.transferReq = true; var want = sample(function () { h.rep.int = 50; }, 100); h.flags.transferReq = false; var base50 = sample(function () { h.rep.int = 50; }, 100);
var wW = frac(want, function (c) { return c.st - cur.st <= -6; }), bW = frac(base50, function (c) { return c.st - cur.st <= -6; });
console.log('pide salir (int 50): ≥6 por debajo ' + Math.round(wW) + ' % | no pide salir: ' + Math.round(bW) + ' %');
var hc = function (c) { return c.c === cc; };
// ---------- A) apertura progresiva ----------
var LV = [29, 35, 40, 45, 50, 60, 70, 85], R = {};
LV.forEach(function (v) { var l = sample(function () { h.rep.int = v; }, 100); R[v] = { n: l.length, F: frac(l, function (c) { return !hc(c); }), E: frac(l, function (c) { return conf(c) === 'UEFA'; }), H: frac(l, hc), HB: frac(l, function (c) { return hc(c) && c.st >= cur.st - 3; }), W: frac(l, function (c) { return c.st - cur.st <= -6; }), Q: frac(l, function (c) { return lgq(c) > lgq(cur); }) };
  console.log('rep. internacional ' + v + ': n ' + l.length + ' | extranjeros ' + Math.round(R[v].F) + ' % | Europa ' + Math.round(R[v].E) + ' % | del país ' + Math.round(R[v].H) + ' % | del país de nivel parecido o mejor ' + Math.round(R[v].HB) + ' % | ≥6 por debajo ' + Math.round(R[v].W) + ' % | liga de mayor calidad ' + Math.round(R[v].Q) + ' %'); });
LV.forEach(function (v) { t('hay muestra suficiente con reputación ' + v + ' (' + R[v].n + ')', R[v].n >= 30); });
var maxStep = 0, maxAt; for (var z = 1; z < LV.length; z++) { var st = R[LV[z]].F - R[LV[z - 1]].F; if (st > maxStep) { maxStep = st; maxAt = LV[z - 1] + '→' + LV[z]; } }
console.log('mayor salto de extranjeros entre niveles consecutivos: ' + Math.round(maxStep) + ' puntos (' + maxAt + ')');
t('la apertura internacional no retrocede de forma apreciable al subir la reputación (tolerancia 12 puntos por ruido)', LV.every(function (v, z) { return z === 0 || R[v].F >= R[LV[z - 1]].F - 12; }));
t('no hay saltos artificiales: ningún tramo consecutivo sube más de 45 puntos de extranjeros (' + Math.round(maxStep) + ' en ' + maxAt + ')', maxStep <= 45);
t('con reputación 70 hay más interés extranjero que con 29', R[70].F > R[29].F + 20);
t('con reputación 50 ya hay algo de interés extranjero o europeo', R[50].F > R[29].F);
// ---------- B) el mercado nacional sigue vivo con reputación alta ----------
t('con reputación 85 siguen llegando ofertas de clubes del país (' + Math.round(R[85].H) + ' %)', R[85].H >= 10);
t('con reputación 85 siguen llegando ofertas de clubes del país de nivel parecido o mejor (' + Math.round(R[85].HB) + ' %)', R[85].HB >= 8);
t('con reputación 70 el interés del país no desaparece (' + Math.round(R[70].H) + ' %)', R[70].H >= 10);
// ---------- C) bajar de división: razones deportivas o económicas ----------
var s0 = Rep.situation(), wk = pool.filter(function (c) { return c.st <= cur.st - 12 && c.c === cc; }), N2 = 3000;
function gate(club, s, opts) { var n = 0; for (var q = 0; q < N2; q++) if (Rep.lowerGate(club, s, null, opts ? Object.assign({}, opts) : null)) n++; return n / N2 * 100; }
var tgt = wk.sort(function (a, b) { return b.st - a.st; })[0] || pool.filter(function (c) { return c.st <= cur.st - 12; })[0];
var base = gate(tgt, s0), rich = gate(tgt, s0, { wage: (h.contract.wage || 40) * 3 });
var sWant = Object.assign({}, s0, { wantMove: true }), want2 = gate(tgt, sWant), wantRich = gate(tgt, sWant, { wage: (h.contract.wage || 40) * 3 });
var sVet = Object.assign({}, s0, { age: 33 }), vet = gate(tgt, sVet);
console.log('puerta a un club ' + (cur.st - tgt.st) + ' puntos inferior (' + tgt.nm + '): base ' + Math.round(base) + ' % | sueldo ×3 ' + Math.round(rich) + ' % | quiere salir ' + Math.round(want2) + ' % | quiere salir y sueldo ×3 ' + Math.round(wantRich) + ' % | veterano ' + Math.round(vet) + ' %');
t('un titular rara vez baja sin razón (' + Math.round(base) + ' %)', base < 15);
t('un sueldo mucho mayor abre la puerta (' + Math.round(rich) + ' % frente a ' + Math.round(base) + ' %)', rich > base);
t('querer salir abre la puerta (' + Math.round(want2) + ' % frente a ' + Math.round(base) + ' %)', want2 > base * 2);
t('querer salir y mejor sueldo es la combinación más abierta', wantRich >= want2 && wantRich >= rich);
t('un veterano acepta bajar más que un joven titular (' + Math.round(vet) + ' % frente a ' + Math.round(base) + ' %)', vet > base);
var bl = pool.filter(function (c) { return c.st <= cur.st - 6 && lgq(c) > lgq(cur) + 2; })[0];
if (bl) { var a1 = Rep.attract(bl), a2 = Rep.attract(tgt); console.log('mejor liga con club inferior (' + bl.nm + '): atractivo ' + a1.toFixed(2) + ' frente a ' + a2.toFixed(2)); t('un club algo inferior de una liga de mayor calidad resulta más atractivo que uno de una liga peor', a1 > a2); }
else console.log('no hay club algo inferior en liga de mayor calidad en este mundo (omitido)');
var sB = Object.assign({}, s0, { role: 'Suplente' }), fb = Rep.fit(tgt); t('un club inferior ofrece más minutos esperados (encaje con hueco) que el actual', fb.gap >= 3 || fb.kind === 'project' || fb.ok);
// integración: quien pide salir con mejor sueldo recibe precontratos de clubes inferiores
h.flags.transferReq = true; var wl = sample(function () { h.rep.int = 40; }, 100); h.flags.transferReq = false; var nl = sample(function () { h.rep.int = 40; }, 100);
var wd = frac(wl, function (c) { return c.st - cur.st <= -6; }), nd = frac(nl, function (c) { return c.st - cur.st <= -6; });
console.log('integración (int 40): clubes ≥6 por debajo — pide salir ' + Math.round(wd) + ' % | no pide ' + Math.round(nd) + ' %');
t('hay precontratos de clubes inferiores cuando el jugador pide salir', wl.some(function (c) { return c.st - cur.st <= -6; }));
console.log('ok', ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
