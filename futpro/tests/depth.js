/* Pruebas de "Profundidad de carrera": salud, vestuario, tácticas, vida personal, retiro y guardado. Uso: node tests/depth.js */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var S = H.restore(H.buildWorld(321)), h = FP.Game.startPreset();
function week(play) { FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h); }
var seenDec = {}, injTypes = {}, maxPeople = 0;
for (var i = 0; i < 52 * 7; i++) {
  if (i === 52 * 2) { Object.keys(h.at).forEach(function (a) { h.at[a] = Math.min(84, h.at[a] + 14); h.cap[a] = 95; }); h.pot = 88; FP.Hero.updateOvr(); }
  week(); if (h.lk) maxPeople = Math.max(maxPeople, h.lk.people.length);
  FP.Dec.open().forEach(function (d) { seenDec[d.kind] = (seenDec[d.kind] || 0) + 1; FP.Dec.resolve(d.id, d.opts[i % d.opts.length].k); });
}
t('resúmenes de temporada generados', h.rv && h.rv.list.length > 0 && h.rv.list[0].text.length >= 3);
t('metas y logros', h.gl && h.gl.season && h.gl.season.items.length >= 3 && Object.keys(h.gl.ach).length > 0);
t('lesiones tipificadas', h.med.hist.length > 0 && h.med.hist.every(function (e) { return e.nm && e.zone; }));
t('carga de partidos acotada', h.med.load >= 0 && h.med.load < 80, h.med.load);
t('decisiones sin pendientes eternas', FP.Dec.open().length < 5);
t('vestuario con personas', maxPeople > 0, maxPeople);
t('estilo de entrenador asignado', Object.keys(FP.S.staff).length > 0);
t('familiaridad en la posición actual', h.fam[h.pos] === 100 || h.fam[h.pos] > 0);
t('vida personal creada', !!h.life && h.life.edu.grad === true);
// cambio de posición con costo y adaptación
var pos0 = h.pos, np = pos0 === 'CM' ? 'DM' : 'CM', r = FP.Tac.setPos(np);
t('cambio de posición ok', r.ok && h.pos === np);
var pen0 = FP.Tac.pen(); t('costo de adaptación', pen0 > 0, pen0);
for (var k = 0; k < 40; k++) week();
t('la adaptación baja el costo', FP.Tac.pen() < pen0, [pen0, FP.Tac.pen()]);
// partido con pausas
var tries = 0, played = false;
while (!played && tries++ < 60) { FP.Game.beginWeek(); if (FP.Game.hasPending()) { var prep = FP.Game.nextPending(), mt = FP.Tac.begin(prep); mt.prep = prep; h.instr = 1; FP.Tac.setMent(mt, 1); var fin = false, n = 0; while (!fin && n++ < 5) fin = FP.Tac.resume(mt); t('partido con pausas termina', fin && mt.res.hs != null); played = true; }
  var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); }
