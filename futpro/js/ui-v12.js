/* FUTPRO — pantallas Resumen de temporada y Metas (metas de la temporada y logros de carrera). Solo presentación: js/season.js. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, A = UI.acts, SC = UI.screens, I = UI.icon, G = FP.Season, hdr = UI.hdr, seg = UI.seg;
  function pill(t, c) { return '<span class="pill ' + (c || '') + '">' + t + '</span>'; }
  function bar(v, max, cls) { return UI.bar(Math.max(0, Math.min(100, max ? v / max * 100 : 0)), 100, cls || ''); }
  function rate(v) { var c = v >= 7.5 ? 'r-top' : v >= 6.8 ? 'r-good' : v >= 6 ? 'r-mid' : v > 0 ? 'r-low' : ''; return '<span class="rate ' + c + '">' + (v ? v.toFixed(1) : '—') + '</span>'; }

  SC.review = function () {
    var h = FP.S.hero; G.ensure(); h.rv.seen = h.rv.list.length ? h.rv.list[0].w : 0;
    var html = hdr('history', 'Resumen de temporada', 'Cómo te fue cada año');
    if (!h.rv.list.length) return html + '<div class="card"><p class="mut">Todavía no terminó ninguna temporada. Cuando termine, aquí verás un resumen con tus números, lesiones, decisiones y metas.</p></div>';
    return html + h.rv.list.map(function (r, i) {
      var d = r.ovr1 - r.ovr0, g = r.goals;
      return '<div class="card scard"><div class="sc-h"><div class="sc-id"><div><div class="sc-y">' + esc(r.y) + '</div><div class="sc-t ell">' + esc(r.club) + (r.rank ? ' · ' + (r.rank.ch ? 'Campeón' : r.rank.pos + '.º de ' + r.rank.n) : '') + '</div></div></div><div class="sc-sum">' + pill(esc(r.head), r.head === 'Año difícil' ? 'r' : r.head === 'Temporada irregular' ? 'y' : 'g') + '<span class="chip"><b>' + r.ap + '</b> PJ</span><span class="chip"><b>' + r.g + '</b> G</span><span class="chip"><b>' + r.a + '</b> A</span>' + rate(r.rt) + '<span class="chip">Media <b>' + r.ovr1 + '</b> ' + (d ? '<span class="' + (d > 0 ? 'ok' : 'bad') + '">' + (d > 0 ? '+' : '') + d + '</span>' : '') + '</span></div></div>' +
        '<div style="padding:.8rem 1rem">' + r.text.map(function (t) { return '<p style="margin:.35rem 0">' + esc(t) + '</p>'; }).join('') +
        (g ? '<h4 style="margin-top:.8rem">Metas de la temporada · ' + g.done + ' de ' + g.n + '</h4>' + g.items.map(function (x) { return '<div class="row sp sm"><span>' + (x.ok ? I('check') : '') + ' ' + esc(x.nm) + '</span>' + pill(x.ok ? 'Cumplida' : 'No cumplida', x.ok ? 'g' : '') + '</div>'; }).join('') : '') + '</div></div>';
    }).join('');
  };

  SC.goals = function () {
    var h = FP.S.hero; G.ensure(); var tab = UI.tab.goals || 'season', gs = h.gl.season;
    var html = hdr('target', 'Metas', 'Objetivos de la temporada y logros de tu carrera', seg('goals', [['season', 'Esta temporada', 'target'], ['ach', 'Logros', 'medal']], tab));
    if (tab === 'ach') {
      var done = G.ACH.filter(function (a) { return h.gl.ach[a.id]; }).length;
      html += '<div class="notice">' + done + ' de ' + G.ACH.length + ' logros desbloqueados. Cada logro da un empujón de moral y de fama.</div><div class="grid g2">' + G.ACH.map(function (a) {
        var got = h.gl.ach[a.id], p = a.p ? a.p(h) : null;
        return '<div class="card" style="margin:0;' + (got ? 'border-color:var(--ac)' : 'opacity:.85') + '"><div class="hd"><h3>' + (got ? I('medal') : I('lock')) + esc(a.nm) + '</h3>' + (got ? pill(esc(D.fmt(got)), 'g') : '') + '</div><p class="mut sm">' + esc(a.d) + '</p>' + (!got && p ? '<div class="mut sm">' + Math.round(p[0]) + ' / ' + p[1] + '</div>' + bar(p[0], p[1]) : '') + '</div>';
      }).join('') + '</div>';
      return html;
    }
    html += '<div class="card"><div class="hd"><h3>' + I('target') + 'Metas de ' + esc(gs.y) + '</h3>' + pill('Al final de la temporada: moral y fama por cada meta', '') + '</div>' + gs.items.map(function (it) {
      var p = G.progress(it);
      return '<div style="padding:.5rem 0;border-top:1px solid var(--line)"><div class="row sp"><b>' + esc(it.nm) + '</b>' + (p.ok ? pill('En camino / cumplida', 'g') : pill('Pendiente', '')) + '</div>' + (p.flag ? '<div class="mut sm">' + (p.ok ? 'Sin lesiones graves por ahora.' : 'Ya tuviste una lesión larga: la meta se perdió.') + '</div>' : '<div class="mut sm">' + (p.dec ? (p.v ? p.v.toFixed(2) : '—') : Math.round(p.v)) + ' / ' + (p.dec ? it.t.toFixed(1) : it.t) + '</div>' + bar(p.dec ? Math.min(p.v, it.t) : p.v, it.t, p.ok ? '' : 'y')) + '</div>';
    }).join('') + '</div>';
    var last = h.rv.list[0]; if (last && last.goals) html += '<div class="card"><div class="hd"><h3>' + I('history') + 'Temporada anterior (' + esc(last.y) + ')</h3>' + pill(last.goals.done + ' de ' + last.goals.n, last.goals.done === last.goals.n ? 'g' : '') + '</div>' + last.goals.items.map(function (x) { return '<div class="row sp sm"><span>' + esc(x.nm) + '</span>' + pill(x.ok ? 'Cumplida' : 'No cumplida', x.ok ? 'g' : '') + '</div>'; }).join('') + '</div>';
    return html;
  };

  var home0 = SC.home;
  SC.home = function () {
    var h = FP.S.hero, html = home0.apply(this, arguments);
    if (!h.rv || !h.rv.list.length || h.retired) return html;
    var r = h.rv.list[0]; if (h.rv.seen >= r.w) return html;
    return '<div class="card glass" style="margin-bottom:.8rem"><div class="hd"><h3>' + I('history') + 'Terminó la temporada ' + esc(r.y) + ': ' + esc(r.head) + '</h3></div><p class="mut">' + esc(r.text[0]) + '</p><button class="btn pri" data-act="nav" data-s="review">Ver resumen</button></div>' + html;
  };
  var gr = UI.GROUPS[0][1]; gr.splice(3, 0, ['review', 'Resumen de temporada', 'history'], ['goals', 'Metas', 'target']);
})();
