/* Pruebas del retiro en profundidad: salud y vida por etapas, escalera de entrenador, presidencia, reencuentros y cierre. Uso: node tests/retiro.js */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
var store = {}; global.localStorage = { getItem: function (k) { return store[k] == null ? null : store[k]; }, setItem: function (k, v) { store[k] = String(v); } };
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var C = FP.Core, RT = FP.Retiro, P = FP.Post, Dec = FP.Dec;
function career(seed) {
  var S = H.restore(H.buildWorld(seed)), h = FP.Game.startPreset();
  for (var i = 0; i < 52 * 9; i++) {
    if (i === 52 * 2) { Object.keys(h.at).forEach(function (a) { h.at[a] = Math.min(84, h.at[a] + 14); h.cap[a] = 95; }); h.pot = 88; FP.Hero.updateOvr(); }
    FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h);
    Dec.open().forEach(function (d) { Dec.resolve(d.id, d.opts[0].k); });
  }
  return h;
}
function years(n, pick) { for (var w = 0; w < 52 * n; w++) { FP.Sim.step(); Dec.open().forEach(function (d) { Dec.resolve(d.id, pick ? pick(d) : d.opts[0].k); }); } }
var h = career(404), S = FP.S;
var rt = RT.ensure();
t('se anotaron compañeros durante la carrera', Object.keys(rt.mates).length >= 3, Object.keys(rt.mates).length);
t('se anotaron rivales', Object.keys(rt.rivals).length >= 1, Object.keys(rt.rivals).length);
t('compañeros acotados', Object.keys(rt.mates).length <= 40 && Object.keys(rt.rivals).length <= 12);
h.money = 5000; FP.Events.retire(false);
t('salud inicial dentro de rango', rt.hl >= 38 && rt.hl <= 95, rt.hl);
t('homenaje de un rival', !!(rt.trib && rt.trib.t.length > 20), rt.trib);
t('la hoja de vida de salón guarda al retirado', RT.hofLoad().length === 1 && RT.hofLoad()[0].nm === h.nm);
Dec.open('retiro').forEach(function (d) { Dec.resolve(d.id, d.opts[0].k); });

// --- etapas de vida y salud ---
var hl0 = rt.hl; h.b = FP.S.week - Math.round(44.9 * 52.1775); 
years(2); // cruza los 45
var ms = Dec.open('rt'); t('etapa de los 45 propuesta o ya resuelta', !!rt.ms[45], JSON.stringify(rt.ms));
years(0); 
var deg = rt.hl; t('la salud se mantiene en rango', deg >= 3 && deg <= 98, [hl0, deg]);
h.b = FP.S.week - Math.round(55.2 * 52.1775); years(1);
t('etapa de los 55', !!rt.ms[55]);
h.b = FP.S.week - Math.round(65.2 * 52.1775); years(1);
t('etapa de los 65', !!rt.ms[65]);
t('hay hitos de vida', rt.life.length >= 1, rt.life.length);
// salud baja → evento y operación
rt.hl = 30; h.money = 3000; RT.healthEvent(); var n0 = Dec.open('rt').length;
for (var q = 0; q < 60 && !Dec.open('rt').some(function (d) { return d.data.t === 'salud'; }); q++) { rt.hl = 30; Dec.open('rt').forEach(function (d) { Dec.resolve(d.id, d.def); }); RT.healthEvent(); }
var sd = Dec.open('rt').filter(function (d) { return d.data.t === 'salud'; })[0]; t('evento de salud aparece con salud baja', !!sd);
if (sd) { var m0 = h.money; Dec.resolve(sd.id, 'operar'); t('operación cuesta dinero y sube la salud', h.money < m0 && rt.hl > 30, [m0, h.money, rt.hl]); }
var a0 = P.ability(); rt.hl = 20; t('la mala salud resta capacidad', P.ability() < a0 || a0 < 1); rt.hl = 60;
h.money = 5; rt.hl = 30; var sd2 = Dec.add({ kind: 'rt', uniq: 'x', title: 'x', text: '', opts: [{ k: 'operar', label: 'x' }], data: { t: 'salud', op: 500 } }); Dec.resolve(sd2.id, 'operar'); t('sin fondos no se opera', rt.hl <= 30, rt.hl);

