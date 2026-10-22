var fs = require('fs'), rows = [], ends = [];
fs.readdirSync('.').filter(function (f) { return /^d\d+\.jsonl$/.test(f); }).forEach(function (f) { fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).forEach(function (l) { var o = JSON.parse(l); if (o.end) ends.push(o); else rows.push(o); }); });
var pro = rows.filter(function (r) { return r.pl && (r.tk === 'pro' || r.tk === 'loan') && (r.cls === 'liga' || r.cls === 'copa' || r.cls === 'cont') && r.min > 0; });
function agg(list) { var p = list.length, g = 0, a = 0, min = 0, xg = 0, tg = 0, st = 0; list.forEach(function (r) { g += r.g; a += r.a; min += r.min; xg += r.xg; tg += r.mine; if (!r.sub) st++; }); return { n: p, g: g, gpa: +(g / p).toFixed(2), g90: +(g / min * 90).toFixed(2), a90: +(a / min * 90).toFixed(2), xg90: +(xg / min * 90).toFixed(2), share: +(g / Math.max(1, tg) * 100).toFixed(0) + '%', starts: Math.round(st / p * 100) + '%' }; }
function by(list, f) { var m = {}; list.forEach(function (r) { var k = f(r); (m[k] = m[k] || []).push(r); }); return m; }
function show(title, m, order) { console.log('\n== ' + title); (order || Object.keys(m).sort()).forEach(function (k) { if (m[k]) console.log(k.padEnd(14), JSON.stringify(agg(m[k]))); }); }
console.log('partidos pro (con minutos):', pro.length, 'carreras terminadas:', ends.length, 'filas totales', rows.length);
show('por posición', by(pro, function (r) { return r.pos; }));
var st = pro.filter(function (r) { return r.pos === 'ST'; });
show('ST por ovr', by(st, function (r) { return Math.floor(r.ovr / 5) * 5; }));
show('ST por calidad de liga (q)', by(st, function (r) { return r.lgq >= 70 ? '70+' : r.lgq >= 60 ? '60-69' : r.lgq >= 50 ? '50-59' : r.lgq >= 44 ? '44-49' : '<44'; }), ['<44', '44-49', '50-59', '60-69', '70+']);
show('ST por categoría de liga', by(st, function (r) { return 'tier' + r.tier; }));
show('ST por diferencia de fuerza (mi equipo - rival)', by(st, function (r) { var d = r.st - r.ost; return d < -10 ? '<-10' : d < -3 ? '-10..-4' : d <= 3 ? '-3..3' : d <= 10 ? '4..10' : '>10'; }), ['<-10', '-10..-4', '-3..3', '4..10', '>10']);
show('ST: ovr del jugador - fuerza del equipo', by(st, function (r) { var d = r.ovr - r.st; return d < -5 ? '<-5' : d < 0 ? '-5..-1' : d < 5 ? '0..4' : d < 10 ? '5..9' : '>=10'; }), ['<-5', '-5..-1', '0..4', '5..9', '>=10']);
show('ST titular vs suplente', by(st, function (r) { return r.sub ? 'suplente' : 'titular'; }));
show('ST local/visita', by(st, function (r) { return r.home ? 'local' : 'visita'; }));
show('ST por clase', by(rows.filter(function (r) { return r.pos === 'ST' && r.pl && r.min > 0; }), function (r) { return r.cls + '/' + r.tk; }));
console.log('\n== carreras');
ends.forEach(function (e) { console.log(e.end.padEnd(10), 'edad', e.age, 'ovr', e.ovr + '/' + e.pot, 'ap', e.tot.ap, 'g', e.tot.g, 'a', e.tot.a, 'g/ap', (e.tot.g / Math.max(1, e.tot.ap)).toFixed(2), 'tier', e.tier, 'q', e.q, e.abroad ? 'extranjero' : ''); });
