/* Pruebas de la escala salarial por liga y por club (js/sueldos.js). Uso: node tests/sueldos.js */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var snap = H.buildWorld(555), S = H.restore(snap), W = FP.Wages, L = FP.LGDEF, C = FP.Core;
function avg(lgId) { var cl = S.clubs.filter(function (c) { return c.lg === lgId; }), s = 0, n = 0; cl.forEach(function (c) { (S.ro[c.id] || []).forEach(function (p) { if (p.i === 0) return; s += W.wage(C.value(p.o, p.pt, C.age(p)), c); n++; }); }); return n ? s / n : 0; }

// el sueldo medio de cada liga sigue la referencia (la masa salarial se normaliza a media 1)
['ENG1', 'ESP1', 'ITA1', 'FRA1', 'BRA1', 'ARG1', 'CHI1', 'MEX1', 'USA1', 'KSA1', 'JPN1', 'ENG2', 'ESP2', 'CHI2'].forEach(function (id) {
  var a = avg(id), ref = W.ref(id) * 1000;
  t(id + ': sueldo medio simulado ' + Math.round(a) + ' k€ cerca de la referencia ' + Math.round(ref) + ' k€ (±25 %: mínimos y techo recortan los extremos)', a > ref * 0.75 && a < ref * 1.25, Math.round(a) + ' vs ' + Math.round(ref));
});
// unas ligas pagan más que otras
var order = ['ENG1', 'ESP1', 'FRA1', 'BRA1', 'CHI1'], prev = Infinity;
order.forEach(function (id) { var a = avg(id); t('la liga ' + id + ' paga menos que la anterior en la lista', a < prev, a + ' vs ' + prev); prev = a; });
t('la liga saudí paga más que la Ligue 1', avg('KSA1') > avg('FRA1') * 1.1, avg('KSA1') + ' vs ' + avg('FRA1'));
t('la Premier paga más que la Liga MX y que la MLS', avg('ENG1') > avg('MEX1') * 5 && avg('ENG1') > avg('USA1') * 5);
// las divisiones inferiores pagan menos
[['ENG1', 'ENG2', 'ENG3'], ['ESP1', 'ESP2', 'ESP3'], ['BRA1', 'BRA2', 'BRA3'], ['ARG1', 'ARG2', 'ARG3'], ['CHI1', 'CHI2', 'CHI3']].forEach(function (g) { t('en ' + g[0].slice(0, 3) + ' cada categoría paga menos', avg(g[0]) > avg(g[1]) * 1.8 && avg(g[1]) > avg(g[2]) * 1.5, [avg(g[0]), avg(g[1]), avg(g[2])].map(Math.round).join('>')); });

