/* Precontratos y reparto del interés de los clubes (js/scouting.js: Rep.pull / pickClub / lowerGate / offerGate; js/contracts.js: K.preOffers).
   Uso: node tests/precontratos.js   (≈ 2 minutos)
   Los porcentajes son supuestos de diseño; antes del cambio, con un delantero chileno de nivel 77 en un equipo de nivel 67: 51 % de los precontratos venía de
   clubes extranjeros, 65 % de clubes más débiles que el actual (19 % mucho más débiles) y el interés tras un gran partido se repartía uniforme entre 726 clubes. */
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
var sit = Rep.situation(), N = 3000, picks = []; for (var k = 0; k < N; k++) picks.push(Rep.pickClub(pool, sit));
function pc(f) { return picks.filter(f).length / N * 100; }
var foreign = pc(function (c) { return c.c !== cc; }), europe = pc(function (c) { return conf(c) === 'UEFA'; }), weak = pc(function (c) { return c.st - cur.st <= -15; }), same = pc(function (c) { return c.st - cur.st > -6; }), home = pc(function (c) { return c.c === cc; }), conmebol = pc(function (c) { return conf(c) === conf({ c: cc }); });
console.log('interés: extranjeros ' + Math.round(foreign) + ' % | Europa ' + Math.round(europe) + ' % | muy débiles ' + Math.round(weak) + ' % | nivel parecido o mejor ' + Math.round(same) + ' % | país ' + Math.round(home) + ' % | confederación ' + Math.round(conmebol) + ' %');
var uniHome = pool.filter(function (c) { return c.c === cc; }).length / pool.length * 100, uniWeak = pool.filter(function (c) { return c.st - cur.st <= -15; }).length / pool.length * 100;
t('el interés favorece a los clubes del país frente al reparto uniforme (' + Math.round(home) + ' % frente a ' + Math.round(uniHome) + ' %)', home > uniHome * 3);
t('el interés internacional sigue existiendo: al menos 20 % de clubes extranjeros (' + Math.round(foreign) + ' %)', foreign >= 20);
t('Europa recibe al menos 8 % del interés de un jugador chileno destacado (' + Math.round(europe) + ' %)', europe >= 8);
t('los clubes muy inferiores reciben mucho menos que su peso en el pool (' + Math.round(weak) + ' % frente a ' + Math.round(uniWeak) + ' %)', weak < uniWeak * 0.35);
t('al menos 30 % del interés viene de clubes de nivel parecido o mejor (' + Math.round(same) + ' %)', same >= 30);
t('hay sorpresas: algún interés viene de clubes muy inferiores (' + Math.round(weak * 10) / 10 + ' %)', weak > 0.3);
t('los pesos son positivos y finitos', pool.every(function (c) { var w = Rep.pull(c, null, sit); return w > 0 && isFinite(w); }));

// ---------- 2) precontratos según la reputación internacional ----------
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
var low = sample(function () { h.rep.int = 29; }, 100);
var pF = frac(low, function (c) { return c.c !== cc; }), pW = frac(low, function (c) { return c.st - cur.st <= -6; }), pWW = frac(low, function (c) { return c.st - cur.st <= -15; }), pS = frac(low, function (c) { return c.st - cur.st > -6; });
console.log('reputación internacional 29: n ' + low.length + ' | extranjeros ' + Math.round(pF) + ' % | ≥6 por debajo ' + Math.round(pW) + ' % | ≥15 por debajo ' + Math.round(pWW) + ' % | parecido o mejor ' + Math.round(pS) + ' %');
t('con poca fama fuera se generan precontratos suficientes para medir (' + low.length + ')', low.length >= 40);
t('con poca fama fuera: como mucho 15 % de clubes ≥6 puntos inferiores (antes 65 %) (' + Math.round(pW) + ' %)', pW <= 15);
t('con poca fama fuera: como mucho 5 % de clubes ≥15 puntos inferiores (antes 19 %) (' + Math.round(pWW) + ' %)', pWW <= 5);
t('con poca fama fuera los precontratos son sobre todo del país (extranjeros ' + Math.round(pF) + ' %): ningún club europeo competitivo puede observarlo', pF <= 25);
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
t('quien pide salir recibe más propuestas de clubes inferiores que quien no (' + Math.round(wW) + ' % frente a ' + Math.round(bW) + ' %)', want.length >= 20 && wW > bW);

// ---------- 3) puertas ----------
var weakClub = pool.filter(function (c) { return c.st <= cur.st - 15; })[0], goodClub = pool.filter(function (c) { return c.st >= cur.st; })[0];
var passW = 0, passG = 0, M2 = 2000; for (var q = 0; q < M2; q++) { if (Rep.lowerGate(weakClub)) passW++; if (Rep.lowerGate(goodClub)) passG++; }
t('un club igual o mejor siempre pasa la puerta de nivel', passG === M2);
t('un club muy inferior pasa solo en pocas ocasiones y no nunca (' + Math.round(passW / M2 * 100) + ' %)', passW / M2 > 0.01 && passW / M2 < 0.15);
var aW = Rep.attract(weakClub, null, { wage: 10 }), aG = Rep.attract(goodClub, null, { wage: 600 });
t('una propuesta mejor (sueldo, minutos, liga) es más atractiva (' + aG.toFixed(2) + ' frente a ' + aW.toFixed(2) + ')', aG > aW && aG <= 1 && aW >= 0);
t('el atractivo siempre está entre 0 y 1', pool.slice(0, 80).every(function (c) { var a = Rep.attract(c); return a >= 0 && a <= 1; }));
t('Rep.fit no se modificó: sigue sin límite inferior', pool.some(function (c) { return Rep.fit(c).ok && c.st <= cur.st - 15; }));
console.log('ok', ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
