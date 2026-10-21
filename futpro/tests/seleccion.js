/* Pruebas del seleccionador jugable. Uso: node tests/seleccion.js */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var Dec = FP.Dec, P = FP.Post, Sel = FP.Sel, K = FP.Coach, NT = FP.NT;
var S = H.restore(H.buildWorld(1212)), h = FP.Game.startPreset();
for (var i = 0; i < 52 * 6; i++) { if (i === 52) { Object.keys(h.at).forEach(function (a) { h.at[a] = Math.min(84, h.at[a] + 14); h.cap[a] = 95; }); h.pot = 88; FP.Hero.updateOvr(); } FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h); Dec.open().forEach(function (d) { Dec.resolve(d.id, d.opts[0].k); }); }
h.money = 5000; FP.Events.retire(false); Dec.open().forEach(function (d) { Dec.resolve(d.id, d.opts[0].k); });
P.choose('sel'); var pa = h.post.path;
var o0 = Dec.open('rt').filter(function (d) { return d.data.t === 'selecc'; })[0];
t('sin licencia no hay oferta de selección', !o0);
h.post.lic = 2; h.post.exp = 1; P.choose('sel'); var of = Dec.open('rt').filter(function (d) { return d.data.t === 'selecc'; })[0];
t('con licencia 2 hay oferta Sub-17/20/23 pero no absoluta', !!of && of.opts.some(function (o) { return o.k === 'c:U20'; }) && !of.opts.some(function (o) { return o.k === 'c:ABS'; }), of && of.opts.map(function (o) { return o.k; }));
Dec.resolve(of.id, 'c:U20'); var j = Sel.job();
t('asumes la Sub-20', j && j.cat === 'U20' && j.nat === FP.Nat.byCode(h.nat).id);
t('convocatoria inicial completa', j.sq.length === 23, j.sq.length);
var c = Sel.counts(); t('cupos por posición', (c.GK || 0) >= 3 && (c.CB || 0) >= 4, JSON.stringify(c));
t('sin avisos al inicio', Sel.warnings().length === 0, Sel.warnings());
var gk = Sel.players().filter(function (p) { return p.p === 'GK'; }); gk.forEach(function (p) { Sel.remove(p.i); });
t('aviso por falta de porteros', Sel.warnings().some(function (w) { return /porteros/.test(w); }));
Sel.autoFill(); t('autocompleta la lista', j.sq.length === 23 && (Sel.counts().GK || 0) >= 3);
var cand = Sel.pool().filter(function (e) { return j.sq.indexOf(e.p.i) < 0; })[0]; t('lista completa no admite más', !Sel.add(cand.p.i).ok);
Sel.remove(j.sq[5]); t('agregar tras quitar', Sel.add(cand.p.i).ok);
t('squadOf devuelve la lista propia', NT.squadOf(j.nat, 'U20').length >= 14 && NT.squadOf(j.nat, 'U20').every(function (p) { return j.sq.indexOf(p.i) >= 0; }));
// jugar: avanzar hasta tener partidos de selección
var played = 0, guard = 0, rec0 = 0;
while (played < 3 && guard++ < 52 * 4) {
  var m = K.stepWeek();
  while (m && K.next()) { var pr = K.next(); t('el partido es de tu categoría', (pr.comp.cat || 'ABS') === 'U20' && (pr.f.h === j.nat || pr.f.a === j.nat)); var cm = K.begin(pr, '4-3-3', 0), fin = false, n = 0; while (!fin && n++ < 5) fin = K.resume(cm); played++; }
  if (m) FP.Game.endWeek(); Dec.open().forEach(function (d) { if (d.kind !== 'rt' || d.data.t !== 'selasc') Dec.resolve(d.id, d.def); });
}
t('se dirigieron partidos de selección con pausas', played >= 3, played);
t('registro de la confianza', j.conf >= 0 && j.conf <= 100 && (j.n || 0) >= 1, [j.conf, j.n]);
// vista previa del once con la formación elegida
var up = Sel.upcoming(3); var xi433 = K.xi(j.nat, '4-3-3', up.length ? up[0].comp : { cat: 'U20', ys: {} }); t('once con 11', xi433.length === 11, xi433.length);
var xi442 = K.xi(j.nat, '4-4-2', up.length ? up[0].comp : { cat: 'U20', ys: {} }); t('la formación cambia el once', xi442.length === 11 && JSON.stringify(xi442.map(function (x) { return x.slot; })) !== JSON.stringify(xi433.map(function (x) { return x.slot; })));
// torneo completo
var seasons0 = pa.seasons.length; guard = 0;
while (pa.job && pa.seasons.length === seasons0 && guard++ < 52 * 4) { var m2 = K.stepWeek(); while (m2 && K.next()) { K.quick(K.next(), '4-3-3', 0); } if (m2) FP.Game.endWeek(); Dec.open().forEach(function (d) { Dec.resolve(d.id, d.def); }); }
t('el torneo termina y se registra el resultado', pa.seasons.length > seasons0 || !pa.job, pa.seasons.length);
if (pa.seasons.length > seasons0) { var rs = pa.seasons[pa.seasons.length - 1]; t('resultado con categoría y torneo', rs.cat === 'U20' && rs.tour && ['Campeón', 'Subcampeón', 'Semifinales', 'Cuartos de final', 'Eliminado'].indexOf(rs.res) >= 0, JSON.stringify(rs)); }
t('sueldo cobrado', h.post.income > 0);
// absoluta
h.post.lic = 3; h.post.exp = 4; t('absoluta disponible con licencia Pro y experiencia', Sel.can('ABS'));
var snap = JSON.stringify(FP.Store.pack()); H.restore(snap); t('sobrevive al guardado', FP.S.hero.post.path.job && FP.S.hero.post.path.job.sq.length >= 14);
console.log('ok', ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