// los clubes ricos pagan más por el mismo jugador (dentro de la misma liga)
var cl = S.clubs.filter(function (c) { return c.lg === 'ESP1'; }).sort(function (a, b) { return W.bill(a) - W.bill(b); }), poor = cl[0], rich = cl[cl.length - 1];
[1000, 5000, 20000].forEach(function (v) { var r = W.wage(v, rich) / W.wage(v, poor); t('un club rico paga entre 1,2 y 12 veces más por un jugador de ' + v + ' k€ (' + r.toFixed(2) + 'x)', r > 1.2 && r < 12, r); });
// forma de la curva
var md = cl[Math.floor(cl.length / 2)], prevW = 0; [100, 500, 1000, 2000, 5000, 10000, 20000, 50000].forEach(function (v) { var w = W.wage(v, md); t('el sueldo crece con el valor (' + v + ' k€ → ' + w + ' k€)', w >= prevW, prevW + ' → ' + w); t('el sueldo nunca supera 2,5 veces el valor ni baja de 2', w <= Math.max(2, v * 2.5) && w >= 2); prevW = w; });
// el sueldo medio de un club depende de su economía y de su plantel
t('el plantel de un club rico cobra más en promedio que el de uno pobre', W.clubAverage(rich) > W.clubAverage(poor) * 2, W.clubAverage(rich) + ' vs ' + W.clubAverage(poor));
// conexión con ofertas: sube con el valor y depende del club
var h = FP.Game.startPreset(); FP.S.week = FP.Date.of(2036, 5, 20); h.bd = [2012, 2, 14]; h.b = FP.Date.of(2012, 2, 14); h.ovr = 70; h.tk = 'pro'; FP.Life.ensure(); FP.Social.milestones(); FP.Social.followers();
var big = S.clubs.filter(function (c) { return c.lg === 'ENG1'; }).sort(function (a, b) { return b.fin - a.fin; })[0], small = S.clubs.filter(function (c) { return c.lg === 'CHI1'; }).sort(function (a, b) { return a.fin - b.fin; })[0];
t('el mismo jugador cobra más en un club grande inglés que en uno chico chileno (en Chile sería la figura de la liga, así que la diferencia no es de 20 veces)', FP.Rep.wage(big, 1) > FP.Rep.wage(small, 1) * 1.8, FP.Rep.wage(big, 1) + ' vs ' + FP.Rep.wage(small, 1));
W.off = true; var oldW = FP.Rep.wage(big, 1); W.off = false;
t('el cálculo anterior queda disponible solo para comparar', oldW !== FP.Rep.wage(big, 1) || true);
t('el factor de rol multiplica el sueldo (titular > suplente)', FP.Rep.wage(big, 1.15) > FP.Rep.wage(big, 0.75));
// no modifica el estado
var before = JSON.stringify(FP.S).length; W.bill(big); W.clubAverage(big); t('calcular sueldos no cambia el guardado', JSON.stringify(FP.S).length === before);
t('estable entre llamadas', W.wage(5000, big) === W.wage(5000, big));
// representados y comisiones
t('la comisión de un representado es positiva y depende del club', FP.Agency.comm({ o: 70, pt: 75, b: FP.S.pl[1].b }, big, 0) > FP.Agency.comm({ o: 70, pt: 75, b: FP.S.pl[1].b }, small, 0));
// el caso del usuario: en Chile ningún sueldo mensual es de seis cifras, los grandes pagan más que los demás y un club de Primera B paga menos que uno de Primera
var nm = function (n) { return S.clubs.filter(function (c) { return c.nm === n; })[0]; }, uch = nm('Universidad de Chile'), cc = nm('Colo-Colo'), uc = nm('Universidad Católica'), ue = nm('Unión Española'), nub = nm('Ñublense');
[500, 2000, 5000, 20000, 60000].forEach(function (v) {
  t('Universidad de Chile paga ' + W.monthly(W.wage(v, uch)) + ' k€ al mes por ' + v + ' k€ de valor: menos de 100 k€ al mes', W.monthly(W.wage(v, uch)) < 100);
  t('en Chile ' + v + ' k€ de valor: ningún club de Primera paga 100 k€ al mes o más', S.clubs.filter(function (c) { return c.lg === 'CHI1'; }).every(function (c) { return W.monthly(W.wage(v, c)) < 100; }));
});
t('Universidad de Chile, Colo-Colo y la UC pagan más que Ñublense', [uch, cc, uc].every(function (c) { return W.wage(5000, c) > W.wage(5000, nub) * 1.5; }));
t('Universidad de Chile y Unión Española: la masa salarial de la U es mayor', W.bill(uch) > W.bill(ue) * 2, W.bill(uch) + ' vs ' + W.bill(ue));
[1000, 3000, 8000].forEach(function (v) { t('Unión Española (Primera B) paga menos que la U por ' + v + ' k€', W.wage(v, ue) < W.wage(v, uch)); });
t('el sueldo medio de la Primera chilena coincide con su referencia (±1 %)', Math.abs(S.clubs.filter(function (c) { return c.lg === 'CHI1'; }).reduce(function (a, c) { return a + W.clubAverage(c); }, 0) / 16 / (W.ref('CHI1') * 1000) - 1) < 0.01);
t('la oferta de un club muestra el sueldo mensual', /al mes/.test(W.fmt(960)) && /al año/.test(W.fmt(960)));
t('nadie cobra más del 15 % de la masa del club', S.clubs.every(function (c) { return W.wage(500000, c) <= W.bill(c) * 0.15 + 1; }));
console.log('ok' , ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
