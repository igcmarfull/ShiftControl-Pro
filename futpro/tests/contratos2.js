/* Cláusulas de renovación automática y de rebaja por descenso. Uso: node tests/contratos2.js */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var K = FP.Contracts, Dec = FP.Dec, M = FP.Market;
var S = H.restore(H.buildWorld(71)), h = FP.Game.startPreset();
for (var i = 0; i < 52 * 5; i++) { if (i === 30) { Object.keys(h.at).forEach(function (a) { h.at[a] = Math.min(80, h.at[a] + 10); h.cap[a] = 92; }); h.pot = 85; FP.Hero.updateOvr(); } FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h); Dec.open().forEach(function (d) { Dec.resolve(d.id, d.opts[0].k); }); }
h.b = S.week - Math.round(22 * 52.18); S.pl[0].b = h.b;
// frecuencias de las cláusulas al generar condiciones
var cl1 = S.clubs.filter(function (c) { return FP.LGDEF[c.lg].t === 1; }), cl3 = S.clubs.filter(function (c) { return FP.LGDEF[c.lg].t >= 3; }), n = 0, a1 = 0, r1 = 0, a3 = 0, r3 = 0, m = 0;
for (var k = 0; k < 600; k++) { var c = cl1[k % cl1.length], tt = K.terms(c, { type: 'transfer', club: c.id }); if (tt.kind === 'prof') { n++; if (tt.auto) a1++; if (tt.relegation) r1++; if (tt.auto && tt.auto.n < 8) m++; } }
for (var k2 = 0; k2 < 600; k2++) { var c3 = cl3[k2 % cl3.length], t3 = K.terms(c3, { type: 'transfer', club: c3.id }); if (t3.relegation) r3++; if (t3.auto) a3++; }
console.log('edad', FP.Hero.age(), 'primera: contratos prof', n, 'auto', a1, 'descenso', r1, '| inferiores: auto', a3, 'descenso', r3);
t('hay contratos con renovación automática (10-40%)', n > 100 && a1 / n >= 0.1 && a1 / n <= 0.4, a1 / n);
t('hay contratos con rebaja por descenso en primera (25-60%)', r1 / n >= 0.25 && r1 / n <= 0.6, r1 / n);
t('en divisiones bajas no hay rebaja por descenso', r3 === 0, r3);
t('el mínimo de partidos es razonable', m === 0);
// mecánica de la renovación automática
var club = S.clubs.filter(function (c) { return FP.LGDEF[c.lg].t === 2 && c.c === 'CHI'; })[0];
h.tk = 'pro'; h.club = club.id; h.team = club.id; var cal = FP.LGDEF[club.lg].cal, yr = FP.Date.year(S.week);
var ct = h.contract = { type: 'prof', kind: 'prof', wage: 100, end: yr, role: 'Titular', cid: 9001, auto: { n: 15, years: 1 }, relegation: { cut: 0.3 } };
ct.endW = M.contractEndWeek(ct, cal); var end0 = ct.endW; var rg = { cid: 9001, wh: [[S.week, 100]], ev: [], wage: 100 }; K.ensure().reg.push(rg);
h.season.ap = 10; K.autoRenew = FP.Contratos2.autoRenew; FP.Contratos2.autoRenew(ct.endW - 60); t('fuera de la última temporada no se activa', !ct.autoDone);
FP.Contratos2.autoRenew(ct.endW - 30); t('con pocos partidos no se activa', !ct.autoDone);
h.season.ap = 16; FP.Contratos2.autoRenew(ct.endW - 30); t('con los partidos pactados se extiende un año', ct.autoDone === 1 && ct.endW > end0 && ct.end === yr + 1, [end0, ct.endW]);
var e1 = ct.endW; FP.Contratos2.autoRenew(ct.endW - 30); t('solo se activa una vez', ct.endW === e1);
// descenso
var comp = S.comps[S.lgs[club.lg].cmp], entry = { dn: [club.id], tab: [club.id], up: [], ch: -1 };
var wage0 = ct.wage, w0 = S.week; K.onLeagueClosed({ teams: [club.id], lg: club.lg, label: '2099' }, entry);
t('se aplica la rebaja por descenso', ct.wage === Math.round(wage0 * 0.7) && ct.relDone === 1, [wage0, ct.wage]);
K.onLeagueClosed({ teams: [club.id], lg: club.lg, label: '2099' }, entry); t('la rebaja se aplica una vez', ct.wage === Math.round(wage0 * 0.7));
t('resumen con las cláusulas', /renovación automática/.test(K.summary({ t: { kind: 'prof', role: 'Titular', startW: 1, endW: 100, wage: 100, auto: { n: 15, years: 1 }, relegation: { cut: 0.3 } }, club: club.id })));
var snap = JSON.stringify(FP.Store.pack()); H.restore(snap); t('guardado conserva el contrato', FP.S.hero.contract && FP.S.hero.contract.auto);
console.log('ok', ok, 'fallas', bad); process.exit(bad ? 1 : 0);
