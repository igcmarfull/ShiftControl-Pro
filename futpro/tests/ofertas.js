/* Pruebas de ofertas de cantera: sin ofertas duplicadas y sin ofertas obsoletas tras firmar. Uso: node tests/ofertas.js */
var H = require('./harness.js'), FP = H.FP, M = FP.Market, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var snap = H.buildWorld(4242), S = H.restore(snap);
var c = S.clubs.filter(function (c) { return FP.LGDEF[c.lg].t === 2 && c.c === 'CHI'; })[0];
var h = FP.Game.startCareer({ nm: 'Zz', nat: 'CHI', city: '', age: 15, h: 170, kg: 60, pos: 'ST', foot: 'R', style: 'killer', extra: { fin: 12, rem: 12 }, ovrTarget: 60, club: { kind: 'academy', id: c.id } });
var maxDup = 0, signed = false, afterSign = 0;
for (var i = 0; i < 52 * 4 && !h.retired; i++) {
  FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek();
  var cnt = {}; h.offers.forEach(function (o) { var k = o.type + ':' + o.club; cnt[k] = (cnt[k] || 0) + 1; maxDup = Math.max(maxDup, cnt[k]); });
  if (h.contract && h.contract.type === 'prof') afterSign = Math.max(afterSign, h.offers.filter(function (o) { return o.type === 'pro' && o.club === h.club; }).length);
  h.offers.slice().forEach(function (o) { if (o.type === 'pro' && !signed) { var r = M.respond(o.id, true); signed = signed || h.contract && h.contract.type === 'prof'; } else if (o.type === 'academy' || o.type === 'trial') M.respond(o.id, true); });
}
t('una sola oferta igual por club', maxDup <= 1, maxDup);
t('firmó contrato profesional', signed);
t('sin ofertas profesionales repetidas tras firmar', afterSign === 0, afterSign);
console.log('ok', ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
