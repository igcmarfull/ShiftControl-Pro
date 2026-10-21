/* FUTPRO — pantallas de la fase funcional: selecciones por categorías, estadísticas por clase y temporada,
   reputación y mercado, plantilla juvenil del club. Solo presentación; conserva los manejadores existentes. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, D = FP.Date, UI = FP.UI, esc = U.esc, A = UI.acts, SC = UI.screens, Comp = FP.Comp, I = UI.icon, NT = FP.NT, ST = FP.Stats;
  var hdr = UI.hdr, seg = UI.seg;

  function pct(v) { return Math.round(v); }
  function bar(v, cls) { return UI.bar(v, 100, cls || ''); }
  var STL = { none: ['Sin observación', ''], obs: ['Observado', 'b'], micro: ['Microciclos', 'y'], pre: ['Preseleccionado', 'y'], sel: ['Convocado', 'g'], cut: ['Descartado', 'r'] };
  function stPill(st) { var x = STL[st] || STL.none; return '<span class="pill ' + x[1] + '">' + x[0] + '</span>'; }
  function money(v) { return UI.money(v); }
  function crestOrFlag(natId) { var n = FP.S.nat[natId - 5000]; return n ? UI.flag(n.c) : ''; }
  function natName(id) { return C.tname(id); }
  function catRows(rows, cls) { return rows.filter(function (r) { return r.k === cls; }); }
  var CLS_OF = { U15: 'u15', U17: 'u17', U20: 'u20', U23: 'u23', ABS: 'abs' };

  // ---------- SELECCIONES ----------
  A.ntsq = function (d, t) { UI.filt.ntNat = t.value; UI.render(); };
  A.ntcat = function (d) { UI.filt.ntCat = d.v; UI.render(); };
  A.compgo = function (d) { UI.filt.compCat = d.cat; UI.filt.compSel = d.id; UI.go('comps'); };

  function meTab(nat) {
    var S = FP.S, h = S.hero, age = FP.Hero.age(), y = D.year(S.week), html = '';
    var byCls = ST.byClass();
    html += '<div class="nat-h">' + UI.flag(h.nat, true) + '<div><h1 style="margin:0 0 .2rem;font-size:1.6rem">' + esc(nat.nm) + '</h1><div class="mut">' + nat.conf + ' · Nivel de la absoluta ' + nat.r.toFixed(1) + ' <span class="tag-gen">estimado</span></div></div>' +
      '<div class="terms" style="grid-template-columns:repeat(3,auto);margin:0"><div><span>Partidos</span><b>' + h.nt.caps + '</b></div><div><span>Goles</span><b>' + h.nt.goals + '</b></div><div><span>Reputación nac.</span><b>' + pct(h.rep ? h.rep.nat : 0) + '</b></div></div></div>';
    html += '<div class="grid g2">';
    NT.CATS.forEach(function (cat) {
      var hs = NT.hs(cat), lim = NT.limitFor(cat, nat), elig = NT.heroEligible(cat), last = cat === 'ABS' ? null : D.year(h.b) + lim;
      var tot = byCls[CLS_OF[cat]] ? byCls[CLS_OF[cat]].tot : null;
      var tour = S.nt.tours.filter(function (t) { return t.cat === (cat === 'ABS' ? 'ABS' : cat) && (NT.TD[t.key].conf === nat.conf || NT.TD[t.key].world); }).sort(function (a, b) { return a.s0 - b.s0; })[0];
      var why = '';
      if (!elig) why = cat === 'ABS' ? (age < 17 ? 'Disponible desde los 17 años.' : 'Necesitas jugar en un club profesional.') : 'Ya no eres elegible para esta categoría (en ' + y + ' pueden jugar los nacidos en ' + (y - lim) + ' o después).';
      else if (hs.st === 'none') why = 'Aún no estás en el radar del cuerpo técnico. Los ojeadores siguen a jugadores con rendimiento y visibilidad.';
      else if (hs.st === 'obs') why = 'Los ojeadores te siguen. Puedes ser citado a un microciclo antes del próximo torneo.';
      else if (hs.st === 'micro') why = 'Participas de los microciclos: compites por un cupo con otros jugadores de tu puesto.';
      else if (hs.st === 'pre') why = 'Estás en la preselección: falta la nómina final.';
      else if (hs.st === 'sel') why = 'Formas parte de la nómina vigente.';
      else if (hs.st === 'cut') why = 'Quedaste fuera en el último proceso' + (hs.cd > S.week ? ' (volverán a considerarte en ' + Math.max(1, Math.round((hs.cd - S.week) / 4)) + ' meses)' : '') + '.';
      var rk = hs.rk ? '<div class="kv-i"><span>Tu puesto entre ' + hs.rk.of + ' candidatos de tu posición</span><b>' + hs.rk.rank + 'º (cupos: ' + hs.rk.quota + ')</b></div>' : '';
      html += '<div class="card"><div class="hd"><h3>' + I(cat === 'ABS' ? 'flag' : 'medal') + NT.LABEL[cat] + '</h3>' + (elig ? stPill(hs.st) : '<span class="pill">No elegible</span>') + '</div>' +
        '<p class="mut sm" style="margin:.1rem 0 .5rem">' + why + '</p>' + rk +
        (last ? '<div class="kv-i"><span>Elegible hasta</span><b>' + last + '</b></div>' : '') +
        (tour ? '<div class="kv-i"><span>Próximo torneo</span><b>' + esc(NT.TD[tour.key].nm) + ' · ' + D.fmt(tour.s0) + '</b></div>' : '') +
        '<div class="kv-i"><span>Convocatorias / microciclos</span><b>' + (hs.n || 0) + ' / ' + (hs.mc || 0) + '</b></div>' +
        '<div class="terms" style="margin-top:.5rem"><div><span>Partidos</span><b>' + (tot ? tot.p : 0) + '</b></div><div><span>Minutos</span><b>' + (tot ? tot.min : 0) + '</b></div><div><span>Goles</span><b>' + (tot ? tot.g : 0) + '</b></div><div><span>Asist.</span><b>' + (tot ? tot.a : 0) + '</b></div></div></div>';
    });
    html += '</div>';
    var ev = h.nts && h.nts.ev ? h.nts.ev.slice(0, 14) : [];
    html += '<div class="card"><div class="hd"><h3>' + I('history') + 'Seguimiento de las selecciones</h3></div>' + (ev.length ? ev.map(function (e) { return '<div class="hrow"><span class="mut" style="min-width:5.8rem">' + D.fmt(e.w) + '</span><span class="pill">' + NT.LABEL[e.cat] + '</span><span class="grow">' + esc(e.t) + '</span></div>'; }).join('') : '<p class="mut">Todavía no hay novedades. Juega, rinde y destácate para entrar en el radar.</p>') + '</div>';
    return html;
  }

  function squadTab() {
    var S = FP.S, h = S.hero, natId = +(UI.filt.ntNat || Nat0().id), cat = UI.filt.ntCat || 'U17', nat = S.nat[natId - 5000];
    var list = NT.squadOf(natId, cat), coach = NT.coach(natId, cat);
    var html = '<div class="filters"><label class="f"><span>Selección</span><select data-act="ntsq">' + S.nat.slice().sort(function (a, b) { return a.nm.localeCompare(b.nm, 'es'); }).map(function (n) { return '<option value="' + n.id + '" ' + (n.id === natId ? 'selected' : '') + '>' + esc(n.nm) + '</option>'; }).join('') + '</select></label><div class="chips" style="align-self:flex-end">' + NT.CATS.map(function (c) { return '<button class="chip ' + (c === cat ? 'on' : '') + '" data-act="ntcat" data-v="' + c + '">' + NT.LABEL[c] + '</button>'; }).join('') + '</div></div>';
    var sk = S.nt.sq[natId + '|' + cat];
    var strength = list.length ? NT.strength(natId, cat, cat === 'ABS' ? null : list) : null;
    html += '<div class="card"><div class="hd"><h3>' + UI.flag(nat.c) + esc(nat.nm) + ' · ' + NT.LABEL[cat] + '</h3><span class="mut sm">Seleccionador: <b style="color:var(--tx)">' + esc(coach.nm) + '</b> <span class="tag-gen">generado</span></span></div>';
    if (!list.length) html += '<p class="mut">Esta selección aún no tiene nómina vigente. Las nóminas se arman antes de cada torneo o ventana de amistosos.</p>';
    else {
      html += '<p class="mut sm">' + (sk.kind === 'final' ? 'Nómina final' : sk.kind === 'friendly' ? 'Nómina de amistosos' : 'Lista de trabajo') + ' (' + D.fmt(sk.at) + ') · ' + list.length + ' jugadores' + (strength != null && cat !== 'ABS' ? ' · fuerza del equipo ' + strength.toFixed(1) : '') + '</p>';
      var rows = list.map(function (p) { var ns = p.ns && p.ns[cat] || [0, 0, 0, 0], age = C.age(p); return { p: p, i: p.i, nm: p.i === 0 ? h.nm : p.n, pos: p.p, age: age, o: p.i === 0 ? h.ovr : p.o, club: p.c >= 0 ? p.c : (p.cl != null ? p.cl : -1), ap: ns[0], min: ns[1], g: ns[2], a: ns[3] }; });
      var posOrd = { GK: 0, CB: 1, LB: 2, RB: 3, DM: 4, CM: 5, AM: 6, LW: 7, RW: 8, ST: 9 }; rows.forEach(function (r) { r.po = posOrd[r.pos]; });
      html += UI.table('nt_sq', [
        { k: 'po', t: 'Pos', f: function (r) { return UI.posb(r.pos); } },
        { k: 'nm', t: 'Jugador', f: function (r) { return r.i === 0 ? '<b>' + esc(r.nm) + '</b> <span class="pill g">tú</span>' : esc(r.nm) + ' <span class="tag-gen">generado</span>'; } },
        { k: 'age', t: 'Edad', n: 1 }, { k: 'o', t: 'Media', n: 1, f: function (r) { return UI.ovr(r.o); } },
        { k: 'club', t: 'Club', f: function (r) { return r.club >= 0 ? UI.clubC(r.club) : '<span class="mut">—</span>'; }, v: function (r) { return r.club >= 0 ? C.tname(r.club) : ''; } },
        { k: 'ap', t: 'PJ', n: 1 }, { k: 'min', t: 'Min', n: 1 }, { k: 'g', t: 'G', n: 1 }, { k: 'a', t: 'A', n: 1 }
      ], rows, { sort: ['po', 'a'], cls: function (r) { return r.i === 0 ? 'me' : ''; } });
    }
    html += '</div>';
    return html;
  }
  function Nat0() { var S = FP.S, n = FP.Nat.heroNation(); return n || S.nat[0]; }

  function tourTab(nat) {
    var S = FP.S, st = S.nt, rows = [];
    st.tours.forEach(function (t) { var d = NT.TD[t.key], c = S.comps[t.id]; rows.push({ t: t, nm: d.nm, cat: d.cat, s0: t.s0, stage: t.stage, comp: c, mine: d.world || d.conf === nat.conf, v: d.v, note: d.note }); });
    rows.sort(function (a, b) { return a.s0 - b.s0; });
    var stageTxt = { plan: 'Programado', obs: 'Observación', micro: 'Microciclos', pre: 'Preselección', final: 'Nómina final', play: 'En juego' };
    var html = '<div class="card"><div class="hd"><h3>' + I('calendar') + 'Torneos programados</h3><span class="mut sm">Los formatos y cupos siguen los reales; las ediciones previas al inicio de la partida son simuladas.</span></div>' +
      UI.table('nt_tours', [
        { k: 's0', t: 'Inicio', f: function (r) { return D.fmt(r.s0); } },
        { k: 'nm', t: 'Torneo', f: function (r) { return (r.comp ? '<a class="lk" data-act="compgo" data-id="' + r.t.id + '" data-cat="Selecciones juveniles">' + esc(r.nm) + '</a>' : esc(r.nm)) + (r.mine ? '' : ''); } },
        { k: 'cat', t: 'Categoría', f: function (r) { return '<span class="pill">' + NT.LABEL[r.cat] + '</span>'; } },
        { k: 'stage', t: 'Estado', f: function (r) { return stageTxt[r.stage] || r.stage; } },
        { k: 'v', t: 'Formato', f: function (r) { return r.v === 'v' ? '<span class="pill g" title="' + esc(r.note) + '">verificado</span>' : '<span class="pill y" title="' + esc(r.note) + '">adaptado</span>'; } }
      ], rows.filter(function (r) { return r.mine; }), { sort: ['s0', 'a'], max: 40 }) + '</div>';
    return html;
  }

  function histTab() {
    var S = FP.S, cat = UI.filt.ntCat || 'U17', hist = S.nt.hist.filter(function (x) { return x.cat === cat; }).slice().reverse();
    var html = '<div class="chips" style="margin-bottom:.6rem">' + NT.CATS.filter(function (c) { return c !== 'ABS'; }).map(function (c) { return '<button class="chip ' + (c === cat ? 'on' : '') + '" data-act="ntcat" data-v="' + c + '">' + NT.LABEL[c] + '</button>'; }).join('') + '</div>';
    var titles = {}; hist.forEach(function (x) { titles[x.ch] = (titles[x.ch] || 0) + 1; });
    var top = Object.keys(titles).sort(function (a, b) { return titles[b] - titles[a]; }).slice(0, 6);
    html += '<div class="grid g21"><div class="card"><div class="hd"><h3>' + I('trophy') + 'Campeones ' + NT.LABEL[cat] + '</h3></div>' + (hist.length ? hist.slice(0, 60).map(function (x) { return '<div class="hrow"><span class="mut ell" style="min-width:11rem;max-width:38%">' + esc(x.name) + ' ' + esc(x.y) + '</span><div class="grow ell">' + I('trophy') + ' ' + crestOrFlag(x.ch) + ' <b>' + esc(natName(x.ch)) + '</b></div><span class="mut sm ell">sub: ' + esc(natName(x.ru)) + (x.sc && x.sc[0] ? ' · goleador ' + esc(x.sc[0].n) + ' (' + x.sc[0].g + ')' : '') + '</span></div>'; }).join('') : '<p class="mut">Todavía no se disputó ningún torneo de esta categoría.</p>') + '</div>' +
      '<div class="card"><div class="hd"><h3>' + I('medal') + 'Más títulos</h3></div>' + (top.length ? top.map(function (id) { return '<div class="hrow">' + crestOrFlag(+id) + '<b class="grow">' + esc(natName(+id)) + '</b><span class="pill g">' + titles[id] + '</span></div>'; }).join('') : '<p class="mut">—</p>') + '</div></div>';
    return html;
  }

  var oldNat = SC.nations;
  SC.nations = function () {
    var S = FP.S, h = S.hero, nat = FP.Nat.heroNation(), tab = UI.tab.nations || 'me';
    NT.ensure();
    var html = hdr('flag', 'Selecciones', 'Categorías juveniles, absoluta, torneos e historial', seg('nations', [['me', 'Mi camino', 'user'], ['sq', 'Plantillas', 'shield'], ['tour', 'Torneos', 'calendar'], ['hist', 'Historial', 'trophy'], ['rank', 'Ranking', 'chart']], tab));
    if (tab === 'me') return html + meTab(nat);
    if (tab === 'sq') return html + squadTab();
    if (tab === 'tour') return html + tourTab(nat);
    if (tab === 'hist') return html + histTab();
    var inner = oldNat.call(this); // ranking
    return html + inner.replace(/^[\s\S]*?(<div class="notice">)/, '$1');
  };

  // fase final de un torneo juvenil (hexagonal / cuadrangular) dentro de la vista de competición
  var oldCV = UI.compView;
  UI.compView = function (comp, key) {
    var h = oldCV.call(this, comp, key);
    if (comp.kind === 'T' && comp.ftab && comp.ftab.length) {
      var rows = NT.finalRows(comp); rows.forEach(function (r) { r.nm = C.tname(r.id); });
      h += '<div class="card" style="margin-top:.8rem"><div class="hd"><h3>Fase final</h3></div>' + UI.table(key + '_fin', [{ k: 'pos', t: '#', c: 1 }, { k: 'nm', t: 'Equipo', f: function (r) { return UI.clubC(r.id); } }, { k: 'p', t: 'PJ', n: 1 }, { k: 'w', t: 'G', n: 1 }, { k: 'd', t: 'E', n: 1 }, { k: 'l', t: 'P', n: 1 }, { k: 'gf', t: 'GF', n: 1 }, { k: 'ga', t: 'GC', n: 1 }, { k: 'pts', t: 'Pts', n: 1, f: function (r) { return '<b>' + r.pts + '</b>'; } }], rows, { sort: ['pos', 'a'] }) + '</div>';
    }
    return h;
  };

  // ---------- ESTADÍSTICAS PROPIAS (por clase, temporada, club y competición) ----------
  function classTable(rows, id) {
    return UI.table(id, [
      { k: 's', t: 'Temp.' }, { k: 'tn', t: 'Equipo', f: function (r) { return r.t != null && r.t < 5000 ? UI.clubC(r.t) : esc(r.tn); }, v: function (r) { return r.tn; } }, { k: 'c', t: 'Competición' },
      { k: 'p', t: 'PJ', n: 1 }, { k: 'st', t: 'Tit.', n: 1 }, { k: 'sub', t: 'Sup.', n: 1, f: function (r) { return r.p - r.st; } }, { k: 'min', t: 'Min', n: 1 }, { k: 'g', t: 'G', n: 1 }, { k: 'a', t: 'A', n: 1 },
      { k: 'yc', t: 'Am.', n: 1 }, { k: 'rc', t: 'Ro.', n: 1 }, { k: 'rt', t: 'Nota', n: 1, f: function (r) { return r.rn ? (r.rs / r.rn).toFixed(2) : '—'; }, v: function (r) { return r.rn ? r.rs / r.rn : 0; } }
    ], rows.map(function (r) { r.sub = r.p - r.st; return r; }), { sort: ['s', 'd'], max: 60 });
  }
  function myStats() {
    var h = FP.S.hero, by = ST.byClass(), sub = UI.tab.stm || 'class', html = '';
    html += '<div style="margin-bottom:.7rem">' + seg('stm', [['class', 'Por clase', 'chart'], ['season', 'Por temporada', 'calendar']], sub) + '</div>';
    var keys = Object.keys(by);
    if (!keys.length) return html + '<div class="card"><p class="mut">Todavía no hay partidos registrados. Cada partido que dispute quedará asociado a su club, temporada y competición.</p></div>';
    if (sub === 'class') {
      html += '<div class="grid g3">' + keys.map(function (k) { var t = by[k].tot; return '<div class="card"><div class="hd"><h3>' + esc(ST.CLASSES[k]) + '</h3><span class="pill">' + t.p + ' PJ</span></div><div class="terms" style="grid-template-columns:repeat(4,1fr)"><div><span>Goles</span><b>' + t.g + '</b></div><div><span>Asist.</span><b>' + t.a + '</b></div><div><span>Minutos</span><b>' + t.min + '</b></div><div><span>Nota</span><b>' + (t.rn ? t.rt.toFixed(2) : '—') + '</b></div></div><div class="mut sm" style="margin-top:.4rem">' + t.st + ' titular · ' + t.sub + ' suplente · ' + t.yc + ' am. · ' + t.rc + ' ro. · ' + t.w + 'V ' + t.d + 'E ' + t.l + 'D</div></div>'; }).join('') + '</div>';
      keys.forEach(function (k) { html += '<div class="card"><div class="hd"><h3>' + esc(ST.CLASSES[k]) + ' — detalle</h3></div>' + classTable(by[k].rows, 'stc_' + k) + '</div>'; });
    } else {
      ST.seasons().forEach(function (s, i) {
        var club = s.t != null && s.t < 5000 ? UI.clubC(s.t) : esc(s.tn);
        html += '<div class="card"><div class="hd"><h3>' + esc(s.s) + ' · ' + club + '</h3><span class="mut sm">' + s.tot.p + ' PJ · ' + s.tot.g + ' G · ' + s.tot.a + ' A</span></div>' + classTable(s.rows, 'sts_' + i) + '</div>';
      });
    }
    return html;
  }
  var oldStats = SC.stats;
  SC.stats = function () {
    var tab = UI.tab.stats || 'comp';
    if (tab !== 'mine') {
      var inner = oldStats.call(this).replace(/^<h1>[\s\S]*?<\/h1>/, '');   // el título lo pone la envoltura de v3b
      inner = inner.replace(/^<div class="tabs">[\s\S]*?<\/div>/, '');
      return hdr('chart', 'Estadísticas', 'Líderes, rankings y tu rendimiento', seg('stats', [['mine', 'Mis estadísticas', 'user'], ['comp', 'Competición', 'trophy'], ['pl', 'Mejores jugadores', 'star']], tab)) + inner;
    }
    return hdr('chart', 'Estadísticas', 'Líderes, rankings y tu rendimiento', seg('stats', [['mine', 'Mis estadísticas', 'user'], ['comp', 'Competición', 'trophy'], ['pl', 'Mejores jugadores', 'star']], tab)) + myStats();
  };
  UI.tab.stats = UI.tab.stats || 'mine';

  // ---------- HISTORIAL DE CARRERA con registro por clase ----------
  var oldCareer = SC.career;
  SC.career = function () {
    var h = FP.S.hero, html = oldCareer.call(this);
    // sustituye la tabla de temporadas heredada por el registro por temporada, club y competición
    html = html.replace(/<div class="card"><h3>Temporadas<\/h3>[\s\S]*?<\/div><div class="card"><h3>Línea de tiempo/, '<div class="card"><div class="hd"><h3>Temporadas por club y competición</h3></div>' + (ST.seasons().length ? ST.seasons().map(function (s, i) { var club = s.t != null && s.t < 5000 ? UI.clubC(s.t) : esc(s.tn); return '<div class="mut sm" style="margin:.6rem 0 .2rem"><b style="color:var(--tx)">' + esc(s.s) + '</b> · ' + club + '</div>' + classTable(s.rows, 'cs_' + i); }).join('') : '<p class="mut">Aún sin partidos.</p>') + '</div><div class="card"><h3>Línea de tiempo');
    return html;
  };

  // ---------- MERCADO: reputación e interés ----------
  var oldMarket = SC.market;
  SC.market = function () {
    var S = FP.S, h = S.hero, tab = UI.tab.market || 'tryouts';
    FP.Rep.ensure();
    if (tab !== 'rep') {
      var html = oldMarket.call(this);
      return html.replace(/(<div class="seg">)([\s\S]*?)(<\/div>)/, function (m, a, b, c) { return a + b + '<button class="" data-act="tabset" data-s="market" data-t="rep">' + I('chart') + 'Reputación</button>' + c; });
    }
    var r = h.rep, win = FP.Market.isWindow(S.week);
    var head = hdr('transfer', 'Mercado de fichajes', '<span class="pill ' + (win ? 'g' : '') + '">' + (win ? esc(FP.Market.windowName(S.week)) + ' abierto' : 'Mercado cerrado') + '</span> · Tu valor: <b style="color:var(--tx)">' + money(FP.Market.heroValue()) + '</b>', seg('market', [['tryouts', 'Pruebas', 'whistle'], ['players', 'Jugadores', 'user'], ['recent', 'Fichajes', 'transfer'], ['free', 'Sin club', 'flag'], ['rep', 'Reputación', 'chart']], tab));
    function meter(label, v, tip) { return '<div class="mb" title="' + esc(tip) + '">' + label + '<b>' + pct(v) + '</b>' + bar(v, v >= 60 ? '' : v >= 30 ? 'warn' : 'bad') + '</div>'; }
    var html2 = head + '<div class="grid g21"><div class="card"><div class="hd"><h3>' + I('chart') + 'Tu reputación</h3></div><div class="mbars" style="grid-template-columns:1fr">' +
      meter('Local', r.loc, 'Cuánto te conocen en tu zona y en clubes cercanos') + meter('Nacional', r.nat, 'Visibilidad ante clubes y selecciones de tu país') + meter('Internacional', r.int, 'Interés de clubes extranjeros') + '</div>' +
      '<p class="mut sm" style="margin-top:.6rem">La reputación sube con minutos, rendimiento, goles, títulos y convocatorias, y baja si dejas de jugar. Un club solo puede ofrecerte contrato si te conoce: marcar 20 goles en un regional te abre puertas cercanas, no necesariamente las de un club europeo.</p></div>' +
      '<div class="card"><div class="hd"><h3>' + I('target') + 'Clubes que te siguen</h3></div>' +
      (h.int.length ? h.int.slice().sort(function (a, b) { return b.v - a.v; }).slice(0, 10).map(function (e) { var c = S.clubs[e.c]; return '<div class="hrow">' + UI.crest(c.id) + '<div class="grow ell"><b>' + esc(c.nm) + '</b><div class="mut sm">' + esc(FP.LGDEF[c.lg].n) + (e.why ? ' · ' + esc(e.why) : '') + '</div></div><div style="width:90px">' + bar(e.v, e.v >= 60 ? '' : 'warn') + '</div></div>'; }).join('') : '<p class="mut">Ningún club te sigue por ahora. Juega, rinde y deja que te vean.</p>') + '</div></div>';
    if (UI.valorCard) html2 += UI.valorCard();
    var cd = Object.keys(h.cd).filter(function (k) { return /^\d+$/.test(k) && h.cd[k] > S.week; });
    if (cd.length) html2 += '<div class="card"><div class="hd"><h3>' + I('lock') + 'Clubes que te descartaron</h3></div>' + cd.map(function (k) { return '<div class="hrow">' + UI.crest(+k) + '<b class="grow">' + esc(C.tname(+k)) + '</b><span class="mut sm">no podrás probarte hasta ' + D.fmt(h.cd[k]) + '</span></div>'; }).join('') + '</div>';
    return html2;
  };

  // ---------- CONTRATOS: negociación y cesión ----------
  A.negot = function (d) { var r = FP.Market.negotiate(+d.id, { wage: +(d.w || 0), years: +(d.y || 0) }); UI.toast(esc(r.msg), r.ok ? 'ok' : 'warn'); UI.render(); };
  A.reqloan = function () { var r = FP.Market.requestLoan(); UI.toast(esc(r.msg), r.ok ? 'ok' : 'warn'); UI.render(); };

  // ---------- MI CLUB: plantilla juvenil y posición entre compañeros ----------
  var oldClub = SC.club;
  SC.club = function () {
    var S = FP.S, h = S.hero, html = oldClub.call(this);
    if (h.tk !== 'academy' && h.tk !== 'amat') return html;
    var age = FP.Hero.age(), st = FP.Youth.heroStanding(), cat = FP.Youth.heroStatus().cat, tier = h.tk === 'amat' ? FP.Youth.tierOf(S.amat[h.team - 20000]) : null;
    var tr = h.ct == null ? 50 : h.ct;
    var mates = FP.Youth.catSquad(h.team, age).slice().sort(function (a, b) { return b.o - a.o; });
    var posOrd = { GK: 0, CB: 1, LB: 2, RB: 3, DM: 4, CM: 5, AM: 6, LW: 7, RW: 8, ST: 9 };
    var rows = mates.map(function (p) { return { p: p, nm: p.n, pos: p.p, po: posOrd[p.p], age: C.age(p), o: p.o, nat: p.nat, u: p.u }; });
    var card = '<div class="card"><div class="hd"><h3>' + I('user') + 'Mi puesto en la categoría ' + esc(cat) + (tier ? ' · ' + esc(FP.Youth.TIERS[tier].n) : '') + '</h3></div>' +
      (st ? '<div class="terms"><div><span>En tu posición</span><b>' + st.pos + 'º de ' + st.ofPos + '</b></div><div><span>En el plantel</span><b>' + st.squadRank + 'º de ' + st.squadN + '</b></div><div><span>Confianza del míster</span><b>' + Math.round(tr) + '</b></div><div><span>Edad / generación</span><b>' + age + ' años</b></div></div>' : '') +
      '<p class="mut sm" style="margin:.5rem 0">No juegas todos los partidos: el entrenador alinea a los mejores de cada puesto, y rinde más cuando confía en ti. Si pasas una temporada relegado, el club puede no renovarte.</p>' +
      UI.table('yq', [{ k: 'po', t: 'Pos', f: function (r) { return UI.posb(r.pos); } }, { k: 'nm', t: 'Jugador', f: function (r) { return esc(r.nm) + ' <span class="tag-gen">generado</span>'; } }, { k: 'age', t: 'Edad', n: 1 }, { k: 'o', t: 'Media', n: 1, f: function (r) { return UI.ovr(r.o); } }, { k: 'u', t: 'Estado', f: function (r) { return r.u > 0 ? '<span class="pill r">baja</span>' : ''; } }], rows, { sort: ['o', 'd'], max: 24 }) + '</div>';
    return html + card;
  };

})();
