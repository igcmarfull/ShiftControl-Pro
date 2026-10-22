/* FUTPRO — interfaz: clasificación de la competición en la pantalla «Partido» (antes de jugar y al terminar).
   Marca a tu equipo y a su rival, muestra la forma reciente de ambos y, si hay muchos equipos, recorta alrededor de los dos. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, UI = FP.UI, esc = U.esc, SC = UI.screens, Comp = FP.Comp;
  var match0 = SC.match;

  // forma reciente de un club en esa competición (letras V/E/D, la más reciente a la derecha)
  function form(comp, id) {
    var out = []; (comp.fx || []).forEach(function (f) { if (f.d && (f.h === id || f.a === id) && f.hs != null) { var m = f.h === id ? f.hs - f.as : f.as - f.hs; out.push(m > 0 ? 'V' : m < 0 ? 'D' : 'E'); } });
    return out.slice(-5);
  }
  function dots(arr) { return arr.map(function (r) { return '<i class="fd ' + r + '">' + r + '</i>'; }).join(''); }

  UI.matchTable = function (comp, f) {
    if (!comp || !comp.tb || !Object.keys(comp.tb).length || (comp.ko && !comp.stages)) return '';
    var rows = Comp.rows(comp); if (rows.length < 3) return '';
    var me = FP.S.hero.team != null ? FP.S.hero.team : FP.S.hero.club, opp = f ? (f.h === me ? f.a : f.h) : -1;
    // tablas largas: se muestran los primeros, el entorno de tu equipo y de su rival y los últimos
    var keep = {}, N = rows.length;
    if (N > 22) { rows.forEach(function (r, i) { if (i < 3 || i >= N - 3 || r.id === me || r.id === opp || Math.abs(i - rows.map(function (x) { return x.id; }).indexOf(me)) <= 1 || Math.abs(i - rows.map(function (x) { return x.id; }).indexOf(opp)) <= 1) keep[r.id] = 1; }); }
    var h = '<div class="card"><div class="hd"><h3>' + (UI.icon ? '' : '') + 'Clasificación</h3><a class="more" data-act="nav" data-s="tables">Ver completa</a></div>' +
      '<div class="mt-wrap"><table class="mtab"><thead><tr><th>#</th><th>Club</th><th class="n">PJ</th><th class="n">G</th><th class="n">E</th><th class="n">P</th><th class="n">DG</th><th class="n">Pts</th><th>Forma</th></tr></thead><tbody>', last = -1;
    rows.forEach(function (r, i) {
      if (N > 22 && !keep[r.id]) return;
      if (last >= 0 && i - last > 1) h += '<tr class="gap"><td colspan="9">···</td></tr>';
      last = i;
      var cls = r.id === me ? 'me' : r.id === opp ? 'opp' : '';
      h += '<tr class="' + cls + '"><td>' + r.pos + '</td><td><span class="mt-club">' + (UI.crest ? UI.crest(r.id) : '') + UI.club(r.id) + (r.id === me ? ' <span class="tag">Tú</span>' : r.id === opp ? ' <span class="tag">Rival</span>' : '') + '</span></td><td class="n">' + r.p + '</td><td class="n">' + r.w + '</td><td class="n">' + r.d + '</td><td class="n">' + r.l + '</td><td class="n">' + (r.gd > 0 ? '+' : '') + r.gd + '</td><td class="n"><b>' + r.pts + '</b></td><td>' + ((r.id === me || r.id === opp) ? dots(form(comp, r.id)) : '') + '</td></tr>';
    });
    return h + '</tbody></table></div></div>';
  };

  SC.match = function () {
    var base = match0.apply(this, arguments), mt = UI.mt;
    try { if (mt && mt.prep && (mt.phase === 'pre' || mt.phase === 'done')) return base + UI.matchTable(mt.prep.comp, mt.prep.f); } catch (e) { if (window.console) console.warn('tabla del partido', e); }
    return base;
  };
})();
