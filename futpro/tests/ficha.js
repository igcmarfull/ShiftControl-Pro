/* Pruebas de la ficha de jugadores seguidos. Uso: node tests/ficha.js */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var Dec = FP.Dec, P = FP.Post, F = FP.Ficha;
var S = H.restore(H.buildWorld(808)), h = FP.Game.startPreset();
for (var i = 0; i < 52 * 7; i++) { if (i === 52) { Object.keys(h.at).forEach(function (a) { h.at[a] = Math.min(84, h.at[a] + 14); h.cap[a] = 95; }); h.pot = 88; FP.Hero.updateOvr(); } FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h); Dec.open().forEach(function (d) { Dec.resolve(d.id, d.opts[0].k); }); }
h.money = 5000; FP.Events.retire(false); Dec.open().forEach(function (d) { Dec.resolve(d.id, d.opts[0].k); });
// protegido: hijo con edad adulta joven en un club
var q = FP.Mentor.createSon(); q.b = S.week - 19 * 52.18; q.o = 62; q.pt = 80; q.p = 'ST';
var club = S.clubs.filter(function (c) { return c.c === h.nat && FP.LGDEF[c.lg].t === 2; })[0]; FP.Agency.move(q, club.id);
// representados
P.choose('agent'); h.post.agentLic = true; var cl = S.pl.filter(function (p) { return p && p.c >= 0 && p.c < 5000 && C().age(p) >= 18 && C().age(p) <= 22 && p.o > 55; }).slice(0, 2);
function C() { return FP.Core; }
cl.forEach(function (p) { h.post.path.clients.push({ pid: p.i, since: S.week, loy: 60, com: 0, star: false, nm: p.n }); });
F.sync();
t('se siguen protegido y representados', Object.keys(h.fi.pl).length === 3, Object.keys(h.fi.pl).length);
var wk = 0; for (var k = 0; k < 52 * 3; k++) { FP.Sim.step(); Dec.open().forEach(function (d) { Dec.resolve(d.id, d.def); }); }
var r = h.fi.pl[q.i];
t('el protegido tiene filas por temporada', r.rows.length >= 2, r.rows.length);
t('hay partidos estimados y goles', r.rows.some(function (x) { return x.p > 0; }), JSON.stringify(r.rows.map(function (x) { return [x.y, x.p, x.g, x.a]; })));
t('debut registrado', r.hit.some(function (x) { return /Debut/.test(x.t); }), JSON.stringify(r.hit));
t('progresión anual', r.prog.length >= 2);
t('minutos coherentes', r.rows.every(function (x) { return x.mn <= x.p * 95 && x.g >= 0; }));
var lead = F.lead(r); t('texto introductorio', lead.indexOf(r.n) > 0 && lead.indexOf('hijo') > 0, lead);
cl.forEach(function (p) { var rr = h.fi.pl[p.i]; t('representado con ficha', rr && rr.rows.length >= 1, rr && rr.rows.length); });
var tot = 0; Object.keys(h.fi.pl).forEach(function (k2) { h.fi.pl[k2].rows.forEach(function (x) { tot += x.g; }); }); t('goles registrados', tot > 0, tot);
// retiro del seguido
S.pl[cl[0].i].c = -2; F.sync(); t('retiro del seguido queda anotado', h.fi.pl[cl[0].i].end && h.fi.pl[cl[0].i].hit.some(function (x) { return /retira/.test(x.t); }));
var snap = JSON.stringify(FP.Store.pack()); H.restore(snap); t('sobrevive al guardado', FP.S.hero.fi && Object.keys(FP.S.hero.fi.pl).length === 3);
console.log('ok', ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
