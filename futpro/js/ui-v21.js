/* FUTPRO — Calendario → Próximos: tres vistas (Agenda, Semanas, Por competición). Solo presentación sobre UI.nextFx y los fixtures de las competiciones. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, SC = UI.screens, I = UI.icon, hdr = UI.hdr, seg = UI.seg;
  var VIEWS = [['agenda', 'Agenda'], ['weeks', 'Semanas'], ['lanes', 'Por competición']];
  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], MESL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  function dp(w) { var y = D.ymd(w); return { d: y[2], m: y[1], y: y[0] }; }
  function ml(w) { var p = dp(w); return MESL[p.m] + ' ' + p.y; }
  function mineSet() { var h = FP.S.hero, m = {}; m[h.team] = 1; (h.extraTeams || []).forEach(function (t) { m[t] = 1; }); var nat = FP.Nat.heroNation(); if (nat) m[nat.id] = 1; return m; }
  function kindOf(x) { if (x.nat) return 'nat'; var k = x.c.kind; return k === 'L' ? 'liga' : k === 'C' ? 'copa' : k === 'X' ? 'cont' : k === 'F' ? 'amis' : k === 'Y' || k === 'A' ? 'juv' : 'liga'; }
  var KN = { liga: 'Liga', copa: 'Copa', cont: 'Internacional', amis: 'Amistoso', juv: 'Juvenil', nat: 'Selección' };
  function info(x) {
    var S = FP.S, f = x.f, mine = mineSet(), mineId = mine[f.h] ? f.h : f.a, opp = f.h === mineId ? f.a : f.h;
    function str(id) { return x.c.ys && x.c.ys[id] != null ? x.c.ys[id] : (C.strOf ? C.strOf(id) : 0); }
    return { x: x, f: f, kind: kindOf(x), mineId: mineId, opp: opp, home: f.h === mineId, sm: str(mineId), so: str(opp), left: f.w - S.week };
  }
  function when(n) { return n <= 0 ? 'Esta semana' : n === 1 ? 'Próxima semana' : 'En ' + n + ' semanas'; }
  function diffCls(d) { return d <= -4 ? 'ok' : d >= 4 ? 'bad' : ''; }

  // ---- A · Agenda ----
  function agenda(list) {
    var a = list[0], html = '';
    var d = a.so - a.sm, dp0 = dp(a.f.w);
    html += '<div class="cl-hero ' + a.kind + '"><div class="cl-hd"><div class="cl-date"><b>' + dp0.d + '</b><span>' + MES[dp0.m] + '</span></div><div class="cl-hm"><span class="cl-k">' + KN[a.kind] + '</span><div class="cl-comp">' + esc(a.x.c.nm) + (a.f.ro ? ' · ' + esc(a.f.ro) : '') + '</div><div class="cl-when">' + I('clock') + when(a.left) + ' · ' + (a.home ? 'Local' : 'Visita') + '</div></div></div>' +
      '<div class="cl-vs"><div class="cl-t">' + UI.crest(a.mineId, 'lg') + '<b>' + esc(C.tname(a.mineId)) + '</b><i>Fuerza ' + Math.round(a.sm) + '</i></div><div class="cl-x">VS</div><div class="cl-t">' + UI.crest(a.opp, 'lg') + '<b>' + esc(C.tname(a.opp)) + '</b><i class="' + diffCls(d) + '">Fuerza ' + Math.round(a.so) + '</i></div></div>' +
      '<div class="cl-note">' + (d >= 4 ? 'Rival claramente superior: partido exigente.' : d <= -4 ? 'Rival más débil: partido para sumar.' : 'Partido parejo.') + '</div></div>';
    html += '<div class="card cl-list">';
    var last = '';
    list.slice(1).forEach(function (x) {
      var m = ml(x.f.w), p = dp(x.f.w), dd = x.so - x.sm;
      if (m !== last) { html += '<div class="ag-m">' + m + '</div>'; last = m; }
      html += '<div class="cl-r ' + x.kind + '"><div class="ag-d"><b>' + p.d + '</b><span>' + MES[p.m] + '</span></div>' + UI.crest(x.opp) + '<div class="cl-n"><b class="ell">' + (x.home ? 'vs ' : '@ ') + esc(C.tname(x.opp)) + '</b><span class="mut sm ell">' + esc(x.x.c.nm) + (x.f.ro ? ' · ' + esc(x.f.ro) : '') + '</span></div>' +
        '<span class="cl-str ' + diffCls(dd) + '" title="Fuerza del rival">' + Math.round(x.so) + '</span><span class="cl-tag ' + x.kind + '">' + KN[x.kind] + '</span><span class="pill">' + (x.home ? 'Local' : 'Visita') + '</span></div>';
    });
    return html + '</div>';
  }

  // ---- B · Semanas ----
  function weeks(list) {
    var S = FP.S, by = {}, w0 = S.week, w1 = Math.min(w0 + 30, list.length ? list[list.length - 1].f.w : w0 + 12), out = '', cur = '', open = false;
    list.forEach(function (x) { (by[x.f.w] = by[x.f.w] || []).push(x); });
    for (var w = w0; w <= w1; w++) {
      var m = ml(w), p = dp(w), ms = by[w] || [];
      if (m !== cur) { if (open) out += '</div>'; out += '<div class="ag-m">' + m + '</div><div class="wk-grid">'; cur = m; open = true; }
      out += '<div class="wkc' + (ms.length ? ' has' : '') + (w === w0 ? ' now' : '') + '"><div class="wkc-d"><b>' + p.d + '</b> ' + MES[p.m] + (w === w0 ? '<em>esta semana</em>' : '') + '</div>' +
        (ms.length ? ms.map(function (x) { return '<div class="wkc-m ' + x.kind + '">' + UI.crest(x.opp) + '<div><b class="ell">' + (x.home ? 'vs ' : '@ ') + esc(C.tname(x.opp)) + '</b><span class="ell">' + esc(KN[x.kind]) + ' · ' + (x.home ? 'local' : 'visita') + '</span></div></div>'; }).join('') : '<div class="wkc-f">Sin partido</div>') + '</div>';
    }
    if (open) out += '</div>';
    return '<p class="mut sm" style="margin:0 0 .4rem">Cada casilla es una semana; las libres son de entrenamiento y descanso.</p>' + out;
  }

  // ---- C · Por competición ----
  function lanes(list) {
    var S = FP.S, mine = mineSet(), groups = {}, order = [];
    list.forEach(function (x) { var k = x.x.c.id; if (!groups[k]) { groups[k] = { c: x.x.c, kind: x.kind, next: [] }; order.push(k); } groups[k].next.push(x); });
    function stats(c) {
      var pl = 0, tot = 0, v = 0, e = 0, l = 0;
      c.fx.forEach(function (f) { if (!(mine[f.h] || mine[f.a])) return; tot++; if (f.d) { pl++; var mh = !!mine[f.h], g1 = mh ? f.hs : f.as, g2 = mh ? f.as : f.hs; if (g1 > g2) v++; else if (g1 < g2) l++; else e++; } });
      return { pl: pl, tot: tot, v: v, e: e, l: l };
    }
    return order.map(function (k) {
      var g = groups[k], st = stats(g.c), pct = st.tot ? Math.round(st.pl / st.tot * 100) : 0, nx = g.next[0];
      return '<div class="card ln ' + g.kind + '"><div class="ln-h"><div><span class="cl-tag ' + g.kind + '">' + KN[g.kind] + '</span><h3>' + esc(g.c.nm) + '</h3></div><div class="ln-s"><b>' + st.pl + '</b> de ' + st.tot + ' jugados' + (st.pl ? ' · <span class="ok">' + st.v + 'V</span> ' + st.e + 'E <span class="bad">' + st.l + 'D</span>' : '') + '</div></div>' +
        '<div class="ln-bar"><i style="width:' + pct + '%"></i></div><div class="mut sm" style="margin:.3rem 0 .5rem">Próximo: <b style="color:var(--tx)">' + dp(nx.f.w).d + ' ' + MES[dp(nx.f.w).m] + '</b> · ' + (nx.home ? 'vs ' : '@ ') + esc(C.tname(nx.opp)) + ' · ' + when(nx.left).toLowerCase() + '</div>' +
        '<div class="ln-ch">' + g.next.slice(0, 8).map(function (x) { return '<span class="ln-c" title="' + esc(C.tname(x.opp)) + '">' + UI.crest(x.opp) + '<i>' + dp(x.f.w).d + ' ' + MES[dp(x.f.w).m] + '</i><em>' + (x.home ? 'L' : 'V') + '</em></span>'; }).join('') + '</div></div>';
    }).join('');
  }

  var cal0 = SC.calendar;
  SC.calendar = function () {
    var tab = UI.tab.calendar || 'next';
    if (tab !== 'next') return cal0.apply(this, arguments);
    var S = FP.S, view = UI.tab.clv || 'agenda', list = UI.nextFx(40).map(info);
    var html = hdr('calendar', 'Calendario', D.fmt(S.week), seg('calendar', [['next', 'Próximos', 'clock'], ['res', 'Resultados', 'history'], ['year', 'Fechas clave', 'pin']], tab));
    if (!list.length) return html + '<div class="card"><p class="mut">Sin partidos programados todavía.</p></div>';
    html += '<div class="fbar" style="margin:.2rem 0 .8rem"><span class="mut sm" style="margin-right:.4rem">Vista</span><div class="seg">' + VIEWS.map(function (v) { return '<button class="' + (view === v[0] ? 'on' : '') + '" data-act="tabset" data-s="clv" data-t="' + v[0] + '">' + v[1] + '</button>'; }).join('') + '</div></div>';
    return html + (view === 'weeks' ? weeks(list) : view === 'lanes' ? lanes(list) : agenda(list));
  };
})();
