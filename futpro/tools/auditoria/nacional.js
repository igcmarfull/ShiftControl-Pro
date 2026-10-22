var H = require(require('path').join(__dirname,'..','..','tests','harness.js')), FP = H.FP, ok = 0, bad = 0;
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
// Diagnóstico: ¿por qué desaparecen las ofertas nacionales con reputación alta? Separa interés, elegibilidad y ofertas.
var hc = function (c) { return c.c === cc; }, sit = Rep.situation();
console.log('club actual: ' + cur.nm + ' (st ' + cur.st + ', ' + cur.lg + '), héroe ovr ' + h.ovr + ', rol ' + sit.role);
console.log('clubes del país (sin el actual) con st >= actual-3: ' + S.clubs.filter(function (c) { return c !== cur && hc(c) && c.st >= cur.st - 3; }).length + ' | del país total: ' + S.clubs.filter(function (c) { return c !== cur && hc(c); }).length);
[50, 70].forEach(function (v) {
  h.rep.int = v;
  var vis = S.clubs.filter(function (c) { return c !== cur && Rep.exposure(c).ok && Rep.foreignOK(c, h.nat, age) && Rep.permit(c); });
  var el = vis.filter(function (c) { var f = Rep.fit(c); return f.kind !== 'none' && f.ok; });
  var D = el.filter(hc), F = el.filter(function (c) { return !hc(c); });
  var mass = function (l) { return l.reduce(function (a, c) { return a + Rep.pull(c, null, sit); }, 0); }, mD = mass(D), mF = mass(F);
  var Dup = D.filter(function (c) { return c.st >= cur.st - 3; });
  console.log('--- int ' + v + ': visibles ' + vis.length + ' | elegibles del país ' + D.length + ' (de nivel parecido o mejor ' + Dup.length + ') | extranjeros ' + F.length + ' | peso medio del país ' + (mD / Math.max(D.length, 1)).toFixed(2) + ' vs extranjero ' + (mF / Math.max(F.length, 1)).toFixed(2) + ' | parte del peso total que va al país ' + Math.round(mD / (mD + mF) * 100) + ' %');
  // etapa interés: ¿a quién sigue?
  var cnt = { d: 0, f: 0 }; for (var r = 0; r < 60; r++) { h.int = []; h.cd = {}; for (var w = 0; w < 30; w++) Rep.scoutWeek(S.week); h.int.forEach(function (e) { cnt[hc(S.clubs[e.c]) ? 'd' : 'f']++; }); }
  console.log('    interés (clubes que lo siguen): del país ' + cnt.d + ' | extranjeros ' + cnt.f + ' → ' + Math.round(cnt.d / Math.max(cnt.d + cnt.f, 1) * 100) + ' % del país');
  // etapa ofertas: ¿qué clubes del país pasan los filtros de oferta?
  var sampleN = 400, pass = { d: 0, f: 0 }, tot = { d: 0, f: 0 };
  for (var k = 0; k < sampleN; k++) { var c = U.pick(el), key = hc(c) ? 'd' : 'f'; tot[key]++; if (Rep.lowerGate(c) && Rep.offerGate(c)) pass[key]++; }
  console.log('    puertas de oferta (muestra uniforme de elegibles): país ' + pass.d + '/' + tot.d + ' | extranjeros ' + pass.f + '/' + tot.f);
});
process.exit(0);
