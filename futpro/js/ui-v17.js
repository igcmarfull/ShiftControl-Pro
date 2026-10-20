/* FUTPRO — Historial de carrera: estadísticas de carrera en formato enciclopédico (clubes y selección), de la temporada
   más antigua a la más reciente, con subtotales por club o categoría y total de carrera. Solo presentación sobre FP.Stats. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, UI = FP.UI, esc = U.esc, SC = UI.screens, I = UI.icon, ST = FP.Stats, seg = UI.seg;

  var LEAGUE = { liga: 1, juv: 1, amat: 1 };
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
  function crest(t) { var b = base(t); return b != null && b < 5000 ? UI.crest(b, 'sm') : ''; }
  function base(t) { return t != null && t >= 30000 && t < 50000 ? t - 30000 : t; }       // el equipo juvenil se agrupa con su club
  function nm(s) { var b = base(s.t); return b != null && b < 5000 ? C.tname(b) : s.tn; }
  function cells(o, cls) {
    return '<td class="n">' + cell(o.liga.p) + '</td><td class="n">' + cell(o.liga.g) + '</td><td class="n lb">' + cell(o.copa.p) + '</td><td class="n">' + cell(o.copa.g) + '</td><td class="n lb">' + cell(o.cont.p) + '</td><td class="n">' + cell(o.cont.g) + '</td>' +
      '<td class="n lb tt">' + cell(o.tot.p) + '</td><td class="n tt">' + cell(o.tot.g) + '</td><td class="n tt">' + cell(o.tot.a) + '</td><td class="n lb mut">' + cell(o.amis.p) + '</td><td class="n mut">' + cell(o.amis.g) + '</td>';
  }
  function mainDiv(s) {
    var best = null; s.rows.forEach(function (r) { if (LEAGUE[r.k] && (!best || r.p > best.p)) best = r; });
    if (!best) best = s.rows.filter(function (r) { return r.k !== 'amis'; })[0] || s.rows[0];
    return best ? best.c.replace(/\s*\(.*\)\s*$/, '') : '';
  }

  function clubsTable() {
    var seasons = ST.seasons().filter(function (s) { return s.rows.some(function (r) { return !ST.isNT(r.k); }); }).map(function (s) { return { s: s.s, t: s.t, tn: s.tn, o: s.o, rows: s.rows.filter(function (r) { return !ST.isNT(r.k); }) }; }).sort(function (a, b) { return a.o - b.o; });
    if (!seasons.length) return '<div class="card"><p class="mut">Todavía no hay partidos de club registrados.</p></div>';
    var groups = [];
    seasons.forEach(function (s) { var g = groups[groups.length - 1]; var bt = base(s.t); if (g && g.t === bt && (bt != null && bt < 5000 || g.tn === s.tn)) g.list.push(s); else groups.push({ t: bt, tn: s.tn, list: [s] }); });
    groups.forEach(function (g) {            // una fila por temporada en cada club (juvenil y primer equipo se suman)
      var by = {}, out = [];
      g.list.forEach(function (s) { var k = String(s.s); if (by[k]) { by[k].rows = by[k].rows.concat(s.rows); by[k].o = Math.max(by[k].o, s.o); } else { by[k] = { s: s.s, t: s.t, tn: s.tn, o: s.o, rows: s.rows.slice() }; out.push(by[k]); } });
      g.list = out;
    });
    var body = '', all = [];
    groups.forEach(function (g) {
      var rows = [].concat.apply([], g.list.map(function (s) { return s.rows; })); all = all.concat(rows);
      g.list.forEach(function (s, i) {
        body += '<tr>' + (i === 0 ? '<th class="wk-cl" rowspan="' + (g.list.length + (g.list.length > 1 ? 1 : 0)) + '"><div>' + crest(g.t) + '<b>' + esc(nm(g.list[0])) + '</b></div></th>' : '') + '<td>' + esc(s.s) + '</td><td class="wk-dv ell" title="' + esc(mainDiv(s)) + '">' + esc(mainDiv(s)) + '</td>' + cells(agg(s.rows)) + '</tr>';
      });
      if (g.list.length > 1) body += '<tr class="wk-sub"><td colspan="2">Total en el club</td>' + cells(agg(rows)) + '</tr>';
    });
    body += '<tr class="wk-tot"><td colspan="3">Total de carrera</td>' + cells(agg(all)) + '</tr>';
    return '<div class="card wk-card"><div class="tw"><table class="wk"><thead><tr><th rowspan="2">Club</th><th rowspan="2">Temporada</th><th rowspan="2">División</th><th colspan="2">Liga</th><th colspan="2" class="lb">Copa nacional</th><th colspan="2" class="lb">Continental</th><th colspan="3" class="lb">Total oficial</th><th colspan="2" class="lb mut">Amistosos</th></tr><tr><th class="n">PJ</th><th class="n">G</th><th class="n lb">PJ</th><th class="n">G</th><th class="n lb">PJ</th><th class="n">G</th><th class="n lb">PJ</th><th class="n">G</th><th class="n">A</th><th class="n lb mut">PJ</th><th class="n mut">G</th></tr></thead><tbody>' + body + '</tbody></table></div><p class="mut sm" style="margin:.6rem .2rem 0">En «Liga» se incluyen las competiciones juveniles y amateur. PJ: partidos jugados · G: goles · A: asistencias.</p></div>';
  }

  var CATS = [['u15', 'Selección Sub-15'], ['u17', 'Selección Sub-17'], ['u20', 'Selección Sub-20'], ['u23', 'Selección Sub-23'], ['abs', 'Selección absoluta']];
  function natTable() {
    var by = ST.byClass(), body = '', all = z(), any = false;
    CATS.forEach(function (c) {
      var d = by[c[0]]; if (!d) return; any = true;
      var rows = d.rows.slice().sort(function (a, b) { return a.o - b.o; }), sub = z();
      rows.forEach(function (r, i) {
        add(sub, r); add(all, r);
        body += '<tr>' + (i === 0 ? '<th class="wk-cl" rowspan="' + (rows.length + (rows.length > 1 ? 1 : 0)) + '"><div><b>' + esc(c[1]) + '</b></div></th>' : '') + '<td>' + esc(r.s) + '</td><td class="ell">' + esc(r.c) + '</td><td class="n">' + cell(r.p) + '</td><td class="n">' + cell(r.g) + '</td><td class="n">' + cell(r.a) + '</td></tr>';
      });
      if (rows.length > 1) body += '<tr class="wk-sub"><td colspan="2">Total ' + esc(c[1].replace('Selección ', '').toLowerCase()) + '</td><td class="n">' + cell(sub.p) + '</td><td class="n">' + cell(sub.g) + '</td><td class="n">' + cell(sub.a) + '</td></tr>';
    });
    if (!any) return '<div class="card"><p class="mut">Todavía no hay partidos con la selección.</p></div>';
    body += '<tr class="wk-tot"><td colspan="3">Total con la selección</td><td class="n">' + cell(all.p) + '</td><td class="n">' + cell(all.g) + '</td><td class="n">' + cell(all.a) + '</td></tr>';
    return '<div class="card wk-card"><div class="tw"><table class="wk"><thead><tr><th>Categoría</th><th>Año</th><th>Competición</th><th class="n">PJ</th><th class="n">G</th><th class="n">A</th></tr></thead><tbody>' + body + '</tbody></table></div></div>';
  }

  var career0 = SC.career;
  SC.career = function () {
    var html = career0.apply(this, arguments);
    if (!ST.seasons().length) return html;
    var tab = UI.tab.crw || 'clubs';
    return html + '<div class="hd" style="margin:1.2rem 0 .5rem"><h3>' + I('list') + 'Estadísticas de carrera</h3></div><div style="margin-bottom:.7rem">' + seg('crw', [['clubs', 'Clubes', 'shield'], ['nat', 'Selección', 'flag']], tab) + '</div>' + (tab === 'nat' ? natTable() : clubsTable());
  };
})();
