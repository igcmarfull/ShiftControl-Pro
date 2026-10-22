// motor detallado sin protagonista: reparto de goles por puesto y goles por partido
var H = require('' + require('path').join(__dirname, '..', '..') + '/tests/harness.js'), FP = H.FP;
var S = H.restore(H.buildWorld(555)), M = FP.Match;
function run(lg, n) {
  var comp = Object.keys(S.comps).map(function (i) { return S.comps[i]; }).filter(function (c) { return c.kind === 'L' && c.lg === lg; })[0], teams = comp.teams, byPos = {}, goals = 0, home = 0, away = 0, rows = [];
  var r = 7; function rnd() { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; }
  for (var i = 0; i < n; i++) {
    var a = teams[Math.floor(rnd() * teams.length)], b = teams[Math.floor(rnd() * teams.length)]; if (a === b) continue;
    var f = { h: a, a: b, w: 5, st: 0 }, res = FP.Match.fullSession({ comp: comp, f: f, hero: null, role: null }); res.runTo(1e9); var o = res.finish();
    goals += o.hs + o.as; home += o.hs; away += o.as;
    var pos = {}; ['h', 'a'].forEach(function (sd) { o.xi[sd].forEach(function (e) { pos[e.id] = e.pos; }); });
    o.ev.forEach(function (e) { if (e.t === 'goal' && e.sc != null) { var p = pos[e.sc]; if (!p) { var l = (o.bench.h.concat(o.bench.a)).filter(function (x) { return x.id === e.sc; })[0]; p = l ? 'BANCA' : '?'; } byPos[p] = (byPos[p] || 0) + 1; } });
    rows.push([a, b, o.hs, o.as]);
  }
  var tot = goals, out = Object.keys(byPos).sort(function (x, y) { return byPos[y] - byPos[x]; }).map(function (k) { return k + ' ' + Math.round(byPos[k] / tot * 100) + '%'; }).join(' ');
  return { lg: lg, q: FP.LGDEF[lg].q, partidos: rows.length, golesPorPartido: +(goals / rows.length).toFixed(2), local: +(home / rows.length).toFixed(2), visita: +(away / rows.length).toFixed(2), reparto: out };
}
['ENG1', 'CHI1', 'GUA1', 'BRA1'].forEach(function (lg) { console.log(JSON.stringify(run(lg, 160))); });
