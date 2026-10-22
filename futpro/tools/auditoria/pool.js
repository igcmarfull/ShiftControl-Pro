// ¿qué clubes pueden fijarse en el protagonista (precontratos y ofertas)? pool elegible y su peso de selección
var root = require('path').join(__dirname, '..', '..'), H = require(root + '/tests/harness.js'), FP = H.FP;
var lgName = process.argv[2] || 'CHI1', base = +process.argv[3] || 64, nat = process.argv[4] || 'CHI';
var S = H.restore(H.buildWorld(777)), h = FP.Game.startPreset(), M = FP.Market, Rep = FP.Rep, D = FP.Date, U = FP.U;
var cl = S.clubs.filter(function (c) { return c.lg === lgName; }).sort(function (a, b) { return a.st - b.st; }), club = cl[Math.floor(cl.length / 2)];
h.b = D.of(2026 - 21, 5, 15); S.pl[0].b = h.b; h.bd = [2005, 5, 15]; h.nat = nat; S.pl[0].nat = nat;
FP.Core.ATTRS.forEach(function (a) { h.at[a] = base - 4; h.cap[a] = 92; }); ['fin', 'rem', 'com', 'pos'].forEach(function (a) { h.at[a] = base + 6; }); h.pot = 80; S.pl[0].pt = 80; h.pos = 'ST'; FP.Hero.updateOvr(); h.tk = 'amat'; h.club = null;
var o = M.addOffer({ type: 'pro', club: club.id, years: 3, wage: 40, role: 'Titular', text: 'x', exp: S.week + 20 }); M.respond(o.id, true);
for (var i = 0; i < 52 * 2; i++) { FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h); FP.Dec.open().forEach(function (d) { FP.Dec.resolve(d.id, d.opts[0].k); }); }
var age = FP.Hero.age(), cur = S.clubs[h.club];
console.log('héroe: edad', age, 'ovr', h.ovr, '| club', cur.nm, cur.c, 'q' + FP.LGDEF[cur.lg].q, 'st', Math.round(cur.st), '| rep', Math.round(h.rep.loc) + '/' + Math.round(h.rep.nat) + '/' + Math.round(h.rep.int));
var pool = S.clubs.filter(function (c) { if (c === cur) return false; var ex = Rep.exposure(c); if (!ex.ok) return false; if (!Rep.foreignOK(c, h.nat, age) || !Rep.permit(c)) return false; var f = Rep.fit(c); return f.kind !== 'none' && f.ok; });
var tw = 0, W = pool.map(function (c) { var f = Rep.fit(c), w = f.need * Math.exp(-Math.abs(f.gap) / 6) * (c.c === M.heroCountry() ? 1.5 : 0.8); tw += w; return { c: c, f: f, w: w }; });
var dom = W.filter(function (x) { return x.c.c === M.heroCountry(); }), fo = W.filter(function (x) { return x.c.c !== M.heroCountry(); });
console.log('clubes elegibles:', pool.length, '| del país', dom.length, '| extranjeros', fo.length, ' (de', S.clubs.length, 'clubes)');
var wd = dom.reduce(function (a, x) { return a + x.w; }, 0);
console.log('probabilidad de que la selección semanal (scoutWeek) elija un club del país:', Math.round(wd / tw * 100) + '%; extranjero:', Math.round((tw - wd) / tw * 100) + '%');
function buck(list) { var b = { 'muy por debajo (st −15 o menos)': 0, 'por debajo (−14..−6)': 0, 'parecido (−5..+5)': 0, 'por encima (+6..)': 0 }; list.forEach(function (x) { var d = x.c.st - cur.st; b[d <= -15 ? 'muy por debajo (st −15 o menos)' : d <= -6 ? 'por debajo (−14..−6)' : d <= 5 ? 'parecido (−5..+5)' : 'por encima (+6..)']++; }); return JSON.stringify(b); }
console.log('nivel de los elegibles respecto al club actual:', buck(W));
var byc = {}; pool.forEach(function (c) { byc[c.c] = (byc[c.c] || 0) + 1; }); console.log('por país:', Object.keys(byc).sort(function (a, b) { return byc[b] - byc[a]; }).slice(0, 14).map(function (k) { return k + ' ' + byc[k]; }).join(' · '));
// la elección de Rep.spark es uniforme entre todos los elegibles
console.log('Rep.spark (tras un gran partido) elige uniformemente entre los', pool.length, 'elegibles: probabilidad de un club extranjero', Math.round(fo.length / pool.length * 100) + '%; de un club mucho más débil que el actual', Math.round(W.filter(function (x) { return x.c.st - cur.st <= -15; }).length / pool.length * 100) + '%');
// muestreo de precontratos: se repite el ciclo «ojeadores → interés → precontrato» y se anota quién ofrece
var K = FP.Contracts, offers = [], tries = 0;
h.contract = h.contract || {}; h.contract.endW = S.week + 20;
K.ensure();
for (var run = 0; run < 400 && offers.length < 150; run++) {
  h.int = []; h.cd = {}; h.offers = []; var n = 0;
  while (n++ < 60 && h.int.filter(function (e) { return e.v >= 40; }).length < 4) { Rep.scoutWeek(S.week); if (U.R() < 0.2) Rep.spark({ played: true, rating: 8.5, g: 2 }); }
  var made = K.preOffers(); h.offers.filter(function (x) { return x.type === 'precontract'; }).forEach(function (x) { offers.push(S.clubs[x.club]); });
}
var nOff = offers.length, fo = offers.filter(function (c) { return c.c !== M.heroCountry(); }).length, weak = offers.filter(function (c) { return c.st - cur.st <= -15; }).length, mid = offers.filter(function (c) { return c.st - cur.st > -15 && c.st - cur.st <= -6; }).length, par = offers.filter(function (c) { return c.st - cur.st > -6; }).length, t1 = offers.filter(function (c) { return FP.LGDEF[c.lg].t === 1; }).length;
console.log('\nPRECONTRATOS (muestra de ' + nOff + ' ofertas generadas por K.preOffers):');
console.log('  de clubes extranjeros:', Math.round(fo / nOff * 100) + '%', '| clubes con nivel ≥15 puntos por debajo del actual:', Math.round(weak / nOff * 100) + '%', '| 6-14 por debajo:', Math.round(mid / nOff * 100) + '%', '| parecido o mejor:', Math.round(par / nOff * 100) + '%', '| de primera división:', Math.round(t1 / nOff * 100) + '%');
var byc2 = {}; offers.forEach(function (c) { byc2[c.c] = (byc2[c.c] || 0) + 1; }); console.log('  países:', Object.keys(byc2).sort(function (a, b) { return byc2[b] - byc2[a]; }).slice(0, 12).map(function (k) { return k + ' ' + byc2[k]; }).join(' · '));
console.log('  ejemplos:', offers.slice(0, 8).map(function (c) { return c.nm + ' (' + c.c + ' st' + Math.round(c.st) + ')'; }).join(' | '));
// reparto del interés (Rep.pickClub: lo que usan spark y scoutWeek) entre los elegibles
if (Rep.pickClub) {
  var picks = [], sit = Rep.situation(); for (var k = 0; k < 3000; k++) picks.push(Rep.pickClub(pool, sit));
  var pf = picks.filter(function (c) { return c.c !== M.heroCountry(); }).length, pw = picks.filter(function (c) { return c.st - cur.st <= -15; }).length, pe = picks.filter(function (c) { return FP.DATA.countries[c.c].conf === 'UEFA'; }).length, pb = picks.filter(function (c) { return c.st - cur.st > -6; }).length;
  console.log('\nINTERÉS (3000 elecciones de Rep.pickClub): extranjeros', Math.round(pf / 30) + '%', '| de Europa', Math.round(pe / 30) + '%', '| muy débiles (−15 o menos)', Math.round(pw / 30) + '%', '| parecidos o mejores', Math.round(pb / 30) + '%');
}
