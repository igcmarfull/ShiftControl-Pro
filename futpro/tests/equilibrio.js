/* Equilibrio de goles del motor detallado (el que juega el protagonista): reparto por puesto, delantero de la IA, protagonista y minutos de prórroga.
   Uso: node tests/equilibrio.js   (≈ 1,5 minutos)
   Referencias aproximadas del fútbol real (de memoria): delanteros ≈ 55-60 % de los goles, mediocampo ≈ 30 %, defensas ≈ 12 %, delantero único ≈ 25-35 % de los de su equipo. */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var S = H.restore(H.buildWorld(555));
var r = 7; function rnd() { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; }
function heal() { Object.keys(S.ro).forEach(function (k) { (S.ro[k] || []).forEach(function (p) { p.inj = 0; p.su = 0; }); }); FP.Match.cache = {}; }
function compOf(lg) { return Object.keys(S.comps).map(function (i) { return S.comps[i]; }).filter(function (c) { return c.kind === 'L' && c.lg === lg; })[0]; }

// ---------- 1) sin protagonista: reparto de goles por puesto ----------
['ENG1', 'CHI1', 'GUA1', 'BRA1'].forEach(function (lg) {
  var comp = compOf(lg), teams = comp.teams, byPos = {}, goals = 0, n = 0;
  for (var i = 0; i < 120; i++) {
    var a = teams[Math.floor(rnd() * teams.length)], b = teams[Math.floor(rnd() * teams.length)]; if (a === b) continue; heal();
    var s = FP.Match.fullSession({ comp: comp, f: { h: a, a: b, w: 5, st: 0 }, hero: null, role: null }); s.runTo(1e9); var o = s.finish(); n++; goals += o.hs + o.as;
    var pos = {}; ['h', 'a'].forEach(function (sd) { o.xi[sd].forEach(function (e) { pos[e.id] = e.pos; }); });
    o.ev.forEach(function (e) { if (e.t === 'goal' && e.sc != null) { var p = pos[e.sc] || 'BANCA'; byPos[p] = (byPos[p] || 0) + 1; } });
  }
  function sh(list) { return list.reduce(function (a, k) { return a + (byPos[k] || 0); }, 0) / goals * 100; }
  var st = sh(['ST']), fw = sh(['ST', 'LW', 'RW']), df = sh(['CB', 'LB', 'RB']), md = sh(['CM', 'DM']), stPerMatch = (byPos.ST || 0) / (2 * n);
  t(lg + ': goles por partido entre 2,3 y 3,1 (' + (goals / n).toFixed(2) + ')', goals / n >= 2.3 && goals / n <= 3.1);
  t(lg + ': el delantero único marca 20-38 % de los goles de su equipo (' + Math.round(st) + ' %)', st >= 20 && st <= 38);
  t(lg + ': delanteros (ST+extremos) entre 45 y 68 % (' + Math.round(fw) + ' %)', fw >= 45 && fw <= 68);
  t(lg + ': defensas entre 6 y 16 % (' + Math.round(df) + ' %)', df >= 6 && df <= 16);
  t(lg + ': mediocampo (CM+DM) entre 5 y 22 % (' + Math.round(md) + ' %)', md >= 5 && md <= 22);
  t(lg + ': el delantero de la IA marca entre 0,25 y 0,52 por partido (' + stPerMatch.toFixed(2) + ')', stPerMatch >= 0.25 && stPerMatch <= 0.52);
});

