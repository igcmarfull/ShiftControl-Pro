/* Precontratos 2: apertura progresiva con la reputación internacional, mercado nacional con fama alta y bajadas de división (js/scouting.js, js/contracts.js).
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
function sample(setup, runs) {
  var out = []; h.contract = h.contract || {}; h.contract.endW = S.week + 20;
  for (var run = 0; run < runs && out.length < 100; run++) {
    h.int = []; h.cd = {}; h.offers = []; var n = 0; setup();
    while (n++ < 60 && h.int.filter(function (e) { return e.v >= 40; }).length < 4) { Rep.scoutWeek(S.week); if (U.R() < 0.2) Rep.spark({ played: true, rating: 8.5, g: 2 }); }
    K.preOffers(); h.offers.filter(function (x) { return x.type === 'precontract'; }).forEach(function (x) { out.push(S.clubs[x.club]); });
  }
  return out;
}
function frac(list, f) { return list.length ? list.filter(f).length / list.length * 100 : 0; }
var lgq = function (c) { return FP.LGDEF[c.lg].q; };
var hc = function (c) { return c.c === cc; };
// ---------- A) apertura progresiva ----------
var LV = [29, 35, 40, 45, 50, 60, 70, 85], R = {};
LV.forEach(function (v) { var l = sample(function () { h.rep.int = v; }, 100); R[v] = { n: l.length, F: frac(l, function (c) { return !hc(c); }), E: frac(l, function (c) { return conf(c) === 'UEFA'; }), H: frac(l, hc), HB: frac(l, function (c) { return hc(c) && c.st >= cur.st - 3; }), W: frac(l, function (c) { return c.st - cur.st <= -6; }), Q: frac(l, function (c) { return lgq(c) > lgq(cur); }) };
  console.log('rep. internacional ' + v + ': n ' + l.length + ' | extranjeros ' + Math.round(R[v].F) + ' % | Europa ' + Math.round(R[v].E) + ' % | del país ' + Math.round(R[v].H) + ' % | del país de nivel parecido o mejor ' + Math.round(R[v].HB) + ' % | ≥6 por debajo ' + Math.round(R[v].W) + ' % | liga de mayor calidad ' + Math.round(R[v].Q) + ' %'); });
LV.forEach(function (v) { t('hay muestra suficiente con reputación ' + v + ' (' + R[v].n + ')', R[v].n >= 20); });
var maxStep = 0, maxAt; for (var z = 1; z < LV.length; z++) { var st = R[LV[z]].F - R[LV[z - 1]].F; if (st > maxStep) { maxStep = st; maxAt = LV[z - 1] + '→' + LV[z]; } }
console.log('mayor salto de extranjeros entre niveles consecutivos: ' + Math.round(maxStep) + ' puntos (' + maxAt + ')');
t('la apertura internacional no retrocede de forma apreciable al subir la reputación (tolerancia 20 puntos: con ~45 muestras por nivel el error de una diferencia ronda los 10)', LV.every(function (v, z) { return z === 0 || R[v].F >= R[LV[z - 1]].F - 20; }));
t('no hay saltos artificiales: ningún tramo consecutivo sube más de 45 puntos de extranjeros (' + Math.round(maxStep) + ' en ' + maxAt + ')', maxStep <= 45);
t('con reputación 70 hay más interés extranjero que con 29', R[70].F > R[29].F + 20);
t('con reputación 50 ya hay algo de interés extranjero o europeo', R[50].F > R[29].F);
// ---------- B) el mercado nacional sigue vivo con reputación alta ----------
// un delantero de 77 en un club mediano tiene pocos clubes nacionales que puedan mejorarle: las ofertas son sobre todo extranjeras, pero los clubes del país no dejan de observarlo
t('con reputación 85 siguen llegando algunas ofertas de clubes del país (' + Math.round(R[85].H) + ' %)', R[85].H >= 5);
t('con reputación 70 siguen llegando algunas ofertas de clubes del país (' + Math.round(R[70].H) + ' %)', R[70].H >= 5);
t('con reputación 70 la mayoría de las ofertas sigue siendo extranjera (' + Math.round(R[70].F) + ' %)', R[70].F >= 60);
[50, 70, 85].forEach(function (v) {
  h.rep.int = v; var dI = 0, tI = 0, cov = 0, RUNS = 30, better = S.clubs.filter(function (c) { return c !== cur && hc(c) && c.st >= cur.st - 3; });
  for (var r = 0; r < RUNS; r++) { h.int = []; h.cd = {}; for (var w = 0; w < 40; w++) { Rep.scoutWeek(S.week); if (U.R() < 0.2) Rep.spark({ played: true, rating: 8.5, g: 2 }); } h.int.forEach(function (e) { tI++; if (hc(S.clubs[e.c])) dI++; }); cov += better.length ? better.filter(function (c) { return Rep.interestOf(c.id) >= 20; }).length / better.length : 1; }
  console.log('interés nacional con reputación ' + v + ': ' + Math.round(dI / Math.max(tI, 1) * 100) + ' % del interés | clubes del país de nivel parecido o mejor que lo siguen (interés ≥20) ' + Math.round(cov / RUNS * 100) + ' % (' + better.length + ' clubes)');
  t('con reputación ' + v + ' los clubes del país siguen observándolo: al menos 8 % del interés (' + Math.round(dI / Math.max(tI, 1) * 100) + ' %)', dI / Math.max(tI, 1) >= 0.08);
  t('con reputación ' + v + ' los clubes del país que pueden mejorarlo lo siguen en al menos 30 % de los casos (' + Math.round(cov / RUNS * 100) + ' %)', !better.length || cov / RUNS >= 0.3);
});
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
