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

  UI.matchTable = function (comp, f, home) {
    if (!comp || !comp.tb || !Object.keys(comp.tb).length) return '';
    var rows = Comp.rows(comp); if (rows.length < 3) return '';
    var me = f ? (home === false ? f.a : f.h) : FP.S.hero.team, opp = f ? (f.h === me ? f.a : f.h) : -1;
    // tablas largas: se muestran los primeros, el entorno de tu equipo y de su rival y los últimos
    var keep = {}, N = rows.length;
    if (N > 22) { rows.forEach(function (r, i) { if (i < 3 || i >= N - 3 || r.id === me || r.id === opp || Math.abs(i - rows.map(function (x) { return x.id; }).indexOf(me)) <= 1 || Math.abs(i - rows.map(function (x) { return x.id; }).indexOf(opp)) <= 1) keep[r.id] = 1; }); }
    var h = '<div class="card"><div class="hd"><h3>' + (comp.kind === 'X' && !comp.ko ? 'Fase de liga' : 'Clasificación') + '</h3><a class="more" data-act="nav" data-s="tables">Ver completa</a></div>' +
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


  // ---------- grupos (torneos de selecciones y similares) ----------
  function rowsHtml(rs, me, opp, comp) {
    return rs.map(function (r) {
      var cls = r.id === me ? 'me' : r.id === opp ? 'opp' : '';
      return '<tr class="' + cls + '"><td>' + r.pos + '</td><td><span class="mt-club">' + (UI.crest ? UI.crest(r.id) : '') + UI.club(r.id) + (r.id === me ? ' <span class="tag">Tú</span>' : r.id === opp ? ' <span class="tag">Rival</span>' : '') + '</span></td><td class="n">' + r.p + '</td><td class="n">' + r.w + '</td><td class="n">' + r.d + '</td><td class="n">' + r.l + '</td><td class="n">' + (r.gd > 0 ? '+' : '') + r.gd + '</td><td class="n"><b>' + r.pts + '</b></td><td>' + ((r.id === me || r.id === opp) ? dots(form(comp, r.id)) : '') + '</td></tr>';
    }).join('');
  }
  var THEAD = '<thead><tr><th>#</th><th>Club</th><th class="n">PJ</th><th class="n">G</th><th class="n">E</th><th class="n">P</th><th class="n">DG</th><th class="n">Pts</th><th>Forma</th></tr></thead>';
  UI.matchGroup = function (comp, f, home) {
    var me = home === false ? f.a : f.h, opp = f.h === me ? f.a : f.h, gi = -1;
    (comp.groups || []).forEach(function (g, i) { if (g.indexOf(me) >= 0) gi = i; });
    if (gi < 0 || !comp.gtab || !comp.gtab[gi]) return '';
    var rs = comp.gtab[gi].slice().sort(function (a, b) { return (a.pos || 0) - (b.pos || 0); });
    return '<div class="card"><div class="hd"><h3>Grupo ' + String.fromCharCode(65 + gi) + '</h3><span class="mut sm">' + esc(comp.nm) + '</span></div><div class="mt-wrap"><table class="mtab">' + THEAD + '<tbody>' + rowsHtml(rs, me, opp, comp) + '</tbody></table></div></div>';
  };

  // ---------- eliminatorias (copas nacionales y continentales) ----------
  function score(f) { return f && f.d && f.hs != null ? f.hs + '-' + f.as + (f.ps ? ' (' + f.ps[0] + '-' + f.ps[1] + ' pen.)' : f.et ? ' (pró.)' : '') : null; }
  function tieLine(comp, t, me) {
    var a = t.a, b = t.b, legs = (t.f || []).map(function (i) { return comp.fx[i]; }).filter(Boolean), played = legs.filter(function (l) { return l.d; }).length, mine = a === me || b === me, D = FP.Date;
    var rows = legs.map(function (l, i) {
      var sc = score(l), lab = legs.length > 1 ? (i === 0 ? 'Ida' : 'Vuelta') : 'Partido';
      return '<div class="dim sm tie-res">' + lab + ': ' + (sc ? esc(FP.Core.tname(l.h)) + ' ' + esc(sc) + ' ' + esc(FP.Core.tname(l.a)) : esc(D.fmt(l.w))) + '</div>';
    }).join('');
    var aggTxt = legs.length > 1 && played ? 'Global ' + t.agg[0] + '-' + t.agg[1] : '';
    return '<div class="tie ' + (mine ? 'me' : '') + '"><div class="row sp"><span class="mt-club">' + (UI.crest ? UI.crest(a) : '') + esc(FP.Core.tname(a)) + (t.win === a ? ' ✓' : '') + '</span><span class="mut sm">' + (aggTxt || (played ? '' : 'Por jugar')) + '</span></div>' +
      '<div class="row sp" style="margin-top:.25rem"><span class="mt-club">' + (UI.crest ? UI.crest(b) : '') + esc(FP.Core.tname(b)) + (t.win === b ? ' ✓' : '') + '</span></div>' + rows + '</div>';
  }
  UI.matchKnockout = function (comp, f, home) {
    var ko = comp.ko; if (!ko || !ko.rounds) return '';
    var me = home === false ? f.a : f.h, ri = f.x != null ? f.x : ko.r, round = ko.rounds[ri]; if (!round) return '';
    var idx = comp.fx.indexOf(f), mine = null;
    round.ties.forEach(function (t) { if ((idx >= 0 && (t.f || []).indexOf(idx) >= 0) || (t.a === me || t.b === me)) mine = mine || t; });
    var others = round.ties.filter(function (t) { return t !== mine; });
    // camino hasta aquí: rondas anteriores en las que jugó tu equipo
    var path = [];
    ko.rounds.forEach(function (r, i) { if (i >= ri) return; r.ties.forEach(function (t) { if (t.a === me || t.b === me) { var opp = t.a === me ? t.b : t.a; path.push('<span class="pill ' + (t.win === me ? 'g' : 'r') + '">' + esc(r.nm) + ': ' + esc(FP.Core.tname(opp)) + (t.agg ? ' (' + (t.a === me ? t.agg[0] + '-' + t.agg[1] : t.agg[1] + '-' + t.agg[0]) + ')' : '') + '</span>'); } }); });
    var next = ko.rounds[ri + 1] ? ko.rounds[ri + 1].nm : null;
    var h = '<div class="card"><div class="hd"><h3>' + esc(round.nm) + '</h3><span class="mut sm">' + esc(comp.nm) + (round.legs > 1 ? ' · ida y vuelta' : ' · partido único') + '</span></div>';
    if (mine) h += '<div class="tie-main">' + tieLine(comp, mine, me) + '</div>';
    h += '<p class="mut sm" style="margin:.5rem 0">' + (/^final$/i.test(round.nm) ? 'Es la final: el ganador se lleva el título.' : next ? 'El ganador pasa a ' + esc(next.toLowerCase()) + '.' : 'El ganador avanza a la siguiente ronda.') + '</p>';
    if (path.length) h += '<h4 style="margin:.6rem 0 .3rem">Tu camino</h4><div class="row" style="flex-wrap:wrap;gap:.35rem">' + path.join('') + '</div>';
    if (others.length) h += '<h4 style="margin:.8rem 0 .3rem">Resto de la ronda</h4><div class="ties">' + others.map(function (t) { return tieLine(comp, t, me); }).join('') + '</div>';
    return h + '</div>';
  };

  // ¿qué se muestra según el tipo de partido?
  UI.matchContext = function (comp, f, home) {
    if (!comp || !f) return '';
    if (f.k && comp.ko) return UI.matchKnockout(comp, f, home);
    if (comp.groups && comp.gtab) return UI.matchGroup(comp, f, home);
    return UI.matchTable(comp, f, home);
  };

  SC.match = function () {
    var base = match0.apply(this, arguments), mt = UI.mt;
    try { if (mt && mt.prep && (mt.phase === 'pre' || mt.phase === 'done')) return base + UI.matchContext(mt.prep.comp, mt.prep.f, mt.prep.home); } catch (e) { if (window.console) console.warn('tabla del partido', e); }
    return base;
  };
})();
