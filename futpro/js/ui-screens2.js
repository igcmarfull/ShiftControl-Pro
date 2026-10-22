/* FUTPRO — pantallas: Competiciones, Clasificaciones, Estadísticas, Mercado, Contratos, Noticias, Selecciones, Palmarés, Historial, Configuración */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, A = UI.acts, SC = UI.screens, Comp = FP.Comp;

  function tabs(scr, list, cur) {
    return '<div class="tabs">' + list.map(function (t) { return '<button class="' + (cur === t[0] ? 'on' : '') + '" data-act="tabset" data-s="' + scr + '" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
  }
  function compList() {
    var S = FP.S, out = [];
    Object.keys(S.comps).forEach(function (id) { var c = S.comps[id]; if (c.kind === 'L' || c.kind === 'C' || c.kind === 'X' || c.kind === 'Q' || c.kind === 'A' || c.kind === 'Y' || (c.kind === 'K' && !c.done)) out.push(c); });
    return out;
  }
  function lastFive(comp, id) {
    var res = [];
    for (var i = comp.cp - 1; i >= 0 && res.length < 5; i--) {
      var f = comp.fx[i]; if (!f || !f.d || f.k) continue;
      if (f.h !== id && f.a !== id) continue;
      var g = f.h === id ? f.hs - f.as : f.as - f.hs; res.unshift(g > 0 ? 'V' : g < 0 ? 'D' : 'E');
    }
    return res;
  }
  // ---------- vista genérica de una competición ----------
  UI.tableFor = function (comp, ids, id, zones) {
    var rows = Comp.rows(comp, ids), me = FP.S.hero.team, def = comp.lg ? FP.LGDEF[comp.lg] : null;
    var n = rows.length, up = def ? (def.up || 0) + (def.poUp ? 0 : 0) : 0, dn = def ? (def.dn || 0) : 0;
    var q = def && def.qual ? Object.keys(def.qual).reduce(function (s, k) { return s + def.qual[k]; }, 0) : 0;
    rows.forEach(function (r) { r.nm = C.tname(r.id); r.fm = lastFive(comp, r.id); });
    return UI.table(id, [
      { k: 'pos', t: '#', c: 1 }, { k: 'nm', t: 'Equipo', f: function (r) { return UI.clubC(r.id); } }, { k: 'p', t: 'PJ', n: 1 }, { k: 'w', t: 'G', n: 1 }, { k: 'd', t: 'E', n: 1 }, { k: 'l', t: 'P', n: 1 },
      { k: 'gf', t: 'GF', n: 1 }, { k: 'ga', t: 'GC', n: 1 }, { k: 'gd', t: 'DG', n: 1, f: function (r) { return FP.fmt.signed(r.gd); } }, { k: 'pts', t: 'Pts', n: 1, f: function (r) { return '<b>' + r.pts + '</b>'; } },
      { k: 'fm', t: 'Últ. 5', s: false, f: function (r) { return UI.form(r.fm); } }
    ], rows, {
      sort: ['pos', 'a'], cls: function (r) {
        var c = r.id === me ? 'me ' : '';
        if (zones && def) { if (r.pos <= up && up) c += 'z1'; else if (r.pos <= q && q) c += 'z2'; else if (dn && r.pos > n - dn) c += 'zd'; }
        return c;
      }
    });
  };
  UI.fixturesFor = function (comp, key, opts) {
    opts = opts || {};
    var S = FP.S, fx = comp.fx, rounds = {};
    fx.forEach(function (f, i) { var k = f.k ? (f.ro || 'Eliminatoria') + (f.l ? ' (ida/vuelta)' : '') : (f.r ? 'Fecha ' + f.r : D.fmt(f.w)); (rounds[k] = rounds[k] || []).push(f); });
    var keys = Object.keys(rounds);
    if (!keys.length) return '<p class="mut">Sin partidos.</p>';
    var cur = UI.filt[key];
    if (!cur || keys.indexOf(cur) < 0) { var next = comp.fx[Math.min(comp.cp, comp.fx.length - 1)]; cur = keys.filter(function (k) { return rounds[k].indexOf(next) >= 0; })[0] || keys[0]; }
    var idx = keys.indexOf(cur);
    var h = '<div class="row sp" style="margin-bottom:.5rem"><button class="btn sm" data-act="rnd" data-k="' + key + '" data-d="-1" data-keys="' + esc(JSON.stringify(keys)) + '" data-cur="' + esc(cur) + '">‹</button><b>' + esc(cur) + '</b><button class="btn sm" data-act="rnd" data-k="' + key + '" data-d="1" data-keys="' + esc(JSON.stringify(keys)) + '" data-cur="' + esc(cur) + '">›</button></div>';
    var me = S.hero.team;
    h += '<div class="card" style="padding:.4rem .8rem">' + rounds[cur].map(function (f) {
      var done = f.d, sc = done ? '<b>' + f.hs + ' - ' + f.as + '</b>' + (f.ps ? ' <span class="mut sm">(' + f.ps[0] + '-' + f.ps[1] + ' pen.)</span>' : f.et ? ' <span class="mut sm">(pró.)</span>' : '') : '<span class="dim">' + D.fmt(f.w) + '</span>';
      var mine = f.h === me || f.a === me;
      return '<div class="row sp" style="padding:.28rem 0;border-bottom:1px solid var(--line);' + (mine ? 'background:#12301f;margin:0 -.4rem;padding-left:.4rem;padding-right:.4rem' : '') + '"><span style="flex:1;text-align:right">' + UI.club(f.h) + '</span><span style="min-width:5.5rem;text-align:center">' + sc + '</span><span style="flex:1">' + UI.club(f.a) + '</span></div>';
    }).join('') + '</div>';
    return h;
  };
  A.rnd = function (d) { var keys = JSON.parse(d.keys), i = keys.indexOf(d.cur) + (+d.d); i = Math.max(0, Math.min(keys.length - 1, i)); UI.filt[d.k] = keys[i]; UI.render(); };
  UI.koView = function (comp) {
    var all = (comp.kh || []).concat(comp.ko ? [comp.ko] : []), h = '';
    all.forEach(function (ko, kidx) {
      ko.rounds.forEach(function (rd) {
        h += '<div class="card"><h3>' + esc(rd.nm) + '</h3>' + rd.ties.map(function (t) {
          if (t.bye) return '<div class="mut sm">' + UI.club(t.win) + ' — exento</div>';
          var legs = t.f.map(function (i) { var f = comp.fx[i]; return f && f.d ? f.hs + '-' + f.as + (f.ps ? ' (' + f.ps[0] + '-' + f.ps[1] + ' pen.)' : '') : '<span class="dim">' + D.fmt(f ? f.w : 0) + '</span>'; });
          return '<div class="row sp" style="padding:.25rem 0;border-bottom:1px solid var(--line)"><span>' + (t.win === t.a ? '<b>' : '') + UI.club(t.a) + (t.win === t.a ? '</b>' : '') + ' vs ' + (t.win === t.b ? '<b>' : '') + UI.club(t.b) + (t.win === t.b ? '</b>' : '') + '</span><span class="mut sm">' + legs.join(' · ') + (t.agg ? ' · global ' + t.agg[0] + '-' + t.agg[1] : '') + '</span></div>';
        }).join('') + '</div>';
      });
    });
    return h;
  };
  UI.compView = function (comp, key) {
    var tab = UI.tab[key] || 'main', h = '';
    var hasTable = comp.tb && Object.keys(comp.tb).length && !comp.groups, hasGroups = !!comp.groups, hasKO = !!comp.ko;
    var t = [['main', hasKO && !hasTable && !hasGroups ? 'Cuadro' : hasGroups ? 'Grupos' : 'Tabla']];
    if (hasKO && (hasTable || hasGroups)) t.push(['ko', 'Fase final']);
    t.push(['fx', 'Partidos']);
    if (comp.sc && Object.keys(comp.sc).length) t.push(['sc', 'Goleadores']);
    if (!t.some(function (x) { return x[0] === tab; })) tab = 'main';
    h += '<div class="hd"><h2>' + esc(comp.nm) + ' ' + esc(comp.label || '') + '</h2>' + (comp.done ? '<span class="pill">finalizada</span>' : '<span class="pill g">en juego</span>') + '</div>';
    if (comp.champ != null) h += '<p class="gold">🏆 Campeón: <b>' + UI.club(comp.champ) + '</b></p>';
    h += '<div class="tabs">' + t.map(function (x) { return '<button class="' + (tab === x[0] ? 'on' : '') + '" data-act="tabset" data-s="' + key + '" data-t="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    if (tab === 'main') {
      if (hasGroups) { h += '<div class="grid g2">' + comp.groups.map(function (g, gi) { return '<div><h4>Grupo ' + String.fromCharCode(65 + gi) + '</h4>' + UI.tableFor(comp, g, key + '_g' + gi, false) + '</div>'; }).join('') + '</div>'; }
      else if (hasTable) h += UI.tableFor(comp, null, key + '_t', true);
      else if (hasKO) h += UI.koView(comp);
    } else if (tab === 'ko') h += UI.koView(comp);
    else if (tab === 'fx') h += UI.fixturesFor(comp, key + '_r');
    else if (tab === 'sc') h += UI.scorersTable(comp, key + '_sc');
    return h;
  };
  UI.scorersTable = function (comp, id) {
    var rows = []; for (var pid in comp.sc) { var v = comp.sc[pid]; rows.push({ pid: +pid, nm: v[3], c: v[2], g: v[0], a: v[1] }); }
    return UI.table(id, [{ k: 'nm', t: 'Jugador', f: function (r) { return r.pid === 0 ? '<b class="ok">' + esc(r.nm) + '</b>' : esc(r.nm) + '<span class="tag-gen">generado</span>'; } }, { k: 'c', t: 'Equipo', f: function (r) { return UI.club(r.c); }, v: function (r) { return C.tname(r.c); } }, { k: 'g', t: 'Goles', n: 1 }, { k: 'a', t: 'Asist.', n: 1 }], rows, { sort: ['g', 'd'], max: 40 });
  };

  // ======================= COMPETICIONES =======================
  SC.comps = function () {
    var S = FP.S, list = compList(), cur = UI.filt.compSel;
    var byCat = { 'Mi competición': [], 'Ligas': [], 'Copas nacionales': [], 'Continentales de clubes': [], 'Selecciones': [] };
    var me = S.hero.team;
    list.forEach(function (c) {
      var cat = c.kind === 'L' ? 'Ligas' : c.kind === 'C' ? 'Copas nacionales' : c.kind === 'X' ? (c.nat ? 'Selecciones' : 'Continentales de clubes') : c.kind === 'Q' ? 'Selecciones' : 'Ligas';
      if (c.teams.indexOf(me) >= 0 && (c.kind === 'L' || c.kind === 'A' || c.kind === 'Y' || c.kind === 'C' || c.kind === 'X')) byCat['Mi competición'].push(c);
      if (c.kind === 'A' || c.kind === 'Y' || c.kind === 'K') return;
      byCat[cat].push(c);
    });
    var catSel = UI.filt.compCat || 'Mi competición';
    if (!byCat[catSel] || (!byCat[catSel].length && catSel === 'Mi competición')) catSel = 'Ligas';
    var c0 = cur && S.comps[cur] ? S.comps[cur] : null;
    var html = '<h1>Competiciones</h1><div class="filters"><label class="f"><span>Categoría</span><select data-act="filt" data-k="compCat">' + Object.keys(byCat).map(function (k) { return '<option ' + (k === catSel ? 'selected' : '') + '>' + k + '</option>'; }).join('') + '</select></label>';
    var items = byCat[catSel].slice();
    if (catSel === 'Ligas') items.sort(function (a, b) { return (a.c || '').localeCompare(b.c || '') || (FP.LGDEF[a.lg] ? FP.LGDEF[a.lg].t : 0) - (FP.LGDEF[b.lg] ? FP.LGDEF[b.lg].t : 0); });
    if (!c0 || items.indexOf(c0) < 0) c0 = items[0] || null;
    html += '<label class="f"><span>Competición</span><select data-act="filt" data-k="compSel">' + items.map(function (c) { return '<option value="' + c.id + '" ' + (c0 === c ? 'selected' : '') + '>' + esc((c.c ? FP.DATA.countries[c.c].n + ' · ' : '') + c.nm + (c.label ? ' ' + c.label : '')) + '</option>'; }).join('') + '</select></label></div>';
    if (!c0) return html + '<div class="card"><p class="mut">No hay competiciones activas en esta categoría.</p></div>';
    html += '<div class="card">' + UI.compView(c0, 'comp') + '</div>';
    return html;
  };

  // ======================= CLASIFICACIONES =======================
  SC.tables = function () {
    var S = FP.S, lgId = UI.filt.tbl || UI.myLeague(), lg = S.lgs[lgId], def = FP.LGDEF[lgId];
    var comp = S.comps[lg.cmp];
    var html = '<h1>Clasificaciones</h1><div class="filters">' + UI.leagueSelect('tbl', { def: lgId }) + '</div>';
    html += '<div class="card"><div class="hd"><h2>' + esc(def.n) + ' · ' + esc(FP.DATA.countries[def.c].n) + '</h2><span>' + UI.verBadge(def.v) + '</span></div>';
    if (comp) {
      html += '<p class="mut sm">Temporada ' + esc(comp.label) + ' · ' + (def.rr === 1 ? 'una vuelta' : def.mp ? def.mp + ' partidos por equipo' : 'ida y vuelta') + (def.po ? ' · liguilla final por el título (top ' + def.po.n + ')' : '') + (def.poUp ? ' · liguilla de ascenso (puestos ' + def.poUp[0] + '–' + def.poUp[1] + ')' : '') + '</p>';
      if (S.cfg.off && S.cfg.off[lgId] && lg.hist) html += '<div class="notice">Esta liga está desactivada: se simula en bloque al terminar la temporada.</div>';
      html += UI.tableFor(comp, null, 'tbl', true);
      html += '<p class="mut sm" style="margin-top:.5rem"><span class="pill g">ascenso</span> <span class="pill b">copas continentales</span> <span class="pill r">descenso</span></p>';
    }
    html += '</div>';
    // campeones históricos
    var hist = lg.hist.slice().reverse();
    if (hist.length) html += '<div class="card"><h3>Campeones recientes</h3>' + hist.slice(0, 12).map(function (e) { return '<div class="row sp" style="padding:.2rem 0"><span class="mut">' + esc(e.l) + '</span><span>🏆 ' + UI.club(e.ch) + (e.sc && e.sc[0] ? ' <span class="mut sm">· goleador ' + esc(e.sc[0][0]) + ' (' + e.sc[0][1] + ')</span>' : '') + '</span></div>'; }).join('') + '</div>';
    return html;
  };

  // ======================= ESTADÍSTICAS =======================
  SC.stats = function () {
    var S = FP.S, h = S.hero, tab = UI.tab.stats || 'comp';
    var html = '<h1>Estadísticas</h1>' + tabs('stats', [['comp', 'Competición'], ['me', 'Mis números'], ['pl', 'Mejores jugadores']], tab);
    if (tab === 'comp') {
      var lgId = UI.filt.stl || UI.myLeague(), lg = S.lgs[lgId], comp = S.comps[lg.cmp];
      html += '<div class="filters">' + UI.leagueSelect('stl', { def: lgId }) + '</div>';
      if (comp) {
        html += '<div class="grid g2"><div class="card"><h3>Goleadores</h3>' + UI.scorersTable(comp, 'st_sc') + '</div>';
        var rows = Comp.rows(comp).map(function (r) { r.nm = C.tname(r.id); return r; });
        html += '<div class="card"><h3>Equipos</h3>' + UI.table('st_tm', [{ k: 'nm', t: 'Equipo', f: function (r) { return UI.club(r.id); } }, { k: 'gf', t: 'GF', n: 1 }, { k: 'ga', t: 'GC', n: 1 }, { k: 'gd', t: 'DG', n: 1 }, { k: 'pg', t: 'GF/PJ', n: 1, f: function (r) { return r.p ? (r.gf / r.p).toFixed(2) : '—'; }, v: function (r) { return r.p ? r.gf / r.p : 0; } }], rows, { sort: ['gf', 'd'], max: 12 }) + '</div></div>';
        var asr = Comp.topScorers(comp, 15, 1).filter(function (e) { return e.a > 0; });
        html += '<div class="card"><h3>Asistencias</h3>' + UI.table('st_as', [{ k: 'n', t: 'Jugador', f: function (r) { return esc(r.n) + (r.pid === 0 ? ' <span class="pill g">tú</span>' : ''); } }, { k: 'c', t: 'Equipo', f: function (r) { return UI.club(r.c); }, v: function (r) { return C.tname(r.c); } }, { k: 'a', t: 'Asist.', n: 1 }, { k: 'g', t: 'Goles', n: 1 }], asr, { sort: ['a', 'd'], max: 15 }) + '</div>';
      }
    } else if (tab === 'me') {
      var rows2 = h.seasons.map(function (s) { return s; });
      html += '<div class="grid g4">' + UI.stat('Partidos', h.tot.ap) + UI.stat('Goles', h.tot.g) + UI.stat('Asistencias', h.tot.a) + UI.stat('Nota media', h.tot.rn ? (h.tot.rs / h.tot.rn).toFixed(2) : '—') + '</div>';
      html += '<div class="card" style="margin-top:1rem"><h3>Goles por partido</h3><p>' + (h.tot.ap ? (h.tot.g / h.tot.ap).toFixed(2) : '—') + ' · Asistencias por partido: ' + (h.tot.ap ? (h.tot.a / h.tot.ap).toFixed(2) : '—') + ' · Minutos por gol: ' + (h.tot.g ? Math.round(h.tot.min / h.tot.g) : '—') + '</p></div>';
      html += '<h3>Por temporada</h3>' + UI.seasonsTable(h);
    } else {
      var f = UI.filt.plf || {}; var pos = UI.filt.plpos || '', cc = UI.filt.plcc || '';
      html += '<div class="filters"><label class="f"><span>Posición</span><select data-act="filt" data-k="plpos"><option value="">Todas</option>' + C.POS.map(function (p) { return '<option value="' + p + '" ' + (pos === p ? 'selected' : '') + '>' + C.POS_ES[p] + '</option>'; }).join('') + '</select></label><label class="f"><span>País del club</span><select data-act="filt" data-k="plcc"><option value="">Todos</option>' + Object.keys(FP.DATA.countries).map(function (k) { return '<option value="' + k + '" ' + (cc === k ? 'selected' : '') + '>' + esc(FP.DATA.countries[k].n) + '</option>'; }).join('') + '</select></label></div>';
      var pl = [];
      for (var i = 1; i < S.pl.length; i++) { var p = S.pl[i]; if (!p || p.c < 0) continue; if (pos && p.p !== pos) continue; if (cc && S.clubs[p.c].c !== cc) continue; if (p.o >= 60) pl.push(p); }
      pl.sort(function (a, b) { return b.o - a.o; });
      html += UI.playersTable(pl.slice(0, 200), 'st_pl');
    }
    return html;
  };
  UI.playersTable = function (list, id) {
    var rows = list.map(function (p) { var age = C.age(p); return { p: p, nm: p.n, pos: p.p, age: age, o: p.o, club: p.c, v: C.value(p.o, p.pt, age), g: p.g || 0, nat: p.nat, ce: p.ce }; });
    return UI.table(id, [
      { k: 'nm', t: 'Jugador', f: function (r) { return UI.player(r.p) + '<span class="tag-gen">generado</span>'; } }, { k: 'pos', t: 'Pos', f: function (r) { return '<span class="pill">' + UI.pos(r.pos) + '</span>'; } },
      { k: 'age', t: 'Edad', n: 1 }, { k: 'o', t: 'Media', n: 1, f: function (r) { return UI.ovr(r.o); } }, { k: 'club', t: 'Club', f: function (r) { return UI.club(r.club); }, v: function (r) { return C.tname(r.club); } },
      { k: 'nat', t: 'Nac.', f: function (r) { return UI.nation(r.nat); } }, { k: 'v', t: 'Valor', n: 1, f: function (r) { return UI.money(r.v); } }, { k: 'ce', t: 'Contrato', n: 1 }, { k: 'g', t: 'Goles', n: 1 }
    ], rows, { sort: ['o', 'd'], max: 200 });
  };
  UI.seasonsTable = function (h) {
    var rows = h.seasons.map(function (s, i) { return { y: s.y, club: s.club, ap: s.ap, min: s.min, g: s.g, a: s.a, yc: s.yc, rc: s.rc, rt: s.rt, ovr: s.ovr, age: s.age, i: i }; });
    var s = h.season;
    if (s.ap || s.rn) rows.push({ y: 'En curso', club: UI.heroTeamLabel(), ap: s.ap, min: s.min, g: s.g, a: s.a, yc: s.yc, rc: s.rc, rt: s.rn ? Math.round(s.rs / s.rn * 10) / 10 : 0, ovr: h.ovr, age: FP.Hero.age(), i: 999 });
    return UI.table('seasons', [{ k: 'i', t: 'Temporada', f: function (r) { return esc(r.y); } }, { k: 'age', t: 'Edad', n: 1 }, { k: 'club', t: 'Club' }, { k: 'ap', t: 'PJ', n: 1 }, { k: 'min', t: 'Min', n: 1 }, { k: 'g', t: 'G', n: 1 }, { k: 'a', t: 'A', n: 1 }, { k: 'yc', t: '🟨', n: 1 }, { k: 'rc', t: '🟥', n: 1 }, { k: 'rt', t: 'Nota', n: 1, f: function (r) { return r.rt ? r.rt.toFixed(1) : '—'; } }, { k: 'ovr', t: 'Media', n: 1, f: function (r) { return UI.ovr(r.ovr); } }], rows, { sort: ['i', 'd'] });
  };

  // ======================= MERCADO =======================
  SC.market = function () {
    var S = FP.S, h = S.hero, tab = UI.tab.market || 'tryouts';
    var win = FP.Market.isWindow(S.week);
    var html = '<h1>Mercado de fichajes</h1><div class="row" style="margin-bottom:.6rem"><span class="pill ' + (win ? 'g' : '') + '">' + (win ? FP.Market.windowName(S.week) + ' abierto' : 'Mercado cerrado') + '</span><span class="mut sm">Valor de mercado: <b style="color:var(--tx)">' + UI.money(FP.Market.heroValue()) + '</b></span></div>';
    html += tabs('market', [['tryouts', 'Pruebas en clubes'], ['players', 'Jugadores'], ['recent', 'Últimos fichajes'], ['free', 'Sin club / amateur']], tab);
    if (tab === 'tryouts') {
      var age = FP.Hero.age(), cc = UI.filt.mkcc || FP.Market.heroCountry();
      html += '<div class="info">Pide una prueba para ingresar a las divisiones inferiores (hasta los 19 años). Los clubes además te observan solos y envían invitaciones según tu rendimiento. Menores de 18 años solo pueden probarse en su país.</div>';
      html += '<div class="filters"><label class="f"><span>País</span><select data-act="filt" data-k="mkcc">' + Object.keys(FP.DATA.countries).map(function (k) { return '<option value="' + k + '" ' + (cc === k ? 'selected' : '') + '>' + esc(FP.DATA.countries[k].n) + '</option>'; }).join('') + '</select></label></div>';
      var clubs = S.clubs.filter(function (c) { return c.c === cc && FP.LGDEF[c.lg].t <= 3; });
      var rows = clubs.map(function (c) { var d = FP.Market.trialDifficulty(c.id); return { c: c, nm: c.nm, lg: FP.LGDEF[c.lg].n, t: FP.LGDEF[c.lg].t, p: d.p, ac: c.ac }; });
      html += UI.table('mk_try', [{ k: 'nm', t: 'Club', f: function (r) { return UI.club(r.c.id); } }, { k: 'lg', t: 'Liga' }, { k: 'ac', t: 'Cantera', n: 1, f: function (r) { return UI.stars(r.ac * 20); } }, { k: 'p', t: 'Prob. de pasar', n: 1, f: function (r) { var p = Math.round(r.p * 100); return '<span class="' + (p >= 55 ? 'ok' : p >= 25 ? 'warn' : 'bad') + '">' + p + '%</span>'; } },
        { k: 'x', t: '', s: false, f: function (r) { var pend = (h.trials || []).some(function (t) { return t.club === r.c.id; }); return pend ? '<span class="pill y">pendiente</span>' : (age <= 19 && h.tk !== 'pro' && h.tk !== 'loan') ? '<button class="btn sm" data-act="trial" data-id="' + r.c.id + '">Pedir prueba</button>' : ''; } }], rows, { sort: ['t', 'a'], max: 120 });
    } else if (tab === 'players') {
      var pos2 = UI.filt.mkpos || '', min = +(UI.filt.mkmin || 60), maxA = +(UI.filt.mkage || 40), ccc = UI.filt.mkc2 || '';
      html += '<div class="filters"><label class="f"><span>Posición</span><select data-act="filt" data-k="mkpos"><option value="">Todas</option>' + C.POS.map(function (p) { return '<option value="' + p + '" ' + (pos2 === p ? 'selected' : '') + '>' + C.POS_ES[p] + '</option>'; }).join('') + '</select></label><label class="f"><span>País del club</span><select data-act="filt" data-k="mkc2"><option value="">Todos</option>' + Object.keys(FP.DATA.countries).map(function (k) { return '<option value="' + k + '" ' + (ccc === k ? 'selected' : '') + '>' + esc(FP.DATA.countries[k].n) + '</option>'; }).join('') + '</select></label><label class="f"><span>Media mínima</span><select data-act="filt" data-k="mkmin">' + [40, 50, 60, 65, 70, 75, 80].map(function (v) { return '<option ' + (min === v ? 'selected' : '') + '>' + v + '</option>'; }).join('') + '</select></label><label class="f"><span>Edad máx.</span><select data-act="filt" data-k="mkage">' + [20, 23, 26, 30, 40].map(function (v) { return '<option ' + (maxA === v ? 'selected' : '') + '>' + v + '</option>'; }).join('') + '</select></label></div>';
      var pl = [];
      for (var i = 1; i < S.pl.length; i++) { var p = S.pl[i]; if (!p || p.c < -1) continue; if (pos2 && p.p !== pos2) continue; if (p.o < min) continue; if (C.age(p) > maxA) continue; if (ccc && (p.c < 0 || S.clubs[p.c].c !== ccc)) continue; pl.push(p); }
      pl.sort(function (a, b) { return b.o - a.o; });
      html += '<p class="mut sm">' + pl.length + ' jugadores. Todos son futbolistas generados por el juego.</p>' + UI.playersTable(pl.slice(0, 200), 'mk_pl');
    } else if (tab === 'recent') {
      var tr = S.transfers || [];
      html += UI.table('mk_rec', [{ k: 'w', t: 'Fecha', f: function (r) { return D.fmt(r.w); } }, { k: 'p', t: 'Jugador' }, { k: 'a', t: 'Edad', n: 1 }, { k: 'o', t: 'Media', n: 1, f: function (r) { return UI.ovr(r.o); } }, { k: 'from', t: 'Desde', f: function (r) { return r.from >= 0 ? UI.club(r.from) : '—'; }, v: function (r) { return r.from >= 0 ? C.tname(r.from) : ''; } }, { k: 'to', t: 'Hacia', f: function (r) { return UI.club(r.to); }, v: function (r) { return C.tname(r.to); } }, { k: 'fee', t: 'Traspaso', n: 1, f: function (r) { return r.fee ? UI.money(r.fee) : 'libre'; } }], tr, { sort: ['w', 'd'], max: 80 });
    } else {
      html += '<div class="card"><h3>Sin club y fútbol amateur</h3><p class="mut">Si no tienes club puedes jugar en un club amateur local mientras buscas una oportunidad. También puedes crear un club amateur que no esté en la base de datos.</p><div class="row"><input type="text" id="newam" placeholder="Nombre del club amateur local"><button class="btn pri" data-act="newamat">Crear club y fichar</button></div></div>';
    }
    return html;
  };
  A.trial = function (d) { var r = FP.Market.requestTrial(+d.id); UI.toast(esc(r.msg || 'Prueba solicitada.'), r.ok ? 'ok' : 'warn'); UI.render(); };

  // ======================= CONTRATOS =======================
  SC.contracts = function () {
    var S = FP.S, h = S.hero, ct = h.contract;
    var html = '<h1>Contratos</h1><div class="grid g2"><div class="card"><h3>Contrato actual</h3>';
    if (ct && h.club != null) {
      var club = S.clubs[h.club], endW = FP.Market.contractEndWeek(ct, FP.LGDEF[club.lg].cal);
      html += '<dl class="kv"><dt>Club</dt><dd>' + UI.club(h.club) + '</dd><dt>Tipo</dt><dd>' + ({ juvenil: 'Juvenil (cantera)', prof: 'Profesional', cesion: 'Cesión' }[ct.type] || ct.type) + '</dd><dt>Sueldo anual</dt><dd>' + (ct.wage ? UI.money(ct.wage) + (FP.Wages ? ' <span class="mut sm">(' + FP.fmt.money(FP.Wages.monthly(ct.wage)) + ' al mes)</span>' : '') : 'sin sueldo') + '</dd><dt>Vence</dt><dd>' + (h.tk === 'loan' ? 'fin de la cesión' : ct.end + ' (' + D.fmt(endW) + ')') + '</dd><dt>Valor de mercado</dt><dd>' + UI.money(FP.Market.heroValue()) + '</dd><dt>Dinero acumulado</dt><dd>' + UI.money(h.money) + '</dd></dl>';
      html += '<div class="btn-group" style="margin-top:.7rem"><button class="btn sm dng" data-act="reqtrans">Solicitar salida</button></div>';
      if (h.tk === 'loan' && h.loan) html += '<p class="mut sm">Cedido por ' + UI.club(h.loan.from) + '.</p>';
    } else if (h.tk === 'amat') html += '<p class="mut">Juegas en un club amateur: no hay contrato ni sueldo.</p>';
    else html += '<p class="mut">Estás sin contrato. Revisa las ofertas.</p>';
    html += '</div><div class="card"><h3>Representante</h3>';
    if (h.agent) html += '<dl class="kv"><dt>Nombre</dt><dd>' + esc(h.agent.nm) + '</dd><dt>Nivel</dt><dd>' + UI.stars(h.agent.lvl * 20) + '</dd><dt>Comisión</dt><dd>' + h.agent.com + '%</dd></dl><p class="mut sm">Más nivel: más ofertas y mejores sueldos.</p><button class="btn sm" data-act="dropagent">Despedir</button>';
    else {
      var age = FP.Hero.age();
      html += age < 15 ? '<p class="mut">Podrás contratar un representante desde los 15 años.</p>' : '<p class="mut sm">Un representante consigue más y mejores ofertas, a cambio de una comisión sobre tu sueldo.</p>' + FP.Market.agentCandidates().map(function (a, i) { return '<div class="row sp" style="padding:.3rem 0;border-bottom:1px solid var(--line)"><span>' + esc(a.nm) + ' <span class="tag-gen">generado</span><br>' + UI.stars(a.lvl * 20) + ' <span class="mut sm">comisión ' + a.com + '%</span></span><button class="btn sm pri" data-act="hire" data-i="' + i + '">Contratar</button></div>'; }).join('');
    }
    html += '</div></div>';
    html += '<div class="card"><h3>Ofertas y propuestas</h3>';
    if (!h.offers.length) html += '<p class="mut">No hay ofertas pendientes. Los clubes te observan según tu rendimiento y tu nivel; las ventanas de mercado traen más movimiento.</p>';
    h.offers.forEach(function (o) {
      var left = o.exp != null ? Math.max(0, o.exp - S.week) : null;
      html += '<div class="card" style="background:var(--panel2)"><div class="hd"><b>' + ({ trial: 'Invitación a prueba', academy: 'Ingreso a la cantera', pro: 'Contrato profesional', transfer: 'Oferta de traspaso', loan: 'Cesión', renew: 'Renovación', event: 'Oportunidad', amateur: 'Club amateur' }[o.type] || o.type) + '</b>' + (left != null ? '<span class="pill y">' + left + ' sem. restantes</span>' : '') + '</div><p>' + esc(o.text) + '</p>' +
        (o.type === 'transfer' ? '<p class="mut sm">Club comprador: ' + UI.club(o.club) + ' · rol prometido: ' + esc(o.role) + (o.fee ? ' · tu club recibiría ' + UI.money(o.fee) : '') + '</p>' : '') +
        '<div class="btn-group"><button class="btn pri" data-act="offer" data-id="' + o.id + '" data-ok="1">' + (o.type === 'trial' || o.type === 'event' ? 'Aceptar' : 'Aceptar') + '</button><button class="btn" data-act="offer" data-id="' + o.id + '" data-ok="0">Rechazar</button></div></div>';
    });
    html += '</div>';
    if (h.history && h.history.length) html += '<div class="card"><h3>Movimientos</h3><div class="feed">' + h.history.slice().reverse().map(function (x) { return '<div class="it"><span class="dt">' + D.fmt(x.w) + '</span><span>' + esc(x.t) + '</span></div>'; }).join('') + '</div></div>';
    return html;
  };
  A.offer = function (d) { var r = FP.Market.respond(+d.id, d.ok === '1'); UI.toast(esc(r.msg || ''), r.ok ? 'ok' : 'warn'); FP.Store.auto(true); UI.render(); };
  A.reqtrans = function () { var r = FP.Market.requestTransfer(); UI.toast(esc(r.msg), r.ok ? 'warn' : 'bad'); UI.render(); };
  A.hire = function (d) { var r = FP.Market.hireAgent(+d.i); UI.toast(esc(r.msg), r.ok ? 'ok' : 'warn'); UI.render(); };
  A.dropagent = function () { FP.S.hero.agent = null; UI.render(); };

  // ======================= NOTICIAS =======================
  SC.news = function () {
    var S = FP.S, h = S.hero, tab = UI.tab.news || 'mine';
    var html = '<h1>Noticias</h1>' + tabs('news', [['mine', 'Mi carrera'], ['world', 'Mundo'], ['top', 'Titulares']], tab);
    if (tab === 'mine') {
      html += '<div class="card feed">' + (h.inbox.length ? h.inbox.slice(0, 80).map(function (m) { return '<div class="it ' + (m.k === 'offer' ? 'offer' : '') + '"><span class="dt">' + D.fmt(m.w) + '</span><span class="' + ({ ok: 'ok', warn: 'warn', inj: 'bad' }[m.k] || '') + '">' + esc(m.t) + '</span></div>'; }).join('') : '<p class="mut">Sin mensajes.</p>') + '</div>';
    } else {
      var items = S.news.filter(function (n) { return tab === 'top' ? n.i >= 3 : n.i >= 1; });
      html += '<div class="card feed">' + items.slice(0, 100).map(function (n) { return '<div class="it"><span class="dt">' + D.fmt(n.w) + '</span><span>' + esc(n.t) + '</span></div>'; }).join('') + '</div>';
    }
    return html;
  };

  // ======================= SELECCIONES =======================
  SC.nations = function () {
    var S = FP.S, h = S.hero, nat = FP.Nat.heroNation(), tab = UI.tab.nations || 'me';
    var html = '<h1>Selecciones</h1>' + tabs('nations', [['me', 'Mi selección'], ['comps', 'Torneos y clasificatorias'], ['rank', 'Ranking']], tab);
    if (tab === 'me') {
      var age = FP.Hero.age(), cats = FP.Nat.cats(age);
      html += '<div class="grid g2"><div class="card"><h3>' + esc(nat.nm) + '</h3><dl class="kv"><dt>Confederación</dt><dd>' + nat.conf + '</dd><dt>Nivel de la selección</dt><dd>' + nat.r.toFixed(1) + ' <span class="tag-gen">estimado</span></dd><dt>Partidos con la selección</dt><dd>' + h.nt.caps + '</dd><dt>Goles</dt><dd>' + h.nt.goals + '</dd><dt>Última categoría</dt><dd>' + (h.nt.cat || '—') + '</dd></dl></div>';
      html += '<div class="card"><h3>Convocatorias</h3>' + cats.map(function (c) { var thr = FP.Hero.callThreshold(nat, c), d = h.ovr - thr; return '<div class="row sp" style="padding:.25rem 0"><span>' + c + '</span><span class="' + (d >= 0 ? 'ok' : d >= -4 ? 'warn' : 'bad') + '">' + (d >= 0 ? 'nivel de convocatoria alcanzado' : d >= -4 ? 'cerca (' + Math.abs(Math.round(d)) + ' pts)' : 'lejos (' + Math.abs(Math.round(d)) + ' pts)') + '</span></div>'; }).join('') + '<p class="mut sm" style="margin-top:.5rem">Los clubes profesionales y las ventanas FIFA (marzo, junio, septiembre, octubre, noviembre) definen cuándo eres convocado.</p></div></div>';
      var nx = UI.nextFx(6).filter(function (x) { return x.nat; });
      html += '<div class="card"><h3>Próximos partidos de ' + esc(nat.nm) + '</h3>' + (nx.length ? nx.map(UI.fxLine).join('') : '<p class="mut">Sin partidos de selección programados a corto plazo.</p>') + '</div>';
    } else if (tab === 'comps') {
      var list = compList().filter(function (c) { return c.nat; });
      var sel = UI.filt.natSel && S.comps[UI.filt.natSel] ? S.comps[UI.filt.natSel] : list[0];
      if (!list.length) return html + '<div class="card"><p class="mut">No hay torneos de selecciones en curso. Las clasificatorias y torneos se crean según el calendario FIFA.</p></div>' + UI.natHistory();
      html += '<div class="filters"><label class="f"><span>Torneo</span><select data-act="filt" data-k="natSel">' + list.map(function (c) { return '<option value="' + c.id + '" ' + (sel === c ? 'selected' : '') + '>' + esc(c.nm + ' ' + (c.label || '')) + '</option>'; }).join('') + '</select></label></div>';
      html += '<div class="card">' + UI.compView(sel, 'natc') + '</div>' + UI.natHistory();
    } else {
      var rows = S.nat.map(function (n) { return { n: n, nm: n.nm, conf: n.conf, r: n.r }; });
      html += '<div class="notice">Los niveles de selección son una estimación del autor (no el ranking FIFA oficial) y evolucionan con los resultados.</div>' + UI.table('nat_rank', [{ k: 'nm', t: 'Selección', f: function (r) { return esc(r.nm) + (r.n.c === h.nat ? ' <span class="pill g">tu país</span>' : ''); } }, { k: 'conf', t: 'Conf.' }, { k: 'r', t: 'Nivel', n: 1, f: function (r) { return r.r.toFixed(1); } }], rows, { sort: ['r', 'd'], max: 80 });
    }
    return html;
  };
  UI.natHistory = function () {
    var ch = FP.S.hist.champs.filter(function (x) { return x.k === 'nat'; }).reverse();
    if (!ch.length) return '';
    var names = { WC: 'Copa del Mundo', EURO: 'Eurocopa', COPA: 'Copa América', AFCON: 'Copa Africana', ASIA: 'Copa Asiática', GOLD: 'Copa Oro' };
    return '<div class="card"><h3>Campeones de selecciones</h3>' + ch.slice(0, 20).map(function (x) { return '<div class="row sp" style="padding:.2rem 0"><span class="mut">' + names[x.key] + ' ' + esc(x.y) + '</span><span>🏆 ' + esc(C.tname(x.ch)) + ' <span class="mut sm">(final vs ' + esc(C.tname(x.ru)) + ')</span></span></div>'; }).join('') + '</div>';
  };

  // ======================= PALMARÉS =======================
  SC.honors = function () {
    var S = FP.S, h = S.hero, tab = UI.tab.honors || 'me';
    var html = '<h1>Palmarés</h1>' + tabs('honors', [['me', 'Mis trofeos'], ['clubs', 'Campeones mundiales']], tab);
    if (tab === 'me') {
      html += '<div class="grid g2"><div class="card"><h3>Trofeos (' + h.trophies.length + ')</h3>' + (h.trophies.length ? h.trophies.slice().reverse().map(function (t) { return '<div class="row sp" style="padding:.3rem 0;border-bottom:1px solid var(--line)"><span>' + (t.sub ? '🥈' : '🏆') + ' ' + esc(t.nm) + '</span><span class="mut sm">' + esc(t.club || '') + ' · ' + esc(t.y) + '</span></div>'; }).join('') : '<p class="mut">Aún sin títulos. Cada campeonato ganado quedará aquí.</p>') + '</div>';
      html += '<div class="card"><h3>Premios individuales (' + h.awards.length + ')</h3>' + (h.awards.length ? h.awards.slice().reverse().map(function (t) { return '<div class="row sp" style="padding:.3rem 0;border-bottom:1px solid var(--line)"><span>⭐ ' + esc(t.nm) + '</span><span class="mut sm">' + esc(t.y) + '</span></div>'; }).join('') : '<p class="mut">Sin premios todavía.</p>') + '</div></div>';
    } else {
      var f = UI.filt.hk || 'cont';
      var opts = [['cont', 'Torneos continentales'], ['nat', 'Selecciones'], ['cup', 'Copas nacionales'], ['lg', 'Ligas']];
      html += '<div class="filters"><label class="f"><span>Tipo</span><select data-act="filt" data-k="hk">' + opts.map(function (o) { return '<option value="' + o[0] + '" ' + (f === o[0] ? 'selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' + (f === 'lg' ? UI.leagueSelect('hlg', { def: UI.myLeague() }) : '') + '</div>';
      var ch = S.hist.champs.filter(function (x) { return x.k === f; });
      if (f === 'lg') { var lid = UI.filt.hlg || UI.myLeague(); ch = ch.filter(function (x) { return x.lg === lid; }); }
      ch = ch.slice().reverse();
      html += '<div class="card">' + (ch.length ? ch.slice(0, 150).map(function (x) { var nm = f === 'cont' ? (FP.Cont.DEF[x.key] ? FP.Cont.DEF[x.key].nm : 'Mundial de Clubes') : f === 'cup' ? x.nm : f === 'nat' ? FP.Nat.TOURN[x.key].nm : FP.LGDEF[x.lg].n; return '<div class="row sp" style="padding:.25rem 0;border-bottom:1px solid var(--line)"><span class="mut">' + esc(nm) + ' ' + esc(x.y) + '</span><span>🏆 ' + UI.club(x.ch) + ' <span class="mut sm">· sub: ' + esc(C.tname(x.ru)) + '</span></span></div>'; }).join('') : '<p class="mut">Aún no hay campeones registrados: se acumulan a medida que pasan las temporadas.</p>') + '</div>';
    }
    return html;
  };

  // ======================= HISTORIAL DE CARRERA =======================
  SC.career = function () {
    var S = FP.S, h = S.hero;
    var html = '<h1>Historial de carrera</h1>';
    if (h.retired) {
      var years = h.retiredAge - h.startAge;
      html += '<div class="card" style="border-color:var(--gold)"><h2>🏁 Carrera finalizada</h2><p>' + esc(h.nm) + ' se retiró a los ' + h.retiredAge + ' años, tras ' + years + ' años de carrera (' + D.fmt(h.retiredW) + ').</p><div class="grid g4">' + UI.stat('Partidos', h.tot.ap) + UI.stat('Goles', h.tot.g) + UI.stat('Asistencias', h.tot.a) + UI.stat('Trofeos', h.trophies.filter(function (t) { return !t.sub; }).length) + '</div><p class="mut" style="margin-top:.6rem">Media máxima: <b style="color:var(--tx)">' + Math.max.apply(null, h.prog.map(function (p) { return p[1]; })) + '</b> · Selección: ' + h.nt.caps + ' partidos.</p><button class="btn pri" data-act="newfromend">Empezar una nueva carrera</button></div>';
    }
    html += '<div class="card"><h3>Evolución de la media</h3>' + UI.progChart(h) + '</div>';
    html += '<div class="card"><h3>Temporadas</h3>' + UI.seasonsTable(h) + '</div>';
    html += '<div class="card"><h3>Línea de tiempo</h3><div class="feed">' + ((h.history || []).slice().reverse().map(function (x) { return '<div class="it"><span class="dt">' + D.fmt(x.w) + '</span><span>' + esc(x.t) + '</span></div>'; }).join('') || '<p class="mut">Sin movimientos todavía.</p>') + '</div></div>';
    return html;
  };
  A.newfromend = function () { FP.Start.menu(); };

  // ======================= CONFIGURACIÓN =======================
  SC.config = function () {
    var S = FP.S, tab = UI.tab.config || 'saves';
    var html = '<h1>Configuración</h1>' + tabs('config', [['saves', 'Partidas'], ['leagues', 'Ligas activas'], ['data', 'Datos y pendientes'], ['sys', 'Opciones']], tab);
    if (tab === 'saves') {
      html += '<div class="card"><h3>Guardado</h3><p class="mut sm">El juego guarda automáticamente cada ' + (S.cfg.autoEvery || 4) + ' semanas y al tomar decisiones importantes, en el almacenamiento local del navegador (IndexedDB). Último guardado: <b id="lastsave">' + (FP.Store.lastSaved ? new Date(FP.Store.lastSaved).toLocaleTimeString('es-CL') : '—') + '</b>.</p><div class="btn-group"><button class="btn pri" data-act="savenow">Guardar ahora</button><button class="btn" data-act="saveas">Guardar como nueva partida…</button><button class="btn" data-act="exportsave">Exportar a archivo</button><label class="btn" style="cursor:pointer">Importar archivo<input type="file" id="impfile" accept=".fpsave,.json,application/json" style="display:none" data-act="impfile"></label><button class="btn sec" data-act="loadlist">Cargar otra partida</button><button class="btn dng" data-act="gomenu">Menú principal</button></div></div>';
      html += '<div id="savelist"></div>';
    } else if (tab === 'leagues') {
      html += '<div class="info">Desactivar una liga la excluye del avance semanal: se simula completa, en bloque, al terminar su temporada (más rápido). Tu competición no se puede desactivar.</div>';
      var mine = UI.myLeague();
      var rows = FP.DATA.leagues.map(function (l) { return { l: l, nm: l.n, c: FP.DATA.countries[l.c].n, t: l.t, on: !(S.cfg.off && S.cfg.off[l.id]), n: S.lgs[l.id].teams.length }; });
      html += UI.table('cfg_lg', [{ k: 'c', t: 'País' }, { k: 'nm', t: 'Liga' }, { k: 't', t: 'Nivel', n: 1 }, { k: 'n', t: 'Clubes', n: 1 }, { k: 'on', t: 'Activa', s: false, f: function (r) { return '<input type="checkbox" data-act="lgtog" data-id="' + r.l.id + '" ' + (r.on ? 'checked' : '') + (r.l.id === mine ? ' disabled' : '') + '>'; } }], rows, { sort: ['c', 'a'] });
      html += '<p style="margin-top:.6rem"><button class="btn sm" data-act="lgall" data-v="1">Activar todas</button> <button class="btn sm" data-act="lgall" data-v="0">Desactivar todas menos mi liga</button></p>';
    } else if (tab === 'data') {
      html += '<div class="card"><h3>Origen de los datos</h3><p>Clubes, países, ligas y formatos corresponden al fútbol real (' + esc(FP.DATA.seasonLabel) + '). <b>Los futbolistas son generados por el juego</b> (nombres y atributos ficticios); no se atribuyen jugadores reales a clubes. Los resultados anteriores a mayo de 2026 son simulados.</p><p class="mut sm">Versión de la base de datos: ' + FP.DATA.version + ' · formato de guardado: ' + FP.Store.VERSION + '. Para actualizarla, edita <code>data/world.js</code> y abre una partida nueva (las partidas existentes incorporan automáticamente clubes y ligas nuevos).</p></div>';
      html += '<div class="card"><h3>Pendientes y limitaciones</h3><ul>' + FP.DATA.pending.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>';
      var rows2 = FP.DATA.leagues.map(function (l) { return { id: l.id, c: FP.DATA.countries[l.c].n, n: l.n, v: l.v, k: l.clubs.split(';').length }; });
      html += '<div class="card"><h3>Estado de verificación por división</h3>' + UI.table('cfg_v', [{ k: 'c', t: 'País' }, { k: 'n', t: 'División' }, { k: 'k', t: 'Clubes', n: 1 }, { k: 'v', t: 'Verificación', f: function (r) { return UI.verBadge(r.v); } }], rows2, { sort: ['c', 'a'] }) + '</div>';
    } else {
      html += '<div class="card"><h3>Aspecto</h3><label class="f" style="max-width:320px"><span>Tema visual</span><select data-act="skin">' + Object.keys(UI.skins).map(function (k) { return '<option value="' + k + '" ' + (UI.skin === k ? 'selected' : '') + '>' + UI.skins[k] + '</option>'; }).join('') + '</select></label></div>';
      html += '<div class="card"><h3>Opciones</h3><div class="grid g3"><label class="f"><span>Autoguardado</span><select data-act="cfgauto"><option value="1" ' + (S.cfg.autosave !== false ? 'selected' : '') + '>Activado</option><option value="0" ' + (S.cfg.autosave === false ? 'selected' : '') + '>Desactivado</option></select></label><label class="f"><span>Guardar cada…</span><select data-act="cfgevery">' + [1, 2, 4, 8, 13].map(function (v) { return '<option value="' + v + '" ' + ((S.cfg.autoEvery || 4) === v ? 'selected' : '') + '>' + v + ' semana' + (v > 1 ? 's' : '') + '</option>'; }).join('') + '</select></label></div></div>';
      html += '<div class="card"><h3>Semilla del mundo</h3><p class="mut sm">Semilla: <b>' + S.seed + '</b>. Los resultados de la simulación del mundo son deterministas dado el estado guardado.</p></div>';
    }
    return html;
  };
  UI.after.config = function () { if ((UI.tab.config || 'saves') === 'saves') A.loadlist(); };
  A.savenow = function () { FP.Store.save().then(function () { UI.toast('Partida guardada.', 'ok'); var e = document.getElementById('lastsave'); if (e) e.textContent = new Date().toLocaleTimeString('es-CL'); A.loadlist(); }).catch(function (e) { UI.toast('No se pudo guardar en el navegador (' + esc(e && e.message) + '). Usa "Exportar a archivo".', 'bad'); }); };
  A.saveas = function () { var nm = prompt('Nombre de la partida:', FP.S.hero.nm + ' · ' + D.fmt(FP.S.week)); if (nm == null) return; FP.Store.saveAs(nm).then(function () { UI.toast('Copia guardada.', 'ok'); A.loadlist(); }).catch(function (e) { UI.toast('Error al guardar: ' + esc(e.message), 'bad'); }); };
  A.exportsave = function () { FP.Store.export().then(function (n) { UI.toast('Archivo exportado (' + Math.round(n / 1024) + ' KB).', 'ok'); }).catch(function (e) { UI.toast('Error: ' + esc(e.message), 'bad'); }); };
  A.impfile = function (d, t) { var f = t.files && t.files[0]; if (!f) return; FP.Store.import(f).then(function () { UI.toast('Partida importada.', 'ok'); FP.Store.save().then(function () { UI.scr = 'home'; UI.render(); }); }).catch(function (e) { UI.toast('No se pudo importar: ' + esc(e.message), 'bad'); }); };
  A.gomenu = function () { FP.Store.save().catch(function () { }).then(function () { FP.Start.menu(); }); };
  A.lgtog = function (d, t) { var S = FP.S; S.cfg.off = S.cfg.off || {}; if (t.checked) delete S.cfg.off[d.id]; else S.cfg.off[d.id] = 1; };
  A.lgall = function (d) { var S = FP.S, mine = UI.myLeague(); S.cfg.off = {}; if (d.v === '0') FP.DATA.leagues.forEach(function (l) { if (l.id !== mine) S.cfg.off[l.id] = 1; }); UI.render(); };
  A.cfgauto = function (d, t) { FP.S.cfg.autosave = t.value === '1'; };
  A.cfgevery = function (d, t) { FP.S.cfg.autoEvery = +t.value; };
  A.loadlist = function () {
    var box = document.getElementById('savelist'); if (!box) return;
    FP.Store.list().then(function (list) {
      box.innerHTML = '<div class="card"><h3>Partidas guardadas</h3>' + (list.length ? list.map(function (s) { var m = s.meta; return '<div class="row sp" style="padding:.45rem 0;border-bottom:1px solid var(--line)"><span><b>' + esc(s.label || m.name) + '</b> <span class="mut sm">· ' + (m.age != null ? m.age + ' años · media ' + m.ovr + ' · ' : '') + esc(m.team) + ' · ' + esc(m.date) + (m.retired ? ' · retirado' : '') + (s.id === FP.S.sid ? ' · <span class="ok">actual</span>' : '') + '</span></span><span class="btn-group"><button class="btn sm pri" data-act="loadsave" data-id="' + s.id + '">Cargar</button><button class="btn sm dng" data-act="delsave" data-id="' + s.id + '">Borrar</button></span></div>'; }).join('') : '<p class="mut">No hay partidas guardadas todavía.</p>') + '</div>';
    });
  };
  A.loadsave = function (d) {
    UI.overlay('Cargando partida…');
    FP.Store.load(d.id).then(function () { UI.overlay(false); UI.scr = 'home'; UI.mt = null; UI.render(); UI.toast('Partida cargada.', 'ok'); }).catch(function (e) { UI.overlay(false); UI.toast('No se pudo cargar: ' + esc(e.message), 'bad'); });
  };
  A.delsave = function (d) { UI.confirm('¿Borrar esta partida de forma permanente?', function () { FP.Store.remove(d.id).then(function () { A.loadlist(); }); }); };

  // ======================= fichas de club y jugador =======================
  A.club = function (d) {
    var S = FP.S, c = S.clubs[+d.id]; if (!c) return;
    var lg = FP.LGDEF[c.lg], comp = S.comps[S.lgs[c.lg].cmp], pos = null;
    if (comp) { var rows = Comp.rows(comp); rows.forEach(function (r) { if (r.id === c.id) pos = r; }); }
    var h = S.hero, age = FP.Hero.age();
    var can = age <= 19 && h.tk !== 'pro' && h.tk !== 'loan' && lg.t <= 3 && (c.c === FP.Market.heroCountry() || age >= 18);
    var html = '<h2>' + esc(c.nm) + '</h2><div class="row"><span class="pill">' + esc(C.cname(c.c)) + '</span><span class="pill b">' + esc(lg.n) + '</span>' + UI.verBadge(lg.v) + '</div><div class="grid g3" style="margin:.8rem 0"><div class="card" style="margin:0"><h4>Club</h4><dl class="kv"><dt>Entrenador</dt><dd>' + esc(c.co) + '</dd><dt>Fuerza</dt><dd>' + c.st + '</dd><dt>Cantera</dt><dd>' + UI.stars(c.ac * 20) + '</dd><dt>Economía</dt><dd>' + c.fin + '/10</dd></dl></div>' + (pos ? '<div class="card" style="margin:0"><h4>Temporada</h4><dl class="kv"><dt>Puesto</dt><dd>' + pos.pos + '°</dd><dt>Puntos</dt><dd>' + pos.pts + '</dd><dt>PJ</dt><dd>' + pos.p + '</dd><dt>Goles</dt><dd>' + pos.gf + ':' + pos.ga + '</dd></dl></div>' : '') + '<div class="card" style="margin:0"><h4>Acciones</h4>' + (can ? '<button class="btn sm pri" data-act="trial" data-id="' + c.id + '">Pedir prueba en inferiores</button>' : '<span class="mut sm">—</span>') + '</div></div>';
    html += '<div class="row" style="margin:.4rem 0"><button class="btn" data-act="cwiki" data-id="' + c.id + '">Ver artículo del club</button></div>';
    if (FP.Wages && UI.wageCard) html += UI.wageCard(c);
    html += '<h3>Plantel</h3>' + UI.squadTable(c.id, 'mc_' + c.id);
    UI.modal(html, true);
  };
  A.player = function (d) {
    var S = FP.S, id = +d.id; if (id === 0) { UI.closeModal(); UI.go('player'); return; }
    var p = S.pl[id]; if (!p) return; var age = C.age(p), v = C.value(p.o, p.pt, age);
    var html = '<div class="pcard"><div class="big">' + UI.ovr(p.o, true) + '<div class="pos">' + UI.pos(p.p) + '</div></div><div><div class="pname">' + esc(p.n) + '</div><div class="mut">' + age + ' años · ' + esc(C.cname(p.nat)) + '</div><div>' + (p.c >= 0 ? UI.club(p.c) : 'Sin club') + '</div><div class="notice" style="margin:.5rem 0 0">Jugador generado por el juego (no es una persona real).</div></div></div>' +
      '<div class="grid g3" style="margin-top:.8rem"><div class="card" style="margin:0"><h4>Valor</h4><b>' + UI.money(v) + '</b></div><div class="card" style="margin:0"><h4>Contrato</h4><b>' + (p.ce || '—') + '</b></div><div class="card" style="margin:0"><h4>Temporada</h4><b>' + (p.g || 0) + ' goles · ' + (p.as || 0) + ' asist.</b></div></div>' + (p.inj ? '<p class="bad">Lesionado: ' + p.inj + ' semanas</p>' : '');
    UI.modal(html);
  };
})();
