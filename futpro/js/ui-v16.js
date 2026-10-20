/* FUTPRO — Resumen de temporada rediseñado: cabecera con club y puesto, indicadores, momentos destacados y metas. Solo presentación sobre h.rv (js/season.js). */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, SC = UI.screens, I = UI.icon, G = FP.Season, hdr = UI.hdr;
  function rcls(v) { return v >= 7.5 ? 'r-top' : v >= 6.8 ? 'r-good' : v >= 6 ? 'r-mid' : v > 0 ? 'r-low' : ''; }
  function tile(l, v, cls, sub) { return '<div class="rv-t"><span>' + l + '</span><b class="' + (cls || '') + '">' + v + '</b>' + (sub ? '<i>' + sub + '</i>' : '') + '</div>'; }
  function hl(ic, tone, ttl, body) { return '<div class="rv-h ' + tone + '"><div class="rv-hi">' + I(ic) + '</div><div><div class="rv-ht">' + ttl + '</div><div class="rv-hb">' + body + '</div></div></div>'; }
  function clubBase(n) { return String(n || '').replace(/\s*\((juv\.|cedido)\)\s*$/i, ''); }
  function chart(list) {
    var pts = list.slice().reverse().map(function (r) { return r.ovr1; }); if (pts.length < 2) return '';
    var W = 520, H = 70, mn = Math.min.apply(null, pts) - 2, mx = Math.max.apply(null, pts) + 2;
    var d = pts.map(function (v, i) { return (i ? 'L' : 'M') + (6 + i / (pts.length - 1) * (W - 12)).toFixed(1) + ' ' + (H - 8 - (v - mn) / (mx - mn) * (H - 16)).toFixed(1); }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="rv-sp"><path d="' + d + 'L' + (W - 6) + ' ' + H + 'L6 ' + H + 'z" fill="rgba(47,191,113,.13)"/><path d="' + d + '" fill="none" stroke="var(--ac)" stroke-width="2.4" stroke-linejoin="round"/></svg>';
  }

  SC.review = function () {
    var h = FP.S.hero; G.ensure(); h.rv.seen = h.rv.list.length ? h.rv.list[0].w : 0;
    var html = hdr('history', 'Resumen de temporada', 'Cómo te fue cada año');
    var L = h.rv.list;
    if (!L.length) return html + '<div class="card"><p class="mut">Todavía no terminó ninguna temporada. Cuando termine, aquí verás un resumen con tus números, lesiones, decisiones y metas.</p></div>';
    var tot = L.reduce(function (a, r) { a.ap += r.ap; a.g += r.g; a.a += r.a; a.t += r.trophies.length; return a; }, { ap: 0, g: 0, a: 0, t: 0 });
    html += '<div class="card rv-top"><div class="rv-tl"><div><div class="rv-k">Tu carrera en números</div><div class="rv-tn"><span><b>' + L.length + '</b> temporadas</span><span><b>' + tot.ap + '</b> partidos</span><span><b>' + tot.g + '</b> goles</span><span><b>' + tot.a + '</b> asist.</span><span><b>' + tot.t + '</b> títulos</span></div></div><div class="rv-spw"><div class="rv-k">Evolución de tu media</div>' + chart(L) + '</div></div></div>';
    return html + L.map(function (r) {
      var d = r.ovr1 - r.ovr0, tone = r.head === 'Año difícil' ? 'r' : r.head === 'Temporada irregular' || r.head === 'Año de poco protagonismo' ? 'y' : 'g';
      var rk = r.rank ? (r.rank.ch ? '<span class="rv-rk gold">' + I('trophy') + ' Campeón</span>' : '<span class="rv-rk">' + r.rank.pos + '.º de ' + r.rank.n + '</span>') : '';
      var hs = [];
      if (r.trophies.length) hs.push(hl('trophy', 'gold', 'Títulos', esc(r.trophies.slice(0, 3).join(' · '))));
      if (r.awards.length) hs.push(hl('medal', 'gold', 'Premios', esc(r.awards.slice(0, 3).join(' · '))));
      if (r.best) hs.push(hl('star', 'g', 'Mejor partido', esc(r.best.c) + ' · ' + esc(r.best.s) + ' vs ' + esc(r.best.o != null ? C.tname(r.best.o) : 'rival') + ' <span class="rate ' + rcls(r.best.rt) + '">' + r.best.rt.toFixed(1) + '</span>'));
      if (r.goal) hs.push(hl('ball', 'g', r.goal.g + ' goles en un partido', esc(r.goal.c) + ' · ' + esc(r.goal.s)));
      if (r.caps > 0) hs.push(hl('flag', 'b', 'Selección', r.caps + (r.caps === 1 ? ' partido' : ' partidos') + ' con tu país'));
      if (r.inj.length) hs.push(hl('inj', 'r', 'Lesiones', r.inj.reduce(function (s, e) { return s + e.n; }, 0) + ' semanas fuera · ' + esc(r.inj.map(function (e) { return e.nm.toLowerCase(); }).slice(0, 2).join(', '))));
      if (r.moves.length) hs.push(hl('sub', 'b', 'Movimientos', esc(r.moves.slice(0, 2).join(' · '))));
      if (r.dec.length) hs.push(hl('bell', 'y', 'Decisiones', esc(r.dec.slice(0, 2).join(' · '))));
      var g = r.goals;
      return '<div class="card scard rv-c"><div class="rv-hd"><div class="rv-id">' + UI.crestName(clubBase(r.club), 'lg') + '<div><div class="rv-y">' + esc(r.y) + '</div><div class="rv-cl ell">' + esc(r.club) + ' · ' + r.age + ' años</div></div></div><div class="rv-bd">' + rk + '<span class="pill ' + tone + '">' + esc(r.head) + '</span></div></div>' +
        '<div class="rv-tiles">' + tile('Partidos', r.ap) + tile('Goles', r.g, 'gn') + tile('Asist.', r.a, 'bl') + tile('Nota', r.rt ? '<span class="rate ' + rcls(r.rt) + '">' + r.rt.toFixed(1) + '</span>' : '—') + tile('Minutos', FP.fmt.num(r.min)) + tile('Media', r.ovr1, d > 0 ? 'gn' : d < 0 ? 'rd' : '', (d > 0 ? '▲ +' : d < 0 ? '▼ ' : '= ') + d) + '</div>' +
        (hs.length ? '<div class="rv-hg">' + hs.join('') + '</div>' : '') +
        (g ? '<div class="rv-goals"><div class="rv-gh"><b>Metas de la temporada</b><span class="pill ' + (g.done === g.n ? 'g' : '') + '">' + g.done + ' de ' + g.n + '</span></div><div class="rv-gl">' + g.items.map(function (x) { return '<span class="rv-gc ' + (x.ok ? 'ok' : '') + '">' + (x.ok ? I('check') : '') + esc(x.nm) + '</span>'; }).join('') + '</div></div>' : '') +
        '<details class="rv-story"><summary>Leer el relato</summary>' + r.text.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</details></div>';
    }).join('');
  };

  // Mi club (cantera): convocatorias al primer equipo (js/callups.js)
  var club0 = SC.club;
  SC.club = function () {
    var h = FP.S.hero, html = club0.apply(this, arguments);
    if (!FP.Callup || h.tk !== 'academy' || h.club == null) return html;
    var cu = FP.Callup.ensure(), st = FP.Callup.standing(), club = FP.S.clubs[h.club], age = FP.Hero.age();
    var near = Math.max(0, Math.min(100, Math.round((st.d + 14) / 14 * 100)));
    var state = cu.on ? '<span class="pill g">Entrenando con el primer equipo</span>' : age < FP.Callup.MIN_AGE ? '<span class="pill">Desde los ' + FP.Callup.MIN_AGE + ' años</span>' : st.d < 0 ? '<span class="pill">Aún lejos del nivel</span>' : '<span class="pill y">En el radar del entrenador</span>';
    var card = '<div class="card"><div class="hd"><h3>' + I('flag') + 'Primer equipo de ' + esc(club.nm) + '</h3>' + state + '</div>' +
      '<p class="mut sm">Los juveniles que destacan son citados unas semanas a entrenar con los profesionales (más desarrollo y moral) y a veces entran en la lista de los partidos del primer equipo, casi siempre como suplentes. Sirve con contrato juvenil o profesional; el ascenso definitivo exige contrato profesional y nivel cercano al plantel.</p>' +
      '<div class="rv-tiles" style="padding:.4rem 0;grid-template-columns:repeat(4,1fr)">' + tile('Citaciones', cu.n || 0) + tile('Partidos', cu.ap || 0, 'gn') + tile('Minutos', cu.min || 0) + tile('Debut', cu.debut ? esc(D.fmt(cu.debut.w)) : '—') + '</div>' +
      '<div class="mut sm" style="margin:.4rem 0 .2rem">Cercanía al nivel del plantel (' + Math.round(st.eff) + ' tuyo vs ' + club.st + ' del club)</div>' + UI.bar(near, 100, near >= 70 ? 'g' : near >= 35 ? 'y' : '') + '</div>';
    return card + html;
  };
})();
