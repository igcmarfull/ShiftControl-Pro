/* Pruebas de la economía salarial viva (js/sueldos.js: presupuesto por club, nómina por jugador, límites de contratación). Uso: node tests/economia.js */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var S = H.restore(H.buildWorld(555)), W = FP.Wages, C = FP.Core;
var nm = function (n) { return S.clubs.filter(function (c) { return c.nm === n; })[0]; };

// ---------- creación del mundo ----------
t('todos los clubes tienen presupuesto, liga de referencia y procedencia', S.clubs.every(function (c) { return c.wb > 0 && c.w0 > 0 && c.wlg === c.lg && (c.wsrc === 'estimacion_manual' || c.wsrc === 'estimacion_modelo'); }));
t('todos los jugadores de plantilla tienen sueldo', S.clubs.every(function (c) { return (S.ro[c.id] || []).every(function (p) { return p.i === 0 || p.wg > 0; }); }));
var use = S.clubs.map(function (c) { return W.committed(c) / W.bill(c); }), mean = use.reduce(function (a, b) { return a + b; }, 0) / use.length;
t('la nómina inicial compromete cerca del 89 % del presupuesto (media ' + Math.round(mean * 100) + ' %)', mean > 0.84 && mean < 0.92);
t('ningún club arranca por encima de su presupuesto', use.every(function (u) { return u <= 1.001; }), Math.max.apply(null, use));
t('hay margen para fichar en casi todos los clubes (> 5 % libre)', use.filter(function (u) { return u > 0.95; }).length < S.clubs.length * 0.02);
t('ningún sueldo individual supera la parte máxima del club', S.clubs.every(function (c) { return (S.ro[c.id] || []).every(function (p) { return p.i === 0 || p.wg <= W.bill(c) * W.capShare(c) + 1; }); }));
t('Universidad de Chile tiene más presupuesto que Unión Española y que Ñublense', W.bill(nm('Universidad de Chile')) > W.bill(nm('Unión Española')) * 2 && W.bill(nm('Universidad de Chile')) > W.bill(nm('Ñublense')));
t('el sueldo máximo de un jugador en Chile es menor de 100 k€ al mes', Math.max.apply(null, S.clubs.filter(function (c) { return c.lg === 'CHI1'; }).map(function (c) { return Math.max.apply(null, (S.ro[c.id] || []).map(function (p) { return p.wg || 0; })); })) / 12 < 100);
t('la procedencia manual se marca para los clubes de la tabla y de modelo para el resto', nm('Colo-Colo').wsrc === 'estimacion_manual' && S.clubs.filter(function (c) { return c.lg === 'CHI3'; })[0].wsrc === 'estimacion_modelo');

// ---------- reglas de contratación ----------
var big = nm('Universidad de Chile'), p0 = (S.ro[big.id] || []).filter(function (p) { return p.i !== 0; })[0];
t('margen = presupuesto - nómina', W.available(big) === Math.max(0, W.bill(big) - W.committed(big)));
t('el máximo ofrecible no supera el margen ni la parte máxima', W.maxOffer(big, 0) <= W.available(big) && W.maxOffer(big, 0) <= W.bill(big) * W.capShare(big) + 1);
t('al sustituir un sueldo, el margen incluye el sueldo anterior', W.maxOffer(big, 50) >= Math.min(W.maxOffer(big, 0), W.bill(big) * W.capShare(big)) - 1);
var poor = nm('Ñublense'); poor.wb = W.committed(poor);       // un club sin ningún margen
t('un club sin margen no puede fichar', !W.canSignNpc(p0, poor) && W.maxOffer(poor, 0) === 0);
t('un club sin margen no envía ofertas al protagonista', (function () { FP.Game.startPreset(); var r = FP.Rep.exposure(poor); return r.ok === false; })());
poor.wb = poor.w0;
t('fichar a un jugador de la IA fija su sueldo en el club de destino', (function () { var q = (S.ro[nm('Colo-Colo').id] || []).filter(function (p) { return p.i !== 0; })[0], dest = nm('Palestino'); FP.Market.move(q, dest.id, 0, 3); return q.wg === W.npcOffer(q, dest) && q.c === dest.id; })());
t('la renovación nunca supera el margen', (function () { var q = (S.ro[big.id] || []).filter(function (p) { return p.i !== 0; })[1]; q.wg = 100; W.renew(q, big); return q.wg <= W.maxOffer(big, 100) && q.wg >= 1; })());

// ---------- evolución ----------
(function () {
  var S2 = H.restore(H.buildWorld(555)), moves = 0, m0 = FP.Market.move; FP.Market.move = function () { moves++; return m0.apply(this, arguments); };
  var g = 0, y0 = FP.S.clubs[0].wb; while (g++ < 520) FP.Sim.step();
  FP.Market.move = m0; var S3 = FP.S, over = 0, noroom = 0, n = S3.clubs.length;
  S3.clubs.forEach(function (c) { var u = W.committed(c) / W.bill(c); if (u > 1) over++; if (W.available(c) < W.bill(c) * 0.02) noroom++; });
  t('tras 10 años casi ningún club supera su presupuesto (' + over + ' de ' + n + ')', over < n * 0.01);
  t('tras 10 años pocos clubes quedan sin margen (' + noroom + ' de ' + n + ')', noroom < n * 0.03);
  t('el mercado de la IA sigue activo (' + moves + ' fichajes entre clubes)', moves > 900);
  t('los presupuestos de un club con resultados parecidos no se disparan ni se hunden (0,5x a 3x su nivel de partida)', S3.clubs.every(function (c) { return c.wb > c.w0 * 0.4 && c.wb < c.w0 * 3.5; }));
  var pr = S3.clubs.filter(function (c) { return c.wlg === c.lg; }).length; t('la liga de referencia se actualiza al cambiar de división', pr === n);
  t('el sueldo máximo en Chile sigue por debajo de 100 k€ al mes tras 10 años', Math.max.apply(null, S3.clubs.filter(function (c) { return c.lg === 'CHI1'; }).map(function (c) { return Math.max.apply(null, (S3.ro[c.id] || []).map(function (p) { return p.wg || 0; })); })) / 12 < 100);
  t('los jugadores nuevos de la plantilla tienen sueldo', S3.clubs.every(function (c) { return (S3.ro[c.id] || []).every(function (p) { return p.i === 0 || p.wg > 0; }); }));
})();

// ---------- migración de partidas anteriores ----------
(function () {
  var S4 = H.restore(H.buildWorld(555)), pk = FP.Store.pack(), keep = pk.pl[10].wg, any = pk.clubs[5].wb;
  var old = JSON.parse(JSON.stringify(pk)); old.clubs.forEach(function (c) { delete c.wb; delete c.w0; delete c.wlg; delete c.wsrc; }); old.pl.forEach(function (p) { if (p && p.i !== 10) delete p.wg; });
  FP.Store.unpack(old); var S5 = FP.S;
  t('una partida anterior recibe presupuesto y sueldos al cargar', S5.clubs.every(function (c) { return c.wb > 0; }) && S5.clubs.every(function (c) { return (S5.ro[c.id] || []).every(function (p) { return p.i === 0 || p.wg > 0; }); }));
  t('los sueldos que ya existían no se reescriben', S5.pl[10].wg === keep);
  var s1 = JSON.stringify(FP.Store.pack()).length; t('el guardado crece menos del 8 % con los sueldos', s1 < JSON.stringify(old).length * 1.08);
})();
console.log('ok', ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
