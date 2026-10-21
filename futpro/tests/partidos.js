/* Calibración del partido: goles, localía, tarjetas, penales, xG y VAR frente a referencias aproximadas (de memoria, no datos exactos). Uso: node tests/partidos.js */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var S = H.restore(H.buildWorld(91)), Match = FP.Match;
var ids = ['ENG1', 'ESP1', 'ITA1', 'GER1', 'FRA1', 'CHI1', 'ARG1', 'BRA1', 'ENG2', 'CHI2'], T = { n: 0, g: 0, hw: 0, d: 0, aw: 0, yc: 0, rc: 0, pen: 0, sh: 0, xg: 0, vr: 0 }, Q = { n: 0, g: 0, hw: 0, d: 0, aw: 0 };
ids.forEach(function (id) { var lg = S.lgs[id]; if (!lg) return; var c = S.comps[lg.cmp]; for (var k = 0; k < 150; k++) {
  var f = c.fx[Math.floor(Math.random() * c.fx.length)], res = Match.full({ comp: c, f: f, role: 'none', imp: 1, tactic: { mentality: 0 }, hero: null, coachSide: null });
  T.n++; T.g += res.hs + res.as; if (res.hs > res.as) T.hw++; else if (res.hs < res.as) T.aw++; else T.d++;
  res.ev.forEach(function (e) { if (e.t === 'yellow') T.yc++; else if (e.t === 'red') T.rc++; else if (e.t === 'pen') T.pen++; else if (e.t === 'var') T.vr++; if (e.xg) T.xg += e.xg; });
  var f2 = { h: f.h, a: f.a, w: f.w }; Match.quick(c, f2); Q.n++; Q.g += f2.hs + f2.as; if (f2.hs > f2.as) Q.hw++; else if (f2.hs < f2.as) Q.aw++; else Q.d++; } });
var n = T.n, q = Q.n, pc = function (x, m) { return x / m * 100; };
console.log('completo: goles', (T.g / n).toFixed(2), 'L/E/V', pc(T.hw, n).toFixed(0) + '/' + pc(T.d, n).toFixed(0) + '/' + pc(T.aw, n).toFixed(0), 'amarillas', (T.yc / n).toFixed(2), 'rojas', (T.rc / n).toFixed(3), 'penales', (T.pen / n).toFixed(2), 'xG', (T.xg / n).toFixed(2), 'VAR', (T.vr / n).toFixed(2));
console.log('rápido: goles', (Q.g / q).toFixed(2), 'L/E/V', pc(Q.hw, q).toFixed(0) + '/' + pc(Q.d, q).toFixed(0) + '/' + pc(Q.aw, q).toFixed(0));
t('goles por partido completo 2,4-3,0', T.g / n >= 2.4 && T.g / n <= 3.0, T.g / n);
t('goles por partido rápido 2,3-3,0', Q.g / q >= 2.3 && Q.g / q <= 3.0, Q.g / q);
t('victorias locales 40-50% (completo)', pc(T.hw, n) >= 40 && pc(T.hw, n) <= 50, pc(T.hw, n)); t('victorias de visitante 26-36% (completo)', pc(T.aw, n) >= 26 && pc(T.aw, n) <= 36, pc(T.aw, n));
t('victorias locales 40-52% (rápido)', pc(Q.hw, q) >= 40 && pc(Q.hw, q) <= 52, pc(Q.hw, q)); t('victorias de visitante 24-34% (rápido)', pc(Q.aw, q) >= 24 && pc(Q.aw, q) <= 34, pc(Q.aw, q));
t('amarillas 3,2-4,4', T.yc / n >= 3.2 && T.yc / n <= 4.4, T.yc / n); t('rojas 0,08-0,2', T.rc / n >= 0.08 && T.rc / n <= 0.2, T.rc / n); t('penales 0,2-0,5', T.pen / n >= 0.2 && T.pen / n <= 0.5, T.pen / n);
t('el xG suma cerca de los goles (0,85-1,2)', T.xg / (T.g || 1) >= 0.85 && T.xg / (T.g || 1) <= 1.2, T.xg / T.g); t('hay anulaciones del VAR', T.vr > 0 && T.vr / n < 0.2, T.vr / n);
// derbis
FP.Derbis.is(0, 1); var colo = S.clubs.filter(function (c) { return c.nm === 'Colo-Colo'; })[0], u = S.clubs.filter(function (c) { return c.nm === 'Universidad de Chile'; })[0], other = S.clubs.filter(function (c) { return c.nm === 'Unión Española'; })[0];
t('Colo-Colo vs U. de Chile es un derbi', FP.Derbis.is(colo.id, u.id) && FP.Derbis.is(u.id, colo.id)); t('Colo-Colo vs Unión Española no lo es', !FP.Derbis.is(colo.id, other.id));
var mk = function (a, b) { var c = S.comps[S.lgs.CHI1.cmp], f = { h: a, a: b, w: c.fx[0].w }; var y = 0, w = 0; for (var i = 0; i < 400; i++) { [a, b].forEach(function (id) { (S.ro[id] || []).forEach(function (p) { delete p.su; delete p.inj; delete p.yc; }); delete Match.cache[id]; }); var r = Match.full({ comp: c, f: f, role: 'none', imp: 1, tactic: { mentality: 0 }, hero: null, coachSide: null }); r.ev.forEach(function (e) { if (e.t === 'yellow') y++; }); w++; } return y / w; };
var yd = mk(colo.id, u.id), yn = mk(colo.id, other.id); console.log('amarillas derbi', yd.toFixed(2), 'normal', yn.toFixed(2)); t('el derbi tiene más tarjetas (≥ +10%)', yd >= yn * 1.1, [yd, yn]);
console.log('ok', ok, 'fallas', bad); process.exit(bad ? 1 : 0);