t('se jugó partido con pausas', played);
// retiro, homenaje y vida posterior
h.money = 300; FP.Events.retire(false);
t('legado calculado', h.post && h.post.legacy && h.post.legacy.score >= 0);
var d0 = FP.Dec.open('retiro')[0]; t('decisión de homenaje', !!d0);
if (d0) { FP.Dec.resolve(d0.id, d0.opts[0].k); t('homenaje registrado', h.post.tribute.st === 'done'); }
FP.Post.choose('coach');
var c1 = FP.Post.startCourse('coach'); t('curso iniciado', c1.ok, c1.msg);
for (var w = 0; w < 52 * 4; w++) { FP.Sim.step(); FP.Dec.open('post').forEach(function (d) { FP.Dec.resolve(d.id, d.opts[0].k); }); if (!h.post.path.course && h.post.lic < 3 && h.post.exp >= h.post.lic - 1) FP.Post.startCourse('coach'); }
t('licencia obtenida', h.post.lic >= 1, h.post.lic);
t('ingresos posteriores', h.post.income > 0, h.post.income);
// director técnico con partidos reales
FP.Post.choose('coach'); h.post.lic = 3; h.post.exp = 3;
var ccl = FP.S.clubs.filter(function (c) { return c.c === h.nat && FP.LGDEF[c.lg].t === 2; })[2]; h.post.path.job = { club: ccl.id, role: 'head', since: FP.S.week }; FP.Post.takeOver(h.post.path.job);
var played = 0, seas0 = h.post.path.seasons.length, gd = 0;
while (h.post.path.seasons.length === seas0 && gd++ < 52 * 2) { var mm = FP.Coach.stepWeek(); while (mm && FP.Coach.next()) { var pr2 = FP.Coach.next(); if (played % 2) { var cm = FP.Coach.begin(pr2, '4-4-2', 1), fin2 = false, nn = 0; while (!fin2 && nn++ < 5) fin2 = FP.Coach.resume(cm); } else FP.Coach.quick(pr2, '4-3-3', 0); played++; } if (mm) FP.Game.endWeek(); }
t('partidos dirigidos con el motor', played > 10, played);
t('resultado real de temporada del técnico', h.post.path.seasons.length > seas0 && h.post.path.seasons[h.post.path.seasons.length - 1].rank > 0);
// representante, protegido, nuevos caminos y epílogo
FP.Post.choose('agent'); h.post.agentLic = true;
for (var w2 = 0; w2 < 52 * 4; w2++) { FP.Sim.step(); FP.Dec.open().forEach(function (d) { FP.Dec.resolve(d.id, d.opts[0].k); }); }
t('representante gestiona clientes con lealtad', h.post.path.clients.length > 0 && h.post.path.clients.every(function (c) { return c.loy != null; }));
var son = FP.Mentor.createSon(); t('hijo creado', !!son && FP.Mentor.get().kind === 'hijo');
for (var w3 = 0; w3 < 52 * 3; w3++) { FP.Sim.step(); FP.Dec.open().forEach(function (d) { FP.Dec.resolve(d.id, d.opts[0].k); }); }
t('protegido progresa', !!FP.Mentor.get() && FP.Mentor.get().hist.length > 0);
['dir', 'pres', 'sel'].forEach(function (k) { FP.Post.choose(k); h.money = 2000; for (var w4 = 0; w4 < 52 * 2; w4++) { FP.Sim.step(); FP.Dec.open().forEach(function (d) { FP.Dec.resolve(d.id, d.opts[0].k); }); } t('camino ' + k + ' con cargo', !!h.post.path.job, k); });
t('epílogo generado', FP.Epilogue.story().length >= 5 && FP.Epilogue.text().length > 200);
// prueba masiva (jugador sin club) en una partida aparte
(function () {
  var snapT = H.buildWorld(902), ST = H.restore(snapT), hh = FP.Game.startPreset();
  for (var q = 0; q < 70; q++) { FP.Game.beginWeek(); var g3 = 0; while (FP.Game.hasPending() && g3++ < 20) FP.Game.playPending(); FP.Game.endWeek(); }
  hh.tk = 'free'; hh.club = null; hh.team = null; hh.contract = null;
  for (var q2 = 0; q2 < 12; q2++) { FP.Game.beginWeek(); var g4 = 0; while (FP.Game.hasPending() && g4++ < 20) FP.Game.playPending(); FP.Game.endWeek(); if (ST.ty && ST.ty.items.length && !hh.ty.reg) FP.Tryouts.register(ST.ty.items[0].id); }
  t('se anuncian pruebas masivas a un jugador sin club', ST.ty && ST.ty.items.length > 0);
  t('se resuelve una prueba masiva con ranking', hh.ty.hist.length > 0 && hh.ty.hist[0].rank >= 1);
})();
// guardado: ida y vuelta conserva todo
var snap = JSON.stringify(FP.Store.pack()), ver = JSON.parse(snap).ver; FP.Store.unpack(JSON.parse(snap));
t('versión de guardado', ver === FP.Store.VERSION, ver);
t('estado nuevo persiste', FP.S.hero.post && FP.S.hero.life && FP.S.hero.med && FP.S.hero.fam);
console.log('ok', ok, 'fallas', bad, 'decisiones vistas', JSON.stringify(seenDec));
process.exit(bad ? 1 : 0);
