// el protagonista (delantero) con distintos niveles en el mismo equipo: goles por partido frente al delantero rival de la IA
var root = process.argv[2] || '' + require('path').join(__dirname, '..', '..') + '', lgs = (process.argv[3] || 'ENG1,CHI1,GUA1').split(',');
var H = require(root + '/tests/harness.js'), FP = H.FP;
var S = H.restore(H.buildWorld(555)), h = FP.Game.startPreset();
h.pos = 'ST'; h.tk = 'pro';
var r = 11; function rnd() { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; }
function setLevel(base) { FP.Core.ATTRS.forEach(function (a) { h.at[a] = base; h.cap[a] = 99; }); ['fin', 'rem', 'com', 'pos'].forEach(function (a) { h.at[a] = base; }); h.mor = 60; h.form = 55; h.fat = 10; FP.Hero.updateOvr(); }
lgs.forEach(function (lg) {
  var comp = Object.keys(S.comps).map(function (i) { return S.comps[i]; }).filter(function (c) { return c.kind === 'L' && c.lg === lg; })[0], teams = comp.teams;
  var mid = teams.slice().sort(function (a, b) { return FP.Core.strOf(a) - FP.Core.strOf(b); })[Math.floor(teams.length / 2)];
  h.club = h.team = mid; var st = Math.round(FP.Core.strOf(mid));
  [45, 55, 62, 70, 78, 86].forEach(function (base) {
    setLevel(base); var n = 220, g = 0, a = 0, sh = 0, aiST = 0, aiTeamST = 0, tg = 0, gm = 0;
    for (var i = 0; i < n; i++) {
      var opp = teams[Math.floor(rnd() * teams.length)]; if (opp === mid) { i--; continue; } var home = rnd() < 0.5;
      Object.keys(S.ro).forEach(function (k) { (S.ro[k] || []).forEach(function (p) { p.inj = 0; p.su = 0; }); }); FP.Match.cache = {};
      var f = { h: home ? mid : opp, a: home ? opp : mid, w: 5, st: 0 };
      var s = FP.Match.fullSession({ comp: comp, f: f, hero: FP.Hero.view(0, 0), role: 'starter', status: { role: 'starter', why: '' } }); s.runTo(1e9); var o = s.finish();
      g += o.hero.g; a += o.hero.a; sh += o.hero.sh; tg += home ? o.hs : o.as;
      // delantero rival de la IA (su ST) en este mismo partido
      var side = home ? 'a' : 'h', ids = {}; o.xi[side].forEach(function (e) { if (e.pos === 'ST') ids[e.id] = 1; });
      o.ev.forEach(function (e) { if (e.t === 'goal' && e.s === side && ids[e.sc]) aiST++; });
    }
    console.log(lg, 'equipo st', st, '| héroe nivel', base, 'ovr', h.ovr, '| goles/partido', (g / n).toFixed(2), 'asist/partido', (a / n).toFixed(2), 'remates', (sh / n).toFixed(1), '| cuota de gol del equipo', Math.round(g / Math.max(1, tg) * 100) + '%', '| ST rival IA goles/partido', (aiST / n).toFixed(2));
  });
});
