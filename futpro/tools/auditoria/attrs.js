// ¿influyen los atributos en los goles? mismo equipo (CHI1 medio), distintos perfiles de atributos
var root = process.argv[2] || '' + require('path').join(__dirname, '..', '..') + '';
var H = require(root + '/tests/harness.js'), FP = H.FP;
var S = H.restore(H.buildWorld(555)), h = FP.Game.startPreset(); h.pos = 'ST'; h.tk = 'pro';
var r = 5; function rnd() { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; }
var comp = Object.keys(S.comps).map(function (i) { return S.comps[i]; }).filter(function (c) { return c.kind === 'L' && c.lg === 'CHI1'; })[0], teams = comp.teams;
var mid = teams.slice().sort(function (a, b) { return FP.Core.strOf(a) - FP.Core.strOf(b); })[8]; h.club = h.team = mid;
console.log('atributos:', FP.Core.ATTRS.join(','), '| pesos del ST:', JSON.stringify(FP.Core.WN.ST));
var SHOT = ['fin', 'rem', 'com', 'pos'], PASS = ['pas', 'vis', 'con'], PHYS = ['vel', 'ace', 'res', 'fue', 'sal'];
function prof(name, base, over) { FP.Core.ATTRS.forEach(function (a) { h.at[a] = base; h.cap[a] = 99; }); Object.keys(over).forEach(function (a) { h.at[a] = over[a]; }); h.mor = 60; h.form = 55; h.fat = 10; FP.Hero.updateOvr(); return name; }
function run(name) {
  var n = 260, g = 0, a = 0, sh = 0;
  for (var i = 0; i < n; i++) {
    Object.keys(S.ro).forEach(function (k) { (S.ro[k] || []).forEach(function (p) { p.inj = 0; p.su = 0; }); }); FP.Match.cache = {};
    var opp = teams[Math.floor(rnd() * teams.length)]; if (opp === mid) { i--; continue; } var home = rnd() < 0.5, f = { h: home ? mid : opp, a: home ? opp : mid, w: 5, st: 0 };
    var s = FP.Match.fullSession({ comp: comp, f: f, hero: FP.Hero.view(0, 0), role: 'starter', status: { role: 'starter', why: '' } }); s.runTo(1e9); var o = s.finish(); g += o.hero.g; a += o.hero.a; sh += o.hero.sh;
  }
  console.log(name.padEnd(46), 'ovr', h.ovr, 'shotSkill', Math.round(FP.Hero.view(0, 0).shotSkill()), '| goles/partido', (g / n).toFixed(2), 'asist', (a / n).toFixed(2), 'remates', (sh / n).toFixed(1));
}
function mk(shot, pass, phys, rest) { var o = {}; SHOT.forEach(function (x) { o[x] = shot; }); PASS.forEach(function (x) { o[x] = pass; }); PHYS.forEach(function (x) { o[x] = phys; }); return o; }
run(prof('todo 62', 62, {}));
run(prof('remate 80, resto 55', 55, mk(80, 55, 55)));
run(prof('remate 55, resto 80', 80, mk(55, 80, 80)));
run(prof('remate 80, pases 40, físico 55', 55, mk(80, 40, 55)));
run(prof('remate 45, físico 95', 55, mk(45, 55, 95)));
run(prof('remate 90, resto 50', 50, mk(90, 50, 50)));
run(prof('remate 95, pases 95, físico 40', 50, mk(95, 95, 40)));
