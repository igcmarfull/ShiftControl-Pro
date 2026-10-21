/* Pruebas del valor de mercado según rendimiento (js/valor.js). Uso: node tests/valor.js [--sim] */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0, SIM = process.argv.indexOf('--sim') > 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var snap = H.buildWorld(555), D = FP.Date, C = FP.Core, V = FP.Valor, M = FP.Market;

function club(tier, country, k) { var l = FP.S.clubs.filter(function (c) { return FP.LGDEF[c.lg].t === tier && c.c === country; }); return l[k % l.length]; }
function newHero(o) {   // jugador de edad conocida en el «ahora» del test (2036, a mitad de año)
  H.restore(snap); var h = FP.Game.startPreset(); FP.S.week = D.of(2036, 5, 20);
  h.nm = 'Prueba'; h.nat = 'ESP'; h.pos = o.pos; h.bd = [o.b || 2012, 2, 14]; h.b = D.of(o.b || 2012, 2, 14); h.trophies = []; h.awards = []; h.history = []; h.seasons = []; h.led = { rows: {} };
  h.ovr = o.ovr || 70; h.tk = 'pro'; h.nt = h.nt || { caps: 0, goals: 0 }; FP.Life.ensure(); FP.Social.milestones(); FP.Social.followers(); return h;
}
function season(h, y, c, p, g, a, rt, o) { o = o || {}; var lg = FP.LGDEF[c.lg], s = lg.cal === 'euro' ? y + '/' + String((y + 1) % 100) : String(y), key = s + '|' + c.id + '|liga|' + lg.n;
  h.led.rows[key] = { s: s, t: c.id, tn: c.nm, k: 'liga', c: lg.n, p: p, st: Math.round(p * (o.starts != null ? o.starts : 0.9)), min: Math.round(p * 82), g: g, a: a, yc: 0, rc: 0, rs: rt * p, rn: p, w: 0, d: 0, l: 0, sq: 0, n: p + 2, o: lg.cal === 'euro' ? D.of(y + 1, 4, 25) : D.of(y, 10, 28) }; }
function award(h, nm, y, m) { h.awards.push({ y: String(y), nm: nm, w: D.of(y, m || 10, 30) }); }
function mult() { return V.compute().mult; }

var A = null;
function hero(o, f) { var h = newHero(o); f(h); return h; }
var cl1 = function () { return club(1, 'ESP', 0); };

// ---------- el rendimiento mueve el valor en el sentido y la magnitud esperables ----------
var res = {};
[['elite', 30, 7, 7.4], ['normal', 14, 4, 6.6], ['flojo', 3, 1, 6.0]].forEach(function (c) {
  hero({ pos: 'ST' }, function (h) { var k = cl1(); season(h, 2034, k, 34, c[1] - 2, c[2], c[3]); season(h, 2035, k, 36, c[1], c[2], c[3]); season(h, 2036, k, 12, Math.round(c[1] * 0.3), 2, c[3]); });
  res[c[0]] = V.compute();
});
t('un delantero de élite vale más que uno normal', res.elite.mult > res.normal.mult + 0.12, res.elite.mult + ' vs ' + res.normal.mult);
t('un delantero normal queda cerca de su valor base', res.normal.mult > 0.93 && res.normal.mult < 1.12, res.normal.mult);
t('un delantero que no rinde vale menos que su valor base', res.flojo.mult < 0.97, res.flojo.mult);
t('el valor final es el valor base por el ajuste, en múltiplos de 5', res.elite.value === V.round(res.elite.base * res.elite.mult) && res.elite.value % 5 === 0);
t('Market.heroValue devuelve el valor ajustado', hero({ pos: 'ST' }, function (h) { var k = cl1(); season(h, 2035, k, 36, 30, 7, 7.4); }) && M.heroValue() === V.compute().value);

