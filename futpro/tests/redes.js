/* Pruebas de "Redes y marca": publicaciones, polémicas, patrocinios, rumores, comunidad y guardado. Uso: node tests/redes.js */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var S = H.restore(H.buildWorld(777)), h = FP.Game.startPreset(), X = FP.Redes;
function week() { FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h); }
var seen = {}, offersSeen = 0, i;
for (i = 0; i < 52 * 9; i++) {
  if (i === 52) { Object.keys(h.at).forEach(function (a) { h.at[a] = Math.min(86, h.at[a] + 16); h.cap[a] = 97; }); h.pot = 92; FP.Hero.updateOvr(); }
  week();
  var r = X.ensure(); offersSeen = Math.max(offersSeen, r.sp.offers.length);
  r.sp.offers.slice().forEach(function (o) { X.acceptSp(o.id); });
  FP.Dec.open('redes').forEach(function (d) { var t0 = d.data.t + (d.data.p ? ':' + d.data.p : ''); seen[t0] = (seen[t0] || 0) + 1; FP.Dec.resolve(d.id, d.opts[i % d.opts.length].k); });
  FP.Dec.open().forEach(function (d) { if (d.kind !== 'redes') FP.Dec.resolve(d.id, d.opts[0].k); });
  if (i % 3 === 0) { FP.Social.actions.forEach(function (a) { try { FP.Social.act(a.id); } catch (e) { t('acción sin error ' + a.id, false, e.message); } }); }
}
var r = X.ensure();
t('estado de redes creado', !!r && !!r.sp && r.brand >= 0 && r.brand <= 100);
t('hay seguidores y fama', FP.Social.followers() > 1000 && h.soc.fame > 5, [FP.Social.followers(), h.soc && h.soc.fame]);
t('historial de seguidores', r.folH.length > 20);
t('ofertas de patrocinio generadas', offersSeen > 0 || r.sp.n > 0, [offersSeen, r.sp.n]);
t('patrocinios firmados y cobrados', r.sp.n > 0 && FP.Contracts.ensure().tot.patrocinio > 0, [r.sp.n, FP.Contracts.ensure().tot.patrocinio]);
t('máximo tres patrocinios', r.sp.deals.length <= 3);
t('una marca por categoría', r.sp.deals.every(function (d, i, a) { return a.filter(function (x) { return x.cat === d.cat; }).length === 1; }));
t('polémicas y mensajes vistos', Object.keys(seen).length >= 2, seen);
t('publicaciones y mejor publicación', r.posts > 20 && !!r.best, [r.posts, r.best]);
t('club de fans', !!r.fan && r.fan.lvl >= 1);
// límites de publicación
FP.Game.beginWeek(); while (FP.Game.hasPending()) FP.Game.playPending(); FP.Game.endWeek();
r.week = { w: -1, n: 0 }; r.sp.deals.length = 0;
var res = [FP.Social.act('thanks'), FP.Social.act('train'), FP.Social.act('fam'), FP.Social.act('thanks')];
t('máx. 3 publicaciones por semana', res[0].ok && res[1].ok && res[2].ok && !res[3].ok, JSON.stringify(res));
t('acción no disponible sin patrocinador', !FP.Social.act('spons').ok);
// guardado
var pk = FP.Store.pack ? FP.Store.pack() : null;
if (pk) { var back = H.restore ? null : null; }
t('rd serializable', JSON.stringify(h.rd).length > 10);
console.log('ok', ok, 'fallas', bad, JSON.stringify({ pat: r.sp.n, ganado: Math.round(r.sp.earn), posts: r.posts, virales: r.viral, pol: r.ptot, malas: r.pbad, marca: Math.round(r.brand), fan: r.fan && r.fan.lvl, seen: seen }));
process.exit(bad ? 1 : 0);
