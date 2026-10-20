/* FUTPRO — interfaz: utilidades, navegación, tablas ordenables, modales, avance de tiempo */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, esc = U.esc;

  var UI = FP.UI = { scr: 'home', tab: {}, sort: {}, filt: {}, busy: false, screens: {}, acts: {}, sidebarOpen: false };

  var NAV = [
    ['home', 'Inicio', '⌂'], ['player', 'Mi jugador', '★'], ['club', 'Mi club', '◈'], ['calendar', 'Calendario', '▦'], ['match', 'Partido', '⚽'],
    ['training', 'Entrenamientos', '↗'], ['comps', 'Competiciones', '♛'], ['tables', 'Clasificaciones', '☰'], ['stats', 'Estadísticas', '∑'],
    ['market', 'Mercado de fichajes', '⇄'], ['contracts', 'Contratos', '✎'], ['news', 'Noticias', '✉'], ['nations', 'Selecciones', '⚑'],
    ['honors', 'Palmarés', '♕'], ['career', 'Historial de carrera', '☷'], ['config', 'Configuración', '⚙']
  ];
  UI.NAV = NAV;

  // ---------- ayudas de formato ----------
  UI.ovrClass = function (v) { return v >= 88 ? 'o7' : v >= 80 ? 'o6' : v >= 72 ? 'o5' : v >= 64 ? 'o4' : v >= 55 ? 'o3' : v >= 46 ? 'o2' : 'o1'; };
  UI.ovr = function (v, xl) { v = Math.round(v); return '<span class="ovr ' + UI.ovrClass(v) + (xl ? ' xl' : '') + '">' + v + '</span>'; };
  UI.pos = function (p) { return C.POS_ES[p] || p; };
  UI.club = function (id, txt) {
    if (id == null) return '—';
    var name = txt || C.tname(id);
    if (id < 5000) return '<a class="lk" data-act="club" data-id="' + id + '">' + esc(name) + '</a>';
    if (id >= 30000) return '<a class="lk" data-act="club" data-id="' + (id - 30000) + '">' + esc(name) + '</a>';
    return esc(name);
  };
  UI.tn = function (id) { return C.tname(id); };
  UI.player = function (p, txt) {
    if (!p) return '—';
    return '<a class="lk" data-act="player" data-id="' + p.i + '">' + esc(txt || (p.i === 0 && FP.S.hero ? FP.S.hero.nm : p.n)) + '</a>';
  };
  UI.nation = function (code) { return '<span class="pill">' + esc(code) + '</span>'; };
  UI.age = function (p) { return C.age(p); };
  UI.date = function (w) { return D.fmt(w); };
  UI.money = FP.fmt.money;
  UI.form = function (arr) { return '<span class="form-w">' + arr.map(function (r) { return '<i class="' + r + '">' + r + '</i>'; }).join('') + '</span>'; };
  UI.bar = function (v, max, cls, cap) {
    var pct = Math.max(0, Math.min(100, v / (max || 100) * 100));
    return '<div class="bar ' + (cls || '') + '"><i style="width:' + pct + '%"></i>' + (cap != null ? '<span class="cap" style="left:' + Math.min(100, cap / (max || 100) * 100) + '%"></span>' : '') + '</div>';
  };
  UI.stars = function (v) { var n = Math.max(0, Math.min(5, v / 20)), full = Math.floor(n), half = n - full >= 0.5; var s = ''; for (var i = 0; i < 5; i++) s += i < full ? '★' : (i === full && half ? '⯪' : '☆'); return '<span class="stars">' + s + '</span>'; };
  UI.verBadge = function (v) { return v === 'v' ? '<span class="pill g" title="Composición verificada con fuentes web">verificado</span>' : v === 'p' ? '<span class="pill y" title="La lista cargada es parcial">parcial</span>' : '<span class="pill y" title="Conocimiento del autor: puede tener errores">por verificar</span>'; };
  UI.stat = function (label, val, sub) { return '<div class="card" style="margin:0"><h4>' + esc(label) + '</h4><div style="font-size:1.5rem;font-weight:800">' + val + '</div>' + (sub ? '<div class="mut sm">' + sub + '</div>' : '') + '</div>'; };

  // ---------- modales y avisos ----------
  UI.modal = function (html, wide) {
    var root = document.getElementById('modal-root');
    root.innerHTML = '<div class="ov" data-act="ovclose"><div class="modal" ' + (wide ? 'style="width:min(1180px,100%)"' : '') + '><button class="btn sm x" data-act="mclose">✕ Cerrar</button>' + html + '</div></div>';
  };
  UI.closeModal = function () { document.getElementById('modal-root').innerHTML = ''; };
  UI.toast = function (msg, kind) {
    var root = document.getElementById('toast-root'), d = document.createElement('div');
    Array.prototype.forEach.call(root.children, function (ch) { if (ch.innerHTML === msg) ch.remove(); });
    if (root.children.length > 3) root.firstChild.remove();
    d.className = 'toast ' + (kind || ''); d.innerHTML = msg; root.appendChild(d);
    setTimeout(function () { d.style.opacity = 0; d.style.transition = '.4s'; setTimeout(function () { d.remove(); }, 450); }, kind === 'bad' || kind === 'warn' ? 6500 : 3800);
  };
  UI.confirm = function (msg, fn) { UI._cf = fn; UI.modal('<h3>Confirmar</h3><p>' + msg + '</p><div class="row"><button class="btn pri" data-act="cfyes">Aceptar</button><button class="btn" data-act="mclose">Cancelar</button></div>'); };

  // ---------- tablas ordenables ----------
  // cols: [{k, t, n, c, f(row), s(sortable), v(row)->valor de orden}]
  UI.table = function (id, cols, rows, opt) {
    opt = opt || {};
    var st = UI.sort[id] || opt.sort || null;
    if (st) {
      var col = cols.filter(function (c) { return c.k === st[0]; })[0];
      if (col) {
        var dir = st[1] === 'a' ? 1 : -1;
        var get = col.v || function (r) { return r[col.k]; };
        rows = rows.slice().sort(function (a, b) {
          var x = get(a), y = get(b);
          if (typeof x === 'string' || typeof y === 'string') return dir * String(x == null ? '' : x).localeCompare(String(y == null ? '' : y), 'es');
          return dir * ((x == null ? -1e9 : x) - (y == null ? -1e9 : y));
        });
      }
    }
    var total = rows.length;
    if (opt.max && rows.length > opt.max) rows = rows.slice(0, opt.max);
    var h = '<div class="tw"><table class="t"><thead><tr>';
    cols.forEach(function (c) {
      var on = st && st[0] === c.k;
      h += '<th class="' + (c.n ? 'n ' : '') + (c.c ? 'c ' : '') + (c.s !== false ? 's' : '') + '"' + (c.s !== false ? ' data-act="sort" data-t="' + id + '" data-k="' + c.k + '"' : '') + (c.tip ? ' title="' + esc(c.tip) + '"' : '') + '>' + esc(c.t) + (on ? ' <span class="ar">' + (st[1] === 'a' ? '▲' : '▼') + '</span>' : '') + '</th>';
    });
    h += '</tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr class="' + (opt.cls ? opt.cls(r) || '' : '') + '">';
      cols.forEach(function (c) { var v = c.f ? c.f(r) : esc(r[c.k]); h += '<td class="' + (c.n ? 'n ' : '') + (c.c ? 'c' : '') + '">' + (v == null ? '' : v) + '</td>'; });
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    if (opt.max && total > opt.max) h += '<p class="mut sm" style="margin-top:.4rem">Mostrando ' + opt.max + ' de ' + total + '.</p>';
    return h;
  };

  // ---------- selector de liga / país ----------
  UI.leagueSelect = function (key, opts) {
    opts = opts || {};
    var cur = UI.filt[key] || opts.def, h = '<label class="f"><span>' + (opts.label || 'Liga') + '</span><select data-act="filt" data-k="' + key + '">';
    var byC = {};
    FP.DATA.leagues.forEach(function (l) { (byC[l.c] = byC[l.c] || []).push(l); });
    Object.keys(byC).sort(function (a, b) { return FP.DATA.countries[a].n.localeCompare(FP.DATA.countries[b].n, 'es'); }).forEach(function (c) {
      h += '<optgroup label="' + esc(FP.DATA.countries[c].n) + '">';
      byC[c].forEach(function (l) { h += '<option value="' + l.id + '"' + (cur === l.id ? ' selected' : '') + '>' + esc(l.n) + '</option>'; });
      h += '</optgroup>';
    });
    return h + '</select></label>';
  };
  UI.myLeague = function () {
    var S = FP.S, h = S.hero, t;
    if (h.club != null) return S.clubs[h.club].lg;
    return 'CHI1';
  };

  // ---------- navegación ----------
  UI.go = function (scr, tab) {
    UI.scr = scr; if (tab) UI.tab[scr] = tab; UI.sidebarOpen = false;
    if (scr !== 'match' && UI.mt && UI.mt.timer) { clearInterval(UI.mt.timer); UI.mt.timer = null; }
    UI.render(); window.scrollTo(0, 0);
  };
  UI.badges = function () {
    var S = FP.S, h = S.hero, b = {};
    if (!h) return b;
    b.contracts = h.offers.length; b.match = (S.pending || []).length;
    var seen = S.cfg.seenMsg || 0, un = h.inbox.filter(function (m) { return m.id > seen; }).length;
    b.news = un;
    return b;
  };
  UI.shell = function () {
    var S = FP.S, h = S.hero, bd = UI.badges();
    var nav = NAV.map(function (n) { return '<button class="nav-i ' + (UI.scr === n[0] ? 'on' : '') + '" data-act="nav" data-s="' + n[0] + '"><span class="ic">' + n[2] + '</span>' + n[1] + (bd[n[0]] ? '<span class="bd">' + bd[n[0]] + '</span>' : '') + '</button>'; }).join('');
    var hdr = '<div class="topbar"><button class="btn sm menu-btn" data-act="menu">☰</button><div class="logo">FUT<b>PRO</b></div>' +
      '<span class="date-chip">' + D.fmt(S.week) + '</span>' +
      '<div class="search"><input type="text" id="gsearch" placeholder="Buscar club o jugador…" autocomplete="off"></div>' +
      '<div class="grow"></div>' +
      (h.retired ? '<span class="pill r">Carrera finalizada</span>' : '<div class="btn-group"><button class="btn pri" data-act="adv" data-w="1">▶ Semana</button><button class="btn" data-act="adv" data-w="4">⏩ 4 sem.</button><button class="btn" data-act="adv" data-w="0" data-m="1">⏭ Próx. partido</button><button class="btn sec" data-act="advmenu">Más…</button></div>') +
      '</div>';
    return hdr + '<aside class="sidebar ' + (UI.sidebarOpen ? 'open' : '') + '">' + nav + '</aside><main class="main" id="main"></main>';
  };
  UI.render = function () {
    var S = FP.S, app = document.getElementById('app');
    if (!S || !S.hero) return;
    var focus = document.activeElement && document.activeElement.id === 'gsearch';
    app.innerHTML = UI.shell();
    var fn = UI.screens[UI.scr] || UI.screens.home;
    var m = document.getElementById('main');
    try { m.innerHTML = fn(); } catch (e) { m.innerHTML = '<div class="card"><h3>Error al mostrar la pantalla</h3><pre class="bad">' + esc(e.stack || e.message) + '</pre></div>'; console.error(e); }
    if (UI.after && UI.after[UI.scr]) UI.after[UI.scr]();
    if (UI.scr === 'news') { var h = S.hero; S.cfg.seenMsg = h.inbox.length ? h.inbox[0].id : 0; }
  };
  UI.after = {};

  // ---------- avance del tiempo ----------
  UI.overlay = function (msg) {
    var el = document.getElementById('modal-root');
    if (msg === false) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="ov"><div class="modal" style="width:min(420px,100%);text-align:center"><h3>' + msg + '</h3><div class="progress"><i id="ovbar"></i></div><p class="mut sm" id="ovtxt"></p></div></div>';
  };
  UI.advance = function (weeks, untilMatch) {
    var S = FP.S, h = S.hero;
    if (UI.busy) return;
    if (h.retired) {
      UI.busy = true; UI.overlay('Avanzando el mundo…');
      var left = Math.max(1, weeks || 4);
      (function loop() {
        var t0 = Date.now();
        while (left > 0 && Date.now() - t0 < 40) { FP.Sim.step(); left--; }
        if (left > 0) setTimeout(loop, 0); else { UI.busy = false; UI.overlay(false); FP.Store.auto(true); UI.render(); }
      })();
      return;
    }
    if (S.weekOpen && FP.Game.hasPending()) { UI.go('match'); return; }
    if (weeks === 1 && !untilMatch) {
      FP.Game.beginWeek();
      if (FP.Game.hasPending()) { UI.mt = null; UI.go('match'); return; }
      FP.Game.endWeek(); UI.afterWeeks();
      return;
    }
    UI.busy = true;
    UI.overlay('Avanzando…');
    var max = untilMatch ? 60 : weeks;
    var inb0 = h.inbox.length;
    FP.Game.runWeeks(max, { untilMatch: untilMatch, stopOnOffer: true, stopOnEvent: true }).then(function (r) {
      UI.busy = false; UI.overlay(false);
      if (r.stop === 'match') { UI.mt = null; UI.afterWeeks(true); UI.go('match'); return; }
      var n = r.weeks;
      UI.toast('Avanzaste ' + n + ' semana' + (n === 1 ? '' : 's') + (r.stop === 'offer' ? ' — ¡llegó una oferta!' : r.stop === 'inj' ? ' — te lesionaste.' : '.'), r.stop === 'done' ? '' : 'warn');
      UI.afterWeeks(); if (r.stop === 'offer') UI.go('contracts');
    }).catch(function (e) { UI.busy = false; UI.overlay(false); console.error(e); UI.toast('Error al avanzar: ' + esc(e.message), 'bad'); });
  };
  UI.afterWeeks = function (skipRender) {
    FP.Store.auto().then(function () { if (FP.Store.lastError && !UI._warnedSave) { UI._warnedSave = true; UI.toast('El navegador no permite guardar localmente. Usa Configuración → Exportar a archivo para no perder tu partida.', 'bad'); } });
    if (!skipRender) UI.render();
  };
  UI.advMenu = function () {
    UI.modal('<h3>Avanzar el tiempo</h3><p class="mut sm">Los partidos del jugador durante el salto se simulan automáticamente. El avance se detiene si llega una oferta o te lesionas.</p>' +
      '<div class="grid g2"><button class="btn" data-act="adv" data-w="12">12 semanas</button><button class="btn" data-act="adv" data-w="26">26 semanas (medio año)</button>' +
      '<button class="btn" data-act="adv" data-w="52">52 semanas (un año)</button><button class="btn" data-act="advseason">Hasta fin de temporada</button>' +
      '<button class="btn" data-act="advwindow">Hasta el próximo mercado</button><button class="btn" data-act="adv" data-w="0" data-m="1">Hasta el próximo partido</button></div>');
  };

  // ---------- eventos ----------
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (act === 'ovclose') { if (e.target === t) UI.closeModal(); return; }
    var fn = UI.acts[act];
    if (fn) { e.preventDefault(); fn(t.dataset, t, e); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target.closest('[data-act]'); if (!t) return;
    var fn = UI.acts[t.getAttribute('data-act')]; if (fn) fn(t.dataset, t, e);
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'gsearch') UI.globalSearch(t.value);
    if (t.matches && t.matches('[data-live]')) { var fn = UI.acts[t.getAttribute('data-live')]; if (fn) fn(t.dataset, t, e); }
  });
  var A = UI.acts;
  A.nav = function (d) { UI.go(d.s); };
  A.menu = function () { UI.sidebarOpen = !UI.sidebarOpen; var s = document.querySelector('.sidebar'); if (s) s.classList.toggle('open', UI.sidebarOpen); };
  A.mclose = function () { UI.closeModal(); };
  A.cfyes = function () { var f = UI._cf; UI.closeModal(); if (f) f(); };
  A.sort = function (d) { var id = d.t, cur = UI.sort[id]; UI.sort[id] = cur && cur[0] === d.k ? [d.k, cur[1] === 'a' ? 'd' : 'a'] : [d.k, 'd']; if (cur && cur[0] !== d.k && typeof d.k === 'string' && /nm|name|team|club|pos/.test(d.k)) UI.sort[id] = [d.k, 'a']; UI.render(); };
  A.filt = function (d, t) { UI.filt[d.k] = t.value; UI.render(); };
  A.tabset = function (d) { UI.tab[d.s] = d.t; UI.render(); };
  A.adv = function (d) { UI.closeModal(); UI.advance(+d.w, !!d.m); };
  A.advmenu = function () { UI.advMenu(); };
  A.advseason = function () {
    UI.closeModal();
    var S = FP.S, h = S.hero, club = h.club != null ? S.clubs[h.club] : null, cal = club ? FP.LGDEF[club.lg].cal : 'year';
    var end = Comp_end(cal); UI.advance(Math.max(1, Math.min(60, end - S.week + 1)), false);
  };
  A.advwindow = function () {
    UI.closeModal();
    var S = FP.S, w = S.week, n = 0; while (n < 60 && !FP.Market.isWindow(w + n + 1)) n++;
    UI.advance(Math.max(1, n + 1), false);
  };
  function Comp_end(cal) {
    var S = FP.S, y = D.year(S.week), m = D.month(S.week);
    if (cal === 'euro') return D.of(m >= 5 ? y + 1 : y, 4, 24);
    return D.of(y, 10, 29) >= S.week ? D.of(y, 10, 29) : D.of(y + 1, 10, 29);
  }

  // ---------- búsqueda global ----------
  UI.globalSearch = function (q) {
    q = (q || '').trim().toLowerCase();
    var S = FP.S;
    var box = document.getElementById('gsr');
    if (q.length < 2) { if (box) box.remove(); return; }
    var cl = S.clubs.filter(function (c) { return c.nm.toLowerCase().indexOf(q) >= 0; }).slice(0, 8);
    var pl = []; for (var i = 1; i < S.pl.length && pl.length < 8; i++) { var p = S.pl[i]; if (p && p.c >= 0 && p.n.toLowerCase().indexOf(q) >= 0) pl.push(p); }
    var h = '<div id="gsr" class="card" style="position:absolute;top:100%;left:0;right:0;z-index:60;margin-top:.3rem;max-height:60vh;overflow:auto">';
    if (S.hero.nm.toLowerCase().indexOf(q) >= 0) h += '<div class="sm mut">Tu jugador</div><div>' + UI.player(S.pl[0]) + '</div>';
    h += '<div class="sm mut" style="margin-top:.3rem">Clubes</div>' + (cl.length ? cl.map(function (c) { return '<div>' + UI.club(c.id) + ' <span class="mut sm">' + esc(FP.DATA.countries[c.c].n) + '</span></div>'; }).join('') : '<div class="dim sm">sin resultados</div>');
    h += '<div class="sm mut" style="margin-top:.3rem">Jugadores</div>' + (pl.length ? pl.map(function (p) { return '<div>' + UI.player(p) + ' <span class="mut sm">' + UI.pos(p.p) + ' · ' + UI.tn(p.c) + '</span></div>'; }).join('') : '<div class="dim sm">sin resultados</div>') + '</div>';
    var wrap = document.querySelector('.search'); if (!wrap) return;
    if (box) box.remove();
    wrap.insertAdjacentHTML('beforeend', h);
  };
  document.addEventListener('click', function (e) { if (!e.target.closest('.search')) { var b = document.getElementById('gsr'); if (b) b.remove(); } });
})();
