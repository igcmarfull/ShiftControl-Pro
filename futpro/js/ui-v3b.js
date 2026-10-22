/* FUTPRO — interfaz v3 (fase 2): rediseño de pantallas secundarias con la identidad visual de la fase 1.
   Solo presentación; conserva todos los manejadores (data-act) y no toca el estado ni el motor. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, A = UI.acts, SC = UI.screens, Comp = FP.Comp, I = UI.icon;

  function plain(t) { return String(t == null ? '' : t).replace(/<[^>]*>/g, ''); }
  function hdr(icon, title, sub, tools) {
    return '<div class="scr-h"><div><h1>' + I(icon) + esc(title) + '</h1>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' + (tools ? '<div class="tools">' + tools + '</div>' : '') + '</div>';
  }
  function seg(scr, list, cur) {
    return '<div class="seg">' + list.map(function (t) { return '<button class="' + (cur === t[0] ? 'on' : '') + '" data-act="tabset" data-s="' + scr + '" data-t="' + t[0] + '">' + (t[2] ? I(t[2]) : '') + t[1] + '</button>'; }).join('') + '</div>';
  }
  UI.hdr = hdr; UI.seg = seg;
  function posGrp(p) { return p === 'GK' ? 'G' : (p === 'CB' || p === 'LB' || p === 'RB') ? 'D' : (p === 'DM' || p === 'CM' || p === 'AM') ? 'M' : 'F'; }
  UI.posb = function (p) { return '<span class="posb ' + posGrp(p) + '">' + esc(C.POS_ES[p] || p) + '</span>'; };
  UI.nation = function (code) { return '<span style="display:inline-flex;align-items:center;gap:.3rem">' + UI.flag(code) + '<span class="mut sm">' + esc(code) + '</span></span>'; };
  function compList() {
    var out = []; Object.keys(FP.S.comps).forEach(function (id) { var c = FP.S.comps[id]; if (c.kind === 'L' || c.kind === 'C' || c.kind === 'X' || c.kind === 'Q' || c.kind === 'T' || c.kind === 'A' || c.kind === 'Y' || (c.kind === 'K' && !c.done)) out.push(c); });
    return out;
  }

  // ---------- partidos de una competición (con escudos) ----------
  UI.fixturesFor = function (comp, key) {
    var S = FP.S, fx = comp.fx, rounds = {};
    fx.forEach(function (f) { var k = f.k ? (f.ro || 'Eliminatoria') + (f.l ? ' (ida/vuelta)' : '') : (f.r ? 'Fecha ' + f.r : D.fmt(f.w)); (rounds[k] = rounds[k] || []).push(f); });
    var keys = Object.keys(rounds);
    if (!keys.length) return '<p class="mut">Sin partidos.</p>';
    var cur = UI.filt[key];
    if (!cur || keys.indexOf(cur) < 0) { var next = comp.fx[Math.min(comp.cp, comp.fx.length - 1)]; cur = keys.filter(function (k) { return rounds[k].indexOf(next) >= 0; })[0] || keys[0]; }
    var k0 = esc(JSON.stringify(keys)), me = S.hero.team, mine = [me].concat(S.hero.extraTeams || []);
    var h = '<div class="row sp" style="margin-bottom:.5rem"><button class="btn sm" data-act="rnd" data-k="' + key + '" data-d="-1" data-keys="' + k0 + '" data-cur="' + esc(cur) + '">' + I('chev') + '</button><b>' + esc(cur) + '</b><button class="btn sm" data-act="rnd" data-k="' + key + '" data-d="1" data-keys="' + k0 + '" data-cur="' + esc(cur) + '">' + I('chev') + '</button></div><div>';
    h += rounds[cur].map(function (f) {
      var sc = f.d ? '<b>' + f.hs + ' - ' + f.as + '</b>' + (f.ps ? ' <span class="mut sm">(' + f.ps[0] + '-' + f.ps[1] + ' pen.)</span>' : f.et ? ' <span class="mut sm">(pró.)</span>' : '') : '<span class="dim sm">' + D.fmt(f.w) + '</span>';
      var m = mine.indexOf(f.h) >= 0 || mine.indexOf(f.a) >= 0;
      return '<div class="fxr' + (m ? ' me' : '') + '"><span class="fh ell">' + UI.club(f.h) + '</span>' + UI.crest(f.h) + '<span class="fs">' + sc + '</span>' + UI.crest(f.a) + '<span class="fa ell">' + UI.club(f.a) + '</span></div>';
    }).join('') + '</div>';
    return h;
  };

  // ---------- COMPETICIONES (maestro-detalle sin desplegables) ----------
  var CATS = ['Mi competición', 'Ligas', 'Copas nacionales', 'Continentales de clubes', 'Selecciones', 'Selecciones juveniles'];
  A.compcat = function (d) { UI.filt.compCat = d.v; UI.filt.compSel = null; UI.render(); };
  A.compsel = function (d) { UI.filt.compSel = d.v; UI.render(); };
  SC.comps = function () {
    var S = FP.S, me = S.hero.team, byCat = {}; CATS.forEach(function (k) { byCat[k] = []; });
    compList().forEach(function (c) {
      var cat = c.kind === 'L' ? 'Ligas' : c.kind === 'C' ? 'Copas nacionales' : c.kind === 'X' ? (c.nat ? 'Selecciones' : 'Continentales de clubes') : c.kind === 'Q' ? 'Selecciones' : c.kind === 'T' ? 'Selecciones juveniles' : 'Ligas';
      if (c.teams.indexOf(me) >= 0 && (c.kind === 'L' || c.kind === 'A' || c.kind === 'Y' || c.kind === 'C' || c.kind === 'X')) byCat['Mi competición'].push(c);
      if (c.kind === 'A' || c.kind === 'Y' || c.kind === 'K') return;
      byCat[cat].push(c);
    });
    var cat = UI.filt.compCat || 'Mi competición';
    if (!byCat[cat] || (!byCat[cat].length && cat === 'Mi competición')) cat = 'Ligas';
    var items = byCat[cat].slice();
    if (cat === 'Ligas') items.sort(function (a, b) { return (a.c || '').localeCompare(b.c || '') || (FP.LGDEF[a.lg] ? FP.LGDEF[a.lg].t : 0) - (FP.LGDEF[b.lg] ? FP.LGDEF[b.lg].t : 0); });
    var c0 = UI.filt.compSel && S.comps[UI.filt.compSel] && items.indexOf(S.comps[UI.filt.compSel]) >= 0 ? S.comps[UI.filt.compSel] : items[0] || null;
    var chips = '<div class="chips">' + CATS.map(function (k) { return '<button class="chip ' + (k === cat ? 'on' : '') + '" data-act="compcat" data-v="' + k + '">' + k.replace('Continentales de clubes', 'Continentales').replace('Selecciones juveniles', 'Juveniles') + ' <span class="dim">' + byCat[k].length + '</span></button>'; }).join('') + '</div>';
    var q = (UI.filt.compQ || '').toLowerCase(), shown = items.filter(function (c) { return !q || (c.nm + ' ' + (c.c ? FP.DATA.countries[c.c].n : '')).toLowerCase().indexOf(q) >= 0; }), lastC = null;
    var rail = '<div class="card md-l"><div class="hd"><h3>' + I('trophy') + 'Competiciones</h3></div>' + chips + '<input type="text" class="rail-q" data-live="filtq" data-k="compQ" placeholder="Filtrar…" value="' + esc(UI.filt.compQ || '') + '" style="width:100%;margin-top:.5rem"><div class="rail">' +
      shown.slice(0, 160).map(function (c) {
        var ctry = c.c && FP.DATA.countries[c.c] ? c.c : null, head = '';
        if (cat === 'Ligas' && ctry !== lastC) { head = '<div class="ag-m" style="margin:.4rem .3rem .1rem">' + esc(ctry ? FP.DATA.countries[ctry].n : '') + '</div>'; lastC = ctry; }
        return head + '<button class="' + (c === c0 ? 'on' : '') + '" data-act="compsel" data-v="' + c.id + '">' + (ctry ? UI.flag(ctry) : I('globe')) + '<span class="ell">' + esc(c.nm) + '</span>' + (c.done ? '' : '<i class="live"></i>') + '</button>';
      }).join('') + (shown.length ? '' : '<p class="mut sm" style="padding:.4rem">Sin resultados.</p>') + '</div></div>';
    var det = c0 ? '<div class="card">' + UI.compView(c0, 'comp') + '</div>' : '<div class="card"><p class="mut">No hay competiciones activas en esta categoría.</p></div>';
    return hdr('trophy', 'Competiciones', 'Ligas, copas y torneos del mundo') + '<div class="md">' + rail + '<div style="min-width:0">' + det + '</div></div>';
  };
  A.filtq = function (d, t) { UI.filt[d.k] = t.value; var pos = t.selectionStart; UI.render(); var n = document.querySelector('.rail-q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } } };

  // ---------- CLASIFICACIONES ----------
  SC.tables = function () {
    var S = FP.S, lgId = UI.filt.tbl || UI.myLeague(), lg = S.lgs[lgId], def = FP.LGDEF[lgId], comp = S.comps[lg.cmp];
    var html = hdr('table', 'Clasificaciones', esc(FP.DATA.countries[def.c].n) + ' · ' + esc(def.n), '<div class="filters" style="margin:0">' + UI.leagueSelect('tbl', { def: lgId }) + '</div>');
    html += '<div class="card"><div class="hd"><h3>' + UI.flag(def.c) + esc(def.n) + '</h3><span>' + UI.verBadge(def.v) + '</span></div>';
    if (comp) {
      html += '<p class="mut sm">Temporada ' + esc(comp.label) + ' · ' + (def.rr === 1 ? 'una vuelta' : def.mp ? def.mp + ' partidos por equipo' : 'ida y vuelta') + (def.po ? ' · liguilla final por el título (top ' + def.po.n + ')' : '') + (def.poUp ? ' · liguilla de ascenso (puestos ' + def.poUp[0] + '–' + def.poUp[1] + ')' : '') + '</p>';
      if (S.cfg.off && S.cfg.off[lgId] && lg.hist) html += '<div class="notice">Esta liga está desactivada: se simula en bloque al terminar la temporada.</div>';
      html += UI.tableFor(comp, null, 'tbl', true);
      html += '<p class="mut sm" style="margin-top:.5rem"><span class="pill g">ascenso</span> <span class="pill b">copas continentales</span> <span class="pill r">descenso</span></p>';
    }
    html += '</div>';
    var hist = lg.hist.slice().reverse();
    if (hist.length) html += '<div class="card"><div class="hd"><h3>' + I('trophy') + 'Campeones recientes</h3></div>' + hist.slice(0, 12).map(function (e) { return '<div class="hrow"><span class="mut" style="min-width:4.5rem">' + esc(e.l) + '</span><div class="grow ell">' + UI.crest(e.ch) + UI.club(e.ch) + '</div>' + (e.sc && e.sc[0] ? '<span class="mut sm ell">' + I('boot') + esc(e.sc[0][0]) + ' (' + e.sc[0][1] + ')</span>' : '') + '</div>'; }).join('') + '</div>';
    return html;
  };

  // ---------- CALENDARIO (agenda por mes) ----------
  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function dparts(w) { var y = D.ymd(w); return { d: y[2], m: y[1], y: y[0] }; }
  function monthLabel(w) { var p = dparts(w); return ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][p.m] + ' ' + p.y; }
  SC.calendar = function () {
    var S = FP.S, h = S.hero, tab = UI.tab.calendar || 'next';
    var html = hdr('calendar', 'Calendario', D.fmt(S.week), seg('calendar', [['next', 'Próximos', 'clock'], ['res', 'Resultados', 'history'], ['year', 'Fechas clave', 'pin']], tab));
    if (tab === 'next') {
      var nx = UI.nextFx(30), lastM = '';
      html += '<div class="card">' + (nx.length ? nx.map(function (x, i) {
        var f = x.f, mineId = (f.h === h.team || (x.nat && FP.Nat.heroNation() && f.h === FP.Nat.heroNation().id)) ? f.h : f.a, opp = f.h === mineId ? f.a : f.h, p = dparts(f.w), ml = monthLabel(f.w), head = '';
        if (ml !== lastM) { head = '<div class="ag-m">' + ml + '</div>'; lastM = ml; }
        return head + '<div class="ag-r' + (f.w <= S.week && i === 0 ? ' now' : '') + '"><div class="ag-d"><b>' + p.d + '</b><span>' + MES[p.m] + '</span></div><div style="min-width:0;display:flex;align-items:center;gap:.5rem">' + UI.crest(opp) + '<div style="min-width:0"><b class="ell" style="display:block">' + (f.h === mineId ? 'vs ' : '@ ') + esc(C.tname(opp)) + '</b><span class="mut sm ell" style="display:block">' + esc(x.c.nm) + (f.ro ? ' · ' + esc(f.ro) : '') + '</span></div></div>' + (x.nat ? '<span class="pill b">Selección</span>' : '<span class="pill">' + (f.h === mineId ? 'Local' : 'Visita') + '</span>') + '</div>';
      }).join('') : '<p class="mut">Sin partidos programados todavía.</p>') + '</div>';
    } else if (tab === 'res') {
      var rows = h.log.map(function (m) { return { w: m.w, c: m.c, o: m.o, h: m.h, s: m.s, r: m.r, role: m.role, min: m.min, g: m.g, a: m.a, rt: m.rt, off: m.off }; });
      html += UI.table('cal_res', [
        { k: 'w', t: 'Fecha', f: function (r) { return D.fmt(r.w); } }, { k: 'c', t: 'Competición' },
        { k: 'o', t: 'Rival', f: function (r) { return (r.h ? 'vs ' : '@ ') + UI.clubC(r.o); }, v: function (r) { return C.tname(r.o); } },
        { k: 's', t: 'Resultado', f: function (r) { return '<span class="pill ' + (r.r === 'V' ? 'g' : r.r === 'D' ? 'r' : '') + '">' + r.r + '</span> ' + esc(r.s); } },
        { k: 'role', t: 'Rol', f: function (r) { return { tit: 'Titular', sup: 'Suplente', banca: 'Banca', fuera: 'Fuera' }[r.role]; } },
        { k: 'min', t: 'Min', n: 1 }, { k: 'g', t: 'G', n: 1 }, { k: 'a', t: 'A', n: 1 }, { k: 'rt', t: 'Nota', n: 1, f: function (r) { return r.rt ? r.rt.toFixed(1) : '—'; } }
      ], rows, { sort: ['w', 'd'], max: 120 });
      if (!rows.length) html += '<p class="mut">Aún no hay partidos registrados.</p>';
    } else {
      var y = D.year(S.week), ev = [], wins = FP.Nat.windows(y);
      ev.push([D.of(y, 0, 2), 'Abre el mercado de invierno', 'transfer']); ev.push([D.of(y, 1, 5), 'Cierra el mercado de invierno', 'lock']);
      ev.push([D.of(y, 5, 15), 'Abre el mercado de verano', 'transfer']); ev.push([D.of(y, 8, 4), 'Cierra el mercado de verano', 'lock']);
      wins.forEach(function (w) { ev.push([w, 'Ventana FIFA de selecciones', 'flag']); });
      Object.keys(S.comps).forEach(function (id) { var c = S.comps[id]; if (!c.done && (c.kind === 'X' || c.kind === 'C') && c.w0 != null && c.w0 >= S.week && c.w0 < S.week + 60) ev.push([c.w0, 'Inicia: ' + c.nm + ' ' + (c.label || ''), 'trophy']); });
      ev = ev.filter(function (e) { return e[0] >= S.week - 1; }).sort(function (a, b) { return a[0] - b[0]; });
      var lm = '';
      html += '<div class="card">' + ev.map(function (e) { var p = dparts(e[0]), ml = monthLabel(e[0]), hd = ''; if (ml !== lm) { hd = '<div class="ag-m">' + ml + '</div>'; lm = ml; } return hd + '<div class="ag-r"><div class="ag-d"><b>' + p.d + '</b><span>' + MES[p.m] + '</span></div><div class="ell">' + I(e[2]) + ' ' + esc(e[1]) + '</div><span></span></div>'; }).join('') + '</div>';
    }
    return html;
  };

  // las tablas heredadas listan clubes solo con nombre: se les antepone el escudo sin tocar su código
  function withCrests(fn) {
    var uc = UI.club;
    UI.club = function (id, t) { return typeof id === 'number' && id >= 0 && id < 5000 ? UI.crest(id) + uc(id, t) : uc(id, t); };
    try { return fn(); } finally { UI.club = uc; }
  }
  // ---------- MERCADO ----------
  var oldMarket = SC.market;
  SC.market = function () {
    var S = FP.S, h = S.hero, tab = UI.tab.market || 'tryouts', win = FP.Market.isWindow(S.week);
    var html = hdr('transfer', 'Mercado de fichajes', '<span class="pill ' + (win ? 'g' : '') + '">' + (win ? esc(FP.Market.windowName(S.week)) + ' abierto' : 'Mercado cerrado') + '</span> · Tu valor: <b style="color:var(--tx)">' + UI.money(FP.Market.heroValue()) + '</b>', seg('market', [['tryouts', 'Pruebas', 'whistle'], ['players', 'Jugadores', 'user'], ['recent', 'Fichajes', 'transfer'], ['free', 'Sin club', 'flag']], tab));
    var inner = withCrests(oldMarket);
    inner = inner.replace(/^<h1>[\s\S]*?<\/div><div class="tabs">[\s\S]*?<\/div>/, '');
    return html + inner;
  };

  // ---------- CONTRATOS ----------
  function negoBtns(o) {
    if (o.wage == null || !(o.type === 'transfer' || o.type === 'semi' || o.type === 'renew' || o.type === 'pro')) return '';
    if (o.neg >= 2) return '<div class="mut sm" style="margin-top:.4rem">Negociación cerrada: acepta o rechaza.</div>';
    return '<div class="chips" style="margin-top:.45rem"><span class="mut sm" style="align-self:center">Negociar:</span><button class="chip" data-act="negot" data-id="' + o.id + '" data-w="0.1">+10% sueldo</button><button class="chip" data-act="negot" data-id="' + o.id + '" data-w="0.2">+20% sueldo</button><button class="chip" data-act="negot" data-id="' + o.id + '" data-y="1">+1 año</button><button class="chip" data-act="negot" data-id="' + o.id + '" data-y="-1">−1 año</button></div>';
  }
  var OT = { semi: 'Contrato semiprofesional', trial_pro: 'Prueba con el primer equipo', trial: 'Invitación a prueba', academy: 'Ingreso a la cantera', pro: 'Contrato profesional', transfer: 'Oferta de traspaso', loan: 'Cesión', renew: 'Renovación', event: 'Oportunidad', amateur: 'Club amateur' };
  SC.contracts = function () {
    var S = FP.S, h = S.hero, ct = h.contract, ci = UI.contractInfo(), tr = UI.trust();
    var html = hdr('contract', 'Contratos', 'Tu situación, ofertas y representante');
    html += '<div class="grid g2"><div class="card"><div class="hd"><h3>' + I('contract') + 'Contrato actual</h3>' + (ci.left != null && ci.left < 1 ? '<span class="pill y">Último año</span>' : '') + '</div>';
    if (ct && h.club != null) {
      var club = S.clubs[h.club], endW = FP.Market.contractEndWeek(ct, FP.LGDEF[club.lg].cal);
      html += '<div class="cc-top" style="margin-bottom:.5rem">' + UI.crest(h.club, 'lg') + '<div><b style="font-size:1.05rem">' + esc(club.nm) + '</b><div class="mut sm">' + ({ juvenil: 'Juvenil (cantera)', prof: 'Profesional', cesion: 'Cesión' }[ct.type] || ct.type) + '</div></div></div>' +
        '<div class="terms"><div><span>Sueldo anual</span><b>' + (ct.wage ? UI.money(ct.wage) + (FP.Wages ? ' <span class="mut sm">(' + FP.fmt.money(FP.Wages.monthly(ct.wage)) + ' al mes)</span>' : '') : 'Sin sueldo') + '</b></div><div><span>Vence</span><b>' + (h.tk === 'loan' ? 'Fin cesión' : ct.end) + '</b></div><div><span>Restante</span><b>' + (ci.left != null ? ci.left.toFixed(1) + ' años' : '—') + '</b></div><div><span>Valor</span><b>' + UI.money(FP.Market.heroValue()) + '</b></div></div>' +
        '<div class="kv-i" style="margin-top:.5rem"><span>Dinero acumulado</span><b>' + UI.money(h.money) + '</b></div><div class="mut sm" style="margin-top:.5rem">Confianza del míster</div><div class="trust">' + UI.bar(tr.v, 100, tr.cls) + '<b>' + tr.v + '</b></div>' +
        '<div class="btn-group" style="margin-top:.7rem">' + ((h.tk === 'pro' || h.tk === 'academy') && FP.Hero.age() <= 25 ? '<button class="btn sm" data-act="reqloan">' + I('transfer') + 'Pedir cesión</button>' : '') + '<button class="btn sm dng" data-act="reqtrans">' + I('transfer') + 'Solicitar salida</button></div>' + (h.tk === 'loan' && h.loan ? '<p class="mut sm">Cedido por ' + UI.club(h.loan.from) + '.</p>' : '');
    } else if (h.tk === 'amat') html += '<p class="mut">Juegas en un club amateur: no hay contrato ni sueldo.</p>';
    else html += '<p class="mut">Estás sin contrato. Revisa las ofertas.</p>';
    html += '</div><div class="card"><div class="hd"><h3>' + I('user') + 'Representante</h3></div>';
    if (h.agent) html += '<div class="terms" style="grid-template-columns:repeat(3,1fr)"><div><span>Nombre</span><b>' + esc(h.agent.nm) + '</b></div><div><span>Nivel</span><b class="rep">' + UI.stars(h.agent.lvl * 20) + '</b></div><div><span>Comisión</span><b>' + h.agent.com + '%</b></div></div><p class="mut sm" style="margin:.6rem 0">Más nivel: más ofertas y mejores sueldos.</p><button class="btn sm" data-act="dropagent">Despedir</button>';
    else if (FP.Hero.age() < 15) html += '<p class="mut">Podrás contratar un representante desde los 15 años.</p>';
    else html += '<p class="mut sm">Un representante consigue más y mejores ofertas, a cambio de una comisión sobre tu sueldo.</p>' + FP.Market.agentCandidates().map(function (a, i) { return '<div class="hrow"><div class="grow"><b>' + esc(a.nm) + '</b> <span class="tag-gen">generado</span><br><span class="rep">' + UI.stars(a.lvl * 20) + '</span> <span class="mut sm">comisión ' + a.com + '%</span></div><button class="btn sm pri" data-act="hire" data-i="' + i + '">Contratar</button></div>'; }).join('');
    html += '</div></div>';
    html += '<div class="card"><div class="hd"><h3>' + I('bell') + 'Ofertas y propuestas' + (h.offers.length ? ' <span class="pill y">' + h.offers.length + '</span>' : '') + '</h3></div>';
    if (!h.offers.length) html += '<p class="mut">No hay ofertas pendientes. Los clubes te observan según tu rendimiento; las ventanas de mercado traen más movimiento.</p>';
    h.offers.forEach(function (o) {
      var left = o.exp != null ? Math.max(0, o.exp - S.week) : null, cur = h.contract ? h.contract.wage : 0;
      var terms = '';
      if (o.wage != null || o.years || o.role || o.fee) terms = '<div class="terms">' + (o.wage != null ? '<div><span>Sueldo anual</span><b>' + (o.wage ? UI.money(o.wage) : 'Sin sueldo') + (cur && o.wage ? ' <span class="delta ' + (o.wage >= cur ? 'up' : 'dn') + '">' + (o.wage >= cur ? '▲' : '▼') + Math.abs(Math.round((o.wage / cur - 1) * 100)) + '%</span>' : '') + '</b></div>' : '') + (o.years ? '<div><span>Duración</span><b>' + o.years + ' año' + (o.years > 1 ? 's' : '') + '</b></div>' : '') + (o.role ? '<div><span>Rol prometido</span><b>' + esc(o.role) + '</b></div>' : '') + (o.fee ? '<div><span>Traspaso</span><b>' + UI.money(o.fee) + '</b></div>' : '') + '</div>';
      html += '<div class="prop">' + (o.club != null ? UI.crest(o.club, 'lg') : '<span class="nic">' + I('contract') + '</span>') + '<div style="min-width:0"><h3>' + (OT[o.type] || o.type) + (o.club != null ? ' · ' + esc(C.tname(o.club)) : '') + '</h3><div class="pm">' + (left != null ? '<span class="pill y">' + left + ' sem. restantes</span>' : '') + (o.club != null ? esc(C.cname(S.clubs[o.club].c)) + ' · ' + esc(FP.LGDEF[S.clubs[o.club].lg].n) : '') + '</div><p class="mut sm" style="margin:.35rem 0 0">' + esc(plain(o.text)) + '</p>' + terms + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:.4rem"><button class="btn pri" data-act="offer" data-id="' + o.id + '" data-ok="1">' + I('check') + 'Aceptar</button><button class="btn" data-act="offer" data-id="' + o.id + '" data-ok="0">' + I('x') + 'Rechazar</button></div></div>';
    });
    html += '</div>';
    if (h.history && h.history.length) html += '<div class="card"><div class="hd"><h3>' + I('history') + 'Movimientos</h3></div>' + h.history.slice().reverse().slice(0, 40).map(function (x) { return '<div class="hrow"><span class="mut" style="min-width:6rem">' + D.fmt(x.w) + '</span><span class="grow">' + esc(x.t) + '</span></div>'; }).join('') + '</div>';
    return html;
  };

  // ---------- NOTICIAS ----------
  var KI = { ok: ['medal', 'ok'], warn: ['bell', 'warn'], inj: ['inj', 'bad'], offer: ['contract', ''], title: ['trophy', 'ok'], transfer: ['transfer', ''], hero: ['star', 'ok'], promo: ['up', 'ok'], releg: ['down', 'bad'], coach: ['user', ''], stat: ['chart', ''] };
  SC.news = function () {
    var S = FP.S, h = S.hero, tab = UI.tab.news || 'mine';
    var html = hdr('news', 'Noticias', 'Tu carrera y el mundo del fútbol', seg('news', [['mine', 'Mi carrera', 'user'], ['world', 'Mundo', 'globe'], ['top', 'Titulares', 'star']], tab));
    var items = tab === 'mine' ? h.inbox.slice(0, 80) : S.news.filter(function (n) { return tab === 'top' ? n.i >= 3 : n.i >= 1; }).slice(0, 100);
    html += '<div class="card">' + (items.length ? items.map(function (m) { var ic = KI[m.k] || ['news', '']; return '<div class="news-i"><span class="nic ' + ic[1] + '">' + I(ic[0]) + '</span><div><div class="nt">' + esc(plain(m.t)) + '</div><div class="nd">' + D.fmt(m.w) + '</div></div></div>'; }).join('') : '<p class="mut">Sin mensajes.</p>') + '</div>';
    return html;
  };

  // ---------- SELECCIONES ----------
  var oldNations = SC.nations;
  SC.nations = function () {
    var S = FP.S, h = S.hero, nat = FP.Nat.heroNation(), tab = UI.tab.nations || 'me';
    var html = hdr('flag', 'Selecciones', 'Convocatorias, torneos y ranking', seg('nations', [['me', 'Mi selección', 'flag'], ['comps', 'Torneos', 'trophy'], ['rank', 'Ranking', 'chart']], tab));
    if (tab === 'me') {
      var age = FP.Hero.age(), cats = FP.Nat.cats(age), dec = h.nt.dec && h.nt.dec.ok && h.nt.dec.until >= S.week;
      html += '<div class="nat-h">' + UI.flag(h.nat, true) + '<div><h1 style="margin:0 0 .2rem;font-size:1.6rem">' + esc(nat.nm) + '</h1><div class="mut">' + nat.conf + ' · Nivel ' + nat.r.toFixed(1) + ' <span class="tag-gen">estimado</span></div></div><div class="terms" style="grid-template-columns:repeat(3,auto);margin:0"><div><span>Partidos</span><b>' + h.nt.caps + '</b></div><div><span>Goles</span><b>' + h.nt.goals + '</b></div><div><span>Última cat.</span><b>' + (h.nt.cat || '—') + '</b></div></div></div>';
      if (dec) html += '<div class="info">' + I('flag') + ' Estás <b>convocado</b> (' + esc(h.nt.dec.cat || '') + ').</div>';
      html += '<div class="grid g2"><div class="card"><div class="hd"><h3>' + I('target') + 'Camino a la convocatoria</h3></div>' + cats.map(function (c) { var thr = FP.Hero.callThreshold(nat, c), d = h.ovr - thr, pct = Math.max(4, Math.min(100, 100 + d * 7)); return '<div class="hrow"><b style="min-width:5.5rem">' + esc(c) + '</b><div class="metric grow">' + UI.bar(pct, 100, d >= 0 ? '' : d >= -4 ? 'warn' : 'bad') + '</div><span class="sm ' + (d >= 0 ? 'ok' : d >= -4 ? 'warn' : 'bad') + '" style="min-width:6.5rem;text-align:right">' + (d >= 0 ? 'Nivel alcanzado' : (d >= -4 ? 'Cerca ' : 'Lejos ') + '(' + Math.abs(Math.round(d)) + ' pts)') + '</span></div>'; }).join('') + '<p class="mut sm" style="margin-top:.5rem">Las ventanas FIFA (marzo, junio, septiembre, octubre, noviembre) definen cuándo eres convocado.</p></div>';
      var nx = UI.nextFx(6).filter(function (x) { return x.nat; });
      html += '<div class="card"><div class="hd"><h3>' + I('calendar') + 'Próximos de ' + esc(nat.nm) + '</h3></div>' + (nx.length ? nx.map(function (x) { var f = x.f, p = dparts(f.w); return '<div class="ag-r"><div class="ag-d"><b>' + p.d + '</b><span>' + MES[p.m] + '</span></div><div class="ell">' + UI.crest(f.h) + esc(C.tname(f.h)) + ' <span class="mut">vs</span> ' + UI.crest(f.a) + esc(C.tname(f.a)) + '</div><span class="mut sm">' + esc(x.c.nm) + '</span></div>'; }).join('') : '<p class="mut">Sin partidos de selección a corto plazo.</p>') + '</div></div>';
      return html;
    }
    var inner = withCrests(oldNations);
    return html + inner.replace(/^<h1>[\s\S]*?<\/h1><div class="tabs">[\s\S]*?<\/div>/, '');
  };

  // ---------- ENTRENAMIENTOS ----------
  SC.training = function () {
    var S = FP.S, h = S.hero, t = h.train, lt = S.lastTrain;
    var html = hdr('train', 'Entrenamientos', 'Plan semanal y progresión', '<span class="pill">' + ['', 'Suave', 'Normal', 'Intensa'][t.int] + '</span>');
    html += '<div class="grid g21"><div><div class="card"><div class="hd"><h3>' + I('target') + 'Enfoque de la semana</h3></div><div class="tiles">' + Object.keys(FP.Hero.FOCUS).map(function (k) {
      var f = FP.Hero.FOCUS[k], attrs = k === 'auto' ? null : FP.Hero.focusAttrs(k);
      return '<div class="tile ' + (t.focus === k ? 'sel' : '') + '" data-act="tfocus" data-k="' + k + '"><b>' + esc(f.n) + '</b><div class="mut sm">' + esc(f.d) + '</div>' + (attrs && attrs.length ? '<div style="margin-top:.35rem;display:flex;gap:.25rem;flex-wrap:wrap">' + attrs.map(function (a) { return '<span class="pill">' + C.ATTR_NAME[a] + '</span>'; }).join('') + '</div>' : '') + '</div>';
    }).join('') + '</div></div>';
    html += '<div class="card"><div class="hd"><h3>' + I('zap') + 'Intensidad</h3></div><div class="seg">' + [[1, 'Suave'], [2, 'Normal'], [3, 'Intensa']].map(function (o) { return '<button class="' + (t.int === o[0] ? 'on' : '') + '" data-act="tint" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div><p class="mut sm" style="margin-top:.5rem">' + ['', 'Menos fatiga y riesgo de lesión, mejora más lenta.', 'Equilibrio entre progresión y desgaste.', 'Progresión más rápida, pero más fatiga y riesgo de lesión.'][t.int] + '</p></div>';
    html += '<div class="card"><div class="hd"><h3>' + I('user') + 'Entrenador personal</h3></div><p class="mut sm">Mejora la eficacia (+10% por nivel). Dinero disponible: ' + UI.money(h.money) + '.</p><div class="seg">' + [[0, 'Ninguno', 0], [1, 'Nivel 1', 0.08], [2, 'Nivel 2', 0.18], [3, 'Nivel 3', 0.4]].map(function (o) { return '<button class="' + ((h.pcoach || 0) === o[0] ? 'on' : '') + '" data-act="tcoach" data-v="' + o[0] + '"' + (o[0] && h.money < o[2] * 10 ? ' disabled' : '') + '>' + o[1] + (o[2] ? ' · ' + UI.money(o[2]) + '/sem' : '') + '</button>'; }).join('') + '</div></div></div><div>';
    html += '<div class="card"><div class="hd"><h3>' + I('zap') + 'Condición física</h3></div><div class="mbars" style="grid-template-columns:1fr"><div class="mb">Fatiga<b>' + Math.round(h.fat) + '</b>' + UI.bar(h.fat, 100, h.fat > 70 ? 'bad' : h.fat > 45 ? 'warn' : '') + '</div><div class="mb">Forma<b>' + Math.round(h.form) + '</b>' + UI.bar(h.form, 100) + '</div><div class="mb">Moral<b>' + Math.round(h.mor) + '</b>' + UI.bar(h.mor, 100, 'b') + '</div></div><p class="mut sm" style="margin-top:.6rem">' + (h.inj && h.inj.n > 0 ? '<span class="bad">Lesionado: ' + esc(h.inj.nm) + ', ' + h.inj.n + ' semana(s). El entrenamiento se reduce a recuperación.</span>' : 'Con fatiga alta bajan el rendimiento y la progresión y aumenta el riesgo de lesión.') + '</p></div>';
    html += '<div class="card"><div class="hd"><h3>' + I('chart') + 'Última semana</h3></div>';
    if (lt && lt.gains && Object.keys(lt.gains).length) html += (lt.autoFocus ? '<p class="mut sm">Plan automático: <b>' + esc(FP.Hero.FOCUS[lt.autoFocus].n) + '</b></p>' : '') + Object.keys(lt.gains).map(function (a) { return '<div class="hrow"><span class="grow">' + C.ATTR_NAME[a] + '</span><b class="ok">+' + lt.gains[a].toFixed(2) + '</b></div>'; }).join('');
    else html += '<p class="mut">' + (lt && lt.rest ? 'Semana de descanso/recuperación.' : 'Todavía sin datos: avanza una semana.') + '</p>';
    html += '</div><div class="card"><div class="hd"><h3>' + I('shield') + 'Instalaciones</h3></div><p class="mut sm">Factor de entrenamiento: <b style="color:var(--tx)">×' + FP.Hero.facility().toFixed(2) + '</b>' + (h.tk === 'amat' ? ' (club amateur)' : h.club != null ? ' (cantera del club: ' + S.clubs[h.club].ac + '/5)' : '') + '</p></div></div></div>';
    return html;
  };

  // ---------- MI CLUB ----------
  UI.squadTable = function (cid, id) {
    var rows = (FP.S.ro[cid] || []).map(function (p) { var age = C.age(p); return { p: p, nm: p.i === 0 ? FP.S.hero.nm : p.n, pos: p.p, age: age, o: p.o, nat: p.nat, v: C.value(p.o, p.pt, age), ce: p.ce, wg: p.i === 0 ? ((FP.S.hero.contract || {}).wage || 0) : (p.wg || 0), g: p.g || 0, a: p.as || 0, inj: p.inj || 0 }; });
    var posOrd = { GK: 0, CB: 1, LB: 2, RB: 3, DM: 4, CM: 5, AM: 6, LW: 7, RW: 8, ST: 9 };
    rows.forEach(function (r) { r.po = posOrd[r.pos]; });
    return UI.table(id, [
      { k: 'po', t: 'Pos', f: function (r) { return UI.posb(r.pos); } },
      { k: 'nm', t: 'Jugador', f: function (r) { return UI.player(r.p) + (r.p.i !== 0 ? '' : ' <span class="pill g">tú</span>'); } },
      { k: 'age', t: 'Edad', n: 1 }, { k: 'o', t: 'Media', n: 1, f: function (r) { return UI.ovr(r.o); } }, { k: 'nat', t: 'Nac.', f: function (r) { return UI.nation(r.nat); } },
      { k: 'v', t: 'Valor', n: 1, f: function (r) { return UI.money(r.v); } }, { k: 'wg', t: 'Sueldo/año', n: 1, f: function (r) { return r.wg ? UI.money(r.wg) : '—'; } }, { k: 'ce', t: 'Contrato', n: 1 }, { k: 'g', t: 'G', n: 1 }, { k: 'a', t: 'A', n: 1 },
      { k: 'inj', t: 'Estado', f: function (r) { return r.inj ? '<span class="pill r">' + I('inj') + r.inj + ' sem.</span>' : ''; } }
    ], rows, { sort: ['po', 'a'], cls: function (r) { return r.p.i === 0 ? 'me' : ''; } });
  };
  // presupuesto salarial del club: cifras estimadas del juego, no cuentas reales
  UI.wageCard = function (club) {
    var W = FP.Wages; if (!W) return '';
    var b = W.bill(club), c = W.committed(club), a = W.available(club), src = W.source(club);
    return '<div class="card"><div class="hd"><h3>Economía salarial del club</h3></div><div class="grid g3"><div><span class="mut sm">Presupuesto anual</span><h3>' + UI.money(b) + '</h3></div><div><span class="mut sm">Nómina comprometida</span><h3>' + UI.money(c) + '</h3></div><div><span class="mut sm">Margen disponible</span><h3>' + UI.money(a) + '</h3></div></div>' +
      '<p class="mut sm">' + (src === 'estimacion_manual' ? 'Presupuesto inicial estimado a mano' : 'Presupuesto inicial deducido por el modelo') + ' y actualizado con los resultados del club. Importes brutos anuales; son estimaciones del juego, no cuentas oficiales.</p></div>';
  };
  var oldClub = SC.club;
  SC.club = function () {
    var S = FP.S, h = S.hero, cid = h.club;
    if (h.tk === 'amat' || cid == null) return hdr('shield', h.tk === 'amat' ? 'Mi club' : 'Sin club', 'Fútbol amateur y agencia libre') + oldClub().replace(/^<h1>[\s\S]*?<\/h1>/, '');
    var club = S.clubs[cid], lg = FP.LGDEF[club.lg], comp = UI.myLeagueComp(), cols = UI.clubColors ? UI.clubColors(club.nm) : [];
    var html = '<div class="club-h" style="--c1:' + (cols[0] || '#17424d') + '66">' + UI.crest(cid, 'xl') + '<div style="min-width:0"><h1>' + esc(club.nm) + '</h1><div class="mut" style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">' + UI.flag(club.c) + esc(C.cname(club.c)) + ' · ' + esc(lg.n) + ' ' + UI.verBadge(lg.v) + '</div></div><div class="terms" style="grid-template-columns:repeat(4,auto);margin:0"><div><span>Entrenador</span><b>' + esc(club.co) + '</b></div><div><span>Fuerza</span><b>' + club.st + '</b></div><div><span>Cantera</span><b class="rep">' + UI.stars(club.ac * 20) + '</b></div><div><span>Economía</span><b>' + club.fin + '/10</b></div></div></div>';
    if (FP.Wages && h.tk !== 'academy') html += UI.wageCard(club);
    if (h.tk === 'academy') html += '<div class="info">Juegas en las divisiones inferiores. Cuando tu nivel se acerque al del primer equipo serás promovido. Abajo ves el plantel profesional de referencia.</div>';
    html += '<div class="md" style="grid-template-columns:minmax(0,300px) minmax(0,1fr)"><div class="card" style="margin:0"><div class="hd"><h3>' + I('table') + (comp ? esc(comp.nm) : 'Competición') + '</h3></div>' + (comp ? UI.miniTable(comp) : '<p class="mut">Sin competición.</p>') + '</div><div class="card" style="margin:0"><div class="hd"><h3>' + I('user') + 'Plantel</h3></div>' + UI.squadTable(cid, 'squad') + '</div></div>';
    return html;
  };

  // ---------- PALMARÉS ----------
  SC.honors = function () {
    var S = FP.S, h = S.hero, tab = UI.tab.honors || 'me';
    var html = hdr('trophy', 'Palmarés', 'Trofeos y premios', seg('honors', [['me', 'Mis trofeos', 'medal'], ['clubs', 'Campeones del mundo', 'globe']], tab));
    if (tab === 'me') {
      var champ = h.trophies.filter(function (t) { return !t.sub; }), subs = h.trophies.filter(function (t) { return t.sub; });
      html += '<div class="card"><div class="hd"><h3>' + I('trophy') + 'Títulos (' + champ.length + ')</h3><span class="mut sm">' + subs.length + ' subcampeonatos</span></div>' + (champ.length || subs.length ? '<div class="vault">' + champ.slice().reverse().concat(subs.slice().reverse()).map(function (t) { return '<div class="trophy">' + '<div style="color:' + (t.sub ? 'var(--mut)' : 'var(--gold)') + '">' + I(t.sub ? 'medal' : 'trophy') + '</div><b>' + esc(t.nm) + '</b><div class="mut sm">' + esc(t.club || '') + ' · ' + esc(t.y) + '</div></div>'; }).join('') + '</div>' : '<p class="mut">Aún sin títulos. Cada campeonato ganado quedará aquí.</p>') + '</div>';
      html += '<div class="card"><div class="hd"><h3>' + I('star') + 'Premios individuales (' + h.awards.length + ')</h3></div>' + (h.awards.length ? '<div class="vault">' + h.awards.slice().reverse().map(function (t) { return '<div class="trophy"><div style="color:var(--vio)">' + I('medal') + '</div><b>' + esc(t.nm) + '</b><div class="mut sm">' + esc(t.y) + '</div></div>'; }).join('') + '</div>' : '<p class="mut">Sin premios todavía.</p>') + '</div>';
    } else {
      var f = UI.filt.hk || 'cont', opts = [['cont', 'Continentales'], ['nat', 'Selecciones'], ['cup', 'Copas'], ['lg', 'Ligas']];
      html += '<div class="filters"><div class="seg">' + opts.map(function (o) { return '<button class="' + (f === o[0] ? 'on' : '') + '" data-act="hkset" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>' + (f === 'lg' ? UI.leagueSelect('hlg', { def: UI.myLeague() }) : '') + '</div>';
      var ch = S.hist.champs.filter(function (x) { return x.k === f; });
      if (f === 'lg') { var lid = UI.filt.hlg || UI.myLeague(); ch = ch.filter(function (x) { return x.lg === lid; }); }
      ch = ch.slice().reverse();
      html += '<div class="card">' + (ch.length ? ch.slice(0, 150).map(function (x) { var nm = f === 'cont' ? (FP.Cont.DEF[x.key] ? FP.Cont.DEF[x.key].nm : 'Mundial de Clubes') : f === 'cup' ? x.nm : f === 'nat' ? FP.Nat.TOURN[x.key].nm : FP.LGDEF[x.lg].n; return '<div class="hrow"><span class="mut ell" style="min-width:11rem;max-width:40%">' + esc(nm) + ' ' + esc(x.y) + '</span><div class="grow ell">' + I('trophy') + ' ' + UI.crest(x.ch) + UI.club(x.ch) + '</div><span class="mut sm ell">sub: ' + esc(C.tname(x.ru)) + '</span></div>'; }).join('') : '<p class="mut">Aún no hay campeones registrados: se acumulan a medida que pasan las temporadas.</p>') + '</div>';
    }
    return html;
  };
  A.hkset = function (d) { UI.filt.hk = d.v; UI.render(); };

  // ---------- ENCABEZADOS DE LAS DEMÁS PANTALLAS ----------
  function wrap(name, icon, title, sub) {
    var old = SC[name];
    SC[name] = function () { var h = old.apply(this, arguments); return hdr(icon, title, sub) + h.replace(/^<h1>[\s\S]*?<\/h1>/, ''); };
  }
  wrap('stats', 'chart', 'Estadísticas', 'Líderes, rankings y tu rendimiento');
  wrap('career', 'history', 'Historial de carrera', 'Temporadas y línea de tiempo');
  wrap('config', 'settings', 'Configuración', 'Partidas, ligas activas y aspecto');
})();
