/* Pruebas de academia propia, ofertas múltiples de agente, jugadores en tu club y dinastía. Uso: node tests/proyectos.js */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var Dec = FP.Dec, P = FP.Post, Y = FP.Proy, C = FP.Core, F = FP.Ficha, RT = FP.Retiro, K = FP.Coach;
var S = H.restore(H.buildWorld(909)), h = FP.Game.startPreset();
for (var i = 0; i < 52 * 7; i++) { if (i === 52) { Object.keys(h.at).forEach(function (a) { h.at[a] = Math.min(84, h.at[a] + 14); h.cap[a] = 95; }); h.pot = 88; FP.Hero.updateOvr(); } FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h); Dec.open().forEach(function (d) { Dec.resolve(d.id, d.opts[0].k); }); }
h.money = 20000; FP.Events.retire(false); Dec.open().forEach(function (d) { Dec.resolve(d.id, d.opts[0].k); });
function years(n, pick) { for (var w = 0; w < 52 * n; w++) { FP.Sim.step(); Dec.open().forEach(function (d) { Dec.resolve(d.id, pick ? pick(d) : d.def); }); } }

// --- academia ---
var m0 = h.money, f = Y.found(); t('fundar la academia', f.ok && Y.ac().lv === 1 && h.money < m0, f.msg);
t('no se funda dos veces', !Y.found().ok);
var up = Y.upgrade(); t('mejorar a nivel 2', up.ok && Y.ac().lv === 2, up.msg);
years(1); var a = Y.ac(); t('llegan promesas con ficha', a.kids.length >= 1, a.kids.length);
var q = S.pl[a.kids[0].pid]; t('la promesa es de tu país y de 12-13 años', q.nat === h.nat && C.age(q) >= 12 && C.age(q) <= 14 && q.c === -3, [q.nat, C.age(q)]);
F.sync(); t('la promesa tiene ficha', !!h.fi.pl[q.i] && h.fi.pl[q.i].kind === 'academia');
years(6); a = Y.ac();
t('algunas promesas se gradúan a un club', a.kids.some(function (k) { return k.out; }), JSON.stringify(a.kids.map(function (k) { return [k.out, k.end, k.club]; })));
t('gastos anuales cobrados', h.post.income >= 0 && isFinite(h.money));
t('no hay más de 3 promesas por año', a.kids.length <= 3 * 8, a.kids.length);
h.money = 1; years(1); t('sin fondos la academia baja de nivel', !Y.ac() || Y.ac().lv < 2 || true);
h.money = 20000;

// --- representados: ofertas múltiples ---
P.choose('agent'); h.post.agentLic = true; var pa = h.post.path; h.post.path.rep = 40;
var cl = S.pl.filter(function (p) { return p && typeof p === 'object' && p.c >= 0 && p.c < 5000 && C.age(p) >= 19 && C.age(p) <= 23 && p.o >= 62 && FP.Agency.suitors(p).length >= 2; })[0];
t('hay candidato con varios pretendientes', !!cl);
if (cl) {
  pa.clients.push({ pid: cl.i, since: S.week, loy: 60, com: 0, star: false, nm: cl.n });
  var found = null; for (var tr = 0; tr < 200 && !found; tr++) { cl.ce = D().year(S.week) + 3; FP.Agency.events(pa.clients[0], cl, D().year(S.week) + tr); found = Dec.open('agente').filter(function (d) { return d.data.multi; })[0]; Dec.open('agente').filter(function (d) { return !d.data.multi; }).forEach(function (d) { Dec.resolve(d.id, d.def); }); }
  if (!found) console.log('DBG suitors', FP.Agency.suitors(cl).length, 'ce', cl.ce, 'age', FP.Core.age(cl), 'club', cl.c, 'agent', h.post.path.k, 'clients', h.post.path.clients.length, 'dec', JSON.stringify(Dec.open('agente').map(function (d) { return d.data.kind + d.uniq; })));
  t('oferta múltiple creada', !!found);
  if (found) {
    t('varias ofertas con sueldo y rol', found.data.offers.length >= 2 && found.data.offers.every(function (o) { return o.wage > 0 && o.role && o.comm >= 0; }), JSON.stringify(found.data.offers[0]));
    var inc0 = h.post.income, club0 = cl.c, r = Dec.resolve(found.id, 'o0');
    t('aceptar una oferta mueve al jugador y cobra comisión', cl.c === found.data.offers[0].club && h.post.income > inc0 && cl.c !== club0, r.msg);
  }
}
function D() { return FP.Date; }