// --- escalera de entrenador ---
h.money = 8000; P.choose('coach'); var pa = h.post.path; h.post.legacy.score = 70; h.post.lic = 1; h.post.exp = 0;
var r2 = P.startCourse('coach'); t('leyenda salta la experiencia del nivel 2', r2.ok, r2.msg);
t('el curso es más corto para una leyenda', pa.course && pa.course.left < Math.round(52 * P.eduFactor()), pa.course && pa.course.left);
t('rung básico', RT.rung() >= 1);
pa.course = null; h.post.lic = 3; h.post.exp = 3;
var club = S.clubs.filter(function (c) { return c.c === h.nat && FP.LGDEF[c.lg].t === 3; })[1] || S.clubs.filter(function (c) { return c.c === h.nat; })[5];
pa.job = { club: club.id, role: 'head', since: S.week }; P.takeOver(pa.job);
var played = 0, guard = 0, sacked = false, K = FP.Coach, seas0 = pa.seasons.length;
while (pa.seasons.length < seas0 + 2 && guard++ < 52 * 4) { var mm = K.stepWeek(); while (mm && K.next()) { K.quick(K.next(), '4-3-3', 0); played++; if (!pa.job) { sacked = true; break; } } if (mm) FP.Game.endWeek(); Dec.open().forEach(function (d) { Dec.resolve(d.id, d.opts[0].k); }); if (!pa.job) { sacked = true; break; } }
t('el técnico juega partidos reales', played > 20, played);
t('confianza acotada', !pa.job || (pa.job.conf >= 0 && pa.job.conf <= 100), pa.job && pa.job.conf);
t('rung de primera categoría marcado', RT.rung() >= 6, RT.rung());
// despido a mitad de temporada
pa.job = { club: club.id, role: 'head', since: S.week, conf: 18, n: 9 }; P.takeOver(pa.job);
var pr = null; guard = 0; while (pa.job && guard++ < 52 * 2) { var m3 = K.stepWeek(); while (m3 && K.next()) { pr = K.next(); pa.job && (pa.job.conf = Math.min(pa.job.conf, 16)); K.quick(pr, '4-3-3', -1); } if (m3) FP.Game.endWeek(); }
t('destitución a mitad de temporada con confianza mínima', pa.job === null && pa.seasons.some(function (s) { return s.mid; }));
// ascenso de asistente
h.post.lic = 3; pa.job = { club: club.id, role: 'assist', since: S.week }; pa.seasons.push({ y: '2099', club: club.id, role: 'assist', res: 'Campeón' }); Dec.open('rt').forEach(function (d) { Dec.resolve(d.id, d.def); });
RT.promo(); var pd = Dec.open('rt').filter(function (d) { return d.data.t === 'ascenso'; })[0]; t('oferta de ascenso tras buena temporada', !!pd);
if (pd) { Dec.resolve(pd.id, 'si'); t('ascenso aplicado', pa.job && pa.job.role === 'head'); }

