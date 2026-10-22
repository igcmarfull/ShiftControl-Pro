var H = require(require('path').join(__dirname,'..','..','tests','harness.js')), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var S = H.restore(H.buildWorld(+process.env.SEED)), h = FP.Game.startPreset(), M = FP.Market, Rep = FP.Rep, D = FP.Date, U = FP.U, K = FP.Contracts;
var cl = S.clubs.filter(function (c) { return c.lg === 'CHI1'; }).sort(function (a, b) { return a.st - b.st; }), club = cl[Math.floor(cl.length * +process.env.Q)];
h.b = D.of(2026 - 21, 5, 15); S.pl[0].b = h.b; h.bd = [2005, 5, 15]; h.nat = 'CHI'; S.pl[0].nat = 'CHI';
FP.Core.ATTRS.forEach(function (a) { h.at[a] = +process.env.BASE; h.cap[a] = 92; }); ['fin', 'rem', 'com', 'pos'].forEach(function (a) { h.at[a] = 70; }); h.pot = 80; S.pl[0].pt = 80; h.pos = 'ST'; FP.Hero.updateOvr(); h.tk = 'amat'; h.club = null;
var o = M.addOffer({ type: 'pro', club: club.id, years: 3, wage: 40, role: 'Titular', text: 'x', exp: S.week + 20 }); M.respond(o.id, true);
for (var i = 0; i < 52 * 2; i++) { FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h); FP.Dec.open().forEach(function (d) { FP.Dec.resolve(d.id, d.opts[0].k); }); }
var age = FP.Hero.age(), cur = S.clubs[h.club], cc = M.heroCountry(), conf = function (c) { return FP.DATA.countries[c.c].conf; };

var age = FP.Hero.age(), cur = S.clubs[h.club], cc = M.heroCountry(), hc = function (c) { return c.c === cc; };
console.log('perfil seed ' + process.env.SEED + ' club ' + cur.nm + ' (st ' + cur.st + ') ovr ' + h.ovr + ' edad ' + age + ' | clubes del país de nivel parecido o mejor: ' + S.clubs.filter(function (c) { return c !== cur && hc(c) && c.st >= cur.st - 3; }).length);
function sample(v, runs) {
  var out = []; h.contract = h.contract || {}; h.contract.endW = S.week + 20;
  for (var run = 0; run < runs; run++) {
    h.int = []; h.cd = {}; h.offers = []; h.rep.int = v; var n = 0;
    while (n++ < 60 && h.int.filter(function (e) { return e.v >= 40; }).length < 4) { Rep.scoutWeek(S.week); if (U.R() < 0.2) Rep.spark({ played: true, rating: 8.5, g: 2 }); }
    K.preOffers(); h.offers.filter(function (x) { return x.type === 'precontract'; }).forEach(function (x) { out.push(S.clubs[x.club]); });
  }
  return out;
}
[0.05, 0.10, 0.15].forEach(function (d) {
  Rep.PULL.domestic = d;
  [50, 70].forEach(function (v) {
    var l = sample(v, 150), dn = l.filter(hc).length;
    console.log('  domestic ' + d + ' | int ' + v + ': precontratos del país ' + Math.round(dn / Math.max(l.length, 1) * 100) + ' % (n ' + l.length + ') | de nivel parecido o mejor ' + Math.round(l.filter(function (c) { return c.st >= cur.st - 3; }).length / Math.max(l.length, 1) * 100) + ' %');
  });
});
process.exit(0);
