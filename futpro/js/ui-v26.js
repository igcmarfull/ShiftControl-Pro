/* FUTPRO — seleccionador: pestaña de carrera y pantalla de convocatoria. Lógica en seleccion.js. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, SC = UI.screens, A = UI.acts, I = UI.icon, P = FP.Post, Sel = FP.Sel, hdr = UI.hdr, seg = UI.seg;
  function m(k) { return FP.fmt.money(k); }
  function pill(t, c) { return '<span class="pill ' + (c || '') + '">' + t + '</span>'; }
  function bar(v, cls) { return UI.bar(Math.max(0, Math.min(100, v)), 100, cls || ''); }
  function done(r) { if (r && r.msg) UI.toast(esc(r.msg), r.ok === false ? 'warn' : 'ok'); UI.render(); }
  var GRP = { GK: 'POR', CB: 'DEF', LB: 'DEF', RB: 'DEF', DM: 'MED', CM: 'MED', AM: 'MED', LW: 'DEL', RW: 'DEL', ST: 'DEL' };
  var ORDER = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];

  UI.selTab = function (h, p, pa) {
    var S = FP.S, j = Sel.job(), html = UI.decCards(['rt']), nat = FP.Nat.byCode(h.nat);
    html += '<div class="grid g2"><div class="card"><div class="hd"><h3>' + I('flag') + 'Cargo actual</h3></div>' + (j ? '<div class="row" style="gap:.7rem">' + UI.crest(j.nat, 'lg') + '<div><b style="font-size:1.1rem">Selección ' + esc(Sel.CATS[j.cat].n) + ' de ' + esc(S.nat[j.nat - 5000].nm) + '</b><div class="mut sm">desde ' + esc(D.fmt(j.since)) + ' · sueldo ' + m(Sel.CATS[j.cat].wage) + ' al año</div></div></div>' +
      '<div class="mut sm" style="margin-top:.6rem">Confianza de la federación</div>' + bar(j.conf, j.conf < 30 ? 'r' : j.conf < 50 ? 'y' : '') + '<p class="mut sm">Se mide contra lo esperado: ganar a favoritos la sube, perder con rivales más débiles la baja. Con 12 partidos dirigidos y confianza mínima te destituyen.</p>' +
      '<div class="btn-group"><button class="btn pri" data-act="nav" data-s="convoca">' + I('user') + 'Convocatoria (' + j.sq.length + '/' + Sel.size(j.cat) + ')</button><button class="btn" data-act="nav" data-s="coach">' + I('whistle') + 'Banquillo</button></div>'
      : '<p class="mut">Sin cargo. ' + (nat ? 'La federación de ' + esc(nat.nm) + ' ofrece puestos según tu licencia.' : '') + '</p><button class="btn pri" data-act="sel-offer">Ver ofertas de la federación</button>') + '</div>';
    html += '<div class="card"><div class="hd"><h3>' + I('contract') + 'Licencias y categorías</h3></div><p>' + esc(P.LIC[p.lic]) + '</p><p class="mut sm">Experiencia: ' + p.exp + ' temporada(s). Tu legado acorta los cursos.</p>' +
      Sel.ORDER.map(function (c) { var need = Sel.need(c); return '<div class="row sp sm"><span>Selección ' + esc(Sel.CATS[c].n) + '</span>' + (need ? '<span class="mut">requiere ' + esc(need) + '</span>' : pill('Disponible', 'g')) + '</div>'; }).join('') +
      (p.lic < 3 && !pa.course ? '<div style="margin-top:.6rem"><button class="btn" data-act="postcourse" data-k="coach">Comenzar ' + esc(P.LIC[p.lic + 1].toLowerCase()) + '</button></div>' : '') + (pa.course ? '<p class="mut sm" style="margin-top:.5rem">Curso en marcha: faltan ' + pa.course.left + ' semanas.</p>' : '') + '</div></div>';
    var up = j ? Sel.upcoming(5) : [];
    if (up.length) html += '<div class="card"><div class="hd"><h3>' + I('calendar') + 'Próximos partidos</h3></div><table class="wt"><thead><tr><th>Fecha</th><th>Competición</th><th>Partido</th></tr></thead><tbody>' + up.map(function (x) { return '<tr><td>' + esc(D.fmt(x.f.w)) + '</td><td>' + esc(x.comp.nm) + (x.f.ro ? ' · ' + esc(x.f.ro) : '') + '</td><td>' + esc(C.tname(x.f.h)) + ' — ' + esc(C.tname(x.f.a)) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    if (pa.seasons.length) html += '<div class="card"><div class="hd"><h3>' + I('history') + 'Torneos dirigidos</h3>' + pill(pa.titles + ' título(s)', 'g') + '</div><table class="wt"><thead><tr><th>Año</th><th>Torneo</th><th>Categoría</th><th>Resultado</th></tr></thead><tbody>' + pa.seasons.slice().reverse().slice(0, 14).map(function (s) { return '<tr><td>' + esc(String(s.y)) + '</td><td>' + esc(s.tour || '—') + '</td><td>' + esc(s.cat ? Sel.CATS[s.cat].n : '—') + '</td><td>' + esc(s.res) + (s.mid ? ' (a mitad de torneo)' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    return html;
  };

  function row(p, btn) {
    var inj = p.inj > 0 ? ' ' + pill('Lesionado', 'r') : '';
    return '<tr><td>' + UI.posb(p.p) + ' ' + esc(p.n) + inj + '</td><td class="n">' + C.age(p) + '</td><td class="n">' + p.o + '</td><td class="n">' + Math.round(p.pt || p.o) + '</td><td class="wt-d">' + (p.c >= 0 && p.c < 5000 ? esc(C.tname(p.c)) : 'Sin club') + '</td><td>' + btn + '</td></tr>';
  }
  SC.convoca = function () {
    var S = FP.S, h = S.hero, j = Sel.job(), html = hdr('user', 'Convocatoria', j ? 'Selección ' + Sel.CATS[j.cat].n + ' de ' + S.nat[j.nat - 5000].nm : 'Selección', '<div class="btn-group"><button class="btn" data-act="sel-auto">Completar con lo recomendado</button><button class="btn" data-act="sel-reset">Reiniciar lista</button></div>');
    if (!h.retired || !j) return html + '<div class="card"><p class="mut">Todavía no diriges ninguna selección. ' + '<a class="more" data-act="nav" data-s="retiro">Ver ofertas</a></p></div>';
    Sel.clean();
    var pl = j.sq.map(function (i) { return S.pl[i]; }).filter(Boolean).sort(function (a, b) { return ORDER.indexOf(a.p) - ORDER.indexOf(b.p) || b.o - a.o; }), cnt = Sel.counts(), q = Sel.size(j.cat);
    var w = Sel.warnings(); if (w.length) html += '<div class="notice">' + w.map(esc).join(' · ') + '</div>';
    html += '<div class="card"><div class="row" style="flex-wrap:wrap;gap:.4rem">' + pill(pl.length + '/' + q + ' convocados', pl.length === q ? 'g' : 'y') + ORDER.map(function (ps) { return pill(C.POS_ES[ps] + ' ' + (cnt[ps] || 0), (cnt[ps] || 0) >= 2 ? '' : 'y'); }).join('') + '</div><p class="mut sm" style="margin-top:.4rem">La lista que armas define quién juega: el motor elige tu once y tu banco entre estos jugadores. En la absoluta, una lista mejor que la recomendada da una pequeña ventaja.</p></div>';
    var f = UI.tab.convoca || 'todos', flt = { todos: null, por: 'POR', def: 'DEF', med: 'MED', del: 'DEL' }[f];
    var pool = Sel.pool().filter(function (e) { return j.sq.indexOf(e.p.i) < 0 && (!flt || GRP[e.p.p] === flt); }).slice(0, 40);
    html += '<div class="grid g2"><div class="card"><div class="hd"><h3>' + I('shield') + 'Tu lista</h3></div><table class="wt"><thead><tr><th>Jugador</th><th class="n">Edad</th><th class="n">Nivel</th><th class="n">Pot.</th><th>Club</th><th></th></tr></thead><tbody>' +
      pl.map(function (p) { return row(p, '<button class="btn sm" data-act="sel-rm" data-id="' + p.i + '">Quitar</button>'); }).join('') + '</tbody></table></div>' +
      '<div class="card"><div class="hd"><h3>' + I('search') + 'Candidatos</h3></div>' + seg('convoca', [['todos', 'Todos'], ['por', 'Porteros'], ['def', 'Defensas'], ['med', 'Medios'], ['del', 'Delanteros']], f) + '<table class="wt"><thead><tr><th>Jugador</th><th class="n">Edad</th><th class="n">Nivel</th><th class="n">Pot.</th><th>Club</th><th></th></tr></thead><tbody>' +
      pool.map(function (e) { return row(e.p, '<button class="btn sm" data-act="sel-add" data-id="' + e.p.i + '">Convocar</button>'); }).join('') + '</tbody></table><p class="mut sm">Ordenados por la valoración del seleccionador (nivel, proyección, club y minutos).</p></div></div>';
    return html;
  };
  A['sel-add'] = function (d) { done(Sel.add(+d.id)); };
  A['sel-rm'] = function (d) { done(Sel.remove(+d.id)); };
  A['sel-auto'] = function () { var n = Sel.autoFill(); done({ ok: true, msg: n ? 'Se agregaron ' + n + ' jugadores recomendados.' : 'La lista ya está completa.' }); };
  A['sel-reset'] = function () { UI.confirm('¿Reiniciar la lista con la convocatoria recomendada?', function () { Sel.reset(); UI.render(); }); };
  A['sel-offer'] = function () { Sel.offer(); UI.render(); };
})();
