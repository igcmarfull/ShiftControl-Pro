/* FUTPRO — tablas de estadísticas de carrera en formato enciclopédico (se muestran en Biografía), con tres vistas para clubes:
   separadas por nivel (cantera/amateur y profesional), una sola tabla con nivel y filtro, y matriz por temporada. Solo presentación sobre FP.Stats. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, UI = FP.UI, esc = U.esc, ST = FP.Stats;

  var LEAGUE = { liga: 1, juv: 1, amat: 1 }, LV = { juv: 'Juvenil', amat: 'Amateur', pro: 'Profesional' };
  var VIEWS = [['split', 'Cantera y profesional'], ['level', 'Una tabla con filtro'], ['season', 'Por temporada']];
  function z() { return { p: 0, g: 0, a: 0 }; }
  function add(t, r) { t.p += r.p; t.g += r.g; t.a += r.a; return t; }
  function cell(v) { return v ? v : '–'; }
  function agg(rows) {
    var o = { liga: z(), copa: z(), cont: z(), amis: z(), tot: z() };
    rows.forEach(function (r) {
      var k = LEAGUE[r.k] ? 'liga' : r.k === 'copa' ? 'copa' : r.k === 'cont' ? 'cont' : r.k === 'amis' ? 'amis' : null;
      if (!k) return; add(o[k], r); if (k !== 'amis') add(o.tot, r);
    });
    return o;
  }
  function level(t) { return t != null && t >= 30000 && t < 50000 ? 'juv' : t != null && t >= 20000 && t < 30000 ? 'amat' : 'pro'; }
  function base(t) { return t != null && t >= 30000 && t < 50000 ? t - 30000 : t; }
  function nm(e) { var b = base(e.t); return b != null && b < 5000 ? C.tname(b) : e.tn; }
  function crest(t) { var b = base(t); return b != null && b < 5000 ? UI.crest(b, 'sm') : ''; }
  function mainDiv(e) {
    var best = null; e.rows.forEach(function (r) { if (LEAGUE[r.k] && (!best || r.p > best.p)) best = r; });
    if (!best) best = e.rows.filter(function (r) { return r.k !== 'amis'; })[0] || e.rows[0];
    if (!best) return '';
    var n = best.c.replace(/\s*\(.*\)\s*$/, '');
    return best.k === 'juv' && n.indexOf(' · ') > 0 ? n.split(' · ')[0] : n;   // el campeonato juvenil se muestra solo (sin la liga profesional del club)
  }
  function entries() {
    return ST.seasons().map(function (s) { return { s: s.s, t: s.t, tn: s.tn, o: s.o, lv: level(s.t), rows: s.rows.filter(function (r) { return !ST.isNT(r.k); }) }; })
      .filter(function (e) { return e.rows.length; }).sort(function (a, b) { return a.o - b.o; });
  }
  function mergeSeasons(list) {   // una fila por temporada dentro de cada club
    var by = {}, out = [];
    list.forEach(function (e) { var k = String(e.s) + '|' + e.lv; if (by[k]) { by[k].rows = by[k].rows.concat(e.rows); by[k].o = Math.max(by[k].o, e.o); } else { by[k] = { s: e.s, t: e.t, tn: e.tn, o: e.o, lv: e.lv, rows: e.rows.slice() }; out.push(by[k]); } });
    return out;
  }
  function groupsOf(list) {
    var groups = [];
    list.forEach(function (e) { var g = groups[groups.length - 1], bt = base(e.t); if (g && g.t === bt && (bt != null && bt < 5000 || g.tn === e.tn)) g.list.push(e); else groups.push({ t: bt, tn: e.tn, list: [e] }); });
    groups.forEach(function (g) { g.list = mergeSeasons(g.list); });
    return groups;
  }
  function cells(o, cols) {
    return '<td class="n">' + cell(o.liga.p) + '</td><td class="n">' + cell(o.liga.g) + '</td>' + (cols.copa ? '<td class="n lb">' + cell(o.copa.p) + '</td><td class="n">' + cell(o.copa.g) + '</td>' : '') + (cols.cont ? '<td class="n lb">' + cell(o.cont.p) + '</td><td class="n">' + cell(o.cont.g) + '</td>' : '') +
      '<td class="n lb tt">' + cell(o.tot.p) + '</td><td class="n tt">' + cell(o.tot.g) + '</td><td class="n tt">' + cell(o.tot.a) + '</td><td class="n lb mut">' + cell(o.amis.p) + '</td><td class="n mut">' + cell(o.amis.g) + '</td>';
  }
  function head(cols, lvl) {
    return '<thead><tr><th rowspan="2">Club</th><th rowspan="2">Temporada</th>' + (lvl ? '<th rowspan="2">Nivel</th>' : '') + '<th rowspan="2">División</th><th colspan="2">Liga</th>' + (cols.copa ? '<th colspan="2" class="lb">Copa nacional</th>' : '') + (cols.cont ? '<th colspan="2" class="lb">Continental</th>' : '') + '<th colspan="3" class="lb">Total oficial</th><th colspan="2" class="lb mut">Amistosos</th></tr><tr><th class="n">PJ</th><th class="n">G</th>' + (cols.copa ? '<th class="n lb">PJ</th><th class="n">G</th>' : '') + (cols.cont ? '<th class="n lb">PJ</th><th class="n">G</th>' : '') + '<th class="n lb">PJ</th><th class="n">G</th><th class="n">A</th><th class="n lb mut">PJ</th><th class="n mut">G</th></tr></thead>';
  }
  function lvPill(l) { return '<span class="wk-lv ' + l + '">' + LV[l] + '</span>'; }

  // tabla de clubes (por grupos de club, con subtotales y total); opts.level muestra la columna Nivel; opts.totalLabel nombra el total
  function table(list, opts) {
    opts = opts || {};
    var groups = groupsOf(list), all = [].concat.apply([], list.map(function (e) { return e.rows; })), t0 = agg(all);
    var cols = { copa: t0.copa.p > 0, cont: t0.cont.p > 0 }, body = '', nc = 3 + (opts.level ? 1 : 0), shown = 0;
    groups.forEach(function (g) {
      var rowsAll = [].concat.apply([], g.list.map(function (s) { return s.rows; })), vis = g.list.filter(function (s) { return agg(s.rows).tot.p > 0; });
      if (!vis.length) return;
      shown += vis.length;
      vis.forEach(function (s, i) {
        body += '<tr>' + (i === 0 ? '<th class="wk-cl" rowspan="' + (vis.length + (vis.length > 1 ? 1 : 0)) + '"><div>' + crest(g.t) + '<b>' + esc(nm(vis[0])) + '</b></div></th>' : '') + '<td>' + esc(s.s) + '</td>' + (opts.level ? '<td>' + lvPill(s.lv) + '</td>' : '') + '<td class="wk-dv ell" title="' + esc(mainDiv(s)) + '">' + esc(mainDiv(s)) + '</td>' + cells(agg(s.rows), cols) + '</tr>';
      });
      if (vis.length > 1) body += '<tr class="wk-sub"><td colspan="' + (nc - 1) + '">Total en el club</td>' + cells(agg(rowsAll), cols) + '</tr>';
    });
    if (!shown) return '<p class="mut sm">Sin partidos oficiales en este nivel.</p>';
    body += '<tr class="wk-tot"><td colspan="' + nc + '">' + esc(opts.totalLabel || 'Total de carrera') + '</td>' + cells(t0, cols) + '</tr>';
    return '<div class="tw"><table class="wk">' + head(cols, opts.level) + '<tbody>' + body + '</tbody></table></div>';
  }
  function chips(list) {
    var by = { juv: z(), amat: z(), pro: z() }, tot = z();
    list.forEach(function (e) { var a = agg(e.rows).tot; add(by[e.lv], a); add(tot, a); });
    function chip(l, t, k) { return t.p ? '<div class="wk-ch ' + k + '"><span>' + l + '</span><b>' + t.p + ' PJ</b><i>' + t.g + ' G · ' + t.a + ' A</i></div>' : ''; }
    return '<div class="wk-chips">' + chip('Juvenil', by.juv, 'juv') + chip('Amateur', by.amat, 'amat') + chip('Profesional', by.pro, 'pro') + chip('Total oficial', tot, 'tot') + '</div>';
  }

  // ---- A · separadas por nivel ----
  function viewSplit(list) {
    var low = list.filter(function (e) { return e.lv !== 'pro'; }), pro = list.filter(function (e) { return e.lv === 'pro'; }), html = chips(list);
    if (pro.length) html += '<h4 class="wk-h">Primer equipo y clubes profesionales</h4>' + table(pro, { totalLabel: 'Total profesional' });
    if (low.length) html += '<h4 class="wk-h">Categorías inferiores y fútbol amateur</h4>' + table(low, { totalLabel: 'Total cantera y amateur' });
    return html;
  }
  // ---- B · una tabla con filtro ----
  function viewLevel(list) {
    var f = UI.tab.bwf || 'all', opts = [['all', 'Todo'], ['pro', 'Profesional'], ['juv', 'Juvenil'], ['amat', 'Amateur']];
    var avail = {}; list.forEach(function (e) { avail[e.lv] = 1; });
    var bar = '<div class="fbar" style="margin:.2rem 0 .6rem"><div class="seg">' + opts.filter(function (o) { return o[0] === 'all' || avail[o[0]]; }).map(function (o) { return '<button class="' + (f === o[0] ? 'on' : '') + '" data-act="tabset" data-s="bwf" data-t="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
    var shown = f === 'all' || !avail[f] ? list : list.filter(function (e) { return e.lv === f; });
    return chips(list) + bar + table(shown, { level: true, totalLabel: f === 'all' || !avail[f] ? 'Total de carrera' : 'Total ' + LV[f].toLowerCase() });
  }
  // ---- C · matriz por temporada ----
  function viewSeason(list) {
    var h = FP.S.hero, ageOf = {}; (h.seasons || []).forEach(function (r) { ageOf[parseInt(String(r.y).slice(0, 4), 10)] = r.age; });
    var years = {}, order = [];
    list.forEach(function (e) { var y = parseInt(String(e.s).slice(0, 4), 10); if (!years[y]) { years[y] = { y: y, s: e.s, low: [], pro: [] }; order.push(y); } (e.lv === 'pro' ? years[y].pro : years[y].low).push(e); });
    order.sort(function (a, b) { return a - b; });
    var natBy = {}; var by = ST.byClass(); ['u15', 'u17', 'u20', 'u23', 'abs'].forEach(function (k) { if (by[k]) by[k].rows.forEach(function (r) { var y = parseInt(String(r.s).slice(0, 4), 10); natBy[y] = natBy[y] || z(); add(natBy[y], r); }); });
    function cellOf(es) {
      var lines = es.map(function (e) { var a = agg(e.rows).tot; return a.p ? '<div class="sm-l"><span class="ell">' + esc(nm(e)) + '</span><b>' + a.p + '<i>·</i>' + a.g + '</b></div>' : ''; }).join('');
      return lines || '<span class="mut">–</span>';
    }
    var tot = z(), rows = order.map(function (y) {
      var Y = years[y], es = Y.low.concat(Y.pro), a = agg([].concat.apply([], es.map(function (e) { return e.rows; })).filter(function (r) { return r.k !== 'amis'; })).tot, n = natBy[y];
      add(tot, a);
      return '<tr><td><b>' + esc(Y.s) + '</b></td><td class="n mut">' + (ageOf[y] != null ? ageOf[y] : '–') + '</td><td>' + cellOf(Y.low) + '</td><td>' + cellOf(Y.pro) + '</td><td class="n lb">' + (n && n.p ? n.p + '<i class="mut"> · </i>' + n.g : '<span class="mut">–</span>') + '</td><td class="n lb tt">' + cell(a.p) + '</td><td class="n tt">' + cell(a.g) + '</td><td class="n tt">' + cell(a.a) + '</td></tr>';
    }).join('');
    return '<div class="tw"><table class="wk"><thead><tr><th rowspan="2">Año</th><th rowspan="2" class="n">Edad</th><th rowspan="2">Cantera / amateur <i class="mut">(PJ · G)</i></th><th rowspan="2">Profesional <i class="mut">(PJ · G)</i></th><th rowspan="2" class="n lb">Selección <i class="mut">(PJ · G)</i></th><th colspan="3" class="lb">Total en clubes</th></tr><tr><th class="n lb">PJ</th><th class="n">G</th><th class="n">A</th></tr></thead><tbody>' + rows + '<tr class="wk-tot"><td colspan="5">Total de carrera</td><td class="n lb tt">' + tot.p + '</td><td class="n tt">' + tot.g + '</td><td class="n tt">' + tot.a + '</td></tr></tbody></table></div>';
  }

  // ---------- estilo Wikipedia ("wikitable"): sin etiquetas de nivel ni tarjetas de resumen ----------
  function wcols(list) { var t = agg([].concat.apply([], list.map(function (e) { return e.rows; }))); return { copa: t.copa.p > 0, cont: t.cont.p > 0 }; }
  function wcells(o, cols) {
    return '<td class="n">' + cell(o.liga.p) + '</td><td class="n">' + cell(o.liga.g) + '</td>' + (cols.copa ? '<td class="n">' + cell(o.copa.p) + '</td><td class="n">' + cell(o.copa.g) + '</td>' : '') + (cols.cont ? '<td class="n">' + cell(o.cont.p) + '</td><td class="n">' + cell(o.cont.g) + '</td>' : '') +
      '<td class="n tt">' + cell(o.tot.p) + '</td><td class="n tt">' + cell(o.tot.g) + '</td><td class="n tt">' + cell(o.tot.a) + '</td>';
  }
  function whead(cols) {
    return '<thead><tr><th rowspan="2">Club</th><th rowspan="2">Temporada</th><th colspan="3">Liga</th>' + (cols.copa ? '<th colspan="2">Copa nacional</th>' : '') + (cols.cont ? '<th colspan="2">Continental</th>' : '') + '<th colspan="3">Total</th></tr><tr><th>División</th><th class="n">PJ</th><th class="n">G</th>' + (cols.copa ? '<th class="n">PJ</th><th class="n">G</th>' : '') + (cols.cont ? '<th class="n">PJ</th><th class="n">G</th>' : '') + '<th class="n">PJ</th><th class="n">G</th><th class="n">A</th></tr></thead>';
  }
  // etiqueta de club: el equipo juvenil se escribe "Club (juv.)" como en un artículo
  function label(e, youthLabel) { var b = base(e.t), n = b != null && b < 5000 ? C.tname(b) : e.tn; return n + (youthLabel && e.lv === 'juv' ? ' (juv.)' : '') + (FP.Bio && FP.Bio.isLoan(e.t, e.o) ? ' (cedido)' : ''); }
  function wtable(list, opts) {
    opts = opts || {};
    var vis = list.filter(function (e) { return agg(e.rows).tot.p > 0; });
    if (!vis.length) return '<p class="mut sm">Sin partidos oficiales.</p>';
    var cols = wcols(vis), body = '', all = z(), nc = 2 + 3 + (cols.copa ? 2 : 0) + (cols.cont ? 2 : 0);
    var groups = [];
    vis.forEach(function (e) { var k = label(e, opts.youthLabel), g = opts.flat ? null : groups.filter(function (x) { return x.k === k; })[0]; if (g) g.list.push(e); else groups.push({ k: k, e: e, list: [e] }); });
    groups.forEach(function (g) {
      g.list = opts.flat ? g.list : mergeSeasons(g.list);
      var rowsAll = [].concat.apply([], g.list.map(function (s) { return s.rows; })), many = g.list.length > 1 && !opts.flat;
      g.list.forEach(function (s, i) {
        body += '<tr>' + (opts.flat ? '<td>' + esc(g.k) + '</td>' : (i === 0 ? '<td class="wt-c" rowspan="' + (g.list.length + (many ? 1 : 0)) + '">' + esc(g.k) + '</td>' : '')) + '<td>' + esc(s.s) + '</td><td class="wt-d">' + esc(mainDiv(s)) + '</td>' + wcells(agg(s.rows), cols) + '</tr>';
      });
      if (many) body += '<tr class="wt-s"><td colspan="2">Total en el club</td>' + wcells(agg(rowsAll), cols) + '</tr>';
      add(all, agg(rowsAll).tot);
    });
    var tot = agg([].concat.apply([], vis.map(function (e) { return e.rows; })));
    body += '<tr class="wt-t"><td colspan="3">' + esc(opts.totalLabel || 'Total carrera') + '</td>' + wcells(tot, cols).replace(/^/, '') + '</tr>';
    // la fila de total ocupa 3 columnas de texto en tablas con club agrupado y 3 en las planas
    return '<table class="wt">' + whead(cols) + '<tbody>' + body + '</tbody></table>';
  }
  function tot3(list) { return agg([].concat.apply([], list.map(function (e) { return e.rows; }))).tot; }
  function careerLine(pro, low) {
    var t = tot3(pro), f = low ? tot3(low) : null;
    return '<p class="wt-n">' + (pro.length ? '<b>Total profesional:</b> ' + t.p + ' partidos, ' + t.g + ' goles y ' + t.a + ' asistencias.' : '') + (f && f.p ? (pro.length ? ' ' : '') + '<b>Etapa formativa:</b> ' + f.p + ' partidos, ' + f.g + ' goles y ' + f.a + ' asistencias.' : '') + '</p>';
  }

  // ---- A · una sola tabla, con subtotales por club ----
  function viewAll(list) { return wtable(list, { youthLabel: true }); }
  // ---- B · dos tablas: clubes y categorías inferiores ----
  function viewTwo(list) {
    var pro = list.filter(function (e) { return e.lv === 'pro'; }), low = list.filter(function (e) { return e.lv !== 'pro'; }), h = '';
    if (low.length) h += '<h4 class="wt-h">Etapa formativa</h4>' + wtable(low, { totalLabel: 'Total etapa formativa' });
    if (pro.length) h += '<h4 class="wt-h">Carrera profesional</h4>' + wtable(pro, { totalLabel: 'Total profesional' });
    return h + careerLine(pro, low);
  }
  // ---- C · plana: una fila por temporada y club, sin subtotales ----
  function viewFlat(list) { return wtable(list, { flat: true, youthLabel: true }); }

  function clubsTable() {
    var list = entries(); if (!list.length) return '<div class="card"><p class="mut">Todavía no hay partidos de club registrados.</p></div>';
    var view = UI.tab.bwv || 'two', VW = [['two', 'Formación y profesional'], ['all', 'Todo junto'], ['flat', 'Plana']];
    var bar = '<div class="wt-v">Vista: ' + VW.map(function (v) { return v[0] === view ? '<b>' + v[1] + '</b>' : '<a data-act="tabset" data-s="bwv" data-t="' + v[0] + '">' + v[1] + '</a>'; }).join(' · ') + '</div>';
    return bar + (view === 'two' ? viewTwo(list) : view === 'flat' ? viewFlat(list) : viewAll(list)) + '<p class="wt-n">PJ: partidos jugados · G: goles · A: asistencias. ' + (view === 'two' ? 'La etapa formativa (juvenil y amateur) no suma al total profesional. ' : '«Liga» incluye competiciones juveniles y amateur. ') + 'No se incluyen amistosos.</p>';
  }

  var CATS = [['u15', 'Selección Sub-15'], ['u17', 'Selección Sub-17'], ['u20', 'Selección Sub-20'], ['u23', 'Selección Sub-23'], ['abs', 'Selección absoluta']];
  function natTable() {
    var by = ST.byClass(), body = '', all = z(), any = false;
    CATS.forEach(function (c) {
      var d = by[c[0]]; if (!d) return;
      var rows = d.rows.filter(function (r) { return r.p > 0 && !/Amistoso/i.test(r.c); }).sort(function (a, b) { return a.o - b.o; }), sub = z(); if (!rows.length) return; any = true;
      rows.forEach(function (r, i) {
        add(sub, r); add(all, r);
        body += '<tr>' + (i === 0 ? '<td class="wt-c" rowspan="' + (rows.length + (rows.length > 1 ? 1 : 0)) + '">' + esc(c[1]) + '</td>' : '') + '<td>' + esc(r.s) + '</td><td class="wt-d">' + esc(r.c) + '</td><td class="n">' + cell(r.p) + '</td><td class="n">' + cell(r.g) + '</td><td class="n">' + cell(r.a) + '</td></tr>';
      });
      if (rows.length > 1) body += '<tr class="wt-s"><td colspan="2">Total ' + esc(c[1].replace('Selección ', '').toLowerCase()) + '</td><td class="n">' + cell(sub.p) + '</td><td class="n">' + cell(sub.g) + '</td><td class="n">' + cell(sub.a) + '</td></tr>';
    });
    if (!any) return '<p class="mut">Todavía no hay partidos oficiales con la selección.</p>';
    body += '<tr class="wt-t"><td colspan="3">Total con la selección</td><td class="n">' + cell(all.p) + '</td><td class="n">' + cell(all.g) + '</td><td class="n">' + cell(all.a) + '</td></tr>';
    return '<table class="wt"><thead><tr><th>Selección</th><th>Año</th><th>Competición</th><th class="n">PJ</th><th class="n">G</th><th class="n">A</th></tr></thead><tbody>' + body + '</tbody></table><p class="wt-n">No se incluyen amistosos.</p>';
  }

  UI.bioTables = { clubs: clubsTable, nat: natTable };
})();
