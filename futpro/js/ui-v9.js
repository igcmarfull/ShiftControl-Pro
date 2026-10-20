/* FUTPRO — Estadísticas → Mis estadísticas (por temporada) rediseñadas: resumen de carrera, filtros,
   tarjetas por temporada con competición principal destacada, notas con color y barra de titularidad.
   Solo presentación: usa FP.Stats sin modificar el registro. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, UI = FP.UI, esc = U.esc, A = UI.acts, SC = UI.screens, I = UI.icon, ST = FP.Stats, hdr = UI.hdr, seg = UI.seg;

  var CLS = { liga: ['Liga', 'g'], copa: ['Copa', 'b'], cont: ['Internacional', 'b'], juv: ['Juvenil', 'g'], amat: ['Amateur', ''], amis: ['Amistoso', 'dim'], u15: ['Sub-15', 'y'], u17: ['Sub-17', 'y'], u20: ['Sub-20', 'y'], u23: ['Sub-23', 'y'], abs: ['Selección', 'y'] };
  function rateCls(v) { return v >= 7.5 ? 'r-top' : v >= 6.8 ? 'r-good' : v >= 6.0 ? 'r-mid' : v > 0 ? 'r-low' : ''; }
  function rate(r) { var v = r.rn ? r.rs / r.rn : 0; return v ? '<span class="rate ' + rateCls(v) + '">' + v.toFixed(1) + '</span>' : '<span class="rate">—</span>'; }
  function badge(k) { var c = CLS[k] || ['', '']; return '<span class="cls-b ' + c[1] + '">' + c[0] + '</span>'; }
  function crestOf(t) {
    var S = FP.S;
    if (t != null && t >= 5000 && t < 20000 && S.nat[t - 5000]) return UI.flag(S.nat[t - 5000].c);
    return t != null && t < 5000 ? UI.crest(t, 'lg') : '';
  }
  function nameOf(s) { return s.t != null && s.t < 5000 ? esc(C.tname(s.t)) : esc(s.tn); }
  function spark(vals) {
    if (vals.length < 2) return '';
    var mx = Math.max.apply(null, vals) || 1, w = 6, g = 3, h = 26;
    return '<svg class="spark" viewBox="0 0 ' + (vals.length * (w + g)) + ' ' + h + '" height="' + h + '" aria-hidden="true">' + vals.map(function (v, i) { var bh = Math.max(2, v / mx * (h - 2)); return '<rect x="' + (i * (w + g)) + '" y="' + (h - bh) + '" width="' + w + '" height="' + bh + '" rx="1.5"/>'; }).join('') + '</svg>';
  }
  function row(r, dim) {
    var pct = r.p ? Math.round(r.st / r.p * 100) : 0, comp = esc(r.c);
    return '<div class="srow' + (dim ? ' dim' : '') + '"><div class="sr-main">' + badge(r.k) + '<span class="sr-c ell" title="' + comp + '">' + comp + '</span></div>' +
      '<div class="sr-nums"><div title="Partidos"><b>' + r.p + '</b><span>PJ</span></div><div title="Goles"><b>' + r.g + '</b><span>G</span></div><div title="Asistencias"><b>' + r.a + '</b><span>A</span></div><div class="sr-min" title="' + r.st + ' titular · ' + (r.p - r.st) + ' suplente · ' + r.min + ' minutos"><div class="mbar"><i style="width:' + pct + '%"></i></div><span>' + pct + '% titular · ' + r.min + '′</span></div>' + rate(r) + '</div></div>';
  }
  function seasonCard(s, best) {
    var main = s.rows.filter(function (r) { return r.k !== 'amis'; }), fr = s.rows.filter(function (r) { return r.k === 'amis'; });
    var order = ST.ORDER; main.sort(function (a, b) { return order.indexOf(a.k) - order.indexOf(b.k) || b.p - a.p; });
    var t = ST.sum(s.rows), tags = '';
    if (best.rate === s) tags += '<span class="tag-best">' + I('star') + 'Mejor nota</span>';
    if (best.goals === s && s.tot.g > 0) tags += '<span class="tag-best g">' + I('target') + 'Más goles</span>';
    return '<div class="card scard"><div class="sc-h"><div class="sc-id">' + crestOf(s.t) + '<div><div class="sc-y">' + esc(s.s) + '</div><div class="sc-t ell">' + nameOf(s) + '</div></div></div><div class="sc-sum">' + tags +
      '<span class="chip"><b>' + t.p + '</b> PJ</span><span class="chip"><b>' + t.g + '</b> G</span><span class="chip"><b>' + t.a + '</b> A</span>' + rate(t) + '</div></div><div class="sc-rows">' + main.map(function (r) { return row(r, false); }).join('') + fr.map(function (r) { return row(r, true); }).join('') + '</div></div>';
  }
  function view() {
    var f = UI.filt.stf || 'all', all = ST.seasons();
    if (!all.length) return '<div class="card"><p class="mut">Todavía no hay partidos registrados. Cada partido que dispute quedará asociado a su club, temporada y competición.</p></div>';
    var rows = ST.rows(), tot = ST.sum(rows.filter(function (r) { return !ST.isNT(r.k) || true; }));
    var club = ST.sum(rows.filter(function (r) { return !ST.isNT(r.k); })), nt = ST.sum(rows.filter(function (r) { return ST.isNT(r.k); }));
    var seasons = all.slice().sort(function (a, b) { return a.o - b.o; }).filter(function (s) { return s.tot.p || s.rows.some(function (r) { return r.p; }); });
    var byYear = {}; seasons.forEach(function (s) { var y = String(s.s).slice(0, 4); byYear[y] = (byYear[y] || 0) + s.rows.reduce(function (a, r) { return a + r.g; }, 0); });
    var gy = Object.keys(byYear).sort().map(function (y) { return byYear[y]; });
    var html = '<div class="kpis">' +
      kpi('Partidos', tot.p, club.p + ' club · ' + nt.p + ' selección') + kpi('Goles', tot.g, tot.p ? (tot.g / tot.p).toFixed(2) + ' por partido' : '', spark(gy)) + kpi('Asistencias', tot.a, '') +
      kpi('Nota media', tot.rn ? '<span class="rate lg ' + rateCls(tot.rs / tot.rn) + '">' + (tot.rs / tot.rn).toFixed(2) + '</span>' : '—', '') + kpi('Minutos', tot.min.toLocaleString('es-CL'), Math.round(tot.min / 90) + ' partidos completos') + '</div>';
    html += '<div class="fbar"><div class="seg">' + [['all', 'Todo'], ['club', 'Solo clubes'], ['nt', 'Selecciones'], ['noamis', 'Sin amistosos']].map(function (o) { return '<button class="' + (f === o[0] ? 'on' : '') + '" data-act="stfilt" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
    var list = all.map(function (s) {
      var rs = s.rows.filter(function (r) { return f === 'club' ? !ST.isNT(r.k) : f === 'nt' ? ST.isNT(r.k) : f === 'noamis' ? r.k !== 'amis' : true; });
      return rs.length ? { s: s.s, t: s.t, tn: s.tn, o: s.o, rows: rs, tot: ST.sum(rs.filter(function (r) { return !ST.isNT(r.k); })) } : null;
    }).filter(Boolean);
    var best = { rate: null, goals: null }, br = 0, bg = 0;
    list.forEach(function (s) { var t = ST.sum(s.rows); if (t.p >= 10 && t.rn && t.rs / t.rn > br && !ST.isNT(s.rows[0].k)) { br = t.rs / t.rn; best.rate = s; } var g = s.tot.g; if (g > bg) { bg = g; best.goals = s; } });
    html += list.length ? list.map(function (s) { return seasonCard(s, best); }).join('') : '<div class="card"><p class="mut">Sin registros con este filtro.</p></div>';
    return html;
  }
  function kpi(l, v, sub, extra) { return '<div class="kpi-c"><span class="kl">' + l + '</span><b class="kv">' + v + '</b>' + (sub ? '<span class="ks">' + sub + '</span>' : '') + (extra || '') + '</div>'; }
  A.stfilt = function (d) { UI.filt.stf = d.v; UI.render(); };

  var stats0 = SC.stats;
  SC.stats = function () {
    var tab = UI.tab.stats || 'mine', sub = UI.tab.stm || 'season';
    if (tab !== 'mine') return stats0.apply(this, arguments);
    var head = hdr('chart', 'Estadísticas', 'Líderes, rankings y tu rendimiento', seg('stats', [['mine', 'Mis estadísticas', 'user'], ['comp', 'Competición', 'trophy'], ['pl', 'Mejores jugadores', 'star']], tab));
    if (sub === 'class') return stats0.apply(this, arguments);
    return head + '<div style="margin-bottom:.7rem">' + seg('stm', [['season', 'Por temporada', 'calendar'], ['class', 'Por clase', 'chart']], sub) + '</div>' + view();
  };
})();
