/* FUTPRO — página de club estilo enciclopedia.
   Se redacta a demanda con lo que el juego ya registra: la historia de cada liga (S.lgs[].hist: tabla final, campeón, ascensos y descensos),
   los campeones de copas y torneos internacionales (S.hist.champs), los goleadores de cada temporada, los récords del módulo de legado,
   los derbis y los datos actuales del club. No guarda estado ni añade nada al guardado, y no toca el motor ni las clasificaciones.
   Solo cuenta lo registrado desde el inicio de la partida: el juego no tiene la historia real previa de los clubes. */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, C = FP.Core, X = FP.Bio.x, N = FP.Narr, CW = FP.ClubWiki = {};
  function y4(l) { return parseInt(String(l).slice(0, 4), 10) || 0; }
  function ord(n) { return n + '.º'; }
  var TIERN = { 1: 'la máxima categoría', 2: 'la segunda categoría', 3: 'la tercera categoría' };
  function tierName(t) { return TIERN[t] || 'una categoría inferior'; }
  function tierOrd(t) { return t + '.ª'; }
  function short(n) { return String(n || '').replace(/\s*\([^)]*\)\s*$/, ''); }

  // ---------- datos ----------
  // una fila por temporada completa en la que el club figura en la tabla final de alguna liga
  CW.seasons = function (id) {
    var S = FP.S, out = [];
    Object.keys(S.lgs).forEach(function (lgId) {
      var lg = S.lgs[lgId], def = FP.LGDEF[lgId]; if (!lg || !def) return;
      (lg.hist || []).forEach(function (e) {
        var i = e.tab ? e.tab.indexOf(id) : -1; if (i < 0) return;
        out.push({ y: y4(e.l), l: e.l, lg: lgId, def: def, pos: i + 1, n: e.tab.length, champ: e.ch === id, runner: e.ru === id, up: (e.up || []).indexOf(id) >= 0, dn: (e.dn || []).indexOf(id) >= 0, pts: i === 0 ? e.pts : null });
      });
    });
    out.sort(function (a, b) { return a.y - b.y; });
    // ascensos y descensos reales: se deducen de la categoría de la temporada siguiente (el juego marca plazas, pero no siempre se llenan)
    var cur = S.clubs[id];
    out.forEach(function (s, i) {
      var nx = out[i + 1], tier = null;
      if (nx && nx.y - s.y === 1 && nx.def.c === s.def.c) tier = nx.def.t; else if (!nx && cur && cur.c === s.def.c && cur.lg !== s.lg && FP.LGDEF[cur.lg]) tier = FP.LGDEF[cur.lg].t;
      s.up = tier != null && tier < s.def.t; s.dn = tier != null && tier > s.def.t;
    });
    return out;
  };
  CW.current = function (id) {
    var S = FP.S, c = S.clubs[id], lg = c && S.lgs[c.lg], comp = lg && S.comps[lg.cmp]; if (!comp || comp.lgDone || comp.done) return null;
    var rows = FP.Comp.rows(comp), r = rows.filter(function (x) { return x.id === id; })[0]; if (!r) return null;
    return { pos: r.pos, n: rows.length, p: r.p, pts: r.pts, label: comp.label, def: FP.LGDEF[c.lg] };
  };
  CW.titles = function (id) {
    var S = FP.S, out = { league: {}, cup: {}, cont: {}, runner: [] };
    CW.seasons(id).forEach(function (s) { if (s.champ) (out.league[s.def.n] = out.league[s.def.n] || []).push(s.l); if (s.runner) out.runner.push({ nm: s.def.n, y: s.l }); });
    (S.hist.champs || []).forEach(function (h) {
      if (h.k === 'cup' && h.ch === id) { var n = String(h.nm || '').replace(/\s*\d{4}(\/\d{2})?$/, ''); (out.cup[n] = out.cup[n] || []).push(h.y); }
      else if (h.k === 'cup' && h.ru === id) out.runner.push({ nm: String(h.nm || '').replace(/\s*\d{4}(\/\d{2})?$/, ''), y: h.y });
      else if (h.k === 'cont' && h.ch === id) { var d = FP.Cont && FP.Cont.DEF[h.key], nn = d ? d.nm : h.key; (out.cont[nn] = out.cont[nn] || []).push(h.y); }
      else if (h.k === 'cont' && h.ru === id) { var d2 = FP.Cont && FP.Cont.DEF[h.key]; out.runner.push({ nm: d2 ? d2.nm : h.key, y: h.y }); }
    });
    return out;
  };
  // etapas seguidas en una misma liga
  CW.eras = function (seasons) {
    var eras = [];
    seasons.forEach(function (s) {
      var e = eras[eras.length - 1];
      if (e && e.lg === s.lg && s.y - e.last.y <= 1) { e.seasons.push(s); e.last = s; }
      else eras.push({ lg: s.lg, def: s.def, seasons: [s], first: s, last: s });
    });
    eras.forEach(function (e) { e.n = e.seasons.length; e.best = e.seasons.reduce(function (b, s) { return !b || s.pos < b.pos ? s : b; }, null); e.worst = e.seasons.reduce(function (b, s) { return !b || s.pos > b.pos ? s : b; }, null); e.champs = e.seasons.filter(function (s) { return s.champ; }); });
    return eras;
  };
  // goleadores de liga de ese club por temporada (los tres máximos de cada liga que quedan registrados)
  CW.scorers = function (id) {
    var S = FP.S, out = [];
    Object.keys(S.lgs).forEach(function (lgId) { (S.lgs[lgId].hist || []).forEach(function (e) { (e.sc || []).forEach(function (r, i) { if (r[2] === id) out.push({ n: r[0], g: r[1], pos: i + 1, l: e.l, lg: FP.LGDEF[lgId] }); }); }); });
    out.sort(function (a, b) { return y4(a.l) - y4(b.l) || a.pos - b.pos; });
    return out;
  };
  CW.rivals = function (id) { var D = FP.Derbis, S = FP.S; if (!D || !D.is) return []; return S.clubs.filter(function (c) { return c.id !== id && D.is(id, c.id); }); };

  // ---------- redacción ----------
  CW.build = function (id) {
    var S = FP.S, c = S.clubs[id]; if (!c) return null;
    var T = N.text, V = T.V, cap = T.cap, join = T.join, span = T.span, plural = T.plural, list = T.list; T.seed('club|' + c.nm + '|' + c.c);
    var def = FP.LGDEF[c.lg], seasons = CW.seasons(id), cur = CW.current(id), ti = CW.titles(id), eras = CW.eras(seasons), riv = CW.rivals(id), esc = U.esc, nm = esc(c.nm);
    var teams = S.lgs[c.lg].teams.map(function (i) { return S.clubs[i]; }), rank = teams.filter(function (x) { return x.st > c.st; }).length + 1;
    var y0 = seasons.length ? seasons[0].y : null, y1 = seasons.length ? seasons[seasons.length - 1].y : null;
    var nTitles = Object.keys(ti.league).reduce(function (a, k) { return a + ti.league[k].length; }, 0), top1 = ti.league[def.n] ? ti.league[def.n].length : 0;
    var nCup = Object.keys(ti.cup).reduce(function (a, k) { return a + ti.cup[k].length; }, 0), nCont = Object.keys(ti.cont).reduce(function (a, k) { return a + ti.cont[k].length; }, 0);
    var ups = seasons.filter(function (s) { return s.up; }).length, dns = seasons.filter(function (s) { return s.dn; }).length;
    var bestAll = seasons.reduce(function (b, s) { return !b || s.def.t < b.def.t || (s.def.t === b.def.t && s.pos < b.pos) ? s : b; }, null);

    // ficha
    var fin = c.fin >= 9 ? 'muy sólida' : c.fin >= 7 ? 'sólida' : c.fin >= 4 ? 'estable' : 'modesta', cant = c.ac >= 4 ? 'muy buena' : c.ac >= 3 ? 'buena' : c.ac >= 2 ? 'aceptable' : 'limitada';
    var box = [['País', C.cname(c.c)], ['Liga', short(def.n) + ' (' + tierOrd(def.t) + ' división)'], ['Nivel de plantel', c.st ? String(Math.round(c.st)) + ' (' + ord(rank) + ' de ' + teams.length + ' en su liga)' : '—'], ['Situación económica', fin], ['Cantera', cant], ['Entrenador', c.co || '—'], ['Sistema', c.fm || '—']];
    if (y0) box.push(['Temporadas registradas', String(seasons.length)]);

    // introducción
    var lead = '<b>' + nm + '</b> es un club de fútbol de ' + esc(C.cname(c.c)) + ' que compite en ' + esc(short(def.n)) + ', ' + tierName(def.t) + ' del país.';
    if (seasons.length) {
      var bits = [];
      if (nTitles) bits.push(plural(nTitles, 'campeonato de liga', 'campeonatos de liga'));
      if (nCup) bits.push(plural(nCup, 'copa nacional', 'copas nacionales'));
      if (nCont) bits.push(plural(nCont, 'título internacional', 'títulos internacionales'));
      var tail = bits.length ? V('cl.lead.b', [function () { return ' Desde ' + y0 + ', el inicio del registro de la partida, ha ganado ' + list(bits) + '.'; }, function () { return ' En las ' + plural(seasons.length, 'temporada registrada', 'temporadas registradas') + ' (' + span(y0, y1) + ') suma ' + list(bits) + '.'; }]) : ' En las ' + plural(seasons.length, 'temporada registrada', 'temporadas registradas') + ' (' + span(y0, y1) + ') no ha conquistado títulos.';
      lead += tail;
      var mv = []; if (ups) mv.push(plural(ups, 'ascenso', 'ascensos')); if (dns) mv.push(plural(dns, 'descenso', 'descensos'));
      if (mv.length) lead += ' En ese período registra ' + list(mv) + '.';
      if (bestAll && !nTitles) lead += ' Su mejor posición fue ' + ord(bestAll.pos) + ' en ' + esc(short(bestAll.def.n)) + ' (' + bestAll.l + ').';
    } else lead += ' Todavía no hay temporadas completas registradas.';
    if (cur) lead += ' En la temporada ' + cur.label + ' va ' + ord(cur.pos) + ' tras ' + plural(cur.p, 'jornada', 'jornadas') + '.';

    var secs = [];
    // historia
    if (eras.length) {
      var hp = [];
      eras.forEach(function (e, i) {
        var prev = eras[i - 1], from = e.first.l, to = e.last.l, n = e.n, lgn = esc(short(e.def.n)), s = [];
        var open = i === 0 ? V('cl.h.first', [function () { return 'El registro de la partida comienza con ' + nm + ' en ' + lgn + ' (' + tierOrd(e.def.t) + ' división)' + (n > 1 ? ', donde juega ' + plural(n, 'temporada', 'temporadas') + ' seguidas (' + span(y4(from), y4(to)) + ')' : ' en la temporada ' + from) + '.'; }, function () { return 'En la temporada ' + from + ' ' + nm + ' compite en ' + lgn + (n > 1 ? ' y permanece en esa categoría hasta ' + to : '') + '.'; }], 'e' + i)
          : (prev.last.dn ? V('cl.h.down', [function () { return 'Tras descender, ' + nm + ' compite en ' + lgn + ' ' + (n > 1 ? 'entre ' + from + ' y ' + to : 'en ' + from) + '.'; }, function () { return 'Desde la temporada ' + from + ' juega en ' + lgn + (n > 1 ? ' durante ' + plural(n, 'temporada', 'temporadas') : '') + ' después de perder la categoría.'; }], 'e' + i)
            : V('cl.h.up', [function () { return 'El ascenso lo lleva a ' + lgn + ', donde juega ' + (n > 1 ? plural(n, 'temporada', 'temporadas') + ' (' + span(y4(from), y4(to)) + ')' : 'la temporada ' + from) + '.'; }, function () { return cap(nm) + ' llega a ' + lgn + ' en ' + from + (n > 1 ? ' y se mantiene hasta ' + to : '') + '.'; }], 'e' + i));
        s.push(open);
        if (n >= 2 || e.best.pos <= 3) {
          var bp = e.best.pos === 1 ? 'campeón en ' + e.best.l : 'su mejor puesto fue ' + ord(e.best.pos) + ' (' + e.best.l + ')';
          s.push(n >= 3 ? 'En esa etapa ' + bp + (e.worst.pos !== e.best.pos ? ' y el peor, ' + ord(e.worst.pos) + ' (' + e.worst.l + ')' : '') + '.' : cap(bp) + '.');
        }
        if (e.champs.length) s.push(e.champs.length === 1 ? 'Ganó el campeonato de ' + lgn + ' en ' + e.champs[0].l + '.' : 'Ganó ' + plural(e.champs.length, 'campeonato', 'campeonatos') + ' de ' + lgn + ' (' + list(e.champs.map(function (x) { return x.l; })) + ').');
        if (e.last.dn) s.push('Descendió al terminar la temporada ' + e.last.l + ' (' + ord(e.last.pos) + ' de ' + e.last.n + ').');
        else if (e.last.up) s.push('Ascendió al terminar la temporada ' + e.last.l + '.');
        hp.push(join(s));
      });
      secs.push({ id: 'historia', t: 'Historia registrada', p: hp });
    }
    // palmarés
    var pal = [];
    Object.keys(ti.league).forEach(function (k) { pal.push({ k: 'Liga', nm: short(k), y: ti.league[k] }); });
    Object.keys(ti.cup).forEach(function (k) { pal.push({ k: 'Copa nacional', nm: k, y: ti.cup[k] }); });
    Object.keys(ti.cont).forEach(function (k) { pal.push({ k: 'Internacional', nm: k, y: ti.cont[k] }); });
    if (pal.length || ti.runner.length) secs.push({ id: 'palmares', t: 'Palmarés (desde el inicio del registro)', pal: pal, runner: ti.runner });
    // rivalidades
    if (riv.length) secs.push({ id: 'rivales', t: 'Rivalidades', p: [V('cl.riv', [function () { return 'Mantiene ' + (riv.length > 1 ? 'derbis con ' : 'un derbi con ') + list(riv.map(function (r) { return esc(r.nm) + (r.lg === c.lg ? '' : ' (' + esc(short(FP.LGDEF[r.lg].n)) + ')'); })) + '.'; }, function () { return 'Su ' + (riv.length > 1 ? 'principales rivales son ' : 'principal rival es ') + list(riv.map(function (r) { return esc(r.nm); })) + '.'; }])] });
    // jugadores destacados
    var sc = CW.scorers(id), Id = FP.Idolo, top = Id && Id.top ? Id.top(id, 8) : [];
    var pp = []; if (sc.length) { var bestSc = sc.filter(function (x) { return x.pos === 1; }); if (bestSc.length) pp.push('Sus jugadores han sido máximo goleador de la liga ' + (bestSc.length === 1 ? 'una vez' : bestSc.length + ' veces') + ': ' + list(bestSc.slice(-4).map(function (x) { return esc(x.n) + ' (' + plural(x.g, 'gol', 'goles') + ', ' + x.l + ')'; })) + '.'); }
    if (top.length || pp.length) secs.push({ id: 'jugadores', t: 'Jugadores destacados', p: pp, top: top });
    // tu relación
    var h = S.hero, hc = h.ido && h.ido.clubs && h.ido.clubs[id];
    if (hc && hc.ap > 0 && Id) { var st = Id.status(id); secs.push({ id: 'tu', t: 'Tu paso por el club', p: ['Disputaste ' + plural(hc.ap, 'partido', 'partidos') + ' y marcaste ' + plural(hc.g, 'gol', 'goles') + (hc.a ? ', con ' + plural(hc.a, 'asistencia', 'asistencias') : '') + '. ' + (st.pts >= 20 ? 'El juego te asigna el estatus de ' + esc(T.lcf(st.label)) + ' (' + st.pts + '/100).' : 'Todavía no tienes estatus en el club.') + (hc.left == null && h.club === id ? ' Sigues en el club.' : '')] }); }
    // temporadas
    if (seasons.length || cur) secs.push({ id: 'temporadas', t: 'Temporadas', seasons: seasons, cur: cur });
    // estado actual
    var sp = [];
    sp.push(V('cl.now', [function () { return 'El nivel de su plantel (' + Math.round(c.st) + ') es el ' + ord(rank) + ' de los ' + teams.length + ' equipos de su liga.'; }, function () { return 'Por nivel de plantel (' + Math.round(c.st) + ') ocupa el puesto ' + rank + ' de ' + teams.length + ' en su liga.'; }]) + ' Su situación económica es ' + fin + ' y su cantera, ' + cant + '.');
    if (c.co) sp.push('Lo dirige ' + esc(c.co) + ', con un sistema ' + esc(c.fm || '') + '.');
    secs.push({ id: 'actual', t: 'Situación actual', p: sp });
    return { id: id, name: c.nm, lead: lead, box: box, secs: secs, seasons: seasons, titles: ti };
  };
})();
