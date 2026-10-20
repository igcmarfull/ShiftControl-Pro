/* FUTPRO — rediseño visual v2: estructura (barra, menú agrupado, navegación móvil) y pantallas Inicio, Mi jugador y Partido.
 * Solo presentación: usa los mismos datos, acciones (data-act) y funciones del juego que las pantallas anteriores. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, A = UI.acts, SC = UI.screens, Comp = FP.Comp, I = UI.icon;

  // ======================= ESTRUCTURA =======================
  var GROUPS = [
    ['Jugador', [['home', 'Inicio', 'home'], ['player', 'Mi jugador', 'user'], ['career', 'Historial de carrera', 'history'], ['honors', 'Palmarés', 'trophy'], ['social', 'Redes', 'chat']]],
    ['Temporada', [['match', 'Partido', 'ball'], ['calendar', 'Calendario', 'calendar'], ['training', 'Entrenamientos', 'train'], ['club', 'Mi club', 'shield']]],
    ['Mundo', [['comps', 'Competiciones', 'globe'], ['tables', 'Clasificaciones', 'table'], ['stats', 'Estadísticas', 'chart'], ['nations', 'Selecciones', 'flag'], ['news', 'Noticias', 'news']]],
    ['Gestión', [['market', 'Mercado de fichajes', 'transfer'], ['contracts', 'Contratos', 'contract']]],
    ['Sistema', [['config', 'Configuración', 'settings']]]
  ];
  UI.GROUPS = GROUPS;
  function title(scr) { var t = ''; GROUPS.forEach(function (g) { g[1].forEach(function (n) { if (n[0] === scr) t = n; }); }); return t; }
  UI.ctaLabel = function () {
    var S = FP.S;
    if (S.weekOpen && S.pending && S.pending.length) return ['Jugar partido', 'play'];
    var nx = UI.nextFx(1)[0];
    if (nx && nx.w <= S.week) return ['Jugar partido', 'play'];
    return ['Avanzar semana', 'play'];
  };
  UI.shell = function () {
    var S = FP.S, h = S.hero, bd = UI.badges(), cur = title(UI.scr) || GROUPS[0][1][0];
    var nav = GROUPS.map(function (g) {
      return '<div class="nav-g"><div class="nav-gt">' + g[0] + '</div>' + g[1].map(function (n) {
        var b = bd[n[0]];
        return '<button class="nav-i ' + (UI.scr === n[0] ? 'on' : '') + '" data-act="nav" data-s="' + n[0] + '">' + I(n[2]) + '<span>' + n[1] + '</span>' + (b ? '<span class="bd' + (n[0] === 'news' ? ' soft' : '') + '">' + b + '</span>' : '') + '</button>';
      }).join('') + '</div>';
    }).join('');
    var cta = h.retired ? '<span class="pill r">Carrera finalizada</span>' : '<div class="cta-g"><button class="btn cta" data-act="adv" data-w="1">' + I(UI.ctaLabel()[1], 'fill') + UI.ctaLabel()[0] + '</button><button class="btn hide-m" data-act="adv" data-w="4">' + I('fwd') + '4 sem.</button><button class="btn hide-m" data-act="adv" data-w="0" data-m="1">' + I('skip') + 'Próx. partido</button><button class="btn sec" data-act="advmenu" title="Más opciones de avance">' + I('plus') + '<span class="hide-m">Más</span></button></div>';
    var season = (function () { var ymd = D.ymd(S.week); return ymd[0]; })();
    var top = '<div class="topbar"><button class="iconbtn menu-btn" data-act="menu" aria-label="Menú">' + I('menu') + '</button>' +
      '<div class="brand"><span class="mark">' + I('ball') + '</span><span class="wm">FUT<b>PRO</b></span></div>' +
      '<div class="crumb">' + I(cur[2]) + cur[1] + '</div>' +
      '<span class="date-chip">' + I('calendar') + D.fmt(S.week) + '</span>' +
      '<div class="search">' + I('search') + '<input type="text" id="gsearch" placeholder="Buscar club o jugador…" autocomplete="off"></div>' +
      '<div class="grow"></div>' +
      '<button class="iconbtn themebtn" data-act="themetoggle" title="Cambiar tema claro/oscuro" aria-label="Tema"><span class="i-sun">' + I('sun') + '</span><span class="i-moon">' + I('moon') + '</span></button>' +
      '<button class="iconbtn" data-act="nav" data-s="contracts" title="Ofertas y decisiones pendientes" aria-label="Ofertas">' + I('bell') + (h.offers.length ? '<span class="dot">' + h.offers.length + '</span>' : '') + '</button>' + cta + '</div>';
    var bn = [['home', 'Inicio', 'home'], ['player', 'Jugador', 'user'], ['match', 'Partido', 'ball'], ['market', 'Mercado', 'transfer']].map(function (n) { var b = bd[n[0]]; return '<button class="bn ' + (UI.scr === n[0] ? 'on' : '') + '" data-act="nav" data-s="' + n[0] + '">' + I(n[2]) + n[1] + (b ? '<span class="bd">' + b + '</span>' : '') + '</button>'; }).join('') + '<button class="bn" data-act="menu">' + I('menu') + 'Más</button>';
    return top + '<aside class="sidebar ' + (UI.sidebarOpen ? 'open' : '') + '">' + nav + '</aside><main class="main" id="main"></main><nav class="bottom-nav">' + bn + '</nav>';
  };
  UI.fitBar = function () { var t = document.querySelector('.topbar'); if (t) document.documentElement.style.setProperty('--tb', Math.round(t.getBoundingClientRect().height) + 'px'); };

  // ======================= AYUDAS =======================
  function mySide(x) {
    var f = x.f, h = FP.S.hero, nat = FP.Nat.heroNation(), mine = null;
    var mineIds = [h.team].concat(h.extraTeams || []); if (nat) mineIds.push(nat.id);
    if (mineIds.indexOf(f.h) >= 0) mine = f.h; else mine = f.a;
    return { mine: mine, opp: mine === f.h ? f.a : f.h, home: mine === f.h };
  }
  function teamPos(comp, id) {
    if (!comp || !comp.tb || comp.tb[id] == null || comp.groups) return null;
    var rows = Comp.rows(comp), r = rows.filter(function (x) { return x.id === id; })[0];
    return r ? { pos: r.pos, n: rows.length, pts: r.pts } : null;
  }
  function last5(comp, id) {
    var res = [];
    if (!comp || !comp.fx) return res;
    for (var i = comp.cp - 1; i >= 0 && res.length < 5; i--) { var f = comp.fx[i]; if (!f || !f.d || f.k || (f.h !== id && f.a !== id)) continue; var g = f.h === id ? f.hs - f.as : f.as - f.hs; res.unshift(g > 0 ? 'V' : g < 0 ? 'D' : 'E'); }
    return res;
  }
  function weeksTo(w) { var d = w - FP.S.week; return d <= 0 ? 'Esta semana' : d === 1 ? 'En 1 semana' : 'En ' + d + ' semanas'; }
  function ordinal(n) { return n + 'º'; }
  function kindIcon(k) { return { ok: ['medal', 'ok'], warn: ['bell', 'warn'], inj: ['inj', 'bad'], offer: ['contract', ''], title: ['trophy', 'ok'], transfer: ['transfer', ''], hero: ['star', 'ok'], promo: ['up', 'ok'], releg: ['down', 'bad'], coach: ['user', ''], stat: ['chart', ''] }[k] || ['news', '']; }
  UI.heroStatusPills = function () {
    var h = FP.S.hero, p = '';
    if (h.inj && h.inj.n > 0) p += '<span class="pill r">' + I('inj') + 'Lesión: ' + esc(h.inj.nm) + ' · ' + h.inj.n + ' sem.</span>';
    if (h.susp > 0) p += '<span class="pill y">Suspendido ' + h.susp + '</span>';
    if (h.fat > 75) p += '<span class="pill y">Fatiga alta</span>';
    if (h.nt.dec && h.nt.dec.ok && h.nt.dec.until >= FP.S.week) p += '<span class="pill b">' + I('flag') + 'Convocado</span>';
    return p;
  };
  function posAlt(h) {
    var base = C.ovrOf(h.at, h.pos), out = [];
    C.POS.forEach(function (p) { if (p !== h.pos && p !== 'GK' && C.ovrOf(h.at, p) >= base - 4) out.push(p); });
    return out.slice(0, 2);
  }
  function teamLabel(h) {
    if (h.tk === 'free') return '<span class="mut">Sin club</span>';
    var id = h.tk === 'academy' ? h.club : h.team;
    return UI.crest(id) + '<b>' + UI.club(id) + '</b>' + (h.tk === 'academy' ? ' <span class="pill">Cantera</span>' : h.tk === 'loan' ? ' <span class="pill y">Cedido</span>' : h.tk === 'amat' ? ' <span class="pill">Amateur</span>' : '');
  }
  function posLabel(h) { return '<span class="pill g">' + C.POS_ES[h.pos] + ' · ' + esc(C.POS_NAME[h.pos]) + '</span>'; }

  // ======================= INICIO =======================
  SC.home = function () {
    var S = FP.S, h = S.hero, age = FP.Hero.age(), cols = UI.heroColors(), s = h.season;
    var html = '<div class="hero-card" style="--c1:' + cols[0] + '55">' +
      '<div class="avatar">' + UI.avatar(h) + '</div>' +
      '<div style="min-width:0"><h1 class="hc-name">' + esc(h.nm) + '</h1><div class="hc-meta"><span>' + age + ' años</span><i class="sep"></i><span>' + UI.flag(h.nat) + esc(C.cname(h.nat)) + '</span><i class="sep"></i><span style="display:inline-flex;align-items:center">' + teamLabel(h) + '</span></div>' +
      '<div class="hc-tags">' + posLabel(h) + '<span class="pill">Rol: ' + esc(FP.Hero.roleLabel()) + '</span>' + UI.heroStatusPills() + '</div></div>' +
      '<div class="rings">' + UI.ovrHex(h.ovr, 104) + UI.ring(h.form, 'Forma', Math.round(h.form), '#46aabd') + UI.ring(h.mor, 'Moral', Math.round(h.mor), '#2fbf71') + UI.ring(h.fat, 'Fatiga', Math.round(h.fat), h.fat > 70 ? '#e5545a' : h.fat > 45 ? '#e2a93b' : '#5d7a8c') + '</div></div>';
    html += '<div class="kpis">' + [
      ['Partidos', s.ap, s.st + ' de titular', 'ball'], ['Goles', s.g, s.ap ? (s.g / s.ap).toFixed(2) + ' por partido' : '—', 'target'], ['Asistencias', s.a, s.ap ? (s.a / s.ap).toFixed(2) + ' por partido' : '—', 'zap'],
      ['Nota media', s.rn ? (s.rs / s.rn).toFixed(2) : '—', s.min + ' minutos', 'star'], ['Valor de mercado', UI.money(FP.Market.heroValue()), h.contract && h.contract.wage ? UI.money(h.contract.wage) + ' / año' : 'sin sueldo', 'chart']
    ].map(function (k) { return '<div class="kpi"><div class="kl">' + I(k[3]) + k[0] + '</div><div class="kv2">' + k[1] + '</div><div class="ks">' + k[2] + '</div></div>'; }).join('') + '</div>';
    // pendientes
    var pend = [];
    if (S.pending && S.pending.length) pend.push('<div class="dec"><span class="nic news-i"></span>' + I('ball') + '<div class="dt2"><b>Partido pendiente</b><br><span class="mut">Tienes ' + S.pending.length + ' partido(s) esta semana.</span></div><button class="btn sm pri" data-act="nav" data-s="match">Ir al partido</button></div>');
    h.offers.slice(0, 4).forEach(function (o) {
      pend.push('<div class="dec">' + (o.club != null ? UI.crest(o.club) : I('contract')) + '<div class="dt2"><b>' + ({ trial: 'Invitación a prueba', academy: 'Ingreso a la cantera', pro: 'Contrato profesional', transfer: 'Oferta de traspaso', loan: 'Cesión', renew: 'Renovación', event: 'Oportunidad', amateur: 'Club amateur' }[o.type] || 'Oferta') + '</b><br><span class="mut">' + esc(o.text.length > 110 ? o.text.slice(0, 108) + '…' : o.text) + '</span></div><button class="btn sm" data-act="nav" data-s="contracts">Revisar</button></div>');
    });
    var main = '', side = '';
    // próximo partido
    var nx = UI.nextFx(1)[0];
    if (nx) {
      var ms = mySide(nx), f = nx.f, comp = nx.c, pM = teamPos(comp, ms.mine), pO = teamPos(comp, ms.opp);
      main += '<div class="card nextm"><div class="hd"><h3>' + I('calendar') + 'Próximo partido</h3><span class="pill b">' + weeksTo(f.w) + '</span></div><div class="mut sm">' + esc(comp.nm) + (f.ro ? ' · ' + esc(f.ro) : '') + ' · ' + D.fmt(f.w) + '</div>' +
        '<div class="nm-teams"><div class="nm-t">' + UI.crest(f.h, 'lg') + '<div>' + UI.club(f.h) + '</div><span class="sub">' + (pM && ms.home ? ordinal(pM.pos) + ' · ' + pM.pts + ' pts' : pO && !ms.home ? ordinal(pO.pos) + ' · ' + pO.pts + ' pts' : 'Local') + '</span>' + (last5(comp, f.h).length ? UI.form(last5(comp, f.h)) : '') + '</div><div class="nm-vs">VS</div>' +
        '<div class="nm-t">' + UI.crest(f.a, 'lg') + '<div>' + UI.club(f.a) + '</div><span class="sub">' + (pM && !ms.home ? ordinal(pM.pos) + ' · ' + pM.pts + ' pts' : pO && ms.home ? ordinal(pO.pos) + ' · ' + pO.pts + ' pts' : 'Visitante') + '</span>' + (last5(comp, f.a).length ? UI.form(last5(comp, f.a)) : '') + '</div></div>' +
        '<div class="nm-foot"><span class="mut sm">' + I('pin') + (ms.home ? ' Juegas de local' : ' Juegas de visitante') + ' · Rol esperado: <b style="color:var(--tx)">' + esc(FP.Hero.roleLabel()) + '</b></span><button class="btn pri" data-act="adv" data-w="1">' + I('play', 'fill') + (UI.ctaLabel()[0]) + '</button></div></div>';
    } else main += '<div class="card nextm"><div class="hd"><h3>' + I('calendar') + 'Próximo partido</h3></div><p class="mut">No hay partidos programados en las próximas semanas. Aprovecha para entrenar y mostrarte ante los clubes.</p><button class="btn" data-act="nav" data-s="training">' + I('train') + 'Ir a entrenamientos</button></div>';
    // últimos resultados
    var lg = h.log.slice(0, 5);
    main += '<div class="card"><div class="hd"><h3>' + I('history') + 'Últimos partidos</h3><a class="more" data-act="nav" data-s="calendar">Historial ' + I('chev') + '</a></div>' + (lg.length ? '<div class="res-strip">' + lg.map(function (m) { return '<div class="res-c ' + m.r + '">' + UI.crest(m.o) + '<div class="rs">' + esc(m.s.split(' ')[0]) + '</div><div class="ro">' + esc(C.tname(m.o)) + '</div><div class="ro">' + (m.rt ? 'Nota ' + m.rt.toFixed(1) : m.role === 'fuera' ? 'No convocado' : 'Banca') + (m.g ? ' · ' + m.g + ' gol' + (m.g > 1 ? 'es' : '') : '') + '</div></div>'; }).join('') + '</div>' : '<p class="mut">Aún no has jugado partidos en esta carrera.</p>') + '</div>';
    // decisiones
    main += '<div class="card"><div class="hd"><h3>' + I('contract') + 'Decisiones y ofertas</h3><a class="more" data-act="nav" data-s="contracts">Ver todo ' + I('chev') + '</a></div>' + (pend.length ? pend.join('') : '<p class="mut">No tienes decisiones pendientes. Los clubes te siguen según tu rendimiento y el calendario de mercado.</p>') + '</div>';
    // noticias
    var mine = h.inbox.slice(0, 4), world = S.news.filter(function (n) { return n.i >= 2; }).slice(0, 4);
    main += '<div class="card"><div class="hd"><h3>' + I('news') + 'Noticias</h3><a class="more" data-act="nav" data-s="news">Más ' + I('chev') + '</a></div><div class="grid g2"><div><h4>Tu carrera</h4>' + (mine.length ? mine.map(function (m) { var ic = kindIcon(m.k); return '<div class="news-i"><span class="nic ' + ic[1] + '">' + I(ic[0]) + '</span><div><div class="nt">' + esc(m.t) + '</div><div class="nd">' + D.fmt(m.w) + '</div></div></div>'; }).join('') : '<p class="mut sm">Sin novedades.</p>') + '</div><div><h4>En el mundo</h4>' + world.map(function (n) { var ic = kindIcon(n.k); return '<div class="news-i"><span class="nic ' + ic[1] + '">' + I(ic[0]) + '</span><div><div class="nt">' + esc(n.t) + '</div><div class="nd">' + D.fmt(n.w) + '</div></div></div>'; }).join('') + '</div></div></div>';
    // lateral: liga
    var lgc = UI.myLeagueComp();
    if (lgc) {
      var rows = Comp.rows(lgc), me = h.team, idx = 0; rows.forEach(function (r, i) { if (r.id === me) idx = i; });
      var from = Math.max(0, Math.min(rows.length - 7, idx - 3)), part = rows.slice(from, from + 7), pm = rows[idx];
      side += '<div class="card"><div class="hd"><h3>' + I('table') + 'Clasificación</h3><a class="more" data-act="nav" data-s="tables">Completa ' + I('chev') + '</a></div><div class="mut sm" style="margin-bottom:.4rem">' + esc(lgc.nm) + ' · ' + esc(lgc.label || '') + (pm ? ' · <b style="color:var(--tx)">Puesto ' + ordinal(pm.pos) + '</b>' : '') + '</div><table class="mini-t"><tbody>' + part.map(function (r) { return '<tr class="' + (r.id === me ? 'me' : '') + '"><td class="pos">' + r.pos + '</td><td>' + UI.crest(r.id) + UI.club(r.id) + '</td><td class="n mut">' + r.p + '</td><td class="n"><b>' + r.pts + '</b></td></tr>'; }).join('') + '</tbody></table></div>';
    }
    side += '<div class="card"><div class="hd"><h3>' + I('train') + 'Entrenamiento</h3><a class="more" data-act="nav" data-s="training">Cambiar ' + I('chev') + '</a></div><div class="row sp"><span>' + esc(FP.Hero.FOCUS[h.train.focus].n) + '</span><span class="pill">' + ['', 'Suave', 'Normal', 'Intensa'][h.train.int] + '</span></div><div class="mut sm" style="margin-top:.4rem">Potencial estimado por los ojeadores: <b style="color:var(--tx)">' + FP.Hero.potRange().join('–') + '</b></div></div>';
    side += '<div class="card"><div class="hd"><h3>' + I('medal') + 'Hitos</h3><a class="more" data-act="nav" data-s="social">Todos ' + I('chev') + '</a></div>' + UI.milestoneList(FP.Social.milestones(), 3) + '</div>';
    if (h.soc && h.soc.feed.length) side += '<div class="card"><div class="hd"><h3>' + I('chat') + 'Redes</h3><a class="more" data-act="nav" data-s="social">Ver ' + I('chev') + '</a></div>' + h.soc.feed.slice(0, 2).map(UI.tweet).join('') + '</div>';
    if (!h.flags.guideOff && S.week - h.startW < 16) side = '<div class="card glass"><div class="hd"><h3>' + I('star') + 'Primeros pasos</h3><button class="btn sm" data-act="guideoff">Ocultar</button></div><ol class="mut" style="margin:.2rem 0 0 1.1rem;padding:0"><li>Elige tu <a class="lk" data-act="nav" data-s="training">entrenamiento</a> semanal.</li><li>Pulsa <b>' + UI.ctaLabel()[0] + '</b> arriba a la derecha.</li><li>Rinde bien: los clubes te invitarán a pruebas, o pídelas en el <a class="lk" data-act="nav" data-s="market">mercado</a>.</li><li>Revisa <a class="lk" data-act="nav" data-s="contracts">Contratos</a> para decidir ofertas.</li></ol></div>' + side;
    return html + '<div class="dash"><div>' + main + '</div><div>' + side + '</div></div>';
  };

  // ======================= MI JUGADOR =======================
  function benchmarks() {
    var S = FP.S, h = S.hero, out = {};
    var lgId = h.club != null ? S.clubs[h.club].lg : null;
    if (lgId) {
      var vals = [];
      S.lgs[lgId].teams.forEach(function (cid) { (S.ro[cid] || []).forEach(function (p) { if (p.i !== 0 && p.p === h.pos) vals.push(p.o); }); });
      vals.sort(function (a, b) { return b - a; });
      if (vals.length) { out.avg = vals.reduce(function (s, x) { return s + x; }, 0) / vals.length; out.top = vals.slice(0, Math.max(3, Math.round(vals.length * 0.1))).reduce(function (s, x) { return s + x; }, 0) / Math.max(3, Math.round(vals.length * 0.1)); out.pct = Math.round(vals.filter(function (v) { return v < h.ovr; }).length / vals.length * 100); out.n = vals.length; out.lg = FP.LGDEF[lgId].n; }
    }
    var comp = UI.myLeagueComp();
    if (comp && comp.sc) { var top = Comp.topScorers(comp, 10, 0); if (top.length) { out.goalLead = top[0].g; out.goalAvg = top.reduce(function (s, x) { return s + x.g; }, 0) / top.length; } var tA = Comp.topScorers(comp, 10, 1); if (tA.length) out.asLead = tA[0].a; }
    return out;
  }
  function cmpBar(label, mine, avg, top, max, fmt) {
    max = max || Math.max(mine, avg || 0, top || 0, 1) * 1.15; var f = fmt || function (v) { return Math.round(v); };
    return '<div class="cmp"><span class="cl">' + label + '</span><div class="cmp-bars"><i style="width:' + Math.min(100, mine / max * 100) + '%;background:var(--ac)"></i>' + (avg != null ? '<span class="mk" style="left:' + Math.min(99, avg / max * 100) + '%" title="Media de la liga"></span>' : '') + '</div><b>' + f(mine) + '</b></div>';
  }
  UI.evoChart = function (h) {
    var pts = h.prog; if (pts.length < 2) return '<p class="mut">Aún no hay suficientes datos: avanza algunas semanas.</p>';
    var W = 820, H = 250, pl = 40, pr = 16, pt = 16, pb = 30, w0 = pts[0][0], w1 = Math.max(pts[pts.length - 1][0], w0 + 4);
    var min = Math.floor((Math.min.apply(null, pts.map(function (p) { return p[1]; })) - 3) / 5) * 5, max = Math.ceil((Math.max.apply(null, pts.map(function (p) { return p[1]; })) + 3) / 5) * 5;
    var x = function (w) { return pl + (w - w0) / (w1 - w0) * (W - pl - pr); }, y = function (v) { return pt + (1 - (v - min) / Math.max(1, max - min)) * (H - pt - pb); };
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1); }).join(' ');
    var area = line + ' L' + x(pts[pts.length - 1][0]).toFixed(1) + ' ' + (H - pb) + ' L' + x(pts[0][0]).toFixed(1) + ' ' + (H - pb) + ' Z';
    var grid = '', v;
    for (v = min; v <= max; v += 5) grid += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="rgba(255,255,255,.07)"/><text x="' + (pl - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="#67788a">' + v + '</text>';
    var ticks = '';
    for (var a = Math.ceil(C.ageF(FP.S.pl[0], w0)); a <= C.ageF(FP.S.pl[0], w1); a++) { var wk = h.b + a * 52.1775; ticks += '<line x1="' + x(wk).toFixed(1) + '" x2="' + x(wk).toFixed(1) + '" y1="' + pt + '" y2="' + (H - pb) + '" stroke="rgba(255,255,255,.04)"/><text x="' + x(wk).toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle" font-size="11" fill="#67788a">' + a + ' años</text>'; }
    var marks = ''; (h.history || []).forEach(function (e) { if (e.club != null && e.w > w0) marks += '<line x1="' + x(e.w).toFixed(1) + '" x2="' + x(e.w).toFixed(1) + '" y1="' + pt + '" y2="' + (H - pb) + '" stroke="#46aabd" stroke-dasharray="3 4" stroke-opacity=".6"/>'; });
    var last = pts[pts.length - 1];
    return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Evolución de la media"><defs><linearGradient id="evo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2fbf71" stop-opacity=".35"/><stop offset="1" stop-color="#2fbf71" stop-opacity="0"/></linearGradient></defs>' + grid + ticks + marks + '<path d="' + area + '" fill="url(#evo)"/><path d="' + line + '" fill="none" stroke="#2fbf71" stroke-width="2.6" stroke-linejoin="round"/><circle cx="' + x(last[0]).toFixed(1) + '" cy="' + y(last[1]).toFixed(1) + '" r="5" fill="#2fbf71" stroke="#161d23" stroke-width="2.5"/><text x="' + (x(last[0]) - 8).toFixed(1) + '" y="' + (y(last[1]) - 12).toFixed(1) + '" text-anchor="end" font-size="13" font-weight="700" fill="#e9eff4">' + last[1] + '</text></svg></div>';
  };
  function attrCard(h) {
    var order = ['Físico', 'Técnico', 'Mental', 'Defensa'], groups = {}, wn = C.WN[h.pos] || C.WN.CM;
    C.ATTRS.forEach(function (a) { (groups[C.ATTR_GRP[a]] = groups[C.ATTR_GRP[a]] || []).push(a); });
    return '<div class="attr-grid">' + order.map(function (g) {
      var avg = groups[g].reduce(function (s, a) { return s + h.at[a]; }, 0) / groups[g].length;
      return '<div class="attr-g"><h4><span>' + g + '</span><span style="color:' + UI.valColor(avg) + '">' + Math.round(avg) + '</span></h4>' + groups[g].map(function (a) {
        var v = h.at[a], d = h.at0 ? v - h.at0[a] : 0, col = UI.valColor(v);
        return '<div class="attr"><span class="nm">' + C.ATTR_NAME[a] + (wn[a] > 0.07 ? ' <span class="pill g" style="font-size:.6rem;padding:0 .4rem">clave</span>' : '') + '</span><div class="bar"><i style="width:' + v + '%;background:' + col + '"></i></div><span class="v"><span class="av-badge" style="background:' + col + '">' + Math.round(v) + '</span></span></div>' + (d > 0.4 ? '' : '');
      }).join('') + '</div>';
    }).join('') + '</div>';
  }
  SC.player = function () {
    var S = FP.S, h = S.hero, age = FP.Hero.age(), tab = UI.tab.player || 'sum', cols = UI.heroColors(), pr = FP.Hero.potRange(), bm = benchmarks();
    if (['sum', 'attr', 'stats', 'career', 'manage'].indexOf(tab) < 0) tab = 'sum';
    var alt = posAlt(h), val = FP.Market.heroValue();
    var html = '<div class="pf-head" style="--c1:' + cols[0] + '66"><div class="avatar">' + UI.avatar(h) + '</div><div style="min-width:0"><h1 class="pf-name">' + esc(h.nm) + '</h1><div class="hc-meta"><span style="display:inline-flex;align-items:center">' + UI.flag(h.nat, 1) + esc(C.cname(h.nat)) + '</span><i class="sep"></i><span style="display:inline-flex;align-items:center">' + teamLabel(h) + '</span></div><div class="hc-tags">' + posLabel(h) + alt.map(function (p) { return '<span class="pill">' + C.POS_ES[p] + '</span>'; }).join('') + UI.heroStatusPills() + '</div>' +
      '<div class="pf-facts"><div><span>Edad</span><b>' + age + ' años</b></div><div><span>Altura</span><b>' + h.ht + ' cm</b></div><div><span>Peso</span><b>' + h.kg + ' kg</b></div><div><span>Pie</span><b>' + ({ R: 'Derecho', L: 'Izquierdo', A: 'Ambos' }[h.foot]) + '</b></div></div></div>' +
      '<div class="pf-side">' + UI.ovrHex(h.ovr, 128) + '<div class="pf-sub">Potencial <b style="color:var(--tx)">' + pr[0] + '–' + pr[1] + '</b> ' + UI.stars(((pr[0] + pr[1]) / 2 - 40) * 1.7) + '</div></div></div>';
    html += '<div class="kpis">' + [['Valor de mercado', UI.money(val), 'chart'], ['Contrato', h.contract && h.tk !== 'amat' ? 'hasta ' + h.contract.end : '—', 'contract'], ['Sueldo anual', h.contract && h.contract.wage ? UI.money(h.contract.wage) : '—', 'transfer'], ['Estilo', FP.Hero.STYLES[h.style].n, 'zap'], ['Seguidores', FP.fmt.num((h.soc && h.soc.fol) || FP.Social.followers()), 'chat']].map(function (k) { return '<div class="kpi"><div class="kl">' + I(k[2]) + k[0] + '</div><div class="kv2" style="font-size:' + (k[1].length > 12 ? '1.05rem' : '1.35rem') + '">' + k[1] + '</div></div>'; }).join('') + '</div>';
    html += '<div class="tabs">' + [['sum', 'Resumen'], ['attr', 'Atributos'], ['stats', 'Estadísticas'], ['career', 'Trayectoria'], ['manage', 'Gestión']].map(function (t) { return '<button class="' + (tab === t[0] ? 'on' : '') + '" data-act="tabset" data-s="player" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (tab === 'sum') {
      var wn = C.WN[h.pos] || C.WN.CM, key = Object.keys(wn).sort(function (a, b) { return wn[b] - wn[a]; }).slice(0, 6);
      html += '<div class="grid g21"><div><div class="card"><div class="hd"><h3>' + I('star') + 'Atributos clave de ' + esc(C.POS_NAME[h.pos]) + '</h3></div>' + key.map(function (a) { var v = h.at[a], col = UI.valColor(v); return '<div class="attr"><span class="nm">' + C.ATTR_NAME[a] + '</span><div class="bar"><i style="width:' + v + '%;background:' + col + '"></i></div><span class="v"><span class="av-badge" style="background:' + col + '">' + Math.round(v) + '</span></span></div>'; }).join('') + '</div>' +
        '<div class="card"><div class="hd"><h3>' + I('chart') + 'Comparativa</h3>' + (bm.lg ? '<span class="mut sm">vs ' + esc(C.POS_NAME[h.pos]) + ' de ' + esc(bm.lg) + '</span>' : '') + '</div>' +
        (bm.avg != null ? cmpBar('Media general', h.ovr, bm.avg, bm.top, 100) + '<div class="cmp"><span class="cl">Media de la liga</span><div class="cmp-bars"><i style="width:' + bm.avg + '%;background:var(--ac2)"></i></div><b>' + Math.round(bm.avg) + '</b></div><div class="cmp"><span class="cl">Élite de la liga</span><div class="cmp-bars"><i style="width:' + bm.top + '%;background:var(--gold)"></i></div><b>' + Math.round(bm.top) + '</b></div><p class="mut sm">Estás por encima del <b style="color:var(--tx)">' + bm.pct + '%</b> de los ' + bm.n + ' jugadores de tu posición en esta liga.</p>' : '<p class="mut sm">Cuando juegues en un club profesional verás cómo te comparas con tu posición en la liga.</p>') +
        (bm.goalLead != null ? cmpBar('Goles', h.season.g, bm.goalAvg, bm.goalLead, Math.max(bm.goalLead, h.season.g, 1) * 1.15) + '<p class="mut sm">Líder de goleo: ' + bm.goalLead + ' · promedio del top 10: ' + bm.goalAvg.toFixed(1) + '</p>' : '') + '</div></div>' +
        '<div><div class="card"><div class="hd"><h3>' + I('target') + 'Perfil</h3></div>' + UI.radar(h, 240) + '</div><div class="card"><div class="hd"><h3>' + I('bell') + 'Estado</h3></div><div class="rings" style="justify-content:space-around">' + UI.ring(h.form, 'Forma', Math.round(h.form), '#46aabd') + UI.ring(h.mor, 'Moral', Math.round(h.mor), '#2fbf71') + UI.ring(h.fat, 'Fatiga', Math.round(h.fat), h.fat > 70 ? '#e5545a' : '#e2a93b') + '</div></div></div></div>';
    } else if (tab === 'attr') {
      html += '<div class="card"><div class="hd"><h3>' + I('target') + 'Atributos (1–99)</h3><span class="mut sm">Colores por nivel · “clave” = pesa en tu posición</span></div>' + attrCard(h) + '</div>';
      html += '<div class="card"><h3>Cambio desde el inicio de la carrera</h3><div class="grid g4">' + C.ATTRS.map(function (a) { var d = h.at[a] - h.at0[a]; return '<div class="row sp"><span class="mut">' + C.ATTR_NAME[a] + '</span><b class="' + (d > 0.5 ? 'ok' : d < -0.5 ? 'bad' : 'mut') + '">' + (d >= 0 ? '+' : '') + d.toFixed(1) + '</b></div>'; }).join('') + '</div></div>';
    } else if (tab === 'stats') {
      var s = h.season, T = h.tot;
      html += '<div class="grid g4" style="margin-bottom:1rem">' + [['Partidos', s.ap, 'carrera ' + T.ap], ['Goles', s.g, 'carrera ' + T.g], ['Asistencias', s.a, 'carrera ' + T.a], ['Nota media', s.rn ? (s.rs / s.rn).toFixed(2) : '—', T.rn ? 'carrera ' + (T.rs / T.rn).toFixed(2) : '']].map(function (k) { return '<div class="kpi"><div class="kl">' + k[0] + '</div><div class="kv2">' + k[1] + '</div><div class="ks">' + k[2] + '</div></div>'; }).join('') + '</div>';
      html += '<div class="grid g2"><div class="card"><h3>Esta temporada</h3><dl class="kv"><dt>Titular</dt><dd>' + s.st + '</dd><dt>Minutos</dt><dd>' + s.min + '</dd><dt>Goles por partido</dt><dd>' + (s.ap ? (s.g / s.ap).toFixed(2) : '—') + '</dd><dt>Minutos por gol</dt><dd>' + (s.g ? Math.round(s.min / s.g) : '—') + '</dd><dt>Amarillas / rojas</dt><dd>' + s.yc + ' / ' + s.rc + '</dd></dl></div>' +
        '<div class="card"><h3>Selección</h3><dl class="kv"><dt>Partidos</dt><dd>' + h.nt.caps + '</dd><dt>Goles</dt><dd>' + h.nt.goals + '</dd><dt>Última categoría</dt><dd>' + (h.nt.cat || '—') + '</dd></dl></div></div>';
      html += '<div class="card"><h3>Últimos partidos</h3>' + (h.log.slice(0, 10).map(function (m) { return '<div class="row sp" style="padding:.4rem 0;border-bottom:1px solid var(--line)"><span>' + UI.crest(m.o) + '<span class="pill ' + (m.r === 'V' ? 'g' : m.r === 'D' ? 'r' : '') + '">' + m.r + '</span> ' + esc(m.s) + ' <span class="mut">vs</span> ' + UI.club(m.o) + '</span><span class="mut sm">' + esc(m.c) + ' · ' + (m.rt ? '<b style="color:' + UI.valColor(m.rt * 10) + '">' + m.rt.toFixed(1) + '</b> · ' : '') + m.min + "'" + (m.g ? ' · ' + m.g + ' gol' : '') + '</span></div>'; }).join('') || '<p class="mut">Sin partidos todavía.</p>') + '</div>';
    } else if (tab === 'career') {
      html += '<div class="card"><div class="hd"><h3>' + I('chart') + 'Evolución de la media</h3><span class="mut sm">Línea punteada = cambio de club</span></div>' + UI.evoChart(h) + '</div>';
      html += '<div class="grid g21"><div class="card"><h3>Temporada por temporada</h3>' + UI.seasonsTable(h) + '</div><div><div class="card"><h3>Trofeos y premios</h3>' + (h.trophies.length || h.awards.length ? h.trophies.slice(-6).reverse().map(function (t) { return '<div class="row sp" style="padding:.3rem 0"><span>' + I(t.sub ? 'medal' : 'trophy') + ' ' + esc(t.nm) + '</span><span class="mut sm">' + esc(t.y) + '</span></div>'; }).join('') + h.awards.slice(-4).reverse().map(function (t) { return '<div class="row sp" style="padding:.3rem 0"><span class="gold">' + I('star') + ' ' + esc(t.nm) + '</span><span class="mut sm">' + esc(t.y) + '</span></div>'; }).join('') : '<p class="mut">Aún sin títulos ni premios.</p>') + '</div>' +
        '<div class="card"><h3>Línea de tiempo</h3><div class="timeline-v">' + ((h.history || []).slice().reverse().slice(0, 8).map(function (x) { return '<div class="tv-i"><div class="td">' + D.fmt(x.w) + '</div>' + esc(x.t) + '</div>'; }).join('') || '<p class="mut">Sin movimientos todavía.</p>') + '</div></div></div></div>';
    } else {
      html += SC._playerManage(h);
    }
    return html;
  };
  // pestaña Gestión: conserva todas las acciones anteriores (datos, posición, instrucción, retiro)
  SC._playerManage = function (h) {
    var html = '<div class="card"><h3>Datos personales</h3><div class="grid g4"><label class="f"><span>Nombre</span><input type="text" id="e_nm" value="' + esc(h.nm) + '"></label><label class="f"><span>Ciudad natal</span><input type="text" id="e_city" value="' + esc(h.city) + '"></label><label class="f"><span>Altura (cm)</span><input type="number" id="e_ht" value="' + h.ht + '" min="140" max="210"></label><label class="f"><span>Peso (kg)</span><input type="number" id="e_kg" value="' + h.kg + '" min="35" max="120"></label><label class="f"><span>Pie dominante</span><select id="e_foot"><option value="R"' + (h.foot === 'R' ? ' selected' : '') + '>Derecho</option><option value="L"' + (h.foot === 'L' ? ' selected' : '') + '>Izquierdo</option><option value="A"' + (h.foot === 'A' ? ' selected' : '') + '>Ambidiestro</option></select></label></div><p style="margin-top:.8rem"><button class="btn pri" data-act="savedet">Guardar</button></p></div>';
    html += '<div class="card"><h3>Posición</h3><p class="mut sm">Puedes reconvertirte a lo largo de la carrera. Tus atributos no cambian, pero tu media se recalcula con los pesos de la nueva posición (el portero no está disponible: el modelo de atributos no incluye habilidades de arquero).</p><div class="btn-group">' + C.POS.filter(function (p) { return p !== 'GK'; }).map(function (p) { return '<button class="btn sm ' + (h.pos === p ? 'pri' : '') + '" data-act="setpos" data-p="' + p + '">' + C.POS_ES[p] + ' · ' + esc(C.POS_NAME[p]) + ' (' + Math.round(C.ovrOf(h.at, p)) + ')</button>'; }).join('') + '</div></div>';
    html += '<div class="card"><h3>Instrucción personal en los partidos</h3><p class="mut sm">Cómo juegas dentro de la táctica del equipo.</p><div class="btn-group">' + [[-1, 'Conservador'], [0, 'Equilibrado'], [1, 'Agresivo / ofensivo']].map(function (o) { return '<button class="btn sm ' + ((h.instr || 0) === o[0] ? 'pri' : '') + '" data-act="setinstr" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
    html += '<div class="card"><h3>Retiro</h3><p class="mut sm">Puedes retirarte en cualquier momento. A los 39 años el retiro es automático.</p><button class="btn dng" data-act="retire">Anunciar retiro</button></div>';
    return html;
  };

  // ======================= PARTIDO =======================
  var EVI = { goal: 'ball', yellow: 'card', red: 'card', inj: 'inj', sub: 'sub', pen: 'target', save: 'glove', post: 'target', miss: 'ball', block: 'shield', chance: 'zap', start: 'whistle', ht: 'whistle', end: 'whistle', et: 'clock', pens: 'target' };
  var MAJOR = { goal: 1, yellow: 1, red: 1, sub: 1, inj: 1 };
  UI.mevRow = function (e) {
    var dimEv = !MAJOR[e.t] && !e.hero, ic = EVI[e.t] || 'ball';
    var cls = 'mev ' + (e.t === 'goal' ? 'goal ' : '') + (e.hero ? 'hero ' : '') + (dimEv ? 'dim-ev' : '');
    return '<div class="' + cls + '"><span class="mm">' + (e.m ? e.m + "'" : '') + '</span><span class="mi t-' + (e.red2 ? 'red' : e.t) + '">' + I(ic) + '</span><span>' + esc(e.x) + (e.t === 'goal' ? ' <b class="nowrap">(' + e.hs + '-' + e.as_ + ')</b>' : '') + '</span></div>';
  };
  UI.tlEvent = function (e, total) {
    if (!MAJOR[e.t] && !e.hero) return '';
    var ic = e.t === 'goal' ? 'ball' : e.t === 'sub' ? 'sub' : e.t === 'inj' ? 'inj' : 'card';
    var cls = e.red2 ? 'red' : e.t, side = e.s === 'a' ? 'a' : 'h';
    return '<span class="tl-ev ' + side + ' ' + cls + (e.hero ? ' hero' : '') + '" style="left:' + Math.min(99, e.m / total * 100).toFixed(1) + '%" title="' + esc((e.m || 0) + "' " + e.x) + '">' + I(ic, e.t === 'goal' ? '' : '') + '</span>';
  };
  UI.matchStats = function (evs, upto) {
    var s = { sh: [0, 0], on: [0, 0], g: [0, 0], y: [0, 0], r: [0, 0], sub: [0, 0] };
    evs.forEach(function (e) {
      if (upto != null && e.m > upto) return; var i = e.s === 'a' ? 1 : 0;
      if (e.t === 'goal') { s.g[i]++; s.sh[i]++; s.on[i]++; } else if (e.t === 'save' || e.t === 'post') { s.sh[i]++; s.on[i]++; } else if (e.t === 'miss' || e.t === 'block') { if (!/penal/i.test(e.x)) s.sh[i]++; }
      else if (e.t === 'yellow') { if (e.red2) s.r[i]++; else s.y[i]++; } else if (e.t === 'red') s.r[i]++; else if (e.t === 'sub') s.sub[i]++;
    });
    return s;
  };
  UI.statBars = function (s) {
    function row(l, a, b) { var t = (a + b) || 1; return '<div class="sbar"><div class="sl">' + l + '</div><b>' + a + '</b><div class="tr"><i class="hh" style="width:' + (a / t * 100) + '%"></i><i class="aa" style="width:' + (b / t * 100) + '%"></i></div><b>' + b + '</b></div>'; }
    return row('Remates', s.sh[0], s.sh[1]) + row('A puerta', s.on[0], s.on[1]) + row('Goles', s.g[0], s.g[1]) + row('Amarillas', s.y[0], s.y[1]) + row('Cambios', s.sub[0], s.sub[1]);
  };
  function teamBlock(id, comp, st) {
    var p = teamPos(comp, id), l5 = last5(comp, id);
    return '<div class="mc-team">' + UI.crest(id, 'lg') + '<div class="tn">' + UI.club(id) + '</div><div class="ts">' + (st || '') + (p ? ordinal(p.pos) + ' · ' + p.pts + ' pts' : '') + '</div>' + (l5.length ? UI.form(l5) : '') + '</div>';
  }
  SC.match = function () {
    var S = FP.S, h = S.hero;
    if (!UI.mt && S.pending && S.pending.length) { var prep = FP.Game.nextPending(); if (prep) UI.mt = { phase: 'pre', prep: prep }; }
    var mt = UI.mt;
    if (!mt) {
      var last = h.log[0];
      return '<div class="card" style="text-align:center;padding:2.2rem 1rem">' + I('whistle', 'lgic') + '<h2 style="margin-top:.8rem">No tienes partidos pendientes</h2><p class="mut">' + (last ? 'Último partido: <b style="color:var(--tx)">' + esc(last.c) + '</b> — ' + esc(last.s) + ' vs ' + UI.club(last.o) + ' (' + D.fmt(last.w) + ')' + (last.rt ? ' · nota ' + last.rt.toFixed(1) : '') : 'Aún no has jugado en esta carrera.') + '</p><button class="btn cta" data-act="adv" data-w="1">' + I('play', 'fill') + UI.ctaLabel()[0] + '</button></div>';
    }
    var prep2 = mt.prep, f = prep2.f, comp = prep2.comp, st = prep2.status, left = S.pending.length;
    var top = '<div class="mc-top"><span>' + esc(comp.nm) + (f.ro ? ' · ' + esc(f.ro) : '') + '</span><span>·</span><span>' + D.fmt(f.w) + '</span>' + (left > 1 ? '<span class="pill y">' + left + ' partidos esta semana</span>' : '') + '</div>';
    if (mt.phase === 'pre') {
      var html = '<div class="mc">' + top + '<div class="mc-main">' + teamBlock(f.h, comp, 'Local · ') + '<div class="mc-score"><div class="big" style="color:var(--dim)">VS</div><div class="min">' + I('clock') + 'Por comenzar</div></div>' + teamBlock(f.a, comp, 'Visitante · ') + '</div></div>';
      html += '<div class="grid g21"><div class="card"><div class="hd"><h3>' + I('user') + 'Tu partido</h3></div><div class="grid g3"><div><h4>Tu rol hoy</h4><b style="font-size:1.1rem">' + ({ starter: 'Titular', bench: 'Suplente', out: 'Fuera de convocatoria' }[st.role]) + '</b>' + (st.why ? '<div><span class="pill y">' + esc(st.why) + '</span></div>' : '') + '</div><div><h4>Fuerza del equipo</h4><div>' + esc(C.tname(f.h)) + ' <b>' + (comp.ys && comp.ys[f.h] != null ? comp.ys[f.h] : C.strOf(f.h)) + '</b></div><div>' + esc(C.tname(f.a)) + ' <b>' + (comp.ys && comp.ys[f.a] != null ? comp.ys[f.a] : C.strOf(f.a)) + '</b></div></div><div><h4>Condición</h4><div class="rings">' + UI.ring(h.form, 'Forma', Math.round(h.form), '#46aabd') + UI.ring(h.fat, 'Fatiga', Math.round(h.fat), h.fat > 70 ? '#e5545a' : '#e2a93b') + '</div></div></div>' +
        '<h4 style="margin-top:1rem">Instrucción personal</h4><div class="btn-group">' + [-1, 0, 1].map(function (v) { return '<button class="btn sm ' + ((h.instr || 0) === v ? 'pri' : '') + '" data-act="minstr" data-v="' + v + '">' + ({ '-1': 'Conservador', '0': 'Equilibrado', '1': 'Agresivo' }[v]) + '</button>'; }).join('') + '</div></div>' +
        '<div class="card"><div class="hd"><h3>' + I('play') + 'Cómo quieres jugarlo</h3></div><p class="mut sm">Puedes seguir el relato minuto a minuto o simular el partido al instante.</p><div style="display:grid;gap:.6rem"><button class="btn cta" data-act="mplay" data-mode="live">' + I('play', 'fill') + 'Ver minuto a minuto</button><button class="btn" data-act="mplay" data-mode="quick">' + I('zap') + 'Simulación rápida</button></div></div></div>';
      return html;
    }
    var res = mt.res, hm = res.hero, live = mt.phase === 'play', total = Math.max(res.et ? 120 : 90, res.ev.length ? res.ev[res.ev.length - 1].m : 90);
    var mineH = prep2.home, mg = mineH ? res.hs : res.as, og = mineH ? res.as : res.hs;
    var letter = res.ps ? ((mineH ? res.ps[0] > res.ps[1] : res.ps[1] > res.ps[0]) ? 'V' : 'D') : mg > og ? 'V' : mg < og ? 'D' : 'E';
    var html2 = '';
    if (!live) {
      html2 += '<div class="res-banner ' + letter + '"><div><div class="rt">' + ({ V: 'Victoria', D: 'Derrota', E: 'Empate' }[letter]) + '</div><div class="rs2">' + esc(comp.nm) + (f.ro ? ' · ' + esc(f.ro) : '') + ' · ' + D.fmt(f.w) + (res.et ? ' · tras prórroga' : '') + (res.ps ? ' · penales ' + res.ps[0] + '-' + res.ps[1] : '') + '</div></div><div class="row" style="gap:1.4rem">' + UI.crest(f.h, 'lg') + '<span class="mc-score"><span class="big" style="font-size:3rem">' + res.hs + '<i>-</i>' + res.as + '</span></span>' + UI.crest(f.a, 'lg') + '</div>' + (hm && hm.played ? '<div class="row" style="gap:.8rem"><div style="text-align:center">' + UI.rateRing(hm.rating) + '<div class="mut sm">Tu nota</div></div></div>' : '') + '</div>';
    }
    html2 += '<div class="mc"><div class="mc-top"><span>' + esc(comp.nm) + (f.ro ? ' · ' + esc(f.ro) : '') + '</span><span>·</span><span>' + D.fmt(f.w) + '</span></div><div class="mc-main">' + teamBlock(f.h, comp, '') + '<div class="mc-score"><div class="big" id="mt-score">' + (live ? '0<i>-</i>0' : res.hs + '<i>-</i>' + res.as) + '</div><div class="min ' + (live ? 'live' : '') + '" id="mt-min">' + (live ? "0'" : (res.et ? 'Final · prórroga' : 'Final')) + '</div>' + (res.ps ? '<div class="mut sm" style="margin-top:.3rem">Penales ' + res.ps[0] + ' - ' + res.ps[1] + '</div>' : '') + '</div>' + teamBlock(f.a, comp, '') + '</div>' +
      '<div class="tl" id="mt-tl"><div class="tl-line"><i id="mt-tlf" style="width:' + (live ? 0 : 100) + '%"></i></div>' + [0, 15, 30, 45, 60, 75, 90].filter(function (m) { return m <= total; }).map(function (m) { return '<span class="tl-tick" style="left:' + (m / total * 100) + '%"></span><span class="tl-lab" style="left:' + (m / total * 100) + '%">' + m + "'</span>"; }).join('') + '<span id="mt-tle">' + (live ? '' : res.ev.map(function (e) { return UI.tlEvent(e, total); }).join('')) + '</span></div>' +
      (live ? '<div class="btn-group" style="justify-content:center;margin-top:.4rem"><button class="btn sm" data-act="mspeed" data-v="1">1×</button><button class="btn sm" data-act="mspeed" data-v="3">3×</button><button class="btn sm" data-act="mspeed" data-v="8">8×</button><button class="btn sm pri" data-act="mskip">' + I('skip') + 'Saltar al final</button></div>' : '') + '</div>';
    html2 += '<div class="mgrid"><div class="card"><div class="hd"><h3>' + I('whistle') + 'Relato del partido</h3></div><div class="evbox" id="mt-ev" style="max-height:460px;background:transparent;padding:0">' + (live ? '' : res.ev.map(UI.mevRow).join('')) + '</div></div><div>';
    html2 += '<div class="card"><div class="hd"><h3>' + I('chart') + 'Estadísticas</h3></div><div id="mt-st">' + UI.statBars(UI.matchStats(res.ev, live ? 0 : null)) + '</div></div>';
    if (hm) html2 += '<div class="card" id="mt-hero" ' + (live ? 'style="display:none"' : '') + '><div class="hd"><h3>' + I('user') + 'Tu rendimiento</h3></div>' + (hm.played ? '<div class="pstat"><div><b>' + hm.min + "'" + '</b><span>Minutos</span></div><div><b>' + hm.g + '</b><span>Goles</span></div><div><b>' + hm.a + '</b><span>Asistencias</span></div><div><b>' + hm.sh + '</b><span>Remates</span></div></div><p class="mut sm" style="margin-top:.6rem">' + (hm.subIn ? 'Ingresaste al minuto ' + hm.subIn + '. ' : 'Fuiste titular. ') + 'Remates a puerta: ' + hm.sot + ' · Pases clave: ' + hm.kp + ' · Tarjetas: ' + hm.yc + ' amarilla(s), ' + hm.rc + ' roja(s).' + (hm.inj ? ' <span class="bad">Terminaste lesionado.</span>' : '') + '</p>' : '<p class="mut">' + ({ out: 'Quedaste fuera de la convocatoria.', bench: 'Estuviste en el banco pero no ingresaste.', starter: '' }[prep2.status.role] || '') + (prep2.status.why ? ' (' + esc(prep2.status.why) + ')' : '') + '</p>') + '</div>';
    html2 += '<div class="card"><div class="hd"><h3>' + I('user') + 'Alineaciones</h3></div><div class="grid g2"><div><h4>' + esc(C.tname(f.h)) + (res.form ? ' · ' + res.form.h : '') + '</h4>' + res.xi.h.map(function (p) { return '<div class="sm">' + (p.id === 0 ? '<b class="ok">' : '') + esc(p.n) + (p.id === 0 ? '</b>' : '') + ' <span class="dim">' + UI.pos(p.pos) + ' ' + Math.round(p.o) + '</span></div>'; }).join('') + '</div><div><h4>' + esc(C.tname(f.a)) + (res.form ? ' · ' + res.form.a : '') + '</h4>' + res.xi.a.map(function (p) { return '<div class="sm">' + (p.id === 0 ? '<b class="ok">' : '') + esc(p.n) + (p.id === 0 ? '</b>' : '') + ' <span class="dim">' + UI.pos(p.pos) + ' ' + Math.round(p.o) + '</span></div>'; }).join('') + '</div></div><p class="mut sm" style="margin-top:.4rem">Los futbolistas rivales y compañeros son generados por el juego.</p></div></div></div>';
    if (!live) html2 += '<div class="card" style="text-align:right"><button class="btn cta" data-act="mnext">' + (left > 1 ? 'Siguiente partido' : 'Terminar la semana') + I('arrow') + '</button></div>';
    return html2;
  };
  // reproducción minuto a minuto
  UI.after.match = function () {
    var mt = UI.mt; if (!mt || mt.phase !== 'play') return;
    if (mt.timer) clearInterval(mt.timer);
    var res = mt.res, idx = mt.idx || 0, box = document.getElementById('mt-ev'), score = document.getElementById('mt-score'), clock = document.getElementById('mt-min'), tle = document.getElementById('mt-tle'), tlf = document.getElementById('mt-tlf'), st = document.getElementById('mt-st');
    var total = Math.max(res.et ? 120 : 90, res.ev.length ? res.ev[res.ev.length - 1].m : 90), hs = 0, as = 0;
    for (var i = 0; i < idx; i++) { var e0 = res.ev[i]; box.insertAdjacentHTML('beforeend', UI.mevRow(e0)); tle.insertAdjacentHTML('beforeend', UI.tlEvent(e0, total)); if (e0.t === 'goal') { hs = e0.hs; as = e0.as_; } }
    score.innerHTML = hs + '<i>-</i>' + as;
    mt.timer = setInterval(function () {
      mt.minute = (mt.minute || 0) + 1; clock.textContent = mt.minute + "'"; tlf.style.width = Math.min(100, mt.minute / total * 100) + '%';
      var changed = false;
      while (idx < res.ev.length && res.ev[idx].m <= mt.minute) {
        var e = res.ev[idx++]; box.insertAdjacentHTML('beforeend', UI.mevRow(e)); tle.insertAdjacentHTML('beforeend', UI.tlEvent(e, total)); box.scrollTop = box.scrollHeight; changed = true;
        if (e.t === 'goal') { hs = e.hs; as = e.as_; score.innerHTML = hs + '<i>-</i>' + as; }
      }
      if (changed) st.innerHTML = UI.statBars(UI.matchStats(res.ev, mt.minute));
      mt.idx = idx;
      if (mt.minute >= total && idx >= res.ev.length) UI.matchFinish();
    }, 520 / (mt.speed || 1));
  };
})();
