/* FUTPRO — pantalla Biografía: artículo enciclopédico del jugador que se va construyendo con la carrera. js/bio.js */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, UI = FP.UI, esc = U.esc, SC = UI.screens, A = UI.acts, I = UI.icon, B = FP.Bio, hdr = UI.hdr;

  function para(p) { return '<p>' + p + '</p>'; }
  function box(d) {
    var h = FP.S.hero, rows = d.box.map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join('');
    var bc = d.boxClubs || { form: [], pro: d.stints };
    function crow(s) { return '<tr><th>' + esc(s.yrs) + '</th><td>' + esc(s.nm) + (s.loan ? ' <span class="mut">(cedido)</span>' : '') + (s.ap != null ? ' <span class="mut">' + s.ap + ' (' + s.g + ')</span>' : '') + '</td></tr>'; }
    var clubs = (bc.form.length ? '<tr class="bx-h"><th colspan="2">Clubes juveniles</th></tr>' + bc.form.map(crow).join('') : '') + (bc.pro.length ? '<tr class="bx-h"><th colspan="2">Clubes profesionales</th></tr>' + bc.pro.map(crow).join('') : '');
    var nt = d.nt ? '<tr class="bx-h"><th colspan="2">Selección nacional</th></tr>' + ((d.ntRows && d.ntRows.length > 1) ? d.ntRows.map(function (x) { return '<tr><th>' + esc(x.y) + '</th><td>' + esc(C.cname(h.nat)) + ' ' + esc(x.cat) + ' <span class="mut">' + x.p + ' (' + x.g + ')</span></td></tr>'; }).join('') : '') + '<tr><th>' + esc(C.cname(h.nat)) + '</th><td>' + d.nt.p + ' partidos (' + d.nt.g + ' goles)</td></tr>' : '';
    var tit = d.titles ? '<tr class="bx-h"><th colspan="2">Títulos</th></tr><tr><th>Campeonatos</th><td>' + d.titles + '</td></tr>' : '';
    return '<aside class="bx"><div class="bx-t">' + esc(d.name) + '</div><div class="bx-av">' + UI.avatar(h) + '</div><table>' + rows + clubs + nt + tit + '</table></aside>';
  }
  function trophies(sec) {
    var champ = sec.trophies.filter(function (t) { return !t.sub; }).sort(function (a, b) { return (a.w || 0) - (b.w || 0); }), sub = sec.trophies.filter(function (t) { return t.sub; }).sort(function (a, b) { return (a.w || 0) - (b.w || 0); });
    function tab(title, rows) { return rows.length ? '<h3>' + title + '</h3><table class="bx-tb"><thead><tr><th>Torneo</th><th>Club</th><th>Año</th></tr></thead><tbody>' + rows.map(function (t) { return '<tr><td>' + esc(t.nm) + '</td><td>' + esc(t.club || '') + '</td><td>' + esc(t.y) + '</td></tr>'; }).join('') + '</tbody></table>' : ''; }
    var aw = sec.awards.slice().sort(function (a, b) { return (a.w || 0) - (b.w || 0); });
    return tab('Campeonatos', champ) + tab('Subcampeonatos', sub) + (aw.length ? '<h3>Distinciones individuales</h3><table class="bx-tb"><thead><tr><th>Distinción</th><th>Año</th></tr></thead><tbody>' + aw.map(function (a) { return '<tr><td>' + esc(a.nm) + '</td><td>' + esc(a.y) + '</td></tr>'; }).join('') + '</tbody></table>' : '');
  }
  function section(sec, n) {
    var h = '<h2 id="bio-' + sec.id + '"><span>' + esc(sec.t) + '</span></h2>';
    if (sec.p) h += sec.p.map(para).join('');
    if (sec.sub) h += sec.sub.map(function (x) { return '<h3>' + esc(x.t) + '</h3>' + x.p.map(para).join(''); }).join('');
    if (sec.items) h += '<ul class="bx-ul">' + sec.items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    if (sec.trophies) h += trophies(sec);
    if (sec.tables) h += sec.tables.map(function (k) { return '<h3>' + (k === 'nat' ? 'Selección' : 'Clubes') + '</h3>' + UI.bioTables[k](); }).join('');
    return h;
  }

  SC.bio = function () {
    var h = FP.S.hero, d = B.build();
    var tab = UI.tab.bio || 'art';
    var html = hdr('book', 'Biografía', 'Tu historia, escrita con lo que haces en la cancha', UI.seg('bio', [['art', 'Artículo', 'book'], ['extra', 'Cronología y hitos', 'history']], tab));
    if (tab === 'extra') {
      html += '<div class="notice">La biografía es un artículo de enciclopedia; aquí queda aparte el registro de hitos, récords y la cronología completa de tu carrera.</div>';
      if (!d.extra.length) return html + '<div class="card"><p class="mut">Todavía no hay hitos ni cronología: se irán llenando mientras juegas.</p></div>';
      return html + d.extra.map(function (sec) { return '<div class="card"><div class="hd"><h3>' + esc(sec.t) + '</h3></div><ul class="bx-ul" style="font-size:.9rem">' + sec.items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>'; }).join('');
    }
    var stub = d.grade[0] === 'Esbozo' ? 'Este artículo es un <b>esbozo</b>: se irá ampliando a medida que juegues temporadas, ganes títulos y vivas tu carrera.' : d.grade[0] === 'En construcción' ? 'Este artículo está <b>en construcción</b>: faltan secciones por completar (ver al final).' : '';
    html += '<article class="bio">' + (stub ? '<div class="bio-stub">' + I('info') + '<span>' + stub + '</span></div>' : '') +
      '<div class="bio-hd"><h1>' + esc(d.name) + '</h1><span class="pill ' + d.grade[1] + '">' + esc(d.grade[0]) + '</span></div><div class="bio-sub">De Wikifútbol, la enciclopedia de tu carrera</div>' +
      box(d) + '<p class="bio-lead">' + d.lead + '</p>';
    html += '<nav class="bio-toc"><b>Contenido</b><ol>' + d.secs.map(function (s) { return '<li><a data-act="biogo" data-id="bio-' + s.id + '">' + esc(s.t) + '</a></li>'; }).join('') + '</ol></nav>';
    html += d.secs.map(section).join('');
    if (d.lock.length) html += '<div class="bio-lock"><h4>Secciones por desbloquear</h4>' + d.lock.map(function (l) { return '<div class="bio-lk">' + I('lock') + '<b>' + esc(l[0]) + '</b><span>' + esc(l[1]) + '</span></div>'; }).join('') + '</div>';
    return html + '</article>';
  };
  A.biogo = function (d) { var el = document.getElementById(d.id); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  var g = UI.GROUPS[0][1], i = -1; g.forEach(function (x, k) { if (x[0] === 'career') i = k; });
  g.splice(i >= 0 ? i + 1 : g.length, 0, ['bio', 'Biografía', 'book']);
})();
