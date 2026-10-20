/* Resume las partes de tests/careers.js: node tests/summary.js <temporadas> <semilla> <partes> */
var fs = require('fs'), seasons = +process.argv[2] || 10, seed = +process.argv[3] || 777, parts = +process.argv[4] || 1, recs = [];
for (var k = 0; k < parts; k++) { var f = '/tmp/careers-' + seasons + '-' + seed + '-' + k + '.json'; if (fs.existsSync(f)) recs = recs.concat(JSON.parse(fs.readFileSync(f))); }
function pct(f, a) { a = a || recs; return Math.round(100 * a.filter(f).length / Math.max(1, a.length)) + '%'; }
function avg(a, f) { return a.length ? a.reduce(function (s, x) { return s + f(x); }, 0) / a.length : 0; }
var juv = function (x) { return Object.keys(x.ntCats).some(function (c) { return c !== 'Absoluta'; }); };
var out = { carreras: recs.length, temporadas: seasons,
  llegaProfesional: pct(function (x) { return x.pro; }), terminaAmateur: pct(function (x) { return x.finalTk === 'amat'; }), terminaLibre: pct(function (x) { return x.finalTk === 'free'; }),
  sinClub14semAlgunaVez: pct(function (x) { return x.freeWeeks >= 14; }), primeraDivision: pct(function (x) { return x.maxTier === 1; }), segundaOSuperior: pct(function (x) { return x.maxTier <= 2; }),
  convocadoJuvenil: pct(juv), convocadoSub17: pct(function (x) { return x.ntCats['Sub-17']; }), convocadoSub20: pct(function (x) { return x.ntCats['Sub-20']; }), convocadoAbsoluta: pct(function (x) { return x.ntCats.Absoluta; }),
  jugoEnElExtranjero: pct(function (x) { return x.abroad; }),
  edadPrimerContratoPro: recs.filter(function (x) { return x.pro; }).map(function (x) { return x.firstProAge; }).sort(function (a, b) { return a - b; }).join(','),
  ovrMaxPromedio: Math.round(avg(recs, function (x) { return x.maxOvr; })), partidosPromedio: Math.round(avg(recs, function (x) { return x.tot.ap; })), golesPromedio: Math.round(avg(recs, function (x) { return x.tot.g; })), capsPromedio: avg(recs, function (x) { return x.ntCaps; }).toFixed(1) };
['academy', 'amat'].forEach(function (k) { var g = recs.filter(function (x) { return x.start === k; }); out['inicio_' + k] = { n: g.length, pro: pct(function (x) { return x.pro; }, g), primera: pct(function (x) { return x.maxTier === 1; }, g), juvenil: pct(juv, g), absoluta: pct(function (x) { return x.ntCats.Absoluta; }, g) }; });
console.log(JSON.stringify(out, null, 1));
