var fs = require('fs'), L = [];
fs.readdirSync('.').filter(function (f) { return /^m\d+\.jsonl$/.test(f); }).forEach(function (f) { fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).forEach(function (l) { try { L.push(JSON.parse(l)); } catch (e) { } }); });
var cars = {}; L.forEach(function (o) { (cars[o.car] = cars[o.car] || []).push(o); });
function cl(c) { return c ? c.nm + ' (' + c.c + ' q' + c.q + ' t' + c.t + ' st' + c.st + ')' : '—'; }
Object.keys(cars).forEach(function (k) {
  var a = cars[k], end = a.filter(function (x) { return x.k === 'end'; })[0];
  console.log('\n=== ' + k + (end ? ' → edad ' + end.age + ' ovr ' + end.ovr + '/' + end.pot + ' ap ' + end.tot.ap + ' g ' + end.tot.g + ' (' + (end.tot.g / Math.max(1, end.tot.ap)).toFixed(2) + ')' : ' (en curso)'));
  a.filter(function (x) { return x.k === 'snap' && x.club; }).forEach(function (s, i) { if (i % 2 === 0) console.log('  snap edad', s.age, 'ovr', s.ovr, 'tiro', s.shot, 'fin', s.fin, '|', cl(s.club), '| rep', JSON.stringify(s.rep), '| g/ap acum', s.tot.g + '/' + s.tot.ap, '| valor', s.val, 'nt', s.nt); });
  a.filter(function (x) { return x.k === 'move' && x.from && x.to; }).forEach(function (m) { console.log('  FICHAJE edad', m.age, 'ovr', m.ovr, cl(m.from), '→', cl(m.to), '| rep', JSON.stringify(m.rep)); });
});
var offers = L.filter(function (x) { return x.k === 'offer' && x.from && x.to && x.type === 'transfer'; });
function bucket(o) { var gr = o.ap >= 10 ? o.g / o.ap : null; return gr == null ? 'pocos partidos' : gr >= 0.6 ? 'goleador (≥0,6 g/p)' : gr >= 0.3 ? 'normal (0,3–0,6)' : 'bajo (<0,3)'; }
var by = {}; offers.forEach(function (o) { var b = bucket(o); var d = by[b] = by[b] || { n: 0, dst: 0, dq: 0, up: 0, down: 0, wage: 0, tier1: 0, foreign: 0 }; d.n++; d.dst += o.to.st - o.from.st; d.dq += o.to.q - o.from.q; if (o.to.st > o.from.st + 3) d.up++; if (o.to.st < o.from.st - 3) d.down++; if (o.to.t === 1) d.tier1++; if (o.to.c !== o.from.c) d.foreign++; });
console.log('\n== ofertas de traspaso según el rendimiento del año (n=' + offers.length + ')');
Object.keys(by).forEach(function (b) { var d = by[b]; console.log(b.padEnd(24), 'n', d.n, '| nivel del comprador − nivel del club actual: media', (d.dst / d.n).toFixed(1), '| mejores (+3):', Math.round(d.up / d.n * 100) + '%', 'peores (−3):', Math.round(d.down / d.n * 100) + '%', '| de primera:', Math.round(d.tier1 / d.n * 100) + '%', '| extranjeros:', Math.round(d.foreign / d.n * 100) + '%'); });
var hot = offers.filter(function (o) { return o.ap >= 10 && o.g / o.ap >= 0.8; });
console.log('\n== goleadores extraordinarios (≥0,8 g/p en ≥10 partidos de la temporada), ofertas:', hot.length);
hot.slice(0, 14).forEach(function (o) { console.log('  edad', o.age, 'ovr', o.ovr, o.g + 'g/' + o.ap + 'p', 'rep', JSON.stringify(o.rep), '|', cl(o.from), '→', cl(o.to), o.role, 'sueldo', o.wage, 'traspaso', o.fee); });