// ---------- 2) protagonista delantero con distinto nivel (mismo equipo, titular) ----------
var h = FP.Game.startPreset(); h.pos = 'ST'; h.tk = 'pro';
function setLevel(base) { FP.Core.ATTRS.forEach(function (a) { h.at[a] = base; h.cap[a] = 99; }); h.mor = 60; h.form = 55; h.fat = 10; FP.Hero.updateOvr(); }
function heroRate(lg, base, n) {
  var comp = compOf(lg), teams = comp.teams, mid = teams.slice().sort(function (a, b) { return FP.Core.strOf(a) - FP.Core.strOf(b); })[Math.floor(teams.length / 2)], g = 0, tg = 0;
  h.club = h.team = mid; setLevel(base);
  for (var i = 0; i < n; i++) {
    var opp = teams[Math.floor(rnd() * teams.length)]; if (opp === mid) { i--; continue; } heal(); var home = rnd() < 0.5;
    var s = FP.Match.fullSession({ comp: comp, f: { h: home ? mid : opp, a: home ? opp : mid, w: 5, st: 0 }, hero: FP.Hero.view(0, 0), role: 'starter', status: { role: 'starter', why: '' } }); s.runTo(1e9); var o = s.finish(); g += o.hero.g; tg += home ? o.hs : o.as;
  }
  return { gpm: g / n, share: g / Math.max(1, tg) };
}
var c55 = heroRate('CHI1', 55, 150), c62 = heroRate('CHI1', 62, 150), c78 = heroRate('CHI1', 78, 150);
t('CHI1: más nivel, más goles (' + c55.gpm.toFixed(2) + ' < ' + c62.gpm.toFixed(2) + ' < ' + c78.gpm.toFixed(2) + ')', c55.gpm < c62.gpm + 0.05 && c62.gpm < c78.gpm + 0.05);
t('CHI1: un delantero de nivel parecido al del equipo (62) marca menos de 0,55 por partido (' + c62.gpm.toFixed(2) + ')', c62.gpm < 0.55);
t('CHI1: un delantero de nivel 78 no pasa de 0,85 por partido (' + c78.gpm.toFixed(2) + ')', c78.gpm < 0.85);
var g62 = heroRate('GUA1', 62, 150), g86 = heroRate('GUA1', 86, 150);
t('GUA1 (liga débil): el protagonista de nivel 62 queda por debajo de 1,05 g/p (' + g62.gpm.toFixed(2) + ')', g62.gpm < 1.05);
t('GUA1: el protagonista de nivel 86 queda por debajo de 1,1 g/p y de 66 % de los goles de su equipo (' + g86.gpm.toFixed(2) + ', ' + Math.round(g86.share * 100) + ' %)', g86.gpm < 1.1 && g86.share < 0.66);
var e55 = heroRate('ENG1', 55, 120); t('ENG1: un delantero de nivel 55 en un equipo de 78 marca poco (' + e55.gpm.toFixed(2) + ')', e55.gpm < 0.25);

// ---------- 3) minutos con prórroga ----------
(function () {
  // eliminatoria de partido único inventada (las reales de este mundo ya están jugadas): al empatar a los 90 minutos hay prórroga
  var comp = Object.keys(S.comps).map(function (i) { return S.comps[i]; }).filter(function (c) { return c.kind === 'C' && c.ko; })[0], teams = comp.teams, ri = comp.ko.rounds.length;
  comp.ko.rounds.push({ nm: 'Prueba', legs: 1, ties: [{}] });
  var et = 0, subbed = 0, played = 0, badSub = 0, badFull = 0, over = 0;
  for (var i = 0; i < 500; i++) {
    var A = teams[Math.floor(rnd() * teams.length)], B = teams[Math.floor(rnd() * teams.length)]; if (A === B) continue; heal();
    var f = { h: A, a: B, w: 5, st: 0, k: 1, x: ri, y: 0 }; comp.fx.push(f); comp.ko.rounds[ri].ties[0] = { a: A, b: B, f: [comp.fx.length - 1], agg: [0, 0] };
    h.club = h.team = A; setLevel(62);
    var s = FP.Match.fullSession({ comp: comp, f: f, hero: FP.Hero.view(0, 0), role: 'starter', status: { role: 'starter', why: '' } }); s.runTo(1e9); var o = s.finish(), hm = o.hero;
    if (!o.et || !hm || !hm.played) continue; et++;
    if (hm.min > 120) over++;
    if (hm.subOut) { subbed++; if (hm.min !== hm.subOut - (hm.subIn || 0)) badSub++; }
    else if (!hm.out) { played++; if (hm.min < 91) badFull++; }
  }
  t('hay suficientes partidos con prórroga para comprobar (' + et + ')', et >= 20);
  t('un sustituido antes de la prórroga no suma los 30 minutos (' + badSub + ' errores de ' + subbed + ')', subbed > 0 && badSub === 0);
  t('quien sigue en el campo juega la prórroga (' + badFull + ' errores de ' + played + ')', played > 0 && badFull === 0);
  t('nadie pasa de 120 minutos', over === 0);
})();

// ---------- 4) constantes separadas ----------
t('la IA reparte goles con exponente 6', FP.Match.SCT.exp === 6);
t('el motor detallado usa su propio exponente de remate', FP.Match.RL.shotExp > 0 && FP.Match.RL.shotExp < 3);
console.log('ok', ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