// --- presidencia ---
P.choose('pres'); pa = h.post.path; h.money = 20000;
var cl = S.clubs.filter(function (c) { return c.c === h.nat && FP.LGDEF[c.lg].t >= 3; })[2];
Dec.handlers.gestion('j0', { data: { cand: [cl.id] } }); t('asumes la presidencia', pa.job && pa.job.club === cl.id);
var fn = RT.fn(); t('hay caja inicial', fn && fn.cash > 0, fn && fn.cash);
var wb = RT.wageBill(cl), inc = RT.income(cl, fn), cs = RT.costs(cl); t('ingresos y costos del mismo orden', inc / cs > 0.85 && inc / cs < 1.5, [wb, inc, cs]);
var tg = RT.targets(); t('hay candidatos a fichar', tg.length >= 1, tg.length);
fn.cash = 1e6; var ro0 = S.ro[cl.id].length; var b = RT.buy(tg[0].pid, tg[0].fee); t('fichaje ok', b.ok && S.ro[cl.id].length === ro0 + 1 && S.pl[tg[0].pid].c === cl.id, b.msg);
var cash1 = fn.cash, top = S.ro[cl.id].slice().sort(function (a, b2) { return b2.o - a.o; })[3]; var sl = RT.sell(top.i); t('venta ok', sl.ok && fn.cash > cash1 && top.c !== cl.id, sl.msg);
var m1 = h.money, st = RT.stadium(); t('estadio sube de nivel y cuesta', st.ok && fn.st === 1 && h.money < m1, st.msg);
var ac0 = cl.ac; RT.academy(); RT.academy(); t('la academia sube con dos inversiones', cl.ac === Math.min(5, ac0 + 1), [ac0, cl.ac]);
fn.cash = 0; var ij = RT.inject(); t('inyección de capital', ij.ok && fn.cash > 0, ij.msg);
fn.cash = 10; var low = RT.buy(tg[1].pid, 999999); t('sin caja no se ficha', !low.ok);
var y0 = fn.y.length; years(2, function (d) { return d.def; });
t('cierre anual con cuentas', fn.y.length > y0 && fn.y.every(function (r) { return isFinite(r.net) && isFinite(r.inc); }), fn.y.length);
t('dinero finito', isFinite(h.money));

// --- reencuentros ---
var rt2 = RT.ensure(); var someMate = Object.keys(rt2.mates)[0]; rt2.mates[someMate].b = FP.S.week - 40 * 52; S.pl[someMate] = 0;
pa.job = pa.job || { club: cl.id, role: 'pres', since: S.week };
Dec.open('rt').forEach(function (d) { Dec.resolve(d.id, d.def); }); rt2.mateCoach = null; RT.reencuentros();
var mc = Dec.open('rt').filter(function (d) { return d.data.t === 'mate_coach'; })[0]; t('excompañero retirado propone entrar al cuerpo técnico', !!mc);
if (mc) { Dec.resolve(mc.id, 'si'); t('se suma al cuerpo técnico', rt2.mateCoach && rt2.mateCoach.pid === mc.data.pid); }
// excompañero activo
var other = Object.keys(rt2.mates).filter(function (k) { return S.pl[k] && typeof S.pl[k] === 'object'; })[0]; var oq = S.pl[other]; oq.c = S.clubs.filter(function (c) { return c.id !== cl.id; })[0].id; oq.b = FP.S.week - 33 * 52; oq.o = cl.st + 2; oq.pt = oq.o;
Dec.open('rt').forEach(function (d) { Dec.resolve(d.id, d.def); }); RT.reencuentros(); var sg = Dec.open('rt').filter(function (d) { return d.data.t === 'mate_sign'; })[0];
t('excompañero activo pide oportunidad', !!sg); if (sg) { RT.fn().cash = 1e7; Dec.resolve(sg.id, 'si'); t('ficha al excompañero', S.pl[sg.data.pid].c === cl.id); }

// --- cierre ---
RT.hofSave(); var e = RT.hofLoad()[0]; t('entrada de salón completa', e && e.nm === h.nm && e.score >= 0 && e.path);
store['futpro.hof'] = JSON.stringify([{ id: 'otro|1', nm: 'Otro', score: 99, bo: 3, tro: 20, g: 400, ap: 800, peak: 92, caps: 100, ret: 36, yr: 2050, path: '', pt: 0 }].concat(RT.hofLoad()));
t('varias carreras ordenadas', RT.hofLoad().length === 2); RT.hofSave(); t('no duplica', RT.hofLoad().length === 2);
RT.hofDelete('otro|1'); t('borrar entrada', RT.hofLoad().length === 1);
var ph = RT.printHtml(); t('versión imprimible', ph.indexOf(h.nm) > 0 && ph.indexOf('Cifras') > 0 && ph.indexOf('<script') < 0);
t('líneas de tarjeta', RT.cardLines().stats.length === 6);
// guardado y carga
var snap = JSON.stringify(FP.Store.pack()); H.restore(snap); var h2 = FP.S.hero;
t('el guardado conserva el estado de retiro', h2.rt && h2.rt.hl != null && Object.keys(h2.rt.mates).length > 0 && h2.rt.life.length >= 1);
console.log('ok', ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
