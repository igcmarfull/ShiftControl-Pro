// estrella en una liga débil: delantero de ovr ~70 con remate alto en Guatemala; 4 temporadas, ofertas y reputación
var root = '' + require('path').join(__dirname, '..', '..') + '', H = require(root + '/tests/harness.js'), FP = H.FP;
var lg = process.argv[2] || 'GUA1', base = +process.argv[3] || 66, shotUp = +process.argv[4] || 10;
var S = H.restore(H.buildWorld(777)), h = FP.Game.startPreset(), M = FP.Market, D = FP.Date;
var cl = S.clubs.filter(function (c) { return c.lg === lg; }).sort(function (a, b) { return a.st - b.st; }), club = cl[Math.floor(cl.length / 2)];
// edad 20, atributos hechos a mano
h.b = D.of(2026 - 20, 5, 15); S.pl[0].b = h.b; h.bd = [2006, 5, 15]; S.week = Math.max(S.week, 0);
FP.Core.ATTRS.forEach(function (a) { h.at[a] = base - 6; h.cap[a] = 92; });
['fin', 'rem', 'com', 'pos'].forEach(function (a) { h.at[a] = base + shotUp; }); ['vel', 'ace'].forEach(function (a) { h.at[a] = base; });
h.pot = 82; S.pl[0].pt = 82; h.pos = 'ST'; FP.Hero.updateOvr(); h.tot.ap = 0; h.tot.g = 0;
h.tk = 'amat'; h.club = null;
var o = M.addOffer({ type: 'pro', club: club.id, years: 3, wage: 40, role: 'Titular', text: 'x', exp: S.week + 20 }); M.respond(o.id, true);
console.log('inicio:', club.nm, lg, 'q', FP.LGDEF[lg].q, 'st', Math.round(club.st), '| héroe ovr', h.ovr, 'remate', Math.round(FP.Hero.view(0, 0).shotSkill()), 'tk', h.tk, 'club', h.club);
var seen = 0, lastSeason = null;
function snap(tag) { var c = h.club != null ? S.clubs[h.club] : null; console.log(tag, 'edad', FP.Hero.age(), 'ovr', h.ovr, '| club', c ? c.nm + ' (' + c.c + ' q' + FP.LGDEF[c.lg].q + ' st' + Math.round(c.st) + ')' : h.tk, '| rep', Math.round(h.rep.loc) + '/' + Math.round(h.rep.nat) + '/' + Math.round(h.rep.int), '| acumulado', h.tot.g + ' g en ' + h.tot.ap + ' p', '| valor', M.heroValue(), 'nt', h.nt.caps); }
var add0 = M.addOffer; M.addOffer = function (of) { var r = add0.apply(this, arguments); if (of.club != null && of.type !== 'pro') { var cc = S.clubs[of.club], q = FP.LGDEF[cc.lg]; console.log('   OFERTA', of.type, '→', cc.nm, '(' + cc.c + ' q' + q.q + ' t' + q.t + ' st' + Math.round(cc.st) + ')', 'rol', of.role, 'sueldo', of.wage, 'traspaso', of.fee, '| g/p temporada', h.season.ap ? (h.season.g / h.season.ap).toFixed(2) : '-'); } return r; };
for (var i = 0; i < 52 * 5; i++) {
  FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h); FP.Dec.open().forEach(function (d) { FP.Dec.resolve(d.id, d.opts[0].k); });
  if (i % 52 === 51) snap('  fin año ' + Math.floor(i / 52 + 1));
}
console.log('seasons:', h.seasons.map(function (s) { return s.club + ' ' + s.g + 'g/' + s.ap + 'p'; }).join(' | '));
