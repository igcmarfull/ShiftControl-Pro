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
var hc = function (c) { return c.c === cc; }, better = S.clubs.filter(function (c) { return c !== cur && hc(c) && c.st >= cur.st - 3; });
console.log('club actual ' + cur.nm + ' st ' + cur.st + ' | clubes del país de nivel parecido o mejor: ' + better.length);
function frac(l, f) { return l.length ? l.filter(f).length / l.length * 100 : 0; }
[0, 0.15, 0.3, 0.45].forEach(function (d) {
  Rep.PULL.domestic = d;
  [40, 50, 70].forEach(function (v) {
    h.rep.int = v; var dI = 0, tI = 0, cov = 0, runs = 40, offD = 0, offT = 0;
    for (var r = 0; r < runs; r++) {
      h.int = []; h.cd = {}; h.offers = [];
      for (var w = 0; w < 40; w++) { Rep.scoutWeek(S.week); if (U.R() < 0.2) Rep.spark({ played: true, rating: 8.5, g: 2 }); }
      h.int.forEach(function (e) { tI++; if (hc(S.clubs[e.c])) dI++; });
      cov += better.filter(function (c) { return Rep.interestOf(c.id) >= 20; }).length / Math.max(better.length, 1);
      h.contract = h.contract || {}; h.contract.endW = S.week + 20; K.preOffers();
      h.offers.filter(function (x) { return x.type === 'precontract'; }).forEach(function (x) { offT++; if (hc(S.clubs[x.club])) offD++; });
    }
    console.log('domestic ' + d + ' | int ' + v + ': interés del país ' + Math.round(dI / Math.max(tI, 1) * 100) + ' % | cobertura de los ' + better.length + ' mejores del país (interés ≥20) ' + Math.round(cov / runs * 100) + ' % | precontratos del país ' + Math.round(offD / Math.max(offT, 1) * 100) + ' % (n ' + offT + ')');
  });
});
process.exit(0);
