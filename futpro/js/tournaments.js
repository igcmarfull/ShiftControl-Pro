/* FUTPRO — torneos continentales de clubes y competiciones de selecciones */
(function () {
  'use strict';
  var FP = window.FP, U = FP.U, R = U.R, C = FP.Core, D = FP.Date, Comp = FP.Comp, Sim = FP.Sim;

  var Cont = FP.Cont = {};
  var Nat = FP.Nat = {};

  // =====================================================================
  //  CLUBES: definiciones
  // =====================================================================
  // semanas relativas al inicio de ventana: 'euro' = 9-ago ; 'year' = 14-feb
  var DEF = {
    UCL: { nm: 'UEFA Champions League', conf: 'UEFA', cal: 'euro', fmt: 'swiss', qk: 'CL', n: 36, pots: 4, md: [5, 7, 10, 12, 15, 17, 24, 25], po: [27, 28], ko: [[31, 32], [35, 36], [38, 39], 41] },
    UEL: { nm: 'UEFA Europa League', conf: 'UEFA', cal: 'euro', fmt: 'swiss', qk: 'EL', n: 36, pots: 4, md: [5, 7, 10, 12, 15, 17, 24, 25], po: [27, 28], ko: [[31, 32], [35, 36], [38, 39], 40] },
    UECL: { nm: 'UEFA Conference League', conf: 'UEFA', cal: 'euro', fmt: 'swiss', qk: 'ECL', n: 36, pots: 6, md: [6, 9, 12, 14, 17, 19], po: [27, 28], ko: [[31, 32], [35, 36], [38, 39], 40] },
    LIB: { nm: 'Copa Libertadores', conf: 'CONMEBOL', cal: 'year', fmt: 'groups', qk: 'LIB', n: 32, groups: 8, md: [7, 9, 11, 13, 15, 17], ko: [[26, 27], [30, 31], [34, 35], 39] },
    SUD: { nm: 'Copa Sudamericana', conf: 'CONMEBOL', cal: 'year', fmt: 'groups', qk: 'SUD', n: 32, groups: 8, md: [7, 9, 11, 13, 15, 17], po: [22, 23], ko: [[27, 28], [31, 32], [35, 36], 38] },
    CCC: { nm: 'Copa de Campeones de la CONCACAF', conf: 'CONCACAF', cal: 'year', fmt: 'ko', qk: 'CCC', n: 16, ko: [[2, 3], [6, 7], [10, 11], [14, 15], 17] },
    ACL: { nm: 'AFC Champions League', conf: 'AFC', cal: 'euro', fmt: 'groups', qk: 'ACL', n: 16, groups: 4, md: [6, 8, 11, 13, 16, 18], ko: [33, 36, 38] },
    CAF: { nm: 'Liga de Campeones de la CAF', conf: 'CAF', cal: 'euro', fmt: 'groups', qk: 'CAF', n: 16, groups: 4, md: [14, 16, 18, 20, 22, 24], ko: [[30, 31], [34, 35], 40] }
  };
  Cont.DEF = DEF;
  var CWC = { nm: 'Mundial de Clubes' };

  function stOrder(ids) { return ids.slice().sort(function (a, b) { return FP.S.clubs[b].st - FP.S.clubs[a].st; }); }
  function leagueOrder(l, initial) {
    var S = FP.S, lg = S.lgs[l.id], h = lg.hist;
    if (initial || !h.length) return stOrder(lg.teams);
    var e = h[h.length - 1];
    var order = [e.ch].concat(e.tab.filter(function (x) { return x !== e.ch; }));
    return order.filter(function (id) { return S.clubs[id]; });
  }
  Cont.entrants = function (key, initial) {
    var S = FP.S, def = DEF[key], sel = [], seq = def.conf === 'UEFA' ? ['CL', 'EL', 'ECL'] : def.conf === 'CONMEBOL' ? ['LIB', 'SUD'] : [def.qk];
    FP.DATA.leagues.forEach(function (l) {
      if (l.t !== 1 || !l.qual) return;
      var order = leagueOrder(l, initial), idx = 0;
      seq.forEach(function (qk) {
        var n = l.qual[qk] || 0;
        if (qk === def.qk) sel = sel.concat(order.slice(idx, idx + n));
        idx += n;
      });
      if (key === 'UEL') { // campeón de copa nacional -> Europa League
        var cups = S.hist.champs.filter(function (x) { return x.k === 'cup' && x.cc === l.c; });
        var cw = cups.length ? cups[cups.length - 1].ch : null;
        if (cw != null && sel.indexOf(cw) < 0 && S.clubs[cw] && S.clubs[cw].c === l.c) {
          var cl = order.slice(0, l.qual.CL || 0);
          if (cl.indexOf(cw) < 0) {
            var mine = sel.filter(function (id) { return S.clubs[id].c === l.c; });
            if (mine.length) sel.splice(sel.indexOf(mine[mine.length - 1]), 1, cw);
          }
        }
      }
    });
    // completar o recortar hasta el tamaño exacto
    sel = sel.filter(function (id, i) { return sel.indexOf(id) === i; });
    if (sel.length > def.n) sel = stOrder(sel).slice(0, def.n);
    if (sel.length < def.n) {
      var rest = stOrder(S.clubs.filter(function (c) { return FP.DATA.countries[c.c].conf === def.conf && FP.LGDEF[c.lg].t === 1 && sel.indexOf(c.id) < 0; }).map(function (c) { return c.id; }));
      while (sel.length < def.n && rest.length) sel.push(rest.shift());
    }
    return sel;
  };

  function potsOf(teams, nPots) {
    var ord = stOrder(teams), size = Math.ceil(ord.length / nPots), pots = [];
    for (var i = 0; i < nPots; i++) pots.push(ord.slice(i * size, (i + 1) * size));
    return pots;
  }
  function greedyRounds(pairs) {
    var best = null;
    for (var t = 0; t < 60; t++) {
      var left = U.shuffle(pairs.slice()), rounds = [];
      while (left.length) {
        var used = {}, rd = [], rest = [];
        left.forEach(function (p) { if (!used[p[0]] && !used[p[1]]) { used[p[0]] = used[p[1]] = 1; rd.push(p); } else rest.push(p); });
        rounds.push(rd); left = rest;
      }
      if (!best || rounds.length < best.length) best = rounds;
      if (best.length <= Math.ceil(pairs.length * 2 / (pairs.length ? Object.keys(pairs.reduce(function (o, p) { o[p[0]] = o[p[1]] = 1; return o; }, {})).length : 1))) break;
    }
    return best;
  }
  function weekForRound(arr, r) { return r < arr.length ? arr[r] : arr[arr.length - 1] + (r - arr.length + 1); }

  Cont.create = function (key, y, initial) {
    var S = FP.S, def = DEF[key], wn = Comp.window(def.cal, y), s0 = wn.s;
    var teams = Cont.entrants(key, initial);
    var id = 'X:' + key + ':' + y;
    var comp = Comp.create({ id: id, kind: 'X', nm: def.nm, y: y, teams: teams, c: null, cont: key });
    comp.spec = key; comp.label = def.cal === 'euro' ? y + '/' + String(y + 1).slice(2) : String(y); comp.cal = def.cal;
    comp.st = 0; comp.stage = 'lp'; comp.s0 = s0;
    var mdW = (def.md || []).map(function (o) { return s0 + o; });
    if (def.fmt === 'swiss') {
      var pots = potsOf(teams, def.pots), pairs = [];
      var P = pots.length;
      if (def.pots === 4) {
        for (var a = 0; a < P; a++) for (var b = a; b < P; b++) {
          var A = pots[a], B = pots[b], nA = A.length;
          for (var i = 0; i < nA; i++) {
            if (a === b) pairs.push([A[i], A[(i + 1) % nA]]);
            else { pairs.push([A[i], B[i % B.length]]); pairs.push([B[i % B.length], A[(i + 1) % nA]]); }
          }
        }
      } else { // 6 bombos, un rival de cada bombo
        for (var a2 = 0; a2 < P; a2++) for (var b2 = a2; b2 < P; b2++) {
          var A2 = pots[a2], B2 = pots[b2], n2 = A2.length;
          if (a2 === b2) { for (var j = 0; j < n2 / 2; j++) pairs.push((j + a2) % 2 ? [A2[j], A2[j + n2 / 2]] : [A2[j + n2 / 2], A2[j]]); }
          else for (var k = 0; k < n2; k++) { var o = B2[(k + a2 + b2) % B2.length]; pairs.push((k + a2 + b2) % 2 === 0 ? [A2[k], o] : [o, A2[k]]); }
        }
      }
      var rounds = greedyRounds(pairs);
      Comp.resetTable(comp);
      rounds.forEach(function (rd, r) { rd.forEach(function (m) { Comp.addFx(comp, m[0], m[1], weekForRound(mdW, r), { r: r + 1 }); }); });
      comp.pots = pots;
    } else if (def.fmt === 'groups') {
      var ng = def.groups, gp = potsOf(teams, 4), groups = [];
      for (var g = 0; g < ng; g++) groups.push([]);
      gp.forEach(function (pot) { var sh = U.shuffle(pot.slice()); sh.forEach(function (t, gi) { groups[gi % ng].push(t); }); });
      comp.groups = groups; Comp.resetTable(comp);
      groups.forEach(function (gr, gi) {
        Comp.roundRobin(gr, true).forEach(function (rd, r) { rd.forEach(function (m) { Comp.addFx(comp, m[0], m[1], weekForRound(mdW, r), { r: r + 1, g: gi }); }); });
      });
    } else if (def.fmt === 'ko') {
      comp.stage = 'ko';
      var wk = def.ko.map(function (x) { return Array.isArray(x) ? [s0 + x[0], s0 + x[1]] : s0 + x; });
      Comp.koInit(comp, stOrder(teams), { legs: 2, finalLegs: 1, weeks: wk, neutralFinal: true });
    }
    comp.fx.sort(function (a, b) { return a.w - b.w || (a.r || 0) - (b.r || 0); });
    comp.w0 = comp.fx.length ? comp.fx[0].w : s0; comp.w1 = s0 + 42;
    return comp;
  };

  function allDone(comp) { return !Comp.pendingLeft(comp); }
  function koWeeks(def, s0, from) { return def.ko.slice(from || 0).map(function (x) { return Array.isArray(x) ? [s0 + x[0], s0 + x[1]] : s0 + x; }); }
  function groupRows(comp, gi) { return Comp.rows(comp, comp.groups[gi]); }
  function startKO(comp, slots, weeks, legs, finalLegs, oneRound, neutralFinal) {
    comp.st++;
    Comp.koInit(comp, [], { slots: slots, legs: legs, finalLegs: finalLegs, weeks: weeks, oneRound: oneRound, neutralFinal: neutralFinal !== false });
  }

  Cont.advance = function (comp, w) {
    var S = FP.S, def = DEF[comp.spec]; if (!def || comp.done) return;
    var s0 = comp.s0;
    if (comp.stage === 'lp') {
      if (!allDone(comp)) return;
      if (def.fmt === 'swiss') {
        var rows = Comp.rows(comp), ids = rows.map(function (r) { return r.id; });
        comp.lpOrder = ids;
        var po = ids.slice(8, 24);
        comp.stage = 'po'; comp.st++;
        Comp.koInit(comp, po, { legs: 2, finalLegs: 2, weeks: [[s0 + def.po[0], s0 + def.po[1]]], oneRound: true });
      } else if (def.fmt === 'groups') {
        comp.gr = comp.groups.map(function (g, gi) { return groupRows(comp, gi).map(function (r) { return r.id; }); });
        var G = comp.gr, W = koWeeks(def, s0);
        if (comp.spec === 'LIB') {
          var slots = [];
          [[0, 1], [2, 3], [4, 5], [6, 7]].forEach(function (p) { slots.push(G[p[0]][0], G[p[1]][1]); });
          [[1, 0], [3, 2], [5, 4], [7, 6]].forEach(function (p) { slots.push(G[p[0]][0], G[p[1]][1]); });
          comp.stage = 'ko'; startKO(comp, slots, W, 2, 1, false);
        } else if (comp.spec === 'SUD') {
          comp.stage = 'wait';
        } else if (comp.spec === 'ACL' || comp.spec === 'CAF') {
          var sl = [G[0][0], G[1][1], G[2][0], G[3][1], G[1][0], G[0][1], G[3][0], G[2][1]];
          comp.stage = 'ko';
          if (comp.spec === 'ACL') startKO(comp, sl, W, 1, 1, false);
          else startKO(comp, sl, W, 2, 1, false);
        }
      }
      return;
    }
    if (comp.stage === 'wait') { // Sudamericana espera los terceros de la Libertadores
      var lib = S.comps['X:LIB:' + comp.y];
      if (!lib || !lib.gr) return;
      var th = lib.gr.map(function (g) { return g[2]; });
      var ru = comp.gr.map(function (g) { return g[1]; });
      var pairs = []; for (var i = 0; i < 8; i++) pairs.push(ru[i], th[i]);
      comp.stage = 'po'; comp.thirds = th;
      comp.st++;
      Comp.koInit(comp, [], { slots: pairs, legs: 2, finalLegs: 2, weeks: [[s0 + def.po[0], s0 + def.po[1]]], oneRound: true });
      return;
    }
    if (comp.stage === 'po') {
      var r = Comp.koAdvance(comp, w);
      if (r !== 'end') return;
      var winners = comp.ko.winners;
      if (def.fmt === 'swiss') {
        var seeds = comp.lpOrder.slice(0, 8), ord = Comp.bracketOrder(8), slots2 = [];
        ord.forEach(function (s) { slots2.push(seeds[s - 1], winners[8 - s]); });
        comp.stage = 'ko'; startKO(comp, slots2, koWeeks(def, s0), 2, 1, false);
      } else { // Sudamericana
        var G2 = comp.gr, slots3 = [];
        [[0, 1], [2, 3], [4, 5], [6, 7], [1, 0], [3, 2], [5, 4], [7, 6]].forEach(function (p) { slots3.push(G2[p[0]][0], winners[p[1]]); });
        comp.stage = 'ko'; startKO(comp, slots3, koWeeks(def, s0), 2, 1, false);
      }
      return;
    }
    if (comp.stage === 'ko') {
      var r2 = Comp.koAdvance(comp, w);
      if (r2 === 'end') Cont.finish(comp);
    }
  };
  Cont.finish = function (comp) {
    var S = FP.S, def = DEF[comp.spec] || CWC;
    comp.done = true;
    S.hist.champs.push({ k: 'cont', key: comp.spec, y: comp.label, ch: comp.champ, ru: comp.runner });
    Sim.news(C.tname(comp.champ) + ' conquista la ' + def.nm + ' ' + comp.label + ' al vencer a ' + C.tname(comp.runner) + '.', 'title', 3);
    var h = S.hero;
    if (h && !h.retired && h.club != null && (h.tk === 'pro' || h.tk === 'loan') && h.team === comp.champ) {
      h.trophies.push({ y: comp.label, nm: 'Campeón · ' + def.nm, club: C.tname(comp.champ), w: S.week });
      FP.Hero.msg('¡Campeón de la ' + def.nm + ' con ' + C.tname(comp.champ) + '!', 'ok'); h.mor = U.clamp(h.mor + 15, 0, 100);
    }
    if (comp.spec === 'CWC' || comp.cwc) return;
  };
  Sim.handlers.X = function (comp, w) {
    if (comp.spec === 'CWC') return Cont.advanceCWC(comp, w);
    if (comp.spec in DEF) return Cont.advance(comp, w);
    return Nat.advance(comp, w);
  };

  // ----- Mundial de Clubes (cada 4 años desde 2029) -----
  Cont.cwcYear = function (y) { return y >= 2029 && (y - 2029) % 4 === 0; };
  Cont.createCWC = function (y) {
    var S = FP.S, quotas = { UEFA: 12, CONMEBOL: 6, AFC: 4, CAF: 4, CONCACAF: 4 };
    var keys = { UEFA: 'UCL', CONMEBOL: 'LIB', AFC: 'ACL', CAF: 'CAF', CONCACAF: 'CCC' };
    var teams = [];
    Object.keys(quotas).forEach(function (cf) {
      var champs = S.hist.champs.filter(function (x) { return x.k === 'cont' && x.key === keys[cf] && parseInt(x.y, 10) >= y - 4; }).map(function (x) { return x.ch; });
      var sel = []; champs.forEach(function (id) { if (sel.indexOf(id) < 0) sel.push(id); });
      var perCountry = {}; sel.forEach(function (id) { var c = S.clubs[id].c; perCountry[c] = (perCountry[c] || 0) + 1; });
      var pool = stOrder(S.clubs.filter(function (c) { return FP.DATA.countries[c.c].conf === cf && FP.LGDEF[c.lg].t === 1 && sel.indexOf(c.id) < 0; }).map(function (c) { return c.id; }));
      while (sel.length < quotas[cf] && pool.length) { var id = pool.shift(), cc = S.clubs[id].c; if ((perCountry[cc] || 0) >= 2) continue; perCountry[cc] = (perCountry[cc] || 0) + 1; sel.push(id); }
      teams = teams.concat(sel.slice(0, quotas[cf]));
    });
    // comodines hasta 32
    var extra = stOrder(S.clubs.filter(function (c) { return teams.indexOf(c.id) < 0 && FP.LGDEF[c.lg].t === 1 && (c.c === 'BRA' || c.c === 'ENG' || c.c === 'ESP' || c.c === 'ARG'); }).map(function (c) { return c.id; }));
    while (teams.length < 32 && extra.length) teams.push(extra.shift());
    var comp = Comp.create({ id: 'X:CWC:' + y, kind: 'X', nm: CWC.nm, y: y, teams: teams, c: null, cont: 'CWC' });
    comp.spec = 'CWC'; comp.label = String(y); comp.stage = 'lp'; comp.st = 0;
    var s0 = D.of(y, 5, 14);
    var gp = potsOf(teams, 4), groups = []; for (var g = 0; g < 8; g++) groups.push([]);
    gp.forEach(function (pot) { U.shuffle(pot.slice()).forEach(function (t, gi) { groups[gi % 8].push(t); }); });
    comp.groups = groups; Comp.resetTable(comp); comp.s0 = s0;
    groups.forEach(function (gr, gi) { Comp.roundRobin(gr, false).forEach(function (rd, r) { rd.forEach(function (m) { Comp.addFx(comp, m[0], m[1], s0 + r, { r: r + 1, g: gi, n: 1 }); }); }); });
    comp.fx.sort(function (a, b) { return a.w - b.w; });
    comp.w0 = s0; comp.w1 = s0 + 7;
    Sim.news('Comienza el ' + CWC.nm + ' ' + y + ' con 32 clubes.', 'title', 2);
    return comp;
  };
  Cont.advanceCWC = function (comp, w) {
    var s0 = comp.s0;
    if (comp.stage === 'lp') {
      if (!allDone(comp)) return;
      comp.gr = comp.groups.map(function (g, gi) { return groupRows(comp, gi).map(function (r) { return r.id; }); });
      var G = comp.gr, slots = [];
      [[0, 1], [2, 3], [4, 5], [6, 7]].forEach(function (p) { slots.push(G[p[0]][0], G[p[1]][1]); });
      [[1, 0], [3, 2], [5, 4], [7, 6]].forEach(function (p) { slots.push(G[p[0]][0], G[p[1]][1]); });
      comp.stage = 'ko'; startKO(comp, slots, [s0 + 3, s0 + 4, s0 + 5, s0 + 6], 1, 1, false);
    } else if (comp.stage === 'ko') {
      if (Comp.koAdvance(comp, w) === 'end') Cont.finish(comp);
    }
  };

  // =====================================================================
  //  SELECCIONES
  // =====================================================================
  Nat.WCS = [2026, 2030, 2034, 2038, 2042, 2046, 2050, 2054];
  Nat.byCode = function (code) { return FP.S.nat.filter(function (n) { return n.c === code; })[0]; };
  Nat.windows = function (y) { return [D.of(y, 2, 24), D.of(y, 5, 2), D.of(y, 8, 7), D.of(y, 9, 12), D.of(y, 10, 16)]; };
  Nat.TOURN = {
    WC: { nm: 'Copa del Mundo', size: 48, groups: 12, thirds: 8, start: [5, 8], conf: null },
    EURO: { nm: 'Eurocopa', size: 24, groups: 6, thirds: 4, start: [5, 10], conf: 'UEFA' },
    COPA: { nm: 'Copa América', size: 16, groups: 4, thirds: 0, start: [5, 10], conf: 'CONMEBOL' },
    AFCON: { nm: 'Copa Africana de Naciones', size: 12, groups: 3, thirds: 2, start: [5, 15], conf: 'CAF' },
    ASIA: { nm: 'Copa Asiática', size: 8, groups: 2, thirds: 0, start: [5, 15], conf: 'AFC' },
    GOLD: { nm: 'Copa Oro CONCACAF', size: 8, groups: 2, thirds: 0, start: [5, 15], conf: 'CONCACAF' }
  };
  function natRank(list) { return list.slice().sort(function (a, b) { return b.r - a.r; }); }
  // selecciona participantes (estimación por rating): usado cuando no hay clasificatorias simuladas
  Nat.pickByRating = function (conf, n, exclude) {
    var S = FP.S;
    var pool = S.nat.filter(function (x) { return (!conf || x.conf === conf) && !(exclude && exclude[x.id]); });
    return pool.map(function (x) { return { x: x, v: x.r + U.norm() * 3 }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, n).map(function (o) { return o.x.id; });
  };
  Nat.qualifiedWC = function (y) {
    var S = FP.S, q = S.natq && S.natq[y];
    var hosts = { 2026: ['USA', 'MEX', 'CAN'], 2030: ['ESP', 'POR', 'MAR', 'ARG', 'URU', 'PAR'], 2034: ['KSA'] }[y] || [];
    var teams = [], used = {};
    hosts.forEach(function (c) { var n = Nat.byCode(c); if (n && !used[n.id]) { teams.push(n.id); used[n.id] = 1; } });
    var slots = { UEFA: 16, CAF: 9, AFC: 8, CONMEBOL: 6, CONCACAF: 6, OFC: 1 };
    Object.keys(slots).forEach(function (cf) {
      var have = teams.filter(function (id) { return S.nat[id - 5000].conf === cf; }).length;
      var want = slots[cf] - have, from = (q && q[cf]) ? q[cf].filter(function (id) { return !used[id]; }) : Nat.pickByRating(cf, want + 6, used).filter(function (id) { return !used[id]; });
      from.slice(0, Math.max(0, want)).forEach(function (id) { teams.push(id); used[id] = 1; });
    });
    var rest = Nat.pickByRating(null, 60, used);
    while (teams.length < 48 && rest.length) { var id = rest.shift(); teams.push(id); used[id] = 1; }
    return teams;
  };

  Nat.createTournament = function (key, y) {
    var S = FP.S, T = Nat.TOURN[key], teams;
    if (key === 'WC') teams = Nat.qualifiedWC(y);
    else if (key === 'COPA') { teams = Nat.pickByRating('CONMEBOL', 10); teams = teams.concat(Nat.pickByRating('CONCACAF', 6)); }
    else teams = Nat.pickByRating(T.conf, T.size);
    var comp = Comp.create({ id: 'X:' + key + ':' + y, kind: 'X', nm: T.nm, y: y, teams: teams, c: null, cont: key });
    comp.spec = key; comp.label = String(y); comp.stage = 'lp'; comp.st = 0; comp.nat = true;
    var s0 = D.of(y, T.start[0], T.start[1]); comp.s0 = s0;
    var ord = natRank(teams.map(function (id) { return S.nat[id - 5000]; })).map(function (n) { return n.id; });
    var ng = T.groups, groups = []; for (var g = 0; g < ng; g++) groups.push([]);
    var potSize = ng;
    for (var i = 0; i < 4; i++) {
      var chunk = U.shuffle(ord.slice(i * potSize, (i + 1) * potSize));
      chunk.forEach(function (t, gi) { groups[gi % ng].push(t); });
    }
    // grupos con menos de 4 (tamaños no múltiplos): reparte los sobrantes
    var left = ord.slice(4 * potSize); left.forEach(function (t, i) { groups[i % ng].push(t); });
    comp.groups = groups; Comp.resetTable(comp);
    groups.forEach(function (gr, gi) { Comp.roundRobin(gr, false).forEach(function (rd, r) { rd.forEach(function (m) { Comp.addFx(comp, m[0], m[1], s0 + r, { r: r + 1, g: gi, n: 1 }); }); }); });
    comp.fx.sort(function (a, b) { return a.w - b.w; });
    comp.w0 = s0; comp.w1 = s0 + 8;
    Sim.news('Comienza la ' + T.nm + ' ' + y + '.', 'title', 3);
    return comp;
  };
  Nat.advance = function (comp, w) {
    var T = Nat.TOURN[comp.spec], s0 = comp.s0, S = FP.S;
    if (comp.stage === 'lp') {
      if (!allDone(comp)) return;
      var gr = comp.groups.map(function (g, gi) { return groupRows(comp, gi); });
      comp.gr = gr.map(function (g) { return g.map(function (r) { return r.id; }); });
      var q = [], thirds = [];
      gr.forEach(function (rows, gi) {
        q.push({ id: rows[0].id, p: 0, pts: rows[0].pts, gd: rows[0].gd, gf: rows[0].gf, g: gi });
        q.push({ id: rows[1].id, p: 1, pts: rows[1].pts, gd: rows[1].gd, gf: rows[1].gf, g: gi });
        if (rows[2]) thirds.push({ id: rows[2].id, p: 2, pts: rows[2].pts, gd: rows[2].gd, gf: rows[2].gf, g: gi });
      });
      thirds.sort(function (a, b) { return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf; });
      var all = q.concat(thirds.slice(0, T.thirds));
      all.sort(function (a, b) { return a.p - b.p || b.pts - a.pts || b.gd - a.gd || b.gf - a.gf; });
      var n = all.length, size = 2; while (size < n) size *= 2;
      var ord = Comp.bracketOrder(size), slots = ord.map(function (s) { return s <= n ? all[s - 1].id : null; });
      comp.stage = 'ko';
      var k = Math.log2(size), W = []; for (var i = 0; i < k; i++) W.push(s0 + 3 + i);
      comp.st++;
      Comp.koInit(comp, [], { slots: slots, legs: 1, finalLegs: 1, weeks: W, neutralFinal: false, neutralAll: true });
      comp.fx.forEach(function (f) { if (f.k) f.n = 1; });
      return;
    }
    if (comp.stage === 'ko') {
      comp.fx.forEach(function (f) { if (f.k && f.n == null) f.n = 1; });
      if (Comp.koAdvance(comp, w) === 'end') {
        comp.done = true;
        S.hist.champs.push({ k: 'nat', key: comp.spec, y: comp.label, ch: comp.champ, ru: comp.runner });
        Sim.news(C.tname(comp.champ) + ' se corona campeón de la ' + T.nm + ' ' + comp.label + '.', 'title', 3);
        // rendimiento histórico: pequeño bonus de rating
        var n = S.nat[comp.champ - 5000]; n.r = Math.min(95, n.r + 0.8);
        var h = S.hero;
        if (h && h.nt.caps && h.extraTeams && h.extraTeams.indexOf(comp.champ) >= 0) {
          h.trophies.push({ y: comp.label, nm: 'Campeón · ' + T.nm, club: C.tname(comp.champ), w: S.week, nt: 1 });
          FP.Hero.msg('¡Campeón con la selección en la ' + T.nm + '!', 'ok');
        }
      }
    }
  };

  // ---------- clasificatorias mundialistas ----------
  Nat.createQualifiers = function (wcYear) {
    var S = FP.S; S.natq = S.natq || {}; S.natqComps = S.natqComps || {};
    var ys = wcYear - 3;
    var wins = [];
    [ys, ys + 1, ys + 2].forEach(function (y) {
      Nat.windows(y).forEach(function (w, i) {
        var yr = y;
        if (yr === ys && i < 2) return;                 // el ciclo parte en septiembre
        if (yr === ys && i === 2) { wins.push(w); return; }
        if (yr === wcYear - 1 && false) return;
        if (i === 1 && (yr - 2028) % 4 === 0) return; // junio ocupado por Eurocopa/Copa América
        if (yr === ys + 2 && i === 4 && false) return;
        wins.push(w);
      });
    });
    var comps = [];
    ['UEFA', 'CONMEBOL', 'CAF', 'AFC', 'CONCACAF', 'OFC'].forEach(function (cf) {
      var nations = S.nat.filter(function (x) { return x.conf === cf; }).map(function (x) { return x.id; });
      var gsize = cf === 'CONMEBOL' ? 10 : cf === 'UEFA' ? 5 : cf === 'OFC' ? 4 : 5;
      var ng = Math.max(1, Math.round(nations.length / gsize));
      var sorted = natRank(nations.map(function (id) { return S.nat[id - 5000]; })).map(function (x) { return x.id; });
      var groups = []; for (var g = 0; g < ng; g++) groups.push([]);
      sorted.forEach(function (id, i) { var row = Math.floor(i / ng); groups[row % 2 ? ng - 1 - (i % ng) : i % ng].push(id); });
      groups.forEach(function (gr, gi) {
        var comp = Comp.create({ id: 'Q:' + wcYear + ':' + cf + ':' + gi, kind: 'Q', nm: 'Clasificatorias ' + cf + ' (grupo ' + (gi + 1) + ')', y: wcYear, teams: gr, c: null });
        comp.spec = 'Q'; comp.cf = cf; comp.wc = wcYear; comp.label = String(wcYear); comp.nat = true; comp.st = 0;
        Comp.resetTable(comp);
        var rds = Comp.roundRobin(gr, true);
        rds.forEach(function (rd, r) { rd.forEach(function (m) { Comp.addFx(comp, m[0], m[1], wins[Math.min(wins.length - 1, Math.floor(r * wins.length / rds.length))], { r: r + 1 }); }); });
        comp.fx.sort(function (a, b) { return a.w - b.w; });
        comp.w0 = comp.fx.length ? comp.fx[0].w : wins[0]; comp.w1 = wins[wins.length - 1];
        comps.push(comp.id);
      });
    });
    S.natqComps[wcYear] = comps;
    Sim.news('Comienzan las clasificatorias para la Copa del Mundo ' + wcYear + '.', 'title', 2);
  };
  Sim.handlers.Q = function (comp, w) {
    if (comp.done) return;
    if (Comp.pendingLeft(comp)) return;
    comp.done = true;
    var S = FP.S, wc = comp.wc;
    var ids = S.natqComps[wc];
    if (ids.every(function (id) { return !S.comps[id] || S.comps[id].done; })) Nat.closeQualifiers(wc);
  };
  Nat.closeQualifiers = function (wc) {
    var S = FP.S, q = {}, slots = { UEFA: 16, CAF: 9, AFC: 8, CONMEBOL: 6, CONCACAF: 6, OFC: 1 };
    var byCf = {};
    S.natqComps[wc].forEach(function (id) {
      var c = S.comps[id]; if (!c) return;
      var rows = Comp.rows(c);
      (byCf[c.cf] = byCf[c.cf] || []).push(rows);
    });
    Object.keys(byCf).forEach(function (cf) {
      var groups = byCf[cf], out = [], pos = 0;
      while (out.length < slots[cf] && pos < 6) {
        var layer = groups.map(function (rows) { return rows[pos]; }).filter(Boolean).sort(function (a, b) { return (b.pts / Math.max(1, b.p)) - (a.pts / Math.max(1, a.p)) || b.gd - a.gd; });
        layer.forEach(function (r) { if (out.length < slots[cf]) out.push(r.id); });
        pos++;
      }
      q[cf] = out;
    });
    S.natq[wc] = q;
    var h = S.hero, mine = h ? Nat.byCode(h.nat) : null;
    if (mine) { var cf = mine.conf; if (q[cf] && q[cf].indexOf(mine.id) >= 0) Sim.news(mine.nm + ' clasifica a la Copa del Mundo ' + wc + '.', 'title', 3); else Sim.news(mine.nm + ' queda fuera de la Copa del Mundo ' + wc + '.', 'title', 3); }
    S.natqComps[wc].forEach(function (id) { delete S.comps[id]; });
  };

  // ---------- calendario anual de selecciones y torneos de clubes ----------
  Sim.startContinental = function (initial) {
    var S = FP.S;
    S.cont = { made: {} };
    Object.keys(DEF).forEach(function (key) {
      var d = DEF[key], y = d.cal === 'euro' ? D.y0 - 1 : D.y0;
      Cont.create(key, y, true); S.cont.made[key + y] = 1;
    });
    if (D.y0 % 4 === 2) { Nat.createTournament('WC', D.y0); S.cont.made['WC' + D.y0] = 1; }     // el Mundial solo existe en años ≡ 2 (mod 4)
    S.natq = {}; S.natqComps = {};
  };
  Sim.weeklyExtra = function (w) {
    var S = FP.S, ymd = D.ymd(w), y = ymd[0], m = ymd[1], d = ymd[2];
    if (!S.cont) S.cont = { made: {} };
    var made = S.cont.made;
    function once(k, fn) { if (!made[k]) { made[k] = 1; fn(); } }
    // junio: ediciones europeas, AFC y CAF de la temporada que parte en agosto
    if (m === 5 && d <= 14) ['UCL', 'UEL', 'UECL', 'ACL', 'CAF'].forEach(function (k) { once(k + y, function () { Cont.create(k, y, false); }); });
    // diciembre: ediciones sudamericanas y de la CONCACAF del año siguiente
    if (m === 11 && d <= 14) ['LIB', 'SUD', 'CCC'].forEach(function (k) { once(k + (y + 1), function () { Cont.create(k, y + 1, false); }); });
    // enero: Mundial de Clubes y torneos de selecciones del año
    if (m === 0 && d <= 14) {
      if (Cont.cwcYear(y)) once('CWC' + y, function () { Cont.createCWC(y); });
      if (y % 4 === 2 && y >= D.y0) once('WC' + y, function () { Nat.createTournament('WC', y); });
      if (y % 4 === 3) { once('AFCON' + y, function () { Nat.createTournament('AFCON', y); }); once('ASIA' + y, function () { Nat.createTournament('ASIA', y); }); once('GOLD' + y, function () { Nat.createTournament('GOLD', y); }); }
      if (y % 4 === 0) { once('EURO' + y, function () { Nat.createTournament('EURO', y); }); once('COPA' + y, function () { Nat.createTournament('COPA', y); }); }
      // clasificatorias de la próxima Copa del Mundo (ciclo que parte en septiembre)
      if (y % 4 === 3) { var nx = y + 3; once('Q' + nx, function () { Nat.createQualifiers(nx); }); }
    }
    // limpieza de torneos continentales terminados hace más de 40 semanas
    Object.keys(S.comps).forEach(function (id) {
      var c = S.comps[id];
      if (c.kind === 'X' && c.done && c.doneAt == null) c.doneAt = w;
      if (c.kind === 'X' && c.done && w - c.doneAt > 30) delete S.comps[id];
    });
    Nat.heroWeek(w);
  };

  // ---------- convocatorias del jugador ----------
  Nat.cats = function (age) {
    var out = [];
    if (age >= 13 && age <= 15) out.push('Sub-15');
    if (age >= 15 && age <= 17) out.push('Sub-17');
    if (age >= 17 && age <= 20) out.push('Sub-20');
    if (age >= 19 && age <= 23) out.push('Sub-23');
    if (age >= 17) out.push('Absoluta');
    return out;
  };
  Nat.heroNation = function () { var h = FP.S.hero; return h ? Nat.byCode(h.nat) : null; };
  Nat.heroWeek = function (w) { /* decisiones se toman en weekStart */ };
  Nat.nationHasFixture = function (natId, w) {
    var S = FP.S, found = null;
    Object.keys(S.comps).forEach(function (id) {
      if (found) return;
      var c = S.comps[id]; if (!c.nat || c.done) return;
      for (var i = c.cp; i < c.fx.length; i++) { var f = c.fx[i]; if (f.w > w) break; if (!f.d && f.w === w && (f.h === natId || f.a === natId)) { found = c; return; } }
    });
    return found;
  };
  Nat.weekStart = function (w) {
    var S = FP.S, h = S.hero; if (!h || h.retired) return;
    h.extraTeams = [];
    var nat = Nat.heroNation(); if (!nat) return;
    var age = FP.Hero.age();
    if (h.inj && h.inj.n > 0) return;
    var fx = Nat.nationHasFixture(nat.id, w);
    var nt = h.nt;
    if (fx) {
      // convocatoria absoluta: se decide una vez por bloque (8 semanas)
      if (!nt.dec || nt.dec.until < w) {
        var thr = FP.Hero.callThreshold(nat, 'Absoluta'), d = h.ovr + (h.form - 50) * 0.03 - thr;
        var ok = age >= 17 && d >= -1 && R() < U.clamp(0.55 + d * 0.08, 0.1, 0.97);
        nt.dec = { ok: ok, until: w + 8, cat: 'Absoluta' };
        if (ok) { nt.cat = 'Absoluta'; FP.Hero.msg('¡Convocado a la selección absoluta de ' + nat.nm + '! (' + fx.nm + ')', 'ok'); }
        else if (age >= 17 && d >= -4) FP.Hero.msg('No fuiste incluido en la nómina de ' + nat.nm + ' para ' + fx.nm + '. Sigue trabajando.', 'i');
      }
      if (nt.dec.ok) { h.extraTeams = [nat.id]; }
    }
    // juveniles: amistosos en ventana
    var wins = Nat.windows(D.year(w)).concat(Nat.windows(D.year(w)));
    var inWin = Nat.windows(D.year(w)).indexOf(w) >= 0;
    if (inWin && !fx) {
      var cats = Nat.cats(age).filter(function (c) { return c !== 'Absoluta'; });
      for (var i = cats.length - 1; i >= 0; i--) {
        var cat = cats[i], thr2 = FP.Hero.callThreshold(nat, cat), d2 = h.ovr + (h.form - 50) * 0.03 - thr2;
        if (h.tk === 'amat' && d2 < 6) continue;
        if (d2 >= -1 && R() < U.clamp(0.5 + d2 * 0.07, 0.1, 0.95)) {
          nt.cat = cat;
          Nat.youthFriendly(w, nat, cat);
          FP.Hero.msg('Convocado a la selección ' + cat + ' de ' + nat.nm + '.', 'ok');
          h.extraTeams = [nat.id];
          break;
        }
      }
    }
  };
  Nat.youthFriendly = function (w, nat, cat) {
    var S = FP.S, id = 'N:' + D.year(w) + ':' + w;
    var comp = S.comps[id] || Comp.create({ id: id, kind: 'N', nm: 'Amistoso internacional ' + cat, y: D.year(w), teams: [nat.id], c: null });
    comp.nat = true; comp.stages = [{ k: 'fr' }]; comp.ys = {};
    var cands = S.nat.filter(function (x) { return x !== nat && Math.abs(x.r - nat.r) < 12; });
    var opp = U.pick(cands);
    var k = { 'Sub-15': 0.8, 'Sub-17': 0.86, 'Sub-20': 0.92, 'Sub-23': 0.96 }[cat] || 1;
    comp.ys[nat.id] = Math.round((nat.r - 6) * k - 2); comp.ys[opp.id] = Math.round((opp.r - 6) * k - 2);
    Comp.addFx(comp, R() < 0.5 ? nat.id : opp.id, R() < 0.5 ? opp.id : nat.id, w, { fr: 1, n: 0 });
    var f = comp.fx[comp.fx.length - 1]; if (f.h !== nat.id && f.a !== nat.id) { f.h = nat.id; f.a = opp.id; }
    comp.done = false;
  };
  Sim.handlers.N = function (comp, w) { if (!Comp.pendingLeft(comp) && comp.fx.length && w > comp.fx[comp.fx.length - 1].w + 1) delete FP.S.comps[comp.id]; };

  // ruido anual de rating de selecciones
  Nat.yearTick = function () {
    FP.S.nat.forEach(function (n) { var base = FP.NATBY[n.c].r; n.r = U.clamp(n.r + U.norm() * 0.9 + (base - n.r) * 0.06, 25, 96); });
  };
})();
