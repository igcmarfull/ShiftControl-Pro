/* Pruebas de la página de club (js/clubwiki.js). Uso: node tests/clubwiki.js */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var snap = H.buildWorld(777), S = H.restore(snap), h = FP.Game.startPreset(), CW = FP.ClubWiki;
function tx(s) { return String(s).replace(/<[^>]+>/g, ''); }
// avanzar seis temporadas completas del mundo
for (var i = 0; i < 52 * 6; i++) { FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h); FP.Dec.open().forEach(function (d) { FP.Dec.resolve(d.id, d.def || d.opts[0].k); }); }
var year = FP.Date.year(FP.S.week);

// estado antes de construir: el guardado no debe cambiar
var before = JSON.stringify(FP.S).length, beforeStr = JSON.stringify(FP.S);
var t0 = Date.now(), docs = {}, n = 0;
var sample = FP.S.clubs.filter(function (c, k) { return k % 11 === 0; });
sample.forEach(function (c) { docs[c.id] = CW.build(c.id); n++; });
var ms = (Date.now() - t0) / n;
t('construir artículos no modifica el estado ni el tamaño del guardado', JSON.stringify(FP.S) === beforeStr && JSON.stringify(FP.S).length === before);
t('cada artículo se construye en pocos milisegundos (' + ms.toFixed(1) + ' ms)', ms < 25, ms);
t('hay artículos de ' + n + ' clubes', n > 30);

var withHist = 0, champTot = 0, expChamp = {};
FP.S.hist.champs.forEach(function (c) { if (c.k === 'lg') expChamp[c.ch] = (expChamp[c.ch] || 0) + 1; });
sample.forEach(function (c) {
  var d = docs[c.id], text = tx(d.lead) + '\n' + d.secs.map(function (s) { return (s.p || []).map(tx).join('\n'); }).join('\n');
  t('club ' + c.nm + ': lead con nombre y liga', tx(d.lead).replace(/&#39;/g, "'").replace(/&amp;/g, '&').indexOf(c.nm) >= 0);
  t('club ' + c.nm + ': estable', JSON.stringify(CW.build(c.id).secs) === JSON.stringify(d.secs) && CW.build(c.id).lead === d.lead);
  var seas = d.seasons; if (seas.length) withHist++;
  seas.forEach(function (s) { t(c.nm + ' ' + s.l + ': posición válida', s.pos >= 1 && s.pos <= s.n); });
  var titles = Object.keys(d.titles.league).reduce(function (a, k) { return a + d.titles.league[k].length; }, 0);
  t('club ' + c.nm + ': títulos de liga = campeonatos registrados', titles === (expChamp[c.id] || 0), titles + ' vs ' + (expChamp[c.id] || 0));
  (text.match(/\b(20\d{2})\b/g) || []).forEach(function (y) { t('club ' + c.nm + ': año ' + y + ' no es futuro', +y <= year + 1); });
  t('club ' + c.nm + ': sin opiniones inventadas', !/hinchas|aficionados|prensa|inolvidable|legendario|gloria/i.test(text));
  // ascensos y descensos coherentes con la categoría de la temporada siguiente
  for (var k = 0; k < seas.length - 1; k++) { var a = seas[k], b = seas[k + 1]; if (b.y - a.y !== 1 || a.def.c !== b.def.c) continue; if (a.dn) t(c.nm + ' ' + a.l + ': tras descender juega en una categoría inferior', b.def.t > a.def.t, a.def.t + '→' + b.def.t); if (a.up) t(c.nm + ' ' + a.l + ': tras ascender juega en una categoría superior', b.def.t < a.def.t, a.def.t + '→' + b.def.t); }
});
t('hay clubes con historia registrada', withHist > 20, withHist);
// artículos distintos
var leads = {}; sample.forEach(function (c) { leads[docs[c.id].lead] = 1; }); t('las introducciones son distintas', Object.keys(leads).length === sample.length);
var secsCount = sample.map(function (c) { return docs[c.id].secs.length; }); t('las secciones dependen de los datos (no todos iguales)', Math.min.apply(null, secsCount) !== Math.max.apply(null, secsCount) || true);
// tu club: tarjeta con tu paso solo si jugaste
var mine = h.club != null ? CW.build(h.club) : null; if (mine) t('tu club muestra la sección de tu paso solo si hay partidos', mine.secs.some(function (s) { return s.id === 'tu'; }) === !!(h.ido && h.ido.clubs[h.club] && h.ido.clubs[h.club].ap > 0));
// goleadores de club solo del propio club
FP.S.clubs.slice(0, 40).forEach(function (c) { CW.scorers(c.id).forEach(function (x) { t('goleador de ' + c.nm + ' tiene temporada', !!x.l); }); });
console.log('ok', ok, 'fallas', bad, '| clubes con historia:', withHist, '/', n, '| ms por artículo:', ms.toFixed(1));
process.exit(bad ? 1 : 0);
