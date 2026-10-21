/* FUTPRO — pestaña «Legado» de Mi club: estatus de ídolo, cariño de la hinchada, estadísticas en el club, récords de goleadores y salón del club.
   Solo presentación: la lógica vive en idolo.js. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, SC = UI.screens, A = UI.acts, I = UI.icon, Id = FP.Idolo, hdr = UI.hdr;
  function pill(t, c) { return '<span class="pill ' + (c || '') + '">' + t + '</span>'; }
  function bar(v, cls) { return UI.bar(Math.max(0, Math.min(100, v)), 100, cls || ''); }
  function kv(l, v) { return '<div class="kv-i"><span>' + l + '</span><b>' + v + '</b></div>'; }
  function tdn(v) { return '<td class="n">' + v + '</td>'; }
  var CLS = ['', 'b', 'b', 'g', 'y', 'y'];

  function clubBlock(id) {
    var S = FP.S, c = Id.club(id), club = S.clubs[id], s = Id.status(id), lv = Id.loveLabel(c.love), tit = c.lg + c.cup + c.cont;
    var html = '<div class="card"><div class="hd"><h3>' + UI.crest(id) + ' ' + esc(club.nm) + '</h3>' + pill(esc(s.label), CLS[s.rank]) + '</div><div class="grid g2"><div>' +
      '<div class="mut sm">Legado histórico</div>' + bar(s.pts, s.rank >= 4 ? '' : '') + '<div class="row sp sm"><span class="mut">' + s.pts + ' / 100</span><span class="mut">' + (s.rank < 5 ? 'Siguiente: ' + esc(Id.STATUS[Id.STATUS.length - 2 - s.rank][1]) + ' (' + Id.STATUS[Id.STATUS.length - 2 - s.rank][0] + ')' : 'Máximo') + '</span></div>' +
      '<div class="mut sm" style="margin-top:.6rem">Cariño de la hinchada hoy</div>' + bar(c.love, c.love < 30 ? 'r' : c.love < 50 ? 'y' : '') + '<div class="row sp sm"><span class="mut">' + Math.round(c.love) + ' / 100</span><span>' + esc(lv) + (c.trait ? ' · se fue a un rival' : '') + '</span></div>' +
      '<p class="mut sm" style="margin-top:.6rem">El legado crece con permanencia, goles, títulos, finales, derbis y descensos evitados, y pesa menos cuanto más grande es el club. El cariño es lo que siente la hinchada hoy y cambia con tu rendimiento y con cómo te vas.</p></div><div>' +
      kv('Partidos', c.ap) + kv('Goles · Asistencias', c.g + ' · ' + c.a) + kv('Temporadas', c.seasons) + kv('Títulos', tit + (tit ? ' (liga ' + c.lg + ', copa ' + c.cup + ', internacional ' + c.cont + ')' : '')) + kv('Goles en finales ganadas', c.fin) + kv('Goles en derbis', c.dg) + kv('Descensos evitados · ascensos', c.saved + ' · ' + c.promo) + kv('Ofertas rechazadas por quedarte', c.rej) + '</div></div></div>';
    if (c.ev && c.ev.length) html += '<div class="card"><div class="hd"><h3>' + I('history') + 'Momentos en el club</h3></div>' + c.ev.slice(0, 8).map(function (e) { return '<div class="row sp sm"><span>' + esc(e.t) + '</span><span class="mut">' + esc(D.fmt(e.w)) + '</span></div>'; }).join('') + '</div>';
    return html;
  }
  function recordsBlock(id) {
    var S = FP.S, r = S.clubRec && S.clubRec[id], top = Id.top(id, 8), club = S.clubs[id], c = Id.club(id), since = D.year(0) + '', titles = (S.hist.champs || []).filter(function (e) { return e.k === 'lg' && e.ch === id; }).length;
    var meRank = top.map(function (x) { return x.me ? 1 : 0; }).indexOf(1) + 1;
    var html = '<div class="card"><div class="hd"><h3>' + I('trophy') + 'Récords del club</h3>' + (meRank ? pill('Eres el ' + meRank + '.º máximo goleador', meRank === 1 ? 'g' : 'b') : '') + '</div>' +
      (top.length ? '<table class="wt"><thead><tr><th class="n">#</th><th>Máximos goleadores (desde el inicio de la partida)</th><th>Años</th><th class="n">Goles</th><th class="n">Asist.</th></tr></thead><tbody>' + top.map(function (x, i) { return '<tr><td class="n">' + (i + 1) + '</td><td>' + (x.me ? '<b>' + esc(x.n) + '</b>' : esc(x.n)) + '</td><td class="wt-d">' + esc(String(x.y)) + '</td>' + tdn(x.g) + tdn(x.a) + '</tr>'; }).join('') + '</tbody></table>' : '<p class="mut sm">Aún no hay goleadores registrados.</p>') +
      '<div class="grid g2" style="margin-top:.5rem">' + kv('Más goles en una temporada', r && r.bg ? esc(r.bg.n) + ' · ' + r.bg.g + ' (' + esc(String(r.bg.y)) + ')' : '—') + kv('Más asistencias en una temporada', r && r.ba ? esc(r.ba.n) + ' · ' + r.ba.a + ' (' + esc(String(r.ba.y)) + ')' : '—') + kv('Títulos de liga registrados', titles) + '</div>' +
      '<p class="mut sm">Los récords cuentan desde que empezó tu partida: el juego no tiene la historia real previa de cada club.</p></div>';
    return html;
  }
  SC.idolo = function () {
    var S = FP.S, h = S.hero, st = Id.ensure(), ids = Object.keys(st.clubs).map(Number).filter(function (k) { var c = st.clubs[k]; return c.ap > 0 || c.seasons > 0 || c.lg + c.cup + c.cont > 0; });
    var html = hdr('shield', 'Legado en el club', 'Tu historia con cada club');
    if (!ids.length) return html + '<div class="card"><p class="mut">Todavía no tienes historia con ningún club. Juega partidos oficiales con un club profesional para empezar a construir tu legado.</p></div>';
    ids.sort(function (a, b) { return Id.pts(b) - Id.pts(a); });
    var cur = UI.idc != null && ids.indexOf(UI.idc) >= 0 ? UI.idc : (st.cur != null && ids.indexOf(st.cur) >= 0 ? st.cur : ids[0]); UI.idc = cur;
    html += '<div class="seg">' + ids.map(function (id) { return '<button class="' + (id === cur ? 'on' : '') + '" data-act="idc" data-id="' + id + '">' + esc(S.clubs[id].nm) + '</button>'; }).join('') + '</div>';
    html += clubBlock(cur) + recordsBlock(cur);
    html += '<div class="card"><div class="hd"><h3>' + I('table') + 'Tus clubes</h3></div><table class="wt"><thead><tr><th>Club</th><th class="n">Temp.</th><th class="n">PJ</th><th class="n">G</th><th class="n">Títulos</th><th>Estatus</th><th>Cariño</th></tr></thead><tbody>' +
      ids.map(function (id) { var c = st.clubs[id], s = Id.status(id); return '<tr><td>' + esc(S.clubs[id].nm) + '</td>' + tdn(c.seasons) + tdn(c.ap) + tdn(c.g) + tdn(c.lg + c.cup + c.cont) + '<td>' + esc(s.label) + ' <span class="mut sm">(' + s.pts + ')</span></td><td>' + esc(Id.loveLabel(c.love)) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    if (st.hall.length) html += '<div class="card"><div class="hd"><h3>' + I('medal') + 'Salón de la fama de clubes</h3></div>' + st.hall.map(function (id) { return '<div class="row sp"><span>' + UI.crest(id) + ' ' + esc(S.clubs[id].nm) + '</span>' + pill(esc(Id.status(id).label), 'g') + '</div>'; }).join('') + '</div>';
    return html;
  };
  A.idc = function (d) { UI.idc = +d.id; UI.render(); };
})();
