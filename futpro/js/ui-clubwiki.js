/* FUTPRO — pantalla del artículo de club (Mi club › Historia y ficha de cualquier club). Lógica en js/clubwiki.js. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, UI = FP.UI, esc = U.esc, SC = UI.screens, A = UI.acts, I = UI.icon, CW = FP.ClubWiki, C = FP.Core;
  function ord(n) { return n + '.º'; }
  function box(d) { return '<aside class="bx"><div class="bx-t">' + esc(d.name) + '</div><div class="bx-av">' + UI.crest(d.id, 'lg') + '</div><table>' + d.box.map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table></aside>'; }
  function table(head, rows) { return '<table class="wt"><thead><tr>' + head.map(function (h) { return '<th' + (h[1] ? ' class="n"' : '') + '>' + esc(h[0]) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>'; }
  function section(s, d) {
    var h = '<h2 id="cw-' + s.id + '"><span>' + esc(s.t) + '</span></h2>';
    if (s.p) h += s.p.map(function (p) { return '<p>' + p + '</p>'; }).join('');
    if (s.pal) h += table([['Competición'], ['Título'], ['Veces', 1], ['Años']], s.pal.map(function (r) { return '<tr><td>' + esc(r.k) + '</td><td>' + esc(r.nm) + '</td><td class="n">' + r.y.length + '</td><td>' + esc(r.y.join(', ')) + '</td></tr>'; }));
    if (s.runner && s.runner.length) h += '<h3>Subcampeonatos</h3><p>' + s.runner.map(function (r) { return esc(r.nm) + ' (' + esc(r.y) + ')'; }).join(' · ') + '</p>';
    if (s.top && s.top.length) h += '<h3>Máximos goleadores del club desde el inicio del registro</h3>' + table([['#', 1], ['Jugador'], ['Años'], ['Goles', 1], ['Asist.', 1]], s.top.map(function (r, i) { return '<tr' + (r.me ? ' style="font-weight:700"' : '') + '><td class="n">' + (i + 1) + '</td><td>' + esc(r.n) + (r.me ? ' (tú)' : '') + '</td><td>' + esc(r.y) + '</td><td class="n">' + r.g + '</td><td class="n">' + r.a + '</td></tr>'; })) + '<p class="wt-n">Los récords cuentan desde que empezó tu partida: el juego no tiene la historia real previa de cada club.</p>';
    if (s.seasons) h += table([['Temporada'], ['División'], ['Pos.', 1], ['Notas']], (s.cur ? ['<tr><td>' + esc(s.cur.label) + '</td><td>' + s.cur.def.t + '.ª · ' + esc(String(s.cur.def.n).replace(/\\s*\\([^)]*\\)\\s*$/, '')) + '</td><td class="n">' + ord(s.cur.pos) + ' de ' + s.cur.n + '</td><td>En curso (' + s.cur.p + ' jornadas)</td></tr>'] : []).concat(s.seasons.slice().reverse().map(function (r) { var n = []; if (r.champ) n.push('Campeón'); else if (r.runner) n.push('Subcampeón'); if (r.up) n.push('Ascenso'); if (r.dn) n.push('Descenso'); return '<tr><td>' + esc(r.l) + '</td><td title="' + esc(r.def.n) + '">' + r.def.t + '.ª · ' + esc(String(r.def.n).replace(/\s*\([^)]*\)\s*$/, '')) + '</td><td class="n">' + ord(r.pos) + ' de ' + r.n + '</td><td>' + esc(n.join(', ')) + '</td></tr>'; })));
    if (s.id === 'actual') h += '<h3>Plantel actual</h3>' + UI.squadTable(d.id, 'cw_' + d.id);
    return h;
  }
  function myClub() { var h = FP.S.hero; return h.club != null ? h.club : h.team != null ? (h.team >= 30000 ? h.team - 30000 : h.team < 5000 ? h.team : null) : null; }
  SC.clubwiki = function () {
    var S = FP.S, id = UI.tab.cwid != null ? UI.tab.cwid : myClub();
    if (id == null || !S.clubs[id]) return UI.hdr('shield', 'Historia del club', 'Artículo del club') + '<div class="card"><p class="mut">Todavía no tienes club. Abre la ficha de cualquier club y elige «Ver artículo».</p></div>';
    var d = CW.build(id), mine = myClub();
    var note = id !== mine && mine != null ? '<div class="notice">Estás viendo el artículo de otro club. <a class="lk" data-act="cwiki" data-id="' + mine + '">Volver a mi club</a></div>' : '';
    return UI.hdr('shield', 'Historia del club', 'Artículo del club, escrito con lo registrado en la partida') + note +
      '<article class="bio"><div class="bio-hd"><h1>' + esc(d.name) + '</h1></div><div class="bio-sub">De Wikifútbol, la enciclopedia de tu carrera</div>' + box(d) + '<p class="bio-lead">' + d.lead + '</p>' +
      '<nav class="bio-toc"><b>Contenido</b><ol>' + d.secs.map(function (s) { return '<li><a data-act="cwgo" data-id="cw-' + s.id + '">' + esc(s.t) + '</a></li>'; }).join('') + '</ol></nav>' + d.secs.map(function (s) { return section(s, d); }).join('') + '</article>';
  };
  A.cwiki = function (d) { UI.tab.cwid = +d.id; UI.tab.g_club = 'historia'; UI.closeModal(); UI.scr = 'club'; UI.render(); };
  A.cwgo = function (d) { var el = document.getElementById(d.id); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
})();
