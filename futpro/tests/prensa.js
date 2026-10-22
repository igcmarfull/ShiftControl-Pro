/* Pruebas de prensa y hinchada (js/prensa.js). Uso: node tests/prensa.js */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
function play(weeks, off) {
  var S = H.restore(H.buildWorld(555)), h = FP.Game.startPreset(); FP.Prensa.off = !!off;
  for (var i = 0; i < weeks; i++) { if (i === 8) { Object.keys(h.at).forEach(function (a) { h.at[a] = Math.min(80, h.at[a] + 14); h.cap[a] = 95; }); h.pot = 90; FP.Hero.updateOvr(); } FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h); FP.Dec.open().forEach(function (d) { FP.Dec.resolve(d.id, d.opts[0].k); }); }
  FP.Prensa.off = false; return FP.S.hero;
}
// ---------- una temporada y media jugada ----------
var h = play(220), P = FP.Prensa, st = h.press, S = FP.S;
t('se generan titulares tras los partidos (' + (st && st.feed.length) + ')', st && st.feed.length >= 20);
var cc = S.clubs[h.club != null ? h.club : h.team].c, names = P.outlets(cc).map(function (o) { return o[0]; });
t('los titulares de prensa vienen de medios del país del club', st.feed.filter(function (x) { return x.k === 'prensa'; }).every(function (x) { return names.indexOf(x.o) >= 0; }));
t('ningún titular queda con marcas sin rellenar', st.feed.every(function (x) { return !/\{\w\}/.test(x.t) && x.t.length > 12; }), st.feed.filter(function (x) { return /\{\w\}/.test(x.t); }).map(function (x) { return x.t; })[0]);
var tx = st.feed.slice(0, 30).map(function (x) { return x.t; }); t('sin titulares repetidos entre los últimos 30 (' + new Set(tx).size + ' distintos de ' + tx.length + ')', new Set(tx).size >= tx.length - 1);
t('el ánimo de la hinchada se mantiene entre 0 y 100', st.mood >= 0 && st.mood <= 100);
t('el protagonista figura en algunos titulares', st.feed.some(function (x) { return x.t.indexOf(h.nm.split(' ')[0]) >= 0; }));
t('hay hinchada y prensa', st.feed.some(function (x) { return x.k === 'hinchada'; }) && st.feed.some(function (x) { return x.k === 'prensa'; }));
t('el dosier siempre tiene líneas', P.dossier().length >= 1 && P.dossier().every(function (l) { return typeof l === 'string' && l.length > 10; }));
// ---------- ánimo según resultados (partidos sintéticos) ----------
var cid = h.club != null ? h.club : h.team, opp = S.clubs.filter(function (c) { return c.lg === S.clubs[cid].lg && c.id !== cid && !FP.Derbis.is(cid, c.id); })[0].id;
function rec(r, s) { return { w: S.week, c: 'Liga', cid: 'x', o: opp, h: 1, s: s, r: r, role: 'tit', g: 0, a: 0 }; }
st.mood = 50; st.w = S.week; st.str = 0; for (var i = 0; i < 6; i++) { S.week++; P.onMatch(rec('V', '2-0'), true); }
t('tras seis victorias el ánimo sube (' + st.mood + ')', st.mood > 65);
t('seis victorias seguidas generan un titular de racha', st.feed.some(function (x) { return x.sit === 'streakW'; }));
st.mood = 50; st.str = 0; for (var j = 0; j < 6; j++) { S.week++; P.onMatch(rec('D', '0-2'), true); }
t('tras seis derrotas el ánimo baja (' + st.mood + ')', st.mood < 35);
t('seis derrotas seguidas generan un titular de crisis', st.feed.some(function (x) { return x.sit === 'streakL'; }));
var m = st.mood; S.week++; P.onMatch(rec('D', '0-5'), true); t('una goleada en contra baja más el ánimo que una derrota normal', st.mood < m - 4, m + ' → ' + st.mood);
var n0 = st.feed.length; S.week++; P.onMatch(rec('V', '1-0'), false); t('los amistosos no generan titulares', st.feed.length === n0);
// ---------- determinismo y no interferencia ----------
var a = play(150, false), sa = JSON.stringify([a.tot, S0()]); function S0() { return FP.S.rs; }
var b = play(150, true), sb = JSON.stringify([b.tot, S0()]);
t('la prensa no cambia partidos, estadísticas ni el azar de la partida', sa === sb, sa + ' vs ' + sb);
var c1 = play(150, false).press.feed.map(function (x) { return x.t; }).join('|'), c2 = play(150, false).press.feed.map(function (x) { return x.t; }).join('|');
t('los mismos partidos producen los mismos titulares', c1 === c2 && c1.length > 50);
t('una partida guardada y cargada conserva los titulares', (function () { var n = FP.S.hero.press.feed.length, d = JSON.parse(JSON.stringify(FP.Store.pack())); FP.Store.unpack(d); return FP.S.hero.press.feed.length === n; })());
console.log('ok', ok, 'fallas', bad);
process.exit(bad ? 1 : 0);
