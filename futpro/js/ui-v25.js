/* FUTPRO — ficha estilo enciclopedia del protegido, los representados y las promesas de la academia. Lógica en ficha.js. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, SC = UI.screens, A = UI.acts, I = UI.icon, P = FP.Post, F = FP.Ficha, hdr = UI.hdr;
  var KIND = { hijo: 'Tu hijo', protegido: 'Tu protegido', representado: 'Representado', academia: 'De tu academia', seguido: 'Seguido' };

  function infobox(r, q) {
    var alive = !r.end && q && typeof q === 'object', cur = alive && q.c >= 0 ? C.tname(q.c) : (alive && q.c === -3 ? 'Reserva nacional' : r.end ? 'Retirado' : '—');
    var dem = FP.Bio && FP.Bio.dem ? FP.Bio.dem(r.nat) : null, nt = F.nt(r), o = alive ? q.o : r.o;
    var rows = [['Nacimiento', (FP.Bio.dlong(r.b)) + ' (' + F.age(r) + ' años)'], ['Posición', C.POS_NAME[r.pos] || r.pos], ['Club', cur], ['Nivel', o != null ? (o + (alive && q.pt ? ' (potencial ' + Math.round(q.pt) + ')' : '')) : '—'], ['Relación', KIND[r.kind] || 'Seguido']];
    if (nt.length) rows.push(['Selección', nt.map(function (x) { return x.label; }).join(', ')]);
    if (alive && q.c >= 0 && q.ce) rows.push(['Contrato', 'hasta ' + q.ce]);
    return '<div class="fi-box"><div class="t">' + esc(r.n) + '</div><dl>' + rows.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + esc(String(x[1])) + '</dd>'; }).join('') + '</dl></div>';
  }
  function tdn(v) { return '<td class="n">' + v + '</td>'; }
  function clubsTable(tb) {
    if (!tb.league.length) return '';
    var byClub = [], idx = {}; tb.league.forEach(function (x) { if (idx[x.c] == null) { idx[x.c] = byClub.length; byClub.push({ c: x.c, rows: [] }); } byClub[idx[x.c]].rows.push(x); });
    var body = '', tp = 0, tg = 0, ta = 0;
    byClub.forEach(function (g) {
      var sp = 0, sg = 0, sa = 0;
      g.rows.forEach(function (x, i) { sp += x.p; sg += x.g; sa += x.a; body += '<tr>' + (i === 0 ? '<td class="wt-c" rowspan="' + (g.rows.length + (g.rows.length > 1 ? 1 : 0)) + '">' + esc(C.tname(g.c)) + '</td>' : '') + '<td>' + esc(String(x.y)) + '</td><td class="wt-d">' + esc(x.dn || '') + '</td>' + tdn(x.p || '–') + tdn(x.g || '–') + tdn(x.a || '–') + tdn(x.o != null ? x.o : '–') + '</tr>'; });
      if (g.rows.length > 1) body += '<tr class="wt-s"><td colspan="2">Total en el club</td>' + tdn(sp) + tdn(sg) + tdn(sa) + tdn('') + '</tr>';
      tp += sp; tg += sg; ta += sa;
    });
    body += '<tr class="wt-t"><td colspan="3">Total carrera</td>' + tdn(tp) + tdn(tg) + tdn(ta) + tdn('') + '</tr>';
    return '<h3>Clubes</h3><table class="wt"><thead><tr><th>Club</th><th>Temporada</th><th>División</th><th class="n">PJ*</th><th class="n">G</th><th class="n">A</th><th class="n">Nivel</th></tr></thead><tbody>' + body + '</tbody></table><div class="mut sm">* Los partidos y minutos son estimaciones a partir de la alineación probable del club; los goles y las asistencias son los registrados por el juego.</div>';
  }
  function otherTable(tb) {
    if (!tb.other.length) return '';
    return '<h3>Copas y torneos continentales</h3><table class="wt"><thead><tr><th>Club</th><th>Temporada</th><th>Competición</th><th class="n">PJ*</th><th class="n">G</th><th class="n">A</th></tr></thead><tbody>' + tb.other.map(function (x) { return '<tr><td>' + esc(C.tname(x.c)) + '</td><td>' + esc(String(x.y)) + '</td><td class="wt-d">' + esc(x.dn || '') + '</td>' + tdn(x.p || '–') + tdn(x.g || '–') + tdn(x.a || '–') + '</tr>'; }).join('') + '</tbody></table>';
  }
  function body(r) {
    var q = FP.S.pl[r.pid], tb = F.table(r), html = '';
    html += '<p>' + F.lead(r) + '</p>';
    var tr = clubsTable(tb), ot = otherTable(tb);
    html += '<h2>Trayectoria</h2>' + (tr || '<p class="mut sm">' + (r.kind === 'academia' || (q && q.c === -3) ? 'Aún no ha debutado: hasta entonces solo se anota su progresión.' : 'Todavía no hay temporadas registradas desde que lo sigues.') + '</p>') + ot;
    if (tb.nt.length) html += '<h3>Selección</h3><table class="wt"><thead><tr><th>Categoría</th><th class="n">PJ</th><th class="n">G</th><th class="n">A</th></tr></thead><tbody>' + tb.nt.map(function (x) { return '<tr><td>Selección ' + esc(x.label) + '</td>' + tdn(x.p) + tdn(x.g) + tdn(x.a) + '</tr>'; }).join('') + '</tbody></table>';
    var tro = r.tro.concat(r.aw.map(function (x) { return { y: x.y, nm: x.nm }; }));
    if (tro.length) html += '<h2>Palmarés y distinciones</h2><table class="wt"><thead><tr><th>Título o distinción</th><th>Club</th><th>Año</th></tr></thead><tbody>' + tro.map(function (x) { return '<tr><td>' + esc(x.nm) + '</td><td>' + (x.c != null ? esc(C.tname(x.c)) : '—') + '</td><td>' + esc(String(x.y)) + '</td></tr>'; }).join('') + '</tbody></table>';
    if (r.hit.length) html += '<h2>Hitos</h2><table class="wt"><tbody>' + r.hit.map(function (x) { return '<tr><td style="width:7rem">' + esc(String(D.year(x.w))) + '</td><td>' + esc(x.t) + '</td></tr>'; }).join('') + '</tbody></table>';
    if (r.prog.length > 1) html += '<h2>Progresión</h2><table class="wt"><thead><tr><th>Año</th><th class="n">Edad</th><th class="n">Nivel</th><th>Club</th></tr></thead><tbody>' + r.prog.map(function (x) { return '<tr><td>' + x.y + '</td>' + tdn(x.age) + tdn(x.o) + '<td>' + (x.c >= 0 ? esc(C.tname(x.c)) : 'Sin club') + '</td></tr>'; }).join('') + '</tbody></table>';
    var pa = P.ensure().path, cl = pa && pa.k === 'agent' ? pa.clients.filter(function (c) { return c.pid === r.pid; })[0] : null, pr = FP.Mentor && FP.Mentor.get();
    if (cl) html += '<h2>Contigo</h2><table class="wt"><tbody><tr><td>Lealtad</td><td>' + Math.round(cl.loy == null ? 60 : cl.loy) + '/100</td></tr><tr><td>Comisiones cobradas</td><td>' + FP.fmt.money(Math.round(cl.com || 0)) + '</td></tr>' + (cl.star ? '<tr><td>Estado</td><td>Figura</td></tr>' : '') + '</tbody></table>';
    else if (pr && pr.pid === r.pid) html += '<h2>Contigo</h2><table class="wt"><tbody><tr><td>Vínculo</td><td>' + Math.round(pr.bond) + '/100</td></tr><tr><td>Plan de formación</td><td>' + esc(FP.Mentor.PLANS[pr.plan].nm) + '</td></tr></tbody></table>';
    return html;
  }
  SC.ficha = function () {
    var h = FP.S.hero, fi = F.ensure(), html = hdr('book', 'Ficha de jugadores', 'Tu protegido, tus representados y las promesas de tu academia');
    if (!h.retired) return html + '<div class="card"><p class="mut">Disponible cuando te retires.</p></div>';
    F.sync();
    var list = Object.keys(fi.pl).map(function (k) { return fi.pl[k]; }).sort(function (a, b) { return (a.end ? 1 : 0) - (b.end ? 1 : 0) || a.since - b.since; });
    if (!list.length) return html + '<div class="card"><p class="mut">Aún no sigues a ningún jugador. Apadrina a una promesa, representa a un cliente o funda una academia en <a class="more" data-act="nav" data-s="post">Después del fútbol</a>.</p></div>';
    var cur = fi.pl[UI.fpid] || list[0]; UI.fpid = cur.pid;
    html += '<div class="seg">' + list.map(function (r) { return '<button class="' + (r.pid === cur.pid ? 'on' : '') + '" data-act="fichago" data-id="' + r.pid + '">' + esc(r.n) + (r.end ? ' †' : '') + '</button>'; }).join('') + '</div>';
    html += '<div class="card fi-page">' + infobox(cur, FP.S.pl[cur.pid]) + '<h1 class="fi-h">' + esc(cur.n) + '</h1><div class="mut sm">' + esc(KIND[cur.kind] || '') + (cur.end ? ' · retirado' : '') + '</div>' + body(cur) + '<div class="fi-clr"></div></div>';
    return html;
  };
  A.fichago = function (d) { UI.fpid = +d.id; UI.go('ficha'); };
  A.fichaopen = A.fichago;
})();
