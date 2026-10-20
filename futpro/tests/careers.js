/* Simula N carreras de S temporadas con perfiles variados y resume las proporciones.
   node tests/careers.js [temporadas=10] [carreras=12] [semilla=777] [--json] */
var H = require('./harness.js'), FP = H.FP;
var args = process.argv.slice(2).filter(function (a) { return a[0] !== '-'; });
var seasons = +args[0] || 10, n = +args[1] || 12, seed = +args[2] || 777, part = +args[3] || 0, nparts = +args[4] || 1;
function rng(s) { var a = s >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var t0 = Date.now(), snap = H.buildWorld(seed), r = rng(seed * 31 + 7), profs = H.PROFILES(n, r), recs = [];
console.error('mundo listo en', ((Date.now() - t0) / 1000).toFixed(1), 's');
profs.forEach(function (p, i) {
  if (i % nparts !== part) return;
  var S = H.restore(snap);
  if (p.club.kind === 'academy') { var cl = S.clubs.filter(function (c) { return c.c === p.nat && FP.LGDEF[c.lg].t <= 2; }); if (!cl.length) cl = S.clubs.filter(function (c) { return FP.LGDEF[c.lg].t <= 2; }); p.club.id = cl[Math.floor(r() * cl.length)].id; }
  var t1 = Date.now(), rec = H.runCareer(p, seasons);
  rec.secs = (Date.now() - t1) / 1000; recs.push(rec);
  console.error('#' + i, p.nat, p.pos, 'edad ' + rec.age0, '→', rec.finalAge, rec.finalTk, 'ovr', rec.ovr + '/' + rec.pot, 'pro', rec.pro ? rec.firstProAge : '-', 'nt', Object.keys(rec.ntCats).join(',') || '-', 'caps', rec.ntCaps, rec.secs.toFixed(1) + 's');
});
require('fs').writeFileSync('/tmp/careers-' + seasons + '-' + seed + '-' + part + '.json', JSON.stringify(recs.map(function (x) { delete x.hero; return x; })));
console.error('parte', part, 'lista');
