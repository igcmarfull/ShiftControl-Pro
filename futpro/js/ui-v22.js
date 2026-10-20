/* FUTPRO — Noticias → Mi carrera rediseñada: pendientes arriba, filtros por tema con contador, novedades resaltadas,
   agrupación por fecha y titular + detalle. Solo presentación sobre h.inbox. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, SC = UI.screens, A = UI.acts, I = UI.icon, hdr = UI.hdr, seg = UI.seg, Dec = FP.Dec;
  var CATS = [
    ['mercado', 'Mercado y contratos', 'contract', 'blue'], ['decision', 'Decisiones', 'bell', 'warn'], ['salud', 'Salud', 'inj', 'bad'], ['partido', 'Partidos', 'ball', 'ok'],
    ['sel', 'Selección', 'flag', 'gold'], ['premio', 'Premios y logros', 'trophy', 'gold'], ['otro', 'Otros', 'news', '']
  ];
  var CI = {}; CATS.forEach(function (c) { CI[c[0]] = c; });
  function cat(m) {
    var t = String(m.t), k = m.k;
    if (/^Decisión pendiente|^Sin respuesta a tiempo/.test(t)) return 'decision';
    if (k === 'offer' || /ojeador|interés|rumor|oferta|propuesta|precontrato|contrato|traspaso|renovar|cedid|cesión|fich|prueba|patrocin|representante/i.test(t)) return 'mercado';
    if (k === 'inj' || /lesi[oó]n|alta médica|lesionad/i.test(t)) return 'salud';
    if (/selecci[oó]n|convocad|nómina|microciclo|preselecci/i.test(t)) return 'sel';
    if (k === 'title' || /campe[oó]n|premio|bono|balón de oro|bota de oro|equipo ideal|desbloqueado|hito|logro|meta/i.test(t)) return 'premio';
    if (k === 'hero' || /partido|gol|triplete|doblete|nota|hat-trick/i.test(t)) return 'partido';
    return 'otro';
  }
  function split(m) {
    var t = String(m.t).replace(/<[^>]*>/g, '').replace(/^(Sin respuesta a tiempo: )+/, 'Sin respuesta a tiempo. '), head = t, body = '';
    var dm = /^Decisión pendiente: (.*)$/.exec(t); if (dm) return { h: dm[1], b: 'Decisión que tuviste que tomar.', pend: 1 };
    if (m.k === 'offer' && t.indexOf(': ') > 0) { var i = t.indexOf(' · '); if (i > 0 && i < 120) { head = t.slice(0, i); body = t.slice(i + 3); } }
    else if (t.length > 105) { var j = t.search(/[.;] /); if (j > 20 && j < 130) { head = t.slice(0, j + 1); body = t.slice(j + 2); } }
    return { h: head, b: body };
  }
  function relLabel(w) {
    var S = FP.S, d = S.week - w; if (d <= 0) return 'Esta semana'; if (d === 1) return 'Semana pasada';
    var y = D.ymd(w); return ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][y[1]] + ' ' + y[0];
  }

  var render0 = UI.render, prev = null, base = 0;
  UI.render = function () { var r = render0.apply(this, arguments); prev = UI.scr; return r; };

  var news0 = SC.news;
  SC.news = function () {
    var tab = UI.tab.news || 'mine';
    if (tab !== 'mine') return news0.apply(this, arguments);
    var S = FP.S, h = S.hero, filt = UI.tab.newsf || 'all';
    if (prev !== 'news') base = S.cfg.seenMsg || 0;
    var openDec = Dec && Dec.open ? Dec.open().map(function (d) { return d.title; }) : [];
    var all = h.inbox.slice(0, 160).map(function (m) { return { m: m, c: cat(m) }; });
    var counts = {}; all.forEach(function (x) { counts[x.c] = (counts[x.c] || 0) + 1; });
    var html = hdr('news', 'Noticias', 'Tu carrera y el mundo del fútbol', seg('news', [['mine', 'Mi carrera', 'user'], ['world', 'Mundo', 'globe'], ['top', 'Titulares', 'star']], tab));
    // pendientes
    var decs = Dec && Dec.open ? Dec.open().length : 0, offs = h.offers.length;
    if (decs || offs) html += '<div class="nw-pend">' + (decs ? '<div class="nw-p warn"><span class="nw-pi">' + I('bell') + '</span><div><b>' + decs + (decs === 1 ? ' decisión pendiente' : ' decisiones pendientes') + '</b><span>Respóndelas antes de que se aplique la opción por defecto.</span></div><button class="btn sm pri" data-act="nav" data-s="home">Responder</button></div>' : '') +
      (offs ? '<div class="nw-p blue"><span class="nw-pi">' + I('contract') + '</span><div><b>' + offs + (offs === 1 ? ' oferta abierta' : ' ofertas abiertas') + '</b><span>Revisa condiciones y plazos en Contratos.</span></div><button class="btn sm pri" data-act="nav" data-s="contracts">Ver ofertas</button></div>' : '') + '</div>';
    // filtros
    html += '<div class="nw-chips"><button class="nw-chip ' + (filt === 'all' ? 'on' : '') + '" data-act="tabset" data-s="newsf" data-t="all">Todo <i>' + all.length + '</i></button>' + CATS.filter(function (c) { return counts[c[0]]; }).map(function (c) { return '<button class="nw-chip ' + (filt === c[0] ? 'on' : '') + '" data-act="tabset" data-s="newsf" data-t="' + c[0] + '">' + I(c[2]) + c[1] + ' <i>' + counts[c[0]] + '</i></button>'; }).join('') + '</div>';
    var list = all.filter(function (x) { return filt === 'all' || x.c === filt; }).slice(0, 90);
    if (!list.length) return html + '<div class="card"><p class="mut">Sin mensajes en esta categoría.</p></div>';
    var last = '', newIds = {}; all.filter(function (x) { return x.m.id > base; }).slice(0, 10).forEach(function (x) { newIds[x.m.id] = 1; });
    html += '<div class="card nw-card">' + list.map(function (x) {
      var m = x.m, c = CI[x.c], s = split(m), lb = relLabel(m.w), hd = '', isNew = !!newIds[m.id], open = m.oid != null && h.offers.some(function (o) { return o.id === m.oid; });
      if (lb !== last) { hd = '<div class="nw-g">' + esc(lb) + '</div>'; last = lb; }
      return hd + '<div class="nw-i' + (isNew ? ' new' : '') + '"><span class="nw-ic ' + c[3] + '">' + I(c[2]) + '</span><div class="nw-b"><div class="nw-t">' + esc(s.h) + (isNew ? '<span class="nw-new">Nuevo</span>' : '') + (s.pend && openDec.indexOf(s.h) >= 0 ? '<span class="pill y">Pendiente</span>' : '') + '</div>' + (s.b ? '<div class="nw-s">' + esc(s.b) + '</div>' : '') + '<div class="nw-m"><span class="nw-cat ' + c[3] + '">' + esc(c[1]) + '</span><span>' + esc(D.fmt(m.w)) + '</span>' + (open ? '<a class="nw-a" data-act="nav" data-s="contracts">Ver oferta ' + I('chev') + '</a>' : '') + '</div></div></div>';
    }).join('') + '</div>';
    return html;
  };
})();
