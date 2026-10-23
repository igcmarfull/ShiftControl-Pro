/* Huella de una carrera de 104 semanas con un representante del formato antiguo ya contratado.
   Se ejecuta en dos versiones del código y las salidas deben ser idénticas (la fase 1 no cambia el comportamiento).
   Uso: node tools/auditoria/huella-agente.js [semilla] */
var path = require('path'), H = require(path.join(__dirname, '..', '..', 'tests', 'harness.js')), FP = H.FP;
var seed = +process.argv[2] || 31337, S = H.restore(H.buildWorld(seed)), h = FP.Game.startPreset(), M = FP.Market;
var cl = S.clubs.filter(function (c) { return c.lg === 'CHI1'; }).sort(function (a, b) { return a.st - b.st; }), club = cl[Math.floor(cl.length / 2)];
h.b = FP.Date.of(2026 - 21, 5, 15); S.pl[0].b = h.b; h.bd = [2005, 5, 15]; h.nat = 'CHI'; S.pl[0].nat = 'CHI';
FP.Core.ATTRS.forEach(function (a) { h.at[a] = 60; h.cap[a] = 92; }); ['fin', 'rem', 'com', 'pos'].forEach(function (a) { h.at[a] = 70; }); h.pot = 80; S.pl[0].pt = 80; h.pos = 'ST'; FP.Hero.updateOvr(); h.tk = 'amat'; h.club = null;
var o = M.addOffer({ type: 'pro', club: club.id, years: 3, wage: 40, role: 'Titular', text: 'x', exp: S.week + 20 }); M.respond(o.id, true);
h.agent = { nm: 'Representante Prueba (agente)', lvl: 3, com: 6 };
if (FP.Agents) FP.Agents.migrate();
var log = [];
for (var i = 0; i < 104; i++) {
  FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h);
  FP.Dec.open().forEach(function (d) { FP.Dec.resolve(d.id, d.opts[0].k); });
  if (i % 13 === 12) log.push([S.week, h.club, Math.round(h.money * 100) / 100, h.ovr, (h.offers || []).map(function (x) { return x.type + ':' + x.club + ':' + (x.t && x.t.wage != null ? x.t.wage : x.wage); }).join(',')].join('|'));
}
var hash = 0, str = JSON.stringify(log); for (var k = 0; k < str.length; k++) hash = (hash * 31 + str.charCodeAt(k)) | 0;
console.log(log.join('\n')); console.log('rs ' + S.rs + ' | dinero ' + Math.round(h.money * 100) / 100 + ' | club ' + h.club + ' | ovr ' + h.ovr + ' | huella ' + hash);
process.exit(0);
