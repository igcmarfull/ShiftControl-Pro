/* Legado e ídolo por club: estatus, tamaño del club, cariño, salida a un rival, récords, migración y retiro. Uso: node tests/idolo.js */
var H = require('./harness.js'), FP = H.FP, ok = 0, bad = 0;
function t(name, cond, info) { if (cond) ok++; else { bad++; console.log('FALLA', name, info !== undefined ? info : ''); } }
var Id = FP.Idolo, Dec = FP.Dec, Stats = FP.Stats;
var S = H.restore(H.buildWorld(1717)), h = FP.Game.startPreset(), log = [];
for (var i = 0; i < 52 * 9; i++) {
  if (i === 52) { Object.keys(h.at).forEach(function (a) { h.at[a] = Math.min(82, h.at[a] + 12); h.cap[a] = 94; }); h.pot = 86; FP.Hero.updateOvr(); }
  FP.Game.beginWeek(); var g = 0; while (FP.Game.hasPending() && g++ < 20) FP.Game.playPending(); FP.Game.endWeek(); H.respond(h); Dec.open().forEach(function (d) { Dec.resolve(d.id, d.opts[0].k); });
  if (i % 52 === 51) { var st = Id.ensure(); log.push(Object.keys(st.clubs).map(function (k) { var c = st.clubs[k]; return S.clubs[k].nm + ' ' + Id.pts(+k) + ' (' + c.ap + 'pj ' + c.g + 'g ' + c.seasons + 'temp love ' + Math.round(c.love) + ')'; }).join(' | ')); }
}
console.log(log[log.length - 1]);
var st = Id.ensure(), ids = Object.keys(st.clubs).map(Number);
t('hay estado por club', ids.length >= 1, ids.length);
// consistencia con el registro estadístico
var okLedger = ids.every(function (id) { var rows = Stats.rows(function (r) { return r.t === id && /^(liga|copa|cont)$/.test(r.k); }), tot = Stats.sum(rows), c = st.clubs[id]; return Math.abs(c.ap - tot.p) <= Math.max(2, tot.p * 0.05) && Math.abs(c.g - tot.g) <= Math.max(2, tot.g * 0.05); });
t('apariciones y goles coinciden con el registro (±5%)', okLedger, ids.map(function (id) { var tot = Stats.sum(Stats.rows(function (r) { return r.t === id && /^(liga|copa|cont)$/.test(r.k); })); return [st.clubs[id].ap, tot.p, st.clubs[id].g, tot.g]; }));
t('el puntaje está entre 0 y 100', ids.every(function (id) { var p = Id.pts(id); return p >= 0 && p <= 100; }));
// tamaño del club
var big = S.clubs.slice().sort(function (a, b) { return b.st - a.st; })[0], small = S.clubs.filter(function (c) { return FP.LGDEF[c.lg].t >= 3; }).sort(function (a, b) { return a.st - b.st; })[0];
t('un club grande pesa más que uno chico', Id.size(big.id) > Id.size(small.id) + 0.5, [Id.size(big.id), Id.size(small.id)]);
var fake = { ap: 170, g: 114, a: 10, seasons: 6, lg: 0, cup: 0, cont: 0, fin: 0, dg: 0, hat: 1, saved: 1, promo: 0, rej: 0, love: 60 };
st.clubs[small.id] = JSON.parse(JSON.stringify(fake)); st.clubs[big.id] = JSON.parse(JSON.stringify(fake));
console.log('mismas cifras: club chico', Id.pts(small.id), Id.label(Id.pts(small.id)), '| club grande', Id.pts(big.id), Id.label(Id.pts(big.id)));
t('las mismas cifras dan más estatus en el club chico', Id.pts(small.id) > Id.pts(big.id) + 15 && Id.pts(small.id) >= 60, [Id.pts(small.id), Id.pts(big.id)]);
t('los títulos suben mucho el estatus', (function () { var c = JSON.parse(JSON.stringify(fake)); st.clubs[999999] = c; c.lg = 2; var a = Id.raw(c); c.lg = 0; return a - Id.raw(c) === 26; })());
t('etiquetas por umbral', Id.label(10) === 'Desconocido' && Id.label(25) === 'Jugador querido' && Id.label(45) === 'Referente' && Id.label(65) === 'Ídolo' && Id.label(85) === 'Leyenda' && Id.label(97) === 'Ídolo eterno');
delete st.clubs[999999];
// salida a un rival (Colo-Colo ↔ Universidad de Chile)
var a = S.clubs.filter(function (c) { return c.nm === 'Colo-Colo'; })[0], b = S.clubs.filter(function (c) { return c.nm === 'Universidad de Chile'; })[0], other = S.clubs.filter(function (c) { return c.nm === 'Unión Española'; })[0];
st.clubs[a.id] = JSON.parse(JSON.stringify(fake)); st.clubs[a.id].love = 85; var l0 = st.clubs[a.id].love; st.cur = a.id; Id.onLeave(a.id, b.id);
t('irse a un rival hunde el cariño', st.clubs[a.id].love < l0 - 30 && st.clubs[a.id].trait === 1, st.clubs[a.id].love);
st.clubs[other.id] = JSON.parse(JSON.stringify(fake)); st.clubs[other.id].love = 85; Id.onLeave(other.id, a.id);
t('irse a un club no rival cuesta mucho menos', st.clubs[other.id].love > 70 && st.clubs[other.id].love > st.clubs[a.id].love + 20, st.clubs[other.id].love);
// reencuentro
var h2 = h; h2.retired = false; st.clubs[a.id].love = 80; var mor0 = h2.mor = 50, msgs0 = h2.inbox.length;
Id.onMatch({ mine: b.id, opp: a.id, comp: { kind: 'L', nm: 'Liga', cat: null }, f: { ro: '', fr: 0 }, home: true }, { hs: 1, as: 0, hero: { played: true, g: 0, a: 0, rating: 6.5, min: 90 } });
t('ovación al volver ante un ex club querido', h2.mor > mor0 && h2.inbox.length > msgs0, [mor0, h2.mor]);
// récords por club
t('hay récords de goleadores por club', S.clubRec && Object.keys(S.clubRec).length >= 50, S.clubRec && Object.keys(S.clubRec).length);
var tc = Object.keys(S.clubRec)[0], top = Id.top(+tc, 5); t('top de goleadores ordenado', top.length >= 1 && top.every(function (x, k) { return k === 0 || top[k - 1].g >= x.g; }), JSON.stringify(top.slice(0, 3)));
t('máximo en una temporada registrado', !!S.clubRec[tc].bg && S.clubRec[tc].bg.g >= 1);
// migración de partidas anteriores
var saved = JSON.stringify(h.ido), ledgerRows = Stats.rows().length; delete h.ido; var st2 = Id.ensure();
t('migración reconstruye desde el registro', Object.keys(st2.clubs).length >= 1 && st2.mig === 1);
// retiro: salón del club y homenaje
st2.clubs = JSON.parse(saved).clubs; st2.clubs[a.id] = JSON.parse(JSON.stringify(fake)); st2.clubs[a.id].lg = 3; st2.clubs[a.id].love = 80; h.money = 1000; FP.Events.retire(false);
t('un leyenda entra al salón del club', st2.hall.indexOf(a.id) >= 0 || Id.pts(a.id) < 80, [Id.pts(a.id), st2.hall]);
var d = Dec.open('retiro')[0]; t('el homenaje ofrece el club de ídolo si no es el principal', !d || d.opts.some(function (o) { return o.k === 'idolo'; }) || Id.best().id === (FP.Post.ensure().legacy.top && FP.Game.clubByName(FP.Post.ensure().legacy.top.nm) && FP.Game.clubByName(FP.Post.ensure().legacy.top.nm).id), d && d.opts.map(function (o) { return o.k; }));
// oferta de puesto tras el retiro
var bst = Id.best(); h.post.legacy.score = 70; st2.postDone = 0; st2.clubs[bst.id].love = 70; st2.clubs[bst.id].lg = 3; Id.postOffer(); var po = Dec.open('rt').filter(function (x) { return x.data.t === 'idpost'; })[0];
t('el club ofrece un puesto al retirado', !!po && po.opts.some(function (o) { return o.k === 'embajador'; }));
if (po) { var inc = h.post.income; Dec.resolve(po.id, 'embajador'); t('ser embajador paga', h.post.income > inc); }
var snap = JSON.stringify(FP.Store.pack()); H.restore(snap); t('sobrevive al guardado', FP.S.hero.ido && Object.keys(FP.S.hero.ido.clubs).length >= 1 && FP.S.clubRec);
console.log('ok', ok, 'fallas', bad); process.exit(bad ? 1 : 0);
