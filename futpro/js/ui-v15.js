/* FUTPRO — Estadísticas → Por temporada: vistas alternativas (Tabla, Línea de tiempo, Panorama). Solo presentación sobre los datos de ui-v9. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, UI = FP.UI, esc = U.esc, I = UI.icon, ST = FP.Stats;
  var VIEWS = [['cards', 'Tarjetas', 'list'], ['table', 'Tabla', 'chart'], ['time', 'Línea de tiempo', 'history'], ['pano', 'Panorama', 'target']];
  var CLSN = { liga: 'Liga', copa: 'Copa', cont: 'Internacional', juv: 'Juvenil', amat: 'Amateur', amis: 'Amistosos', u15: 'Sub-15', u17: 'Sub-17', u20: 'Sub-20', u23: 'Sub-23', abs: 'Selección' };

  UI.stViewBar = function (mode) {
    return '<div class="fbar" style="margin-top:.3rem"><span class="mut sm" style="margin-right:.4rem">Vista</span><div class="seg">' + VIEWS.map(function (v) { return '<button class="' + (mode === v[0] ? 'on' : '') + '" data-act="tabset" data-s="stv" data-t="' + v[0] + '">' + v[1] + '</button>'; }).join('') + '</div></div>';
  };

  function crestOf(t, s0) { var S = FP.S; if (t != null && t >= 5000 && t < 20000 && S.nat[t - 5000]) return UI.flag(S.nat[t - 5000].c); return t != null && t < 5000 ? UI.crest(t, 'sm') : '<span class="vt-ini">' + esc((s0 || '?').replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g, '').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase()) + '</span>'; }
  function nameOf(s) { return s.t != null && s.t < 5000 ? esc(C.tname(s.t)) : esc(s.tn); }
  function rv(t) { return t.rn ? t.rs / t.rn : 0; }
  function rcls(v) { return v >= 7.5 ? 'r-top' : v >= 6.8 ? 'r-good' : v >= 6.0 ? 'r-mid' : v > 0 ? 'r-low' : ''; }
  function rate(v) { return v ? '<span class="rate ' + rcls(v) + '">' + v.toFixed(1) + '</span>' : '<span class="rate">—</span>'; }
  function starts(rows) { return rows.reduce(function (a, r) { return a + (r.st || 0); }, 0); }
  function main(s) { return s.rows.filter(function (r) { return r.k !== 'amis'; }).sort(function (a, b) { return ST.ORDER.indexOf(a.k) - ST.ORDER.indexOf(b.k) || b.p - a.p; }); }
  function tags(s, best) { return (best.rate === s ? '<span class="tag-best">' + I('star') + 'Mejor nota</span>' : '') + (best.goals === s && s.tot.g > 0 ? '<span class="tag-best g">' + I('target') + 'Más goles</span>' : ''); }
  function compPills(s) { return main(s).map(function (r) { return '<span class="vc-pill"><b>' + esc(CLSN[r.k] || r.k) + '</b> ' + esc(r.c) + ' <i>' + r.p + ' PJ · ' + r.g + ' G · ' + r.a + ' A</i></span>'; }).join(''); }

  UI.stViews = {
    // ---- tabla compacta: una fila por temporada y club ----
    table: function (list, best) {
      var mxg = Math.max.apply(null, list.map(function (s) { return ST.sum(s.rows).g; }).concat([1]));
      var tt = ST.sum([].concat.apply([], list.map(function (s) { return s.rows; })));
      var body = list.map(function (s) {
        var t = ST.sum(s.rows), pct = t.p ? Math.round(starts(s.rows) / t.p * 100) : 0;
        return '<tr><td><b class="vt-y">' + esc(s.s) + '</b></td><td><div class="vt-c">' + crestOf(s.t, s.tn) + '<div><div class="ell">' + nameOf(s) + '</div><div class="vt-sub ell">' + esc(main(s).map(function (r) { return r.c; }).slice(0, 2).join(' · ')) + '</div></div></div></td>' +
          '<td class="n">' + t.p + '</td><td class="n"><div class="vt-g"><b>' + t.g + '</b><i style="width:' + Math.round(t.g / mxg * 100) + '%"></i></div></td><td class="n">' + t.a + '</td><td class="n">' + rate(rv(t)) + '</td><td class="n mut">' + t.min.toLocaleString('es-CL') + '\'</td><td class="n"><div class="vt-b" title="' + pct + '% titular"><i style="width:' + pct + '%"></i></div></td><td>' + tags(s, best) + '</td></tr>';
      }).join('');
      return '<div class="card vt-card"><div class="vt-wrap"><table class="vt"><thead><tr><th>Año</th><th>Club</th><th class="n">PJ</th><th class="n">Goles</th><th class="n">Asist.</th><th class="n">Nota</th><th class="n">Minutos</th><th class="n">Titular</th><th></th></tr></thead><tbody>' + body + '</tbody>' +
        '<tfoot><tr><td></td><td><b>Total de carrera</b></td><td class="n"><b>' + tt.p + '</b></td><td class="n"><b>' + tt.g + '</b></td><td class="n"><b>' + tt.a + '</b></td><td class="n">' + rate(rv(tt)) + '</td><td class="n mut">' + tt.min.toLocaleString('es-CL') + '\'</td><td></td><td></td></tr></tfoot></table></div></div>';
    },
    // ---- línea de tiempo vertical ----
    time: function (list, best) {
      return '<div class="vtl">' + list.map(function (s) {
        var t = ST.sum(s.rows), v = rv(t);
        return '<div class="vtl-i"><div class="vtl-dot">' + crestOf(s.t, s.tn) + '</div><div class="card vtl-c"><div class="row sp"><div><div class="vtl-y">' + esc(s.s) + '</div><div class="vtl-t">' + nameOf(s) + '</div></div><div>' + tags(s, best) + '</div></div>' +
          '<div class="vtl-n"><div><b>' + t.p + '</b><span>Partidos</span></div><div><b class="gn">' + t.g + '</b><span>Goles</span></div><div><b class="bl">' + t.a + '</b><span>Asist.</span></div><div>' + rate(v).replace('class="rate', 'class="rate lg') + '<span>Nota</span></div><div><b>' + t.min.toLocaleString('es-CL') + '</b><span>Minutos</span></div></div>' +
          '<div class="vc-pills">' + compPills(s) + '</div></div></div>';
      }).join('') + '</div>';
    },
    // ---- panorama: gráfico + resumen por club ----
    pano: function (list, best) {
      var yy = {}, ch = []; list.slice().sort(function (a, b) { return a.o - b.o; }).forEach(function (s) { var k = String(s.s).slice(0, 4); if (!yy[k]) { yy[k] = { s: k, rows: [] }; ch.push(yy[k]); } yy[k].rows = yy[k].rows.concat(s.rows); });
      var W = 760, H = 210, pl = 30, pb = 34, n = ch.length, bw = Math.min(26, (W - pl - 10) / Math.max(1, n) / 2.6), step = (W - pl - 10) / Math.max(1, n);
      var vals = ch.map(function (s) { var t = ST.sum(s.rows); return { g: t.g, a: t.a, r: rv(t), s: s }; }), mx = Math.max.apply(null, vals.map(function (v) { return Math.max(v.g, v.a); }).concat([3]));
      var y = function (v) { return H - pb - v / mx * (H - pb - 14); }, yr = function (r) { return H - pb - (Math.min(9, Math.max(5, r)) - 5) / 4 * (H - pb - 14); };
      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="vp-svg" role="img" aria-label="Goles, asistencias y nota por temporada">';
      [0, 0.5, 1].forEach(function (f) { var yy = y(mx * f); svg += '<line x1="' + pl + '" x2="' + (W - 6) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--line)"/><text x="' + (pl - 6) + '" y="' + (yy + 4) + '" text-anchor="end" class="vp-ax">' + Math.round(mx * f) + '</text>'; });
      var pts = [];
      vals.forEach(function (v, i) {
        var cx = pl + step * (i + 0.5);
        svg += '<rect x="' + (cx - bw - 1) + '" y="' + y(v.g) + '" width="' + bw + '" height="' + (H - pb - y(v.g)) + '" rx="3" fill="var(--ac)"/><rect x="' + (cx + 1) + '" y="' + y(v.a) + '" width="' + bw + '" height="' + (H - pb - y(v.a)) + '" rx="3" fill="var(--blue)"/>';
        svg += '<text x="' + cx + '" y="' + (H - 18) + '" text-anchor="middle" class="vp-ax">' + esc(v.s.s) + '</text>';
        if (v.r) pts.push([cx, yr(v.r)]);
      });
      if (pts.length > 1) svg += '<path d="' + pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('') + '" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linejoin="round"/>';
      pts.forEach(function (p) { svg += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="var(--gold)"/>'; });
      svg += '</svg>';
      var clubs = {}, order = [];
      list.forEach(function (s) { var k = s.t != null ? 't' + s.t : 'n' + s.tn; if (!clubs[k]) { clubs[k] = { s: s, rows: [], y: [] }; order.push(k); } clubs[k].rows = clubs[k].rows.concat(s.rows); clubs[k].y.push(String(s.s).slice(0, 4)); });
      var cards = order.map(function (k) {
        var c = clubs[k], t = ST.sum(c.rows), ys = c.y.slice().sort();
        return '<div class="vp-club"><div class="vp-ch">' + crestOf(c.s.t, c.s.tn) + '<div><div class="vp-cn ell">' + nameOf(c.s) + '</div><div class="mut sm">' + ys[0] + (ys[ys.length - 1] !== ys[0] ? '–' + ys[ys.length - 1] : '') + '</div></div></div><div class="vp-cs"><div><b>' + t.p + '</b><span>PJ</span></div><div><b class="gn">' + t.g + '</b><span>G</span></div><div><b class="bl">' + t.a + '</b><span>A</span></div><div>' + rate(rv(t)) + '<span>Nota</span></div></div></div>';
      }).join('');
      return '<div class="card"><div class="row sp"><h3>Evolución por temporada</h3><div class="vp-leg"><i style="background:var(--ac)"></i>Goles <i style="background:var(--blue)"></i>Asistencias <i style="background:var(--gold)"></i>Nota</div></div>' + svg + '</div>' +
        '<h4 style="margin:1rem 0 .5rem">Por club</h4><div class="vp-grid">' + cards + '</div>';
    }
  };
})();
