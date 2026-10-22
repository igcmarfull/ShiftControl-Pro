// ¿cambia el agente la cantidad o el nivel de las ofertas? mismo héroe, semilla igual, con y sin agente de nivel 5
var root = require('path').join(__dirname, '..', '..'), H = require(root + '/tests/harness.js'), FP = H.FP, seed = +process.argv[2], lvl = +process.argv[3];
var S = H.restore(H.buildWorld(seed)), h = FP.Game.startPreset(), M = FP.Market, D = FP.Date;
var cl = S.clubs.filter(function (c) { return c.lg === 'CHI1'; }).sort(function (a, b) { return a.st - b.st; }), club = cl[Math.floor(cl.length / 2)];
h.b = D.of(2026 - 21, 5, 15); S.pl[0].b = h.b; h.bd = [2005, 5, 15]; h.nat = 'CHI'; S.pl[0].nat = 'CHI';
FP.Core.ATTRS.forEach(function (a) { h.at[a] = 60; h.cap[a] = 92; }); ['fin', 'rem', 'com', 'pos'].forEach(function (a) { h.at[a] = 70; }); h.pot = 80; S.pl[0].pt = 80; h.pos = 'ST'; FP.Hero.updateOvr(); h.tk = 'amat'; h.club = null;
var o = M.addOffer({ type: 'pro', club: club.id, years: 3, wage: 40, role: 'Titular', text: 'x', exp: S.week + 20 }); M.respond(o.id, true);
if (lvl) h.agent = { nm: 'Agente (agente)', lvl: lvl, com: lvl === 1 ? 3 : lvl === 3 ? 6 : 10 };
var n = { transfer: 0, precontract: 0, loan: 0, other: 0 }, wsum = 0, wn = 0, stsum = 0, add0 = M.addOffer;
M.addOffer = function (of) { var r = add0.apply(this, arguments); if (of.type !== 'pro') { n[n[of.type] != null ? of.type : 'other']++; if (of.wage) { wsum += of.wage; wn++; } if (of.club != null) stsum += S.clubs[of.club].st; } return r; };
for (var i = 0; i < 104; i++) { FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h); FP.Dec.open().forEach(function (d) { FP.Dec.resolve(d.id, d.opts[0].k); }); }
console.log(JSON.stringify({ seed: seed, lvl: lvl, ofertas: n, total: n.transfer + n.precontract + n.loan + n.other, sueldoMedio: wn ? Math.round(wsum / wn) : 0, nivelMedioComprador: wn ? Math.round(stsum / Math.max(1, n.transfer + n.precontract + n.loan + n.other)) : 0 }));