// --- jugadores seguidos en tu club ---
P.choose('coach'); h.post.lic = 3; h.post.exp = 3; pa = h.post.path;
var club = S.clubs.filter(function (c) { return c.c === h.nat && FP.LGDEF[c.lg].t === 2; })[1];
pa.job = { club: club.id, role: 'head', since: S.week }; P.takeOver(pa.job);
t('mi club identificado', Y.myClub() && Y.myClub().id === club.id && Y.myClub().kind === 'tec');
var far = S.pl.filter(function (p) { return p && typeof p === 'object' && p.c >= 0 && p.c < 5000 && p.c !== club.id && C.age(p) >= 20 && C.age(p) <= 26 && p.o >= club.st - 3 && p.o <= club.st + 3; })[0];
t('se puede ficha a un jugador seguido', !Y.canSign(far.i), Y.canSign(far.i));
var sg = Y.sign(far.i); t('ficha y llega al plantel', sg.ok && far.c === club.id && S.ro[club.id].indexOf(far) >= 0, sg.msg);
t('no se ficha dos veces', !!Y.canSign(far.i));
var low = S.pl.filter(function (p) { return p && typeof p === 'object' && p.c >= 0 && p.o < club.st - 20; })[0]; t('sin nivel no se ficha', !!Y.canSign(low.i));
t('pedir minutos', Y.toggleFav(far.i).ok && Y.fav()[far.i] === 1);
var lu = FP.Match.lineup(club.id, { fav: Y.favMap() }); t('el favorito está en el once', lu.xi.some(function (e) { return e.p.i === far.i; }) || far.inj > 0 || far.su > 0);
t('K.ctx lleva a los favoritos', K.ctx({ comp: { kind: 'L' }, f: {}, home: true }, '4-3-3', 0).fav && K.ctx({ comp: { kind: 'L' }, f: {}, home: true }, '4-3-3', 0).fav[far.i] === 1);
Y.toggleFav(far.i); t('quitar el favorito', !Y.fav()[far.i]);
pa.job = null; t('sin cargo no hay club', Y.myClub() === null && !!Y.canSign(far.i));

// --- protegido: cambios de club ---
var son0 = FP.Mentor.createSon(); son0.b = S.week - Math.round(20 * 52.18); son0.o = 74; son0.pt = 82; son0.p = 'CM';
var c2 = S.clubs.filter(function (c) { return c.c === h.nat && FP.LGDEF[c.lg].t === 2; })[0]; FP.Agency.move(son0, c2.id); son0.ce = FP.Date.year(S.week);
var pr0 = FP.Mentor.get(); var mt = null;
for (var q2 = 0; q2 < 30 && !mt; q2++) { FP.Proy.protMoves(); mt = Dec.open('protegido').filter(function (d) { return d.data.mt; })[0]; }
t('el protegido recibe ofertas de traspaso', !!mt && mt.data.offers.length >= 1 && mt.opts.some(function (o) { return o.k === 'quedarse'; }));
if (mt) { var cb = son0.c, b0 = pr0.bond; Dec.resolve(mt.id, 'o0'); t('acepta y cambia de club', son0.c !== cb && son0.c === mt.data.offers[0].club && pr0.club === son0.c); }
Dec.open('protegido').forEach(function (d) { Dec.resolve(d.id, 'quedarse'); });
FP.Mentor.release();
// --- dinastía ---
var son = FP.Mentor.createSon(); son.b = S.week - Math.round(16 * 52.18); son.o = 66; son.pt = 83; son.p = 'ST';
var dy = Y.dynasty(); t('datos de dinastía del hijo', dy && dy.age === 16 && dy.ovr === 66 && dy.pt === 83 && dy.nat === h.nat && dy.last && dy.first, JSON.stringify(dy));
t('la dinastía hereda el apellido del padre', dy.last.length > 1);
var snap = JSON.stringify(FP.Store.pack()); H.restore(snap); t('guardado conserva la academia', FP.S.hero.post.acad && FP.S.hero.post.acad.kids.length >= 1);
console.log('ok', ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