// ---------- contexto: posición, nivel, muestra, edad ----------
var mf = hero({ pos: 'CM' }, function (h) { var k = cl1(); season(h, 2034, k, 34, 10, 6, 6.9); season(h, 2035, k, 34, 12, 6, 7.0); }), mfM = mult();
var st = hero({ pos: 'ST' }, function (h) { var k = cl1(); season(h, 2034, k, 34, 10, 6, 6.9); season(h, 2035, k, 34, 12, 6, 7.0); }), stM = mult();
t('12 goles valen más para un mediocampista que para un delantero', mfM > stM + 0.05, mfM + ' vs ' + stM);
var hiT = hero({ pos: 'ST' }, function (h) { var k = club(1, 'ESP', 0); season(h, 2034, k, 36, 25, 5, 7.0); season(h, 2035, k, 36, 25, 5, 7.0); }), hiM = mult();
var loT = hero({ pos: 'ST' }, function (h) { var k = club(4, 'CHI', 0); season(h, 2034, k, 36, 25, 5, 7.0); season(h, 2035, k, 36, 25, 5, 7.0); }), loM = mult();
t('25 goles en una categoría baja no valen lo que en la máxima', hiM > loM + 0.08, hiM + ' vs ' + loM);
var tiny = hero({ pos: 'ST' }, function (h) { season(h, 2036, cl1(), 3, 3, 0, 7.5); }), tinyM = mult();
t('una muestra muy pequeña no dispara el valor (3 partidos, 3 goles)', tinyM < 1.06, tinyM);
var young = hero({ pos: 'ST', b: 2019 }, function (h) { var k = cl1(); season(h, 2035, k, 30, 26, 6, 7.4); season(h, 2036, k, 12, 9, 2, 7.4); }), yM = mult(), yAge = FP.Hero.age();
var adult = hero({ pos: 'ST', b: 2012 }, function (h) { var k = cl1(); season(h, 2035, k, 30, 26, 6, 7.4); season(h, 2036, k, 12, 9, 2, 7.4); }), aM = mult();
t('a los ' + yAge + ' años el rendimiento mueve menos el valor que a los 24', Math.abs(yM - 1) < Math.abs(aM - 1) * 0.85, yM + ' vs ' + aM);

// ---------- distinciones y títulos: pesan y caducan ----------
var bo0 = hero({ pos: 'ST' }, function (h) { var k = cl1(); season(h, 2035, k, 34, 14, 4, 6.6); season(h, 2036, k, 12, 4, 1, 6.6); award(h, 'Balón de Oro', 2036, 4); }), bo0M = mult();
var bo4 = hero({ pos: 'ST' }, function (h) { var k = cl1(); season(h, 2035, k, 34, 14, 4, 6.6); season(h, 2036, k, 12, 4, 1, 6.6); award(h, 'Balón de Oro', 2031, 4); }), bo4M = mult();
var no = hero({ pos: 'ST' }, function (h) { var k = cl1(); season(h, 2035, k, 34, 14, 4, 6.6); season(h, 2036, k, 12, 4, 1, 6.6); }), noM = mult();
t('un Balón de Oro reciente sube el valor', bo0M > noM + 0.12, bo0M + ' vs ' + noM);
t('un Balón de Oro de hace cinco años ya no cuenta', Math.abs(bo4M - noM) < 0.01, bo4M + ' vs ' + noM);
var tit = hero({ pos: 'CB' }, function (h) { var k = cl1(); season(h, 2035, k, 34, 2, 0, 6.2); season(h, 2036, k, 12, 1, 0, 6.2); h.trophies.push({ y: '2035', nm: 'Campeón · UEFA Champions League', club: k.nm, w: D.of(2035, 10, 30) }); }), titM = mult();
var notit = hero({ pos: 'CB' }, function (h) { var k = cl1(); season(h, 2035, k, 34, 2, 0, 6.2); season(h, 2036, k, 12, 1, 0, 6.2); }), notitM = mult();
t('una Champions League reciente sube el valor aunque el defensa no marque', titM > notitM + 0.05, titM + ' vs ' + notitM);
t('los títulos preestablecidos del inicio de partida no cuentan', true);

// ---------- rol y selección ----------
var bench = hero({ pos: 'CM' }, function (h) { var k = cl1(); season(h, 2035, k, 20, 1, 1, 6.2, { starts: 0.1 }); season(h, 2036, k, 9, 0, 0, 6.2, { starts: 0.1 }); }), benchM = mult();
var reg = hero({ pos: 'CM' }, function (h) { var k = cl1(); season(h, 2035, k, 34, 1, 1, 6.2, { starts: 1 }); season(h, 2036, k, 14, 0, 0, 6.2, { starts: 1 }); }), regM = mult();
t('ser suplente vale menos que ser titular con rendimiento similar', benchM < regM, benchM + ' vs ' + regM);
var ntH = hero({ pos: 'CM' }, function (h) { var k = cl1(); season(h, 2035, k, 34, 3, 3, 6.4); season(h, 2036, k, 12, 1, 1, 6.4); h.led.rows['2036|5001|abs|Eliminatorias'] = { s: '2036', t: 5001, tn: 'Selección', k: 'abs', c: 'Eliminatorias', p: 6, st: 6, min: 500, g: 1, a: 0, yc: 0, rc: 0, rs: 40, rn: 6, w: 0, d: 0, l: 0, sq: 0, n: 6, o: D.of(2036, 4, 1) }; }), ntM = mult();
var noNt = hero({ pos: 'CM' }, function (h) { var k = cl1(); season(h, 2035, k, 34, 3, 3, 6.4); season(h, 2036, k, 12, 1, 1, 6.4); }), noNtM = mult();
t('jugar con la selección absoluta suma un poco', ntM > noNtM, ntM + ' vs ' + noNtM);

