/* FUTPRO — Historial de carrera: resumen, evolución, trayectoria por club y tarjetas por temporada
   con estadísticas por clase de competición y acontecimientos. Solo presentación (usa FP.Stats y h.cx). */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, A = UI.acts, SC = UI.screens, I = UI.icon, ST = FP.Stats;
  var hdr = UI.hdr;
  var CLS_SHORT = { liga: 'Liga', copa: 'Copa', cont: 'Internacional', juv: 'Juvenil', amat: 'Amateur', amis: 'Amistosos', u15: 'Sub-15', u17: 'Sub-17', u20: 'Sub-20', u23: 'Sub-23', abs: 'Absoluta' };
  var CLS_ICON = { liga: 'table', copa: 'trophy', cont: 'globe', juv: 'user', amat: 'shield', amis: 'ball', u15: 'flag', u17: 'flag', u20: 'flag', u23: 'flag', abs: 'flag' };

  function seasonOf(label, w) {                       // ¿la semana w cae en esa temporada?
    var y = D.year(w), m = D.month(w);
    if (String(label).indexOf('/') > 0) { var y0 = +String(label).split('/')[0]; return (m >= 6 ? y : y - 1) === y0; }
    return String(y) === String(label);
  }
  function ageAt(w) { var S = FP.S; return Math.floor(C.ageF(S.pl[0], w)); }
  function ovrAt(w) {
    var h = FP.S.hero, best = h.prog[0] ? h.prog[0][1] : h.ovr0;
    for (var i = 0; i < h.prog.length; i++) { if (h.prog[i][0] <= w) best = h.prog[i][1]; else break; }
    return best;
  }
  function statLine(t) {
    var s = t.p + ' PJ';
    if (t.g || t.a) s += ' · ' + t.g + ' G · ' + t.a + ' A';
    else s += ' · 0 G';
    if (t.rn) s += ' · <b>' + t.rt.toFixed(2) + '</b>';
    return s;
  }
  function build() {
    var S = FP.S, h = S.hero, rows = ST.rows(), by = {};
    rows.forEach(function (r) {
      var b = by[r.s] || (by[r.s] = { s: r.s, o: 0, clubs: {}, order: [], nt: {}, ntOrder: [] });
      b.o = Math.max(b.o, r.o);
      var isNT = ST.isNT(r.k), key = r.t + '|' + (isNT ? 'nt' : 'cl');
      var grp = isNT ? b.nt : b.clubs, ord = isNT ? b.ntOrder : b.order;
      if (!grp[key]) { grp[key] = { t: r.t, tn: r.tn, rows: [] }; ord.push(key); }
      grp[key].rows.push(r);
    });
    var list = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.o - a.o; });
    // acontecimientos por temporada
    function put(w, e) { for (var i = 0; i < list.length; i++) if (seasonOf(list[i].s, w)) { (list[i].ev = list[i].ev || []).push(e); return; } }
    var cx = h.cx || { hist: [], reg: [], injH: [] };
    h.trophies.forEach(function (t) { var s = list.filter(function (x) { return x.s === String(t.y); })[0]; if (s) (s.ev = s.ev || []).push({ w: t.w, ic: t.sub ? 'medal' : 'trophy', c: t.sub ? '' : 'gold', t: (t.sub ? '' : '') + t.nm + (t.club ? ' · ' + t.club : '') }); });
    h.awards.forEach(function (t) { var s = list.filter(function (x) { return x.s === String(t.y); })[0]; if (s) (s.ev = s.ev || []).push({ w: t.w, ic: 'star', c: 'vio', t: t.nm }); });
    cx.hist.forEach(function (e) {
      if (e.k === 'alta') put(e.w, { w: e.w, ic: 'transfer', c: 'ok', t: 'Fichaje: ' + C.tname(e.club) + (e.fee ? ' (traspaso ' + UI.money(e.fee) + ')' : '') + (e.role ? ' · ' + e.role : '') });
      else if (e.k === 'baja') put(e.w, { w: e.w, ic: 'x', c: 'bad', t: 'Salida de ' + C.tname(e.club) + (e.why ? ': ' + e.why : '') });
      else if (e.k === 'renovacion') put(e.w, { w: e.w, ic: 'contract', c: '', t: 'Renovación con ' + C.tname(e.club) });
      else if (e.k === 'cesion_ini') put(e.w, { w: e.w, ic: 'transfer', c: '', t: 'Cesión a ' + C.tname(e.club) });
      else if (e.k === 'conflicto' && e.state && e.state !== 'resuelto') put(e.w, { w: e.w, ic: 'bell', c: 'warn', t: 'Conflicto de rol: ' + (e.why || e.state) });
    });
    (cx.injH || []).forEach(function (e) { if (e.n >= 10) put(e.w, { w: e.w, ic: 'inj', c: 'bad', t: 'Lesión grave (' + e.n + ' semanas)' }); });
    if (h.nts) {
      var fr = {};
      h.nts.ev.forEach(function (e) {
        if (/No fuiste|Quedaste/.test(e.t)) return;
        if (/amistosos/i.test(e.t)) { var m = e.t.match(/Sub-\d+|absoluta/i); var key = (m ? m[0] : '') + '|' + (list.filter(function (x) { return seasonOf(x.s, e.w); })[0] || {}).s; fr[key] = fr[key] || { n: 0, w: e.w, cat: m ? m[0] : '' }; fr[key].n++; return; }
        if (/Convocado|preselección|microciclo/i.test(e.t)) put(e.w, { w: e.w, ic: 'flag', c: 'blue', t: e.t.replace(/[¡!]/g, '').replace(/^Te convocan al microciclo/, 'Microciclo') });
      });
      Object.keys(fr).forEach(function (k) { var f = fr[k]; put(f.w, { w: f.w, ic: 'flag', c: 'blue', t: f.n + ' convocatoria' + (f.n > 1 ? 's' : '') + ' a amistosos ' + (f.cat || '') }); });
    }
    list.forEach(function (s) {
      if (!s.ev) return;
      var seen = {}; s.ev = s.ev.filter(function (e) { if (seen[e.t]) return false; seen[e.t] = 1; return true; });
      s.ev.sort(function (a, b) { return a.w - b.w; });
    });
    return list;
  }

  function summary(list) {
    var S = FP.S, h = S.hero, by = ST.byClass(), clubTot = ST.sum(ST.rows(function (r) { return !ST.isNT(r.k) && r.k !== 'amis'; }));
    var nt = ST.sum(ST.rows(function (r) { return ST.isNT(r.k); })), clubs = {}; ST.rows().forEach(function (r) { if (!ST.isNT(r.k) && r.t < 5000) clubs[r.t] = 1; });
    var peak = Math.max.apply(null, h.prog.map(function (p) { return p[1]; }).concat([h.ovr]));
    var titles = h.trophies.filter(function (t) { return !t.sub; }).length;
    var cells = [['Temporadas', list.length, 'calendar'], ['Clubes', Object.keys(clubs).length, 'shield'], ['Partidos', clubTot.p, 'ball'], ['Goles', clubTot.g, 'target'], ['Asistencias', clubTot.a, 'zap'], ['Títulos', titles, 'trophy'], ['Con selección', nt.p + ' PJ', 'flag'], ['Media máxima', peak, 'up']];
    return '<div class="kpi-row cr-sum">' + cells.map(function (k) { return '<div class="kp"><span class="ki">' + I(k[2]) + '</span><div class="kt"><div class="kn">' + k[1] + '</div><div class="kl2">' + k[0] + '</div></div></div>'; }).join('') + '</div>';
  }
  function stints(list) {
    var h = FP.S.hero, reg = (h.cx && h.cx.reg) || [];
    var items = reg.filter(function (r) { return r.club != null && r.club < 20000; }).slice(-14);
    if (!items.length) return '';
    return '<div class="card"><div class="hd"><h3>' + I('shield') + 'Trayectoria por clubes</h3></div><div class="stints">' + items.map(function (r) {
      var end = r.exitW || FP.S.week;
      return '<div class="stint">' + (r.club < 5000 ? UI.crest(r.club) : '') + '<div><b class="ell">' + esc(C.tname(r.club)) + '</b><span>' + D.year(r.startW) + '–' + (r.exitW ? D.year(r.exitW) : 'hoy') + ' · ' + esc((FP.Contracts.KIND[r.kind] || r.kind).replace('Contrato ', '')) + '</span></div></div>';
    }).join('<i class="stint-sep"></i>') + '</div></div>';
  }
  function honours() {
    var h = FP.S.hero, champ = h.trophies.filter(function (t) { return !t.sub; }), subs = h.trophies.filter(function (t) { return t.sub; });
    var html = '<div class="card"><div class="hd"><h3>' + I('trophy') + 'Palmarés</h3><a class="more" data-act="nav" data-s="honors">Ver todo ' + I('chev') + '</a></div>';
    if (!champ.length && !h.awards.length && !subs.length) return html + '<p class="mut sm">Aún sin títulos ni premios.</p></div>';
    html += champ.slice(-6).reverse().map(function (t) { return '<div class="hrow"><span style="color:var(--gold)">' + I('trophy') + '</span><div class="grow ell"><b>' + esc(t.nm) + '</b><div class="mut sm">' + esc(t.club || '') + ' · ' + esc(t.y) + '</div></div></div>'; }).join('');
    html += h.awards.slice(-4).reverse().map(function (t) { return '<div class="hrow"><span style="color:var(--vio)">' + I('medal') + '</span><div class="grow ell"><b>' + esc(t.nm) + '</b><div class="mut sm">' + esc(t.y) + '</div></div></div>'; }).join('');
    if (subs.length) html += '<div class="mut sm" style="margin-top:.4rem">' + subs.length + ' subcampeonato' + (subs.length > 1 ? 's' : '') + '</div>';
    return html + '</div>';
  }
  function groupLines(grp, ord) {
    return ord.map(function (k) {
      var g = grp[k], byc = {};
      g.rows.forEach(function (r) { (byc[r.k] = byc[r.k] || []).push(r); });
      var isNat = g.t >= 5000 && g.t < 20000;
      var head = '<div class="ss-club">' + (isNat ? UI.flag(FP.S.nat[g.t - 5000].c) : (g.t < 5000 ? UI.crest(g.t) : '<span class="nic">' + I('shield') + '</span>')) + '<b class="ell">' + esc(g.tn) + '</b></div>';
      var lines = ST.ORDER.filter(function (c) { return byc[c]; }).map(function (c) {
        var t = ST.sum(byc[c]);
        return '<div class="ss-line"><span class="cls">' + I(CLS_ICON[c]) + CLS_SHORT[c] + '</span><span class="st">' + statLine(t) + '</span></div>';
      }).join('');
      return '<div class="ss-grp">' + head + lines + '</div>';
    }).join('');
  }
  function seasonCard(s, open) {
    var S = FP.S, w = s.o, age = ageAt(w), ovr = ovrAt(w);
    var clubRows = ST.rows(function (r) { return r.s === s.s && !ST.isNT(r.k) && r.k !== 'amis'; }), tot = ST.sum(clubRows);
    var all = s.ev || [], more = all.length > 9 ? all.length - 9 : 0;
    var ev = all.slice(0, 9).map(function (e) { return '<div class="ss-ev ' + (e.c || '') + '">' + I(e.ic) + '<span>' + esc(e.t) + '</span></div>'; }).join('') + (more ? '<div class="mut sm">+ ' + more + ' acontecimientos más</div>' : '');
    var html = '<div class="ss"><div class="ss-h"><div class="ss-y">' + esc(s.s) + '</div><div class="mut sm">' + age + ' años</div><div class="ss-o" title="Media al cierre">' + UI.ovrHex(ovr, 44) + '</div></div>' +
      '<div class="ss-b">' + groupLines(s.clubs, s.order) + groupLines(s.nt, s.ntOrder) +
      '<div class="ss-tot mut sm">' + (tot.p ? 'Con clubes: <b>' + tot.p + ' PJ · ' + tot.g + ' G · ' + tot.a + ' A' + (tot.rn ? ' · nota ' + tot.rt.toFixed(2) : '') + '</b>' : 'Sin partidos oficiales con clubes') + '</div>' +
      '<a class="lk sm" data-act="cseason" data-s="' + esc(s.s) + '">' + (open ? 'Ocultar detalle por competición' : 'Ver detalle por competición') + '</a>' + (open ? detail(s) : '') + '</div>' +
      '<div class="ss-e">' + (ev || '<span class="mut sm">Sin acontecimientos destacados.</span>') + '</div></div>';
    return html;
  }
  function detail(s) {
    var rows = ST.rows(function (r) { return r.s === s.s; }).map(function (r) { r.sub = r.p - r.st; return r; });
    return '<div style="margin-top:.5rem">' + UI.table('crd_' + s.s, [
      { k: 'tn', t: 'Equipo', f: function (r) { return esc(r.tn); } }, { k: 'c', t: 'Competición' }, { k: 'p', t: 'PJ', n: 1 }, { k: 'st', t: 'Tit.', n: 1 }, { k: 'sub', t: 'Sup.', n: 1 }, { k: 'min', t: 'Min', n: 1 }, { k: 'g', t: 'G', n: 1 }, { k: 'a', t: 'A', n: 1 }, { k: 'yc', t: 'Am.', n: 1 }, { k: 'rc', t: 'Ro.', n: 1 },
      { k: 'rt', t: 'Nota', n: 1, f: function (r) { return r.rn ? (r.rs / r.rn).toFixed(2) : '—'; }, v: function (r) { return r.rn ? r.rs / r.rn : 0; } }
    ], rows, { sort: ['p', 'd'] }) + '</div>';
  }
  A.cseason = function (d) { UI.tab.crOpen = UI.tab.crOpen || {}; UI.tab.crOpen[d.s] = !UI.tab.crOpen[d.s]; UI.render(); };

  var oldCareer = SC.career; UI.careerClassic = oldCareer;
  SC.career = function () {
    var S = FP.S, h = S.hero, list = build(), open = UI.tab.crOpen || {};
    var html = hdr('history', 'Historial de carrera', esc(h.nm) + ' · ' + FP.Hero.age() + ' años · ' + (h.retired ? 'retirado' : esc(UI.heroTeamLabel ? UI.heroTeamLabel() : '')));
    if (h.retired) {
      var years = h.retiredAge - h.startAge;
      html += '<div class="card" style="border-color:var(--gold)"><div class="hd"><h3>' + I('flag') + 'Carrera finalizada</h3></div><p>' + esc(h.nm) + ' se retiró a los ' + h.retiredAge + ' años, tras ' + years + ' años de carrera (' + D.fmt(h.retiredW) + ').</p><button class="btn pri" data-act="newfromend">Empezar una nueva carrera</button></div>';
    }
    html += summary(list);
    html += '<div class="cr-split"><div class="card"><div class="hd"><h3>' + I('chart') + 'Evolución de la media</h3><span class="mut sm">Línea punteada = cambio de club</span></div>' + UI.evoChart(h) + '</div>' + honours() + '</div>';
    html += stints(list);
    html += '<div class="hd" style="margin:.8rem 0 .4rem"><h3>' + I('calendar') + 'Temporada por temporada</h3></div>';
    html += list.length ? list.map(function (s) { return seasonCard(s, !!open[s.s]); }).join('') : '<div class="card"><p class="mut">Todavía no hay temporadas registradas: juega partidos para construir tu historial.</p></div>';
    return html;
  };
})();
