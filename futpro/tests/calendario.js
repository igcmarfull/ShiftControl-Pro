/* Calendario y copas: sin ligas en fecha FIFA, supercopas, reglas de copa por país. Uso: node tests/calendario.js */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var S = H.restore(H.buildWorld(131)), Comp = FP.Comp;
var supers = {}, cupsSeen = {}, tierHost = { low: 0, hi: 0, eq: 0 }, bigWins = { big: 0, tot: 0 }, legsBra = [], semiEsp = [], intlLg = 0, lgFx = 0, midWin = 0;
for (var i = 0; i < 52 * 4; i++) {
  FP.Sim.step();
  Object.keys(S.comps).forEach(function (id) {
    var c = S.comps[id];
    if (c.kind === 'L' && !c.seen) { c.seen = 1; c.fx.forEach(function (f) { lgFx++; if (Comp.isIntl(f.w)) intlLg++; }); }
    if (c.kind === 'C' && c.sup && !supers[id]) supers[id] = c;
    if (c.kind === 'C' && !c.sup && !cupsSeen[id]) { cupsSeen[id] = c; }
    if (c.kind === 'C' && c.done && !c.counted) {
      c.counted = 1;
      if (!c.sup) { bigWins.tot++; var cl = S.clubs[c.champ]; if (cl && FP.LGDEF[cl.lg].t === 1) bigWins.big++; }
      if (!c.sup && c.ko) c.ko.rounds.forEach(function (r) { if (r.ties.length > 4) r.ties.forEach(function (tt) { if (tt.bye || tt.f.length !== 1) return; var f = c.fx[tt.f[0]], th = FP.LGDEF[S.clubs[f.h].lg].t, ta = FP.LGDEF[S.clubs[f.a].lg].t; if (th > ta) tierHost.low++; else if (th < ta) tierHost.hi++; else tierHost.eq++; }); });
      if (c.c === 'BRA' && !c.sup) c.ko.rounds.forEach(function (r) { r.ties.forEach(function (tt) { if (!tt.bye) legsBra.push(tt.f.length); }); });
      if (c.c === 'ESP' && !c.sup) c.ko.rounds.forEach(function (r) { if (r.ties.length === 2) r.ties.forEach(function (tt) { semiEsp.push(tt.f.length); }); });
    }
  });
}
var sids = Object.keys(supers), done = sids.filter(function (id) { return supers[id].done; });
console.log('ligas: partidos', lgFx, 'en fecha FIFA', intlLg, '| supercopas creadas', sids.length, 'terminadas', done.length, '| copas cerradas', bigWins.tot, 'ganadas por equipos de primera', bigWins.big, '| local de menor categoría / mayor / igual', tierHost.low, tierHost.hi, tierHost.eq);
t('ninguna liga juega en fecha FIFA', lgFx > 1000 && intlLg === 0, [lgFx, intlLg]);
t('se crean supercopas (≥ 20 en 4 años)', sids.length >= 20, sids.length); t('las supercopas terminan y tienen campeón', done.length >= 10 && done.every(function (id) { return supers[id].champ != null; }), done.length);
var one = supers[sids[0]]; t('la supercopa es un único partido entre dos clubes', one.fx.length === 1 && one.teams.length === 2, one && one.fx.length);
t('Brasil: copa a ida y vuelta (la mayoría de las llaves con 2 partidos)', legsBra.length > 10 && legsBra.filter(function (x) { return x === 2; }).length / legsBra.length > 0.85, legsBra.filter(function (x) { return x === 2; }).length + '/' + legsBra.length);
t('España: semifinales a ida y vuelta', semiEsp.length >= 2 && semiEsp.every(function (x) { return x === 2; }), semiEsp);
t('en las primeras rondas el de menor categoría suele ser local', tierHost.low > tierHost.hi * 3, tierHost);
t('copas: ganan equipos de primera casi siempre, pero no siempre (60-97%)', bigWins.tot >= 15 && bigWins.big / bigWins.tot >= 0.6 && bigWins.big / bigWins.tot <= 0.97, bigWins.big / bigWins.tot);
t('las ligas terminan antes de que empiece la siguiente', Object.keys(S.comps).filter(function (id) { return S.comps[id].kind === 'L' && !S.comps[id].done; }).every(function (id) { return S.comps[id].y >= FP.Date.year(S.week) - 1; }));
console.log('ok', ok, 'fallas', bad); process.exit(bad ? 1 : 0);