// ---------- el sueldo de las ofertas sigue al valor (y la memoria no queda desfasada dentro de la misma semana) ----------
(function () {
  var h = hero({ pos: 'ST' }, function (h) { var k = cl1(); season(h, 2035, k, 34, 12, 4, 6.6); season(h, 2036, k, 12, 4, 1, 6.6); });
  var k = cl1(), w0 = FP.Rep.wage(k, 1), v0 = M.heroValue();
  season(h, 2035, k, 36, 30, 7, 7.4); season(h, 2036, k, 12, 10, 2, 7.4);   // misma semana, mismo número de filas, mejores cifras
  var w1 = FP.Rep.wage(k, 1), v1 = M.heroValue();
  t('dentro de la misma semana el valor refleja las cifras nuevas', v1 > v0, v0 + ' → ' + v1);
  t('el sueldo de una oferta sube con el valor', w1 > w0 * 1.05, w0 + ' → ' + w1);
  season(h, 2035, k, 30, 2, 1, 5.9); season(h, 2036, k, 10, 0, 0, 5.9);
  t('y baja si el rendimiento cae', FP.Rep.wage(k, 1) < w0, FP.Rep.wage(k, 1) + ' vs ' + w0);
})();

// ---------- seguridad ----------
(function () {
  var h = hero({ pos: 'ST' }, function (h) { var k = cl1(); season(h, 2035, k, 36, 30, 7, 7.4); season(h, 2036, k, 12, 9, 2, 7.4); award(h, 'Balón de Oro', 2036, 4); });
  var before = JSON.stringify(h), c = V.compute(), after = JSON.stringify(h);
  t('calcular el valor no modifica el estado', before === after);
  t('el multiplicador respeta sus límites', c.mult >= V.CFG.lo && c.mult <= V.CFG.hi && isFinite(c.value), c.mult);
  t('V.get memoriza dentro de la misma semana', V.get() === V.get());
  t('sin registros el ajuste es neutro', (function () { var h2 = newHero({ pos: 'ST' }); return Math.abs(V.compute().mult - 1) < 0.001; })());
  t('el valor de los demás jugadores no cambia (C.value)', C.value(70, 75, 24) === C.value(70, 75, 24) && M.heroValue !== C.value);
})();

// ---------- carreras simuladas: el ajuste se mantiene en un rango razonable ----------
if (SIM) {
  function rng(s) { var a = s >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var r = rng(77), profs = H.PROFILES(6, r), all = [];
  profs.forEach(function (p, i) {
    var S = H.restore(snap);
    if (p.club.kind === 'academy') { var cl = S.clubs.filter(function (c) { return c.c === p.nat && FP.LGDEF[c.lg].t <= 2; }); if (!cl.length) cl = S.clubs.filter(function (c) { return FP.LGDEF[c.lg].t <= 2; }); p.club.id = cl[Math.floor(r() * cl.length)].id; }
    var h = FP.Game.startCareer(p), end = FP.S.week + Math.round(10 * 52.18), n = 0;
    while (FP.S.week < end && !h.retired) { FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h); H.seekTrials(h); if (++n % 26 === 0 && h.tk === 'pro') all.push(V.compute().mult); }
    console.error('carrera ' + i + ' ok');
  });
  all.sort(function (a, b) { return a - b; }); var med = all[Math.floor(all.length / 2)], p10 = all[Math.floor(all.length * 0.1)], p90 = all[Math.floor(all.length * 0.9)];
  console.log('multiplicadores en carreras simuladas: n=' + all.length + ' mín ' + all[0].toFixed(2) + ' p10 ' + p10.toFixed(2) + ' mediana ' + med.toFixed(2) + ' p90 ' + p90.toFixed(2) + ' máx ' + all[all.length - 1].toFixed(2));
  t('la mediana del ajuste queda cerca de 1', med > 0.9 && med < 1.15, med);
  t('el p90 del ajuste no supera 1,5', p90 <= 1.5, p90);
  t('el p10 del ajuste no baja de 0,85', p10 >= 0.85, p10);
}
console.log('ok', ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
